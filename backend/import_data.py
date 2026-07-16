"""One-shot import script.

Wipes existing business data (products, salespersons, vendors, user accounts for salespersons,
sales, collections, allocations, inventory transactions, salesperson_inventory) — keeps admin —
then imports products, salespersons, and vendors from the GPI_MASTER.xlsx file.

Usage:  python import_data.py /path/to/GPI_MASTER.xlsx
"""
import asyncio
import os
import re
import secrets
import string
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from auth import hash_password  # noqa: E402


def gen_password(n: int = 10) -> str:
    """Human-friendly random password: mixed letters + digits, no confusable chars."""
    alphabet = string.ascii_letters + string.digits
    # remove confusable
    alphabet = alphabet.translate(str.maketrans("", "", "0O1lI"))
    return "".join(secrets.choice(alphabet) for _ in range(n))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def clean_str(v) -> str:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return ""
    return str(v).strip()


def num(v, default=0):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return default
    try:
        return float(v)
    except Exception:
        return default


async def wipe(db):
    """Wipe business data. Keep admin user."""
    print("Wiping existing business data …")
    await db.products.delete_many({})
    await db.vendors.delete_many({})
    await db.salespersons.delete_many({})
    await db.users.delete_many({"role": {"$ne": "admin"}})
    await db.sales.delete_many({})
    await db.collections.delete_many({})
    await db.allocations.delete_many({})
    await db.inventory_txns.delete_many({})
    await db.salesperson_inventory.delete_many({})
    print("  ✓ wiped")


async def import_products(db, xl):
    df = pd.read_excel(xl, sheet_name="SKU LIST", header=0)
    # Normalize column names — collapse ALL whitespace to single spaces
    df.columns = [re.sub(r"\s+", " ", str(c)).strip() for c in df.columns]
    now = now_iso()
    docs = []
    for _, r in df.iterrows():
        sku = clean_str(r.get("SKU CODE"))
        name = clean_str(r.get("SKU NAME"))
        if not sku or not name:
            continue
        docs.append({
            "name": name,
            "brand": clean_str(r.get("Product Category")) or "Uncategorized",
            "sku": sku,
            "selling_price": num(r.get("MRP")),
            "commission_per_unit": num(r.get("PTR (Commission Rate)")),
            "current_stock": 0,
            "hsn_code": clean_str(r.get("HSN CODE")).replace(".0", "") or None,
            "gst_pct": num(r.get("GST%")) if not pd.isna(r.get("GST%")) else None,
            "landing_price": num(r.get("LANDING PRICE")) if not pd.isna(r.get("LANDING PRICE")) else None,
            "created_at": now,
            "updated_at": now,
        })
    if docs:
        await db.products.insert_many(docs)
    print(f"  ✓ imported {len(docs)} products")
    return len(docs)


async def import_salespersons(db, xl):
    df = pd.read_excel(xl, sheet_name="SE DETAILS", header=0)
    df.columns = [re.sub(r"\s+", " ", str(c)).strip() for c in df.columns]
    now = now_iso()
    imported = []
    for i, r in df.iterrows():
        name_raw = clean_str(r.get("SALESMAN NAME"))
        salesman_id = clean_str(r.get("SALESMAN ID"))
        route = clean_str(r.get("ROUTE NAME"))
        mobile = clean_str(r.get("MOBILE NUMBER")).split(".")[0]  # drop trailing .0
        is_pending = name_raw.lower() == "pending" or route.lower() == "pending"
        display_name = name_raw if name_raw and not is_pending else f"Pending SE ({salesman_id or i+1})"
        status = "inactive" if is_pending else "active"

        # Auto-generate email + password
        idx = i + 1
        email = f"sales{idx:02d}@dms.com"
        password = gen_password(10)
        user_doc = {
            "email": email,
            "password_hash": hash_password(password),
            "name": display_name,
            "role": "salesperson",
            "created_at": now,
        }
        user_res = await db.users.insert_one(user_doc)

        sp_doc = {
            "name": display_name,
            "mobile": mobile or "",
            "area": route or "Unassigned",
            "status": status,
            "email": email,
            "salesman_id": salesman_id or None,
            "user_id": str(user_res.inserted_id),
            "created_at": now,
        }
        sp_res = await db.salespersons.insert_one(sp_doc)
        await db.users.update_one({"_id": user_res.inserted_id}, {"$set": {"salesperson_id": str(sp_res.inserted_id)}})

        imported.append({
            "salesman_id": salesman_id,
            "name": display_name,
            "route": route,
            "mobile": mobile,
            "email": email,
            "password": password,
            "status": status,
        })
    print(f"  ✓ imported {len(imported)} salespersons")
    return imported


async def import_vendors(db, xl, sp_route_map):
    df = pd.read_excel(xl, sheet_name="CUSTOMER DATA BASE", header=0)
    df.columns = [str(c).strip() for c in df.columns]
    now = now_iso()
    docs = []
    for _, r in df.iterrows():
        name_raw = clean_str(r.iloc[0])
        if not name_raw or name_raw.lower() == "name":
            continue
        # Parse prefix like "01 ", "13 ", or "DLR ", "TSE "
        m = re.match(r"^(\d{1,2})\s+(.*)$", name_raw)
        if m:
            prefix = m.group(1).zfill(2)
            shop = m.group(2).strip()
            area = sp_route_map.get(prefix, f"Route {prefix}")
        elif name_raw.upper().startswith("DLR "):
            shop = name_raw[4:].strip()
            area = "Dealer"
        elif name_raw.upper().startswith("TSE "):
            shop = name_raw[4:].strip()
            area = "TSE"
        else:
            shop = name_raw
            area = "Unassigned"
        docs.append({
            "shop_name": shop,
            "owner_name": "",
            "mobile": "",
            "area": area,
            "address": "",
            "created_at": now,
        })
    # Insert in batches
    if docs:
        BATCH = 500
        for i in range(0, len(docs), BATCH):
            await db.vendors.insert_many(docs[i:i + BATCH])
    print(f"  ✓ imported {len(docs)} vendors")
    return len(docs)


async def write_credentials_file(salespersons):
    path = "/app/memory/test_credentials.md"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    lines = []
    lines.append("# Test Credentials\n")
    lines.append("## Admin\n")
    lines.append("- Email: `admin@dms.com`\n- Password: `admin123`\n- Role: admin\n\n")
    lines.append("## Salespersons (Auto-generated from GPI_MASTER.xlsx)\n\n")
    lines.append("| # | Salesman ID | Name | Route | Mobile | Email | Password | Status |\n")
    lines.append("|---|-------------|------|-------|--------|-------|----------|--------|\n")
    for i, s in enumerate(salespersons, 1):
        lines.append(
            f"| {i} | {s['salesman_id']} | {s['name']} | {s['route']} | {s['mobile']} | "
            f"`{s['email']}` | `{s['password']}` | {s['status']} |\n"
        )
    lines.append("\n## Auth Endpoints\n")
    lines.append("- POST `/api/auth/login`\n- POST `/api/auth/logout`\n- GET  `/api/auth/me`\n")
    with open(path, "w") as f:
        f.writelines(lines)
    print(f"  ✓ credentials written to {path}")


async def main():
    excel_path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/gpi.xlsx"
    if not os.path.exists(excel_path):
        print(f"File not found: {excel_path}")
        sys.exit(1)

    mongo_url = os.environ["MONGO_URL"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ["DB_NAME"]]

    xl = pd.ExcelFile(excel_path)
    print(f"Sheets: {xl.sheet_names}")

    await wipe(db)

    n_products = await import_products(db, xl)

    salespersons = await import_salespersons(db, xl)

    # Route map: "01" → "Munnekollal 1" ...
    # SL NO 1 -> "01" etc.
    df_sp = pd.read_excel(xl, sheet_name="SE DETAILS", header=0)
    df_sp.columns = [re.sub(r"\s+", " ", str(c)).strip() for c in df_sp.columns]
    sp_route_map = {}
    for i, r in df_sp.iterrows():
        idx = i + 1
        route = clean_str(r.get("ROUTE NAME")) or f"Route {idx:02d}"
        sp_route_map[f"{idx:02d}"] = route

    n_vendors = await import_vendors(db, xl, sp_route_map)

    await write_credentials_file(salespersons)

    print("\n=== DONE ===")
    print(f"Products      : {n_products}")
    print(f"Salespersons  : {len(salespersons)}")
    print(f"Vendors       : {n_vendors}")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
