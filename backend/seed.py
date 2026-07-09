"""Seed initial data for the Distribution Management System."""
import os
from datetime import datetime, timezone
from auth import hash_password


PRODUCTS = [
    {"name": "Classic Milds", "brand": "Classic", "sku": "CLS-MLD-20", "selling_price": 320.0, "commission_per_unit": 5.0, "current_stock": 400},
    {"name": "Classic Regular", "brand": "Classic", "sku": "CLS-REG-20", "selling_price": 340.0, "commission_per_unit": 5.5, "current_stock": 350},
    {"name": "Gold Flake Kings", "brand": "Gold Flake", "sku": "GF-KNG-20", "selling_price": 360.0, "commission_per_unit": 6.0, "current_stock": 500},
    {"name": "Gold Flake Small", "brand": "Gold Flake", "sku": "GF-SML-10", "selling_price": 180.0, "commission_per_unit": 3.0, "current_stock": 600},
    {"name": "Wills Navy Cut", "brand": "Wills", "sku": "WL-NVY-20", "selling_price": 300.0, "commission_per_unit": 4.5, "current_stock": 450},
    {"name": "Wills Flake", "brand": "Wills", "sku": "WL-FLK-10", "selling_price": 160.0, "commission_per_unit": 2.5, "current_stock": 700},
    {"name": "Marlboro Red", "brand": "Marlboro", "sku": "MB-RED-20", "selling_price": 420.0, "commission_per_unit": 8.0, "current_stock": 250},
    {"name": "Marlboro Gold", "brand": "Marlboro", "sku": "MB-GLD-20", "selling_price": 420.0, "commission_per_unit": 8.0, "current_stock": 200},
    {"name": "Four Square", "brand": "Four Square", "sku": "FS-REG-20", "selling_price": 280.0, "commission_per_unit": 4.0, "current_stock": 550},
    {"name": "Navy Cut Deluxe", "brand": "Wills", "sku": "WL-DLX-20", "selling_price": 380.0, "commission_per_unit": 6.5, "current_stock": 300},
]

AREAS = [
    "T Nagar", "Anna Nagar", "Adyar", "Velachery", "Mylapore",
    "Nungambakkam", "Egmore", "Thiruvanmiyur", "Kilpauk", "Guindy",
    "Perambur", "Royapettah", "Alwarpet", "Besant Nagar",
]

SALESPERSONS = [
    {"name": "Rajesh Kumar", "area": "T Nagar"},
    {"name": "Suresh Babu", "area": "Anna Nagar"},
    {"name": "Vikram Iyer", "area": "Adyar"},
    {"name": "Karthik Raja", "area": "Velachery"},
    {"name": "Manoj Prakash", "area": "Mylapore"},
    {"name": "Deepak Menon", "area": "Nungambakkam"},
    {"name": "Arun Krishnan", "area": "Egmore"},
    {"name": "Prakash Reddy", "area": "Thiruvanmiyur"},
    {"name": "Ganesh Rao", "area": "Kilpauk"},
    {"name": "Ravi Shankar", "area": "Guindy"},
    {"name": "Naveen Kumar", "area": "Perambur"},
    {"name": "Sanjay Verma", "area": "Royapettah"},
    {"name": "Anil Nair", "area": "Alwarpet"},
    {"name": "Mohan Das", "area": "Besant Nagar"},
]

VENDOR_PREFIXES = [
    "Sri", "Sree", "New", "Royal", "Star", "Krishna", "Ganesh",
    "Bharath", "Ashok", "Lakshmi", "Anand", "Guru", "Amma", "Balaji",
]
VENDOR_SUFFIXES = [
    "Stores", "Traders", "Shop", "Kirana", "Enterprises",
    "Provisions", "Mini Mart", "Departmental",
]


async def seed_data(db):
    # Admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@dms.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    now = datetime.now(timezone.utc).isoformat()

    existing_admin = await db.users.find_one({"email": admin_email})
    if not existing_admin:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "created_at": now,
        })
    else:
        if not existing_admin.get("password_hash") or not existing_admin.get("password_hash", "").startswith("$2"):
            await db.users.update_one(
                {"_id": existing_admin["_id"]},
                {"$set": {"password_hash": hash_password(admin_password)}}
            )

    # Products
    if await db.products.count_documents({}) == 0:
        for p in PRODUCTS:
            await db.products.insert_one({**p, "created_at": now, "updated_at": now})

    # Salespersons + user accounts
    if await db.salespersons.count_documents({}) == 0:
        for i, sp in enumerate(SALESPERSONS, start=1):
            email = f"sales{i}@dms.com"
            sp_doc = {
                "name": sp["name"],
                "mobile": f"98{1000000 + i * 12345}"[:10],
                "area": sp["area"],
                "status": "active",
                "email": email,
                "created_at": now,
            }
            result = await db.salespersons.insert_one(sp_doc)
            user = {
                "email": email,
                "password_hash": hash_password("sales123"),
                "name": sp["name"],
                "role": "salesperson",
                "salesperson_id": str(result.inserted_id),
                "created_at": now,
            }
            user_res = await db.users.insert_one(user)
            await db.salespersons.update_one(
                {"_id": result.inserted_id},
                {"$set": {"user_id": str(user_res.inserted_id)}}
            )

    # Vendors (50)
    if await db.vendors.count_documents({}) == 0:
        idx = 0
        vendors = []
        for pref in VENDOR_PREFIXES:
            for suf in VENDOR_SUFFIXES:
                idx += 1
                if idx > 50:
                    break
                vendors.append({
                    "shop_name": f"{pref} {suf}",
                    "owner_name": f"Owner {idx}",
                    "mobile": f"90{2000000 + idx * 4321}"[:10],
                    "area": AREAS[idx % len(AREAS)],
                    "address": f"{idx * 3} Main Rd, {AREAS[idx % len(AREAS)]}",
                    "created_at": now,
                })
            if idx > 50:
                break
        await db.vendors.insert_many(vendors[:50])

    # Write test credentials file
    try:
        os.makedirs("/app/memory", exist_ok=True)
        with open("/app/memory/test_credentials.md", "w") as f:
            f.write("# Test Credentials\n\n")
            f.write("## Admin\n")
            f.write(f"- Email: `{admin_email}`\n- Password: `{admin_password}`\n- Role: admin\n\n")
            f.write("## Salesperson (Test User)\n")
            f.write("- Email: `sales1@dms.com`\n- Password: `sales123`\n- Role: salesperson\n\n")
            f.write("## Auth Endpoints\n")
            f.write("- POST `/api/auth/login`\n- POST `/api/auth/logout`\n- GET `/api/auth/me`\n")
    except Exception:
        pass
