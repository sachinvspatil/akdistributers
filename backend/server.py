"""Distribution Management System - FastAPI backend."""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import io
import logging
from datetime import datetime, timezone, date
from typing import Optional, List
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Response, Request, Query
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from pydantic import BaseModel, EmailStr

from auth import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    set_auth_cookies, clear_auth_cookies,
    get_current_user, require_admin,
)
from models import (
    ProductIn, SalespersonIn, SalespersonUpdate, VendorIn,
    InventoryTxnIn, AllocationIn, SaleIn, CollectionIn, LoginBody,
)
from seed import seed_data


# ---------- Setup ----------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="DMS API")
app.state.db = db

api = APIRouter(prefix="/api")


# ---------- Helpers ----------
def today_str() -> str:
    return date.today().isoformat()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")


def serialize(doc: dict) -> dict:
    if not doc:
        return doc
    doc = dict(doc)
    if "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    return doc


async def _get_product(product_id: str) -> dict:
    p = await db.products.find_one({"_id": oid(product_id)})
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return p


async def _get_salesperson(sp_id: str) -> dict:
    sp = await db.salespersons.find_one({"_id": oid(sp_id)})
    if not sp:
        raise HTTPException(status_code=404, detail="Salesperson not found")
    return sp


async def _get_vendor(v_id: str) -> dict:
    v = await db.vendors.find_one({"_id": oid(v_id)})
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return v


# ---------- Auth Routes ----------
@api.post("/auth/login")
async def login(body: LoginBody, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    uid = str(user["_id"])
    access = create_access_token(uid, email, user["role"])
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return {
        "id": uid,
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "salesperson_id": user.get("salesperson_id"),
        "access_token": access,
    }


@api.post("/auth/logout")
async def logout(response: Response, _: dict = Depends(get_current_user)):
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------- Products ----------
@api.get("/products")
async def list_products(user: dict = Depends(get_current_user), category: Optional[str] = None, q: Optional[str] = None):
    query = {}
    if category and category != "all":
        query["brand"] = category
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"sku": {"$regex": q, "$options": "i"}},
        ]
    docs = await db.products.find(query).sort("name", 1).to_list(2000)
    return [serialize(d) for d in docs]


@api.post("/products")
async def create_product(body: ProductIn, _: dict = Depends(require_admin)):
    if await db.products.find_one({"sku": body.sku}):
        raise HTTPException(status_code=400, detail="SKU already exists")
    now = now_iso()
    doc = body.model_dump()
    doc.update({"created_at": now, "updated_at": now})
    result = await db.products.insert_one(doc)
    if body.current_stock > 0:
        await db.inventory_txns.insert_one({
            "product_id": str(result.inserted_id),
            "type": "stock_added",
            "quantity": body.current_stock,
            "salesperson_id": None,
            "note": "Initial stock",
            "created_at": now,
        })
    return serialize(await db.products.find_one({"_id": result.inserted_id}))


@api.put("/products/{product_id}")
async def update_product(product_id: str, body: ProductIn, _: dict = Depends(require_admin)):
    p = await _get_product(product_id)
    existing_sku = await db.products.find_one({"sku": body.sku, "_id": {"$ne": p["_id"]}})
    if existing_sku:
        raise HTTPException(status_code=400, detail="SKU already exists")
    now = now_iso()
    update = body.model_dump()
    update["updated_at"] = now
    # Track stock diff as an inventory txn if changed
    diff = body.current_stock - p.get("current_stock", 0)
    await db.products.update_one({"_id": p["_id"]}, {"$set": update})
    if diff != 0:
        await db.inventory_txns.insert_one({
            "product_id": product_id,
            "type": "stock_added" if diff > 0 else "stock_returned",
            "quantity": abs(diff),
            "salesperson_id": None,
            "note": "Manual stock adjustment",
            "created_at": now,
        })
    return serialize(await db.products.find_one({"_id": p["_id"]}))


@api.delete("/products/{product_id}")
async def delete_product(product_id: str, _: dict = Depends(require_admin)):
    p = await _get_product(product_id)
    await db.products.delete_one({"_id": p["_id"]})
    return {"ok": True}


# ---------- Salespersons ----------
@api.get("/salespersons")
async def list_salespersons(user: dict = Depends(get_current_user)):
    docs = await db.salespersons.find({}).sort("name", 1).to_list(1000)
    return [serialize(d) for d in docs]


@api.post("/salespersons")
async def create_salesperson(body: SalespersonIn, _: dict = Depends(require_admin)):
    now = now_iso()
    doc = {
        "name": body.name,
        "mobile": body.mobile,
        "area": body.area,
        "status": body.status or "active",
        "email": (body.email or "").lower() or None,
        "salesman_id": body.salesman_id,
        "created_at": now,
    }
    result = await db.salespersons.insert_one(doc)
    sp_id = str(result.inserted_id)
    if body.email and body.password:
        if await db.users.find_one({"email": body.email.lower()}):
            raise HTTPException(status_code=400, detail="User email already exists")
        user_res = await db.users.insert_one({
            "email": body.email.lower(),
            "password_hash": hash_password(body.password),
            "name": body.name,
            "role": "salesperson",
            "salesperson_id": sp_id,
            "created_at": now,
        })
        await db.salespersons.update_one({"_id": result.inserted_id}, {"$set": {"user_id": str(user_res.inserted_id)}})
    return serialize(await db.salespersons.find_one({"_id": result.inserted_id}))


@api.put("/salespersons/{sp_id}")
async def update_salesperson(sp_id: str, body: SalespersonUpdate, _: dict = Depends(require_admin)):
    sp = await _get_salesperson(sp_id)
    update = {k: v for k, v in body.model_dump(exclude_none=True).items() if k != "password"}
    if body.email is not None:
        update["email"] = body.email.lower()
    if update:
        await db.salespersons.update_one({"_id": sp["_id"]}, {"$set": update})
    if body.password and sp.get("user_id"):
        await db.users.update_one(
            {"_id": oid(sp["user_id"])},
            {"$set": {"password_hash": hash_password(body.password)}},
        )
    if (body.email or body.name) and sp.get("user_id"):
        u_update = {}
        if body.email is not None:
            u_update["email"] = body.email.lower()
        if body.name is not None:
            u_update["name"] = body.name
        if u_update:
            await db.users.update_one({"_id": oid(sp["user_id"])}, {"$set": u_update})
    return serialize(await db.salespersons.find_one({"_id": sp["_id"]}))


@api.delete("/salespersons/{sp_id}")
async def disable_salesperson(sp_id: str, _: dict = Depends(require_admin)):
    sp = await _get_salesperson(sp_id)
    await db.salespersons.update_one({"_id": sp["_id"]}, {"$set": {"status": "inactive"}})
    return {"ok": True}


# ---------- Vendors ----------
@api.get("/vendors")
async def list_vendors(
    user: dict = Depends(get_current_user),
    area: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 5000,
):
    query = {}
    if area:
        query["area"] = area
    if q:
        query["$or"] = [
            {"shop_name": {"$regex": q, "$options": "i"}},
            {"owner_name": {"$regex": q, "$options": "i"}},
            {"area": {"$regex": q, "$options": "i"}},
        ]
    docs = await db.vendors.find(query).sort("shop_name", 1).to_list(limit)
    return [serialize(d) for d in docs]


@api.get("/my-vendors")
async def my_vendors(user: dict = Depends(get_current_user), q: Optional[str] = None):
    """Vendors belonging to the current salesperson's route/area."""
    if user.get("role") != "salesperson":
        raise HTTPException(status_code=403, detail="Salesperson only")
    sp_id = user.get("salesperson_id")
    sp = await db.salespersons.find_one({"_id": oid(sp_id)}) if sp_id else None
    if not sp:
        raise HTTPException(status_code=404, detail="Salesperson not found")
    query = {"area": sp["area"]}
    if q:
        query["$and"] = [
            query.copy(),
            {"$or": [{"shop_name": {"$regex": q, "$options": "i"}}, {"owner_name": {"$regex": q, "$options": "i"}}]},
        ]
    docs = await db.vendors.find(query).sort("shop_name", 1).to_list(5000)
    return [serialize(d) for d in docs]


@api.post("/vendors")
async def create_vendor(body: VendorIn, _: dict = Depends(require_admin)):
    doc = body.model_dump()
    doc["created_at"] = now_iso()
    result = await db.vendors.insert_one(doc)
    return serialize(await db.vendors.find_one({"_id": result.inserted_id}))


@api.put("/vendors/{v_id}")
async def update_vendor(v_id: str, body: VendorIn, _: dict = Depends(require_admin)):
    v = await _get_vendor(v_id)
    await db.vendors.update_one({"_id": v["_id"]}, {"$set": body.model_dump()})
    return serialize(await db.vendors.find_one({"_id": v["_id"]}))


@api.delete("/vendors/{v_id}")
async def delete_vendor(v_id: str, _: dict = Depends(require_admin)):
    v = await _get_vendor(v_id)
    await db.vendors.delete_one({"_id": v["_id"]})
    return {"ok": True}


@api.get("/vendors/{v_id}/history")
async def vendor_history(v_id: str, user: dict = Depends(get_current_user)):
    v = await _get_vendor(v_id)
    sales = await db.sales.find({"vendor_id": v_id}).sort("created_at", -1).to_list(500)
    collections = await db.collections.find({"vendor_id": v_id}).sort("created_at", -1).to_list(500)
    total_sales = sum(s["sale_value"] for s in sales)
    total_paid = sum(c["amount"] for c in collections)
    return {
        "vendor": serialize(v),
        "sales": [serialize(s) for s in sales],
        "collections": [serialize(c) for c in collections],
        "total_sales": total_sales,
        "total_paid": total_paid,
        "outstanding": total_sales - total_paid,
    }


# ---------- Inventory (Godown) ----------
@api.get("/inventory/transactions")
async def list_inventory_txns(user: dict = Depends(get_current_user), limit: int = 200):
    txns = await db.inventory_txns.find({}).sort("created_at", -1).to_list(limit)
    # enrich
    product_ids = {t["product_id"] for t in txns if t.get("product_id")}
    sp_ids = {t.get("salesperson_id") for t in txns if t.get("salesperson_id")}
    products = {str(p["_id"]): p for p in await db.products.find({"_id": {"$in": [oid(i) for i in product_ids]}}).to_list(1000)}
    salespersons = {str(s["_id"]): s for s in await db.salespersons.find({"_id": {"$in": [oid(i) for i in sp_ids if i]}}).to_list(1000)} if sp_ids else {}
    out = []
    for t in txns:
        t2 = serialize(t)
        t2["product_name"] = products.get(t["product_id"], {}).get("name")
        if t.get("salesperson_id"):
            t2["salesperson_name"] = salespersons.get(t["salesperson_id"], {}).get("name")
        out.append(t2)
    return out


@api.post("/inventory/transactions")
async def add_inventory_txn(body: InventoryTxnIn, _: dict = Depends(require_admin)):
    p = await _get_product(body.product_id)
    if body.type not in ("stock_added", "stock_returned"):
        raise HTTPException(status_code=400, detail="Use allocation endpoint for allocations")
    inc = body.quantity if body.type == "stock_added" else body.quantity
    await db.products.update_one({"_id": p["_id"]}, {"$inc": {"current_stock": inc}})
    doc = body.model_dump()
    doc["created_at"] = now_iso()
    await db.inventory_txns.insert_one(doc)
    return {"ok": True}


# ---------- Stock Allocations ----------
@api.get("/allocations")
async def list_allocations(user: dict = Depends(get_current_user), date_filter: Optional[str] = Query(None, alias="date"), salesperson_id: Optional[str] = None):
    q = {}
    if date_filter:
        q["date"] = date_filter
    if salesperson_id:
        q["salesperson_id"] = salesperson_id
    elif user.get("role") == "salesperson":
        q["salesperson_id"] = user.get("salesperson_id")
    allocs = await db.allocations.find(q).sort("created_at", -1).to_list(1000)
    product_ids = {a["product_id"] for a in allocs}
    sp_ids = {a["salesperson_id"] for a in allocs}
    products = {str(p["_id"]): p for p in await db.products.find({"_id": {"$in": [oid(i) for i in product_ids]}}).to_list(1000)} if product_ids else {}
    salespersons = {str(s["_id"]): s for s in await db.salespersons.find({"_id": {"$in": [oid(i) for i in sp_ids]}}).to_list(1000)} if sp_ids else {}
    out = []
    for a in allocs:
        a2 = serialize(a)
        a2["product_name"] = products.get(a["product_id"], {}).get("name")
        a2["salesperson_name"] = salespersons.get(a["salesperson_id"], {}).get("name")
        out.append(a2)
    return out


@api.post("/allocations")
async def create_allocation(body: AllocationIn, _: dict = Depends(require_admin)):
    p = await _get_product(body.product_id)
    sp = await _get_salesperson(body.salesperson_id)
    if p.get("current_stock", 0) < body.quantity:
        raise HTTPException(status_code=400, detail=f"Insufficient stock (available: {p.get('current_stock', 0)})")
    d = body.date or today_str()
    now = now_iso()
    # Reduce godown stock
    await db.products.update_one({"_id": p["_id"]}, {"$inc": {"current_stock": -body.quantity}})
    # Add to salesperson inventory
    await db.salesperson_inventory.update_one(
        {"salesperson_id": body.salesperson_id, "product_id": body.product_id, "date": d},
        {"$inc": {"quantity": body.quantity}, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    # Log allocation
    result = await db.allocations.insert_one({
        "salesperson_id": body.salesperson_id,
        "product_id": body.product_id,
        "quantity": body.quantity,
        "date": d,
        "created_at": now,
    })
    # Inventory transaction
    await db.inventory_txns.insert_one({
        "product_id": body.product_id,
        "type": "stock_allocated",
        "quantity": body.quantity,
        "salesperson_id": body.salesperson_id,
        "note": f"Allocated on {d}",
        "created_at": now,
    })
    return {"ok": True, "id": str(result.inserted_id)}


@api.get("/my-inventory")
async def my_inventory(user: dict = Depends(get_current_user), date_filter: Optional[str] = Query(None, alias="date")):
    if user.get("role") == "salesperson":
        sp_id = user.get("salesperson_id")
    else:
        sp_id = None
    if not sp_id:
        raise HTTPException(status_code=400, detail="Not a salesperson account")
    d = date_filter or today_str()
    # Aggregate allocations - sales for that date
    alloc_docs = await db.salesperson_inventory.find({"salesperson_id": sp_id, "date": d}).to_list(1000)
    # Sold quantities
    sales = await db.sales.find({"salesperson_id": sp_id, "date": d}).to_list(1000)
    sold_map = {}
    for s in sales:
        sold_map[s["product_id"]] = sold_map.get(s["product_id"], 0) + s["quantity"]
    # Products for names
    pids = [oid(a["product_id"]) for a in alloc_docs]
    prods = {str(p["_id"]): p for p in await db.products.find({"_id": {"$in": pids}}).to_list(1000)} if pids else {}
    out = []
    for a in alloc_docs:
        prod = prods.get(a["product_id"], {})
        allocated = a["quantity"]
        sold = sold_map.get(a["product_id"], 0)
        out.append({
            "product_id": a["product_id"],
            "product_name": prod.get("name"),
            "brand": prod.get("brand"),
            "sku": prod.get("sku"),
            "selling_price": prod.get("selling_price", 0),
            "commission_per_unit": prod.get("commission_per_unit", 0),
            "allocated": allocated,
            "sold": sold,
            "remaining": allocated - sold,
        })
    return out


# ---------- Sales ----------
@api.get("/sales")
async def list_sales(
    user: dict = Depends(get_current_user),
    date_filter: Optional[str] = Query(None, alias="date"),
    salesperson_id: Optional[str] = None,
    vendor_id: Optional[str] = None,
    product_id: Optional[str] = None,
):
    q = {}
    if date_filter:
        q["date"] = date_filter
    if vendor_id:
        q["vendor_id"] = vendor_id
    if product_id:
        q["product_id"] = product_id
    if user.get("role") == "salesperson":
        q["salesperson_id"] = user.get("salesperson_id")
    elif salesperson_id:
        q["salesperson_id"] = salesperson_id
    sales = await db.sales.find(q).sort("created_at", -1).to_list(2000)
    return [serialize(s) for s in sales]


@api.post("/sales")
async def create_sale(body: SaleIn, user: dict = Depends(get_current_user)):
    role = user.get("role")
    sp_id = user.get("salesperson_id") if role == "salesperson" else body.salesperson_id
    if not sp_id:
        raise HTTPException(status_code=400, detail="salesperson_id required")
    sp = await _get_salesperson(sp_id)
    vendor = await _get_vendor(body.vendor_id)
    product = await _get_product(body.product_id)

    d = body.date or today_str()

    # Check salesperson has enough stock
    inv = await db.salesperson_inventory.find_one({"salesperson_id": sp_id, "product_id": body.product_id, "date": d})
    allocated = inv["quantity"] if inv else 0
    sold_agg = await db.sales.aggregate([
        {"$match": {"salesperson_id": sp_id, "product_id": body.product_id, "date": d}},
        {"$group": {"_id": None, "total": {"$sum": "$quantity"}}},
    ]).to_list(1)
    already_sold = sold_agg[0]["total"] if sold_agg else 0
    remaining = allocated - already_sold
    if body.quantity > remaining:
        raise HTTPException(status_code=400, detail=f"Only {remaining} unit(s) remaining for this product today")

    unit_price = product["selling_price"]
    commission_rate = product.get("commission_per_unit", 0)
    sale_value = unit_price * body.quantity
    commission = commission_rate * body.quantity

    now = now_iso()
    doc = {
        "vendor_id": body.vendor_id,
        "vendor_name": vendor["shop_name"],
        "product_id": body.product_id,
        "product_name": product["name"],
        "salesperson_id": sp_id,
        "salesperson_name": sp["name"],
        "quantity": body.quantity,
        "unit_price": unit_price,
        "sale_value": sale_value,
        "commission": commission,
        "date": d,
        "created_at": now,
    }
    result = await db.sales.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


# ---------- Collections ----------
@api.get("/collections")
async def list_collections(
    user: dict = Depends(get_current_user),
    date_filter: Optional[str] = Query(None, alias="date"),
    salesperson_id: Optional[str] = None,
    vendor_id: Optional[str] = None,
):
    q = {}
    if date_filter:
        q["date"] = date_filter
    if vendor_id:
        q["vendor_id"] = vendor_id
    if user.get("role") == "salesperson":
        q["salesperson_id"] = user.get("salesperson_id")
    elif salesperson_id:
        q["salesperson_id"] = salesperson_id
    docs = await db.collections.find(q).sort("created_at", -1).to_list(2000)
    return [serialize(c) for c in docs]


@api.post("/collections")
async def create_collection(body: CollectionIn, user: dict = Depends(get_current_user)):
    role = user.get("role")
    sp_id = user.get("salesperson_id") if role == "salesperson" else body.salesperson_id
    if not sp_id:
        raise HTTPException(status_code=400, detail="salesperson_id required")
    sp = await _get_salesperson(sp_id)
    vendor = await _get_vendor(body.vendor_id)
    d = body.date or today_str()
    doc = {
        "vendor_id": body.vendor_id,
        "vendor_name": vendor["shop_name"],
        "salesperson_id": sp_id,
        "salesperson_name": sp["name"],
        "amount": body.amount,
        "payment_mode": body.payment_mode,
        "note": body.note,
        "date": d,
        "created_at": now_iso(),
    }
    result = await db.collections.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


# ---------- Dashboard ----------
@api.get("/dashboard/admin")
async def admin_dashboard(_: dict = Depends(require_admin)):
    today = today_str()
    products = await db.products.find({}).to_list(1000)
    total_stock = sum(p.get("current_stock", 0) for p in products)

    today_sales_agg = await db.sales.aggregate([
        {"$match": {"date": today}},
        {"$group": {"_id": None, "total": {"$sum": "$sale_value"}, "qty": {"$sum": "$quantity"}}},
    ]).to_list(1)
    today_sales = today_sales_agg[0]["total"] if today_sales_agg else 0
    today_qty = today_sales_agg[0]["qty"] if today_sales_agg else 0

    today_coll_agg = await db.collections.aggregate([
        {"$match": {"date": today}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)
    today_collections = today_coll_agg[0]["total"] if today_coll_agg else 0

    total_vendors = await db.vendors.count_documents({})
    total_salespersons = await db.salespersons.count_documents({"status": "active"})

    top_products = await db.sales.aggregate([
        {"$group": {"_id": {"product_id": "$product_id", "product_name": "$product_name"}, "qty": {"$sum": "$quantity"}, "value": {"$sum": "$sale_value"}}},
        {"$sort": {"qty": -1}},
        {"$limit": 5},
    ]).to_list(5)
    top_products = [{
        "product_id": t["_id"]["product_id"],
        "product_name": t["_id"]["product_name"],
        "qty": t["qty"],
        "value": t["value"],
    } for t in top_products]

    # 7-day sales trend
    from datetime import timedelta as _td
    days = []
    for i in range(6, -1, -1):
        d = (date.today() - _td(days=i)).isoformat()
        agg = await db.sales.aggregate([
            {"$match": {"date": d}},
            {"$group": {"_id": None, "total": {"$sum": "$sale_value"}}},
        ]).to_list(1)
        days.append({"date": d, "sales": agg[0]["total"] if agg else 0})

    return {
        "total_stock": total_stock,
        "today_sales": today_sales,
        "today_qty": today_qty,
        "today_collections": today_collections,
        "total_vendors": total_vendors,
        "total_salespersons": total_salespersons,
        "top_products": top_products,
        "sales_trend_7d": days,
    }


@api.get("/dashboard/salesperson")
async def salesperson_dashboard(user: dict = Depends(get_current_user)):
    sp_id = user.get("salesperson_id")
    if not sp_id:
        raise HTTPException(status_code=403, detail="Salesperson only")
    today = today_str()
    inventory = await my_inventory(user=user, date_filter=today)
    opening_stock = sum(i["allocated"] for i in inventory)
    sold_qty = sum(i["sold"] for i in inventory)
    remaining = sum(i["remaining"] for i in inventory)
    sales_agg = await db.sales.aggregate([
        {"$match": {"salesperson_id": sp_id, "date": today}},
        {"$group": {"_id": None, "sales": {"$sum": "$sale_value"}, "commission": {"$sum": "$commission"}}},
    ]).to_list(1)
    coll_agg = await db.collections.aggregate([
        {"$match": {"salesperson_id": sp_id, "date": today}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)
    return {
        "opening_stock": opening_stock,
        "sold_qty": sold_qty,
        "remaining_stock": remaining,
        "today_sales": sales_agg[0]["sales"] if sales_agg else 0,
        "commission": sales_agg[0]["commission"] if sales_agg else 0,
        "today_collections": coll_agg[0]["total"] if coll_agg else 0,
        "inventory": inventory,
    }


# ---------- Reports ----------
async def _report_data(kind: str, date_filter: Optional[str] = None):
    """Returns (columns, rows, title) for the given report kind."""
    if kind == "daily_sales":
        d = date_filter or today_str()
        sales = await db.sales.find({"date": d}).sort("created_at", -1).to_list(5000)
        cols = ["Date", "Salesperson", "Vendor", "Product", "Qty", "Unit Price", "Sale Value"]
        rows = [[s["date"], s.get("salesperson_name", ""), s.get("vendor_name", ""), s.get("product_name", ""), s["quantity"], s["unit_price"], s["sale_value"]] for s in sales]
        title = f"Daily Sales Report - {d}"
    elif kind == "salesperson_performance":
        pipeline = [
            {"$group": {"_id": {"id": "$salesperson_id", "name": "$salesperson_name"}, "qty": {"$sum": "$quantity"}, "sales": {"$sum": "$sale_value"}, "commission": {"$sum": "$commission"}}},
            {"$sort": {"sales": -1}},
        ]
        if date_filter:
            pipeline.insert(0, {"$match": {"date": date_filter}})
        data = await db.sales.aggregate(pipeline).to_list(500)
        cols = ["Salesperson", "Total Qty", "Total Sales", "Commission Earned"]
        rows = [[d["_id"]["name"], d["qty"], d["sales"], d["commission"]] for d in data]
        title = "Salesperson Performance Report"
    elif kind == "product_sales":
        pipeline = [
            {"$group": {"_id": {"id": "$product_id", "name": "$product_name"}, "qty": {"$sum": "$quantity"}, "sales": {"$sum": "$sale_value"}}},
            {"$sort": {"qty": -1}},
        ]
        if date_filter:
            pipeline.insert(0, {"$match": {"date": date_filter}})
        data = await db.sales.aggregate(pipeline).to_list(500)
        cols = ["Product", "Total Qty Sold", "Total Sales Value"]
        rows = [[d["_id"]["name"], d["qty"], d["sales"]] for d in data]
        title = "Product-wise Sales Report"
    elif kind == "vendor_outstanding":
        vendors = await db.vendors.find({}).to_list(2000)
        rows = []
        for v in vendors:
            vid = str(v["_id"])
            s_agg = await db.sales.aggregate([{"$match": {"vendor_id": vid}}, {"$group": {"_id": None, "t": {"$sum": "$sale_value"}}}]).to_list(1)
            c_agg = await db.collections.aggregate([{"$match": {"vendor_id": vid}}, {"$group": {"_id": None, "t": {"$sum": "$amount"}}}]).to_list(1)
            sales_v = s_agg[0]["t"] if s_agg else 0
            paid = c_agg[0]["t"] if c_agg else 0
            outstanding = sales_v - paid
            if outstanding > 0 or sales_v > 0:
                rows.append([v["shop_name"], v["area"], sales_v, paid, outstanding])
        cols = ["Vendor", "Area", "Total Sales", "Collected", "Outstanding"]
        rows.sort(key=lambda r: r[4], reverse=True)
        title = "Vendor Outstanding Report"
    elif kind == "collections":
        q = {}
        if date_filter:
            q["date"] = date_filter
        coll = await db.collections.find(q).sort("created_at", -1).to_list(5000)
        cols = ["Date", "Vendor", "Salesperson", "Amount", "Payment Mode"]
        rows = [[c["date"], c.get("vendor_name", ""), c.get("salesperson_name", ""), c["amount"], c["payment_mode"]] for c in coll]
        title = "Collection Report"
    else:
        raise HTTPException(status_code=400, detail="Unknown report kind")
    return cols, rows, title


@api.get("/reports/{kind}")
async def get_report(kind: str, date_filter: Optional[str] = Query(None, alias="date"), _: dict = Depends(require_admin)):
    cols, rows, title = await _report_data(kind, date_filter)
    return {"title": title, "columns": cols, "rows": rows}


@api.get("/reports/{kind}/export")
async def export_report(kind: str, format: str = "xlsx", date_filter: Optional[str] = Query(None, alias="date"), _: dict = Depends(require_admin)):
    cols, rows, title = await _report_data(kind, date_filter)
    if format == "xlsx":
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.title = kind[:30]
        ws.append([title])
        ws.append([])
        ws.append(cols)
        for r in rows:
            ws.append(r)
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{kind}.xlsx"'},
        )
    elif format == "pdf":
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=landscape(A4))
        styles = getSampleStyleSheet()
        elements = [Paragraph(title, styles["Title"]), Spacer(1, 12)]
        table_data = [cols] + [[str(x) for x in r] for r in rows]
        t = Table(table_data, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A8A")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#CBD5E1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F1F5F9")]),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
        ]))
        elements.append(t)
        doc.build(elements)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{kind}.pdf"'},
        )
    else:
        raise HTTPException(status_code=400, detail="format must be xlsx or pdf")


# ---------- EOD Summary ----------
@api.get("/eod-summary")
async def eod_summary(
    user: dict = Depends(get_current_user),
    date_filter: Optional[str] = Query(None, alias="date"),
    salesperson_id: Optional[str] = None,
):
    d = date_filter or today_str()
    if user.get("role") == "salesperson":
        sp_ids = [user.get("salesperson_id")]
    elif salesperson_id:
        sp_ids = [salesperson_id]
    else:
        sps = await db.salespersons.find({}).to_list(1000)
        sp_ids = [str(s["_id"]) for s in sps]

    result = []
    sp_docs = {str(s["_id"]): s for s in await db.salespersons.find({"_id": {"$in": [oid(i) for i in sp_ids]}}).to_list(1000)}
    for sp_id in sp_ids:
        alloc_docs = await db.salesperson_inventory.find({"salesperson_id": sp_id, "date": d}).to_list(1000)
        opening = sum(a["quantity"] for a in alloc_docs)
        sales_agg = await db.sales.aggregate([
            {"$match": {"salesperson_id": sp_id, "date": d}},
            {"$group": {"_id": None, "qty": {"$sum": "$quantity"}, "sales": {"$sum": "$sale_value"}, "commission": {"$sum": "$commission"}}},
        ]).to_list(1)
        coll_agg = await db.collections.aggregate([
            {"$match": {"salesperson_id": sp_id, "date": d}},
            {"$group": {"_id": None, "t": {"$sum": "$amount"}}},
        ]).to_list(1)
        sold = sales_agg[0]["qty"] if sales_agg else 0
        result.append({
            "salesperson_id": sp_id,
            "salesperson_name": sp_docs.get(sp_id, {}).get("name", ""),
            "opening_stock": opening,
            "sold_qty": sold,
            "remaining_stock": opening - sold,
            "sales_value": sales_agg[0]["sales"] if sales_agg else 0,
            "commission_earned": sales_agg[0]["commission"] if sales_agg else 0,
            "collection_amount": coll_agg[0]["t"] if coll_agg else 0,
        })
    return {"date": d, "rows": result}


# ---------- App wiring ----------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.products.create_index("sku", unique=True)
    await db.salesperson_inventory.create_index([("salesperson_id", 1), ("product_id", 1), ("date", 1)])
    await db.sales.create_index([("salesperson_id", 1), ("date", 1)])
    await db.collections.create_index([("salesperson_id", 1), ("date", 1)])
    await seed_data(db)
    logger.info("DMS API started; seed done.")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
