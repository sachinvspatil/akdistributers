"""End-to-end backend API tests for the Distribution Management System (DMS)."""
import os
import io
import uuid
import pytest
import requests
from datetime import date

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to frontend/.env value at test time
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

ADMIN_EMAIL = "admin@dms.com"
ADMIN_PASSWORD = "admin123"
SP_EMAIL = "sales1@dms.com"
SP_PASSWORD = "sales123"
TODAY = date.today().isoformat()


# -------- Fixtures --------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    s.headers.update({"Authorization": f"Bearer {data['access_token']}"})
    s._user = data
    return s


@pytest.fixture(scope="session")
def sp_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": SP_EMAIL, "password": SP_PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    s.headers.update({"Authorization": f"Bearer {data['access_token']}"})
    s._user = data
    return s


@pytest.fixture(scope="session")
def sample_product(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/products")
    assert r.status_code == 200
    products = r.json()
    assert len(products) >= 1
    return products[0]


@pytest.fixture(scope="session")
def sample_vendor(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/vendors")
    assert r.status_code == 200
    vendors = r.json()
    assert len(vendors) >= 1
    return vendors[0]


# -------- AUTH --------
class TestAuth:
    def test_admin_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert data["role"] == "admin"
        assert "access_token" in data
        # cookie set
        assert "access_token" in r.cookies

    def test_admin_me(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_sp_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": SP_EMAIL, "password": SP_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert data["role"] == "salesperson"
        assert data.get("salesperson_id"), "salesperson_id must be populated"

    def test_sp_me(self, sp_session):
        r = sp_session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        user = r.json()
        assert user["role"] == "salesperson"
        assert user.get("salesperson_id")

    def test_bad_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401


# -------- Admin Dashboard --------
class TestAdminDashboard:
    def test_admin_dashboard(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/dashboard/admin")
        assert r.status_code == 200
        data = r.json()
        for key in ["total_stock", "today_sales", "today_collections",
                    "total_vendors", "total_salespersons", "top_products", "sales_trend_7d"]:
            assert key in data, f"Missing key: {key}"
        assert isinstance(data["top_products"], list)
        assert isinstance(data["sales_trend_7d"], list)
        assert len(data["sales_trend_7d"]) == 7

    def test_sp_cannot_access_admin_dashboard(self, sp_session):
        r = sp_session.get(f"{BASE_URL}/api/dashboard/admin")
        assert r.status_code == 403


# -------- Products CRUD --------
class TestProducts:
    def test_list_products(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 1
        assert "id" in data[0] and "_id" not in data[0]

    def test_sp_can_list_products(self, sp_session):
        r = sp_session.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200

    def test_sp_cannot_create_product(self, sp_session):
        r = sp_session.post(f"{BASE_URL}/api/products", json={
            "name": "Blocked", "brand": "X", "sku": "TEST-BLOCK",
            "selling_price": 100, "commission_per_unit": 5, "current_stock": 0,
        })
        assert r.status_code == 403

    def test_create_update_delete_product(self, admin_session):
        sku = f"TEST-{uuid.uuid4().hex[:8].upper()}"
        payload = {
            "name": f"TEST Product {sku}", "brand": "TESTBRAND", "sku": sku,
            "selling_price": 250.0, "commission_per_unit": 5.5, "current_stock": 10,
        }
        r = admin_session.post(f"{BASE_URL}/api/products", json=payload)
        assert r.status_code == 200, r.text
        prod = r.json()
        assert prod["sku"] == sku
        pid = prod["id"]

        # Duplicate SKU should fail
        r_dup = admin_session.post(f"{BASE_URL}/api/products", json=payload)
        assert r_dup.status_code == 400

        # Update
        payload["current_stock"] = 25
        payload["selling_price"] = 275.0
        r_upd = admin_session.put(f"{BASE_URL}/api/products/{pid}", json=payload)
        assert r_upd.status_code == 200
        assert r_upd.json()["current_stock"] == 25

        # Delete
        r_del = admin_session.delete(f"{BASE_URL}/api/products/{pid}")
        assert r_del.status_code == 200


# -------- Salespersons CRUD --------
class TestSalespersons:
    def test_list_salespersons(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/salespersons")
        assert r.status_code == 200
        assert len(r.json()) >= 14

    def test_create_update_status_salesperson(self, admin_session):
        email = f"test_sp_{uuid.uuid4().hex[:6]}@dms.com"
        payload = {
            "name": "TEST SP", "mobile": "9999999999", "area": "TestArea",
            "status": "active", "email": email, "password": "test123",
        }
        r = admin_session.post(f"{BASE_URL}/api/salespersons", json=payload)
        assert r.status_code == 200, r.text
        sp = r.json()
        sp_id = sp["id"]
        assert sp["email"] == email

        # Linked user login
        r_login = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "test123"})
        assert r_login.status_code == 200
        assert r_login.json()["role"] == "salesperson"

        # Update
        r_upd = admin_session.put(f"{BASE_URL}/api/salespersons/{sp_id}", json={"area": "Updated Area"})
        assert r_upd.status_code == 200
        assert r_upd.json()["area"] == "Updated Area"

        # Disable
        r_del = admin_session.delete(f"{BASE_URL}/api/salespersons/{sp_id}")
        assert r_del.status_code == 200


# -------- Vendors --------
class TestVendors:
    def test_list_vendors(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/vendors")
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_create_update_delete_vendor(self, admin_session):
        payload = {
            "shop_name": f"TEST Shop {uuid.uuid4().hex[:6]}", "owner_name": "Test Owner",
            "mobile": "9876543210", "area": "TestArea", "address": "1 Test St",
        }
        r = admin_session.post(f"{BASE_URL}/api/vendors", json=payload)
        assert r.status_code == 200
        vid = r.json()["id"]

        r_upd = admin_session.put(f"{BASE_URL}/api/vendors/{vid}", json={**payload, "area": "New Area"})
        assert r_upd.status_code == 200
        assert r_upd.json()["area"] == "New Area"

        r_hist = admin_session.get(f"{BASE_URL}/api/vendors/{vid}/history")
        assert r_hist.status_code == 200
        h = r_hist.json()
        for k in ["vendor", "sales", "collections", "total_sales", "total_paid", "outstanding"]:
            assert k in h

        r_del = admin_session.delete(f"{BASE_URL}/api/vendors/{vid}")
        assert r_del.status_code == 200


# -------- Inventory + Allocations + Sales + Collections (integration flow) --------
class TestInventoryAndSalesFlow:
    def test_inventory_txn_list(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/inventory/transactions")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_stock_added_increments(self, admin_session, sample_product):
        pid = sample_product["id"]
        before = admin_session.get(f"{BASE_URL}/api/products").json()
        before_stock = next(p["current_stock"] for p in before if p["id"] == pid)

        r = admin_session.post(f"{BASE_URL}/api/inventory/transactions", json={
            "product_id": pid, "type": "stock_added", "quantity": 50,
            "note": "TEST add",
        })
        assert r.status_code == 200

        after = admin_session.get(f"{BASE_URL}/api/products").json()
        after_stock = next(p["current_stock"] for p in after if p["id"] == pid)
        assert after_stock == before_stock + 50

    def test_allocation_and_my_inventory_and_sale(self, admin_session, sp_session, sample_product, sample_vendor):
        # Allocate 20 units of product to sales1
        pid = sample_product["id"]
        vid = sample_vendor["id"]
        sp_id = sp_session._user["salesperson_id"]

        # First get current godown stock
        products = admin_session.get(f"{BASE_URL}/api/products").json()
        stock = next(p["current_stock"] for p in products if p["id"] == pid)

        # Ensure enough stock
        if stock < 20:
            r_add = admin_session.post(f"{BASE_URL}/api/inventory/transactions", json={
                "product_id": pid, "type": "stock_added", "quantity": 100,
            })
            assert r_add.status_code == 200

        alloc_payload = {"salesperson_id": sp_id, "product_id": pid, "quantity": 20, "date": TODAY}
        r_alloc = admin_session.post(f"{BASE_URL}/api/allocations", json=alloc_payload)
        assert r_alloc.status_code == 200, r_alloc.text

        # Insufficient stock error
        r_bad = admin_session.post(f"{BASE_URL}/api/allocations", json={
            "salesperson_id": sp_id, "product_id": pid, "quantity": 999999,
        })
        assert r_bad.status_code == 400

        # Allocations list filtered by date
        r_list = admin_session.get(f"{BASE_URL}/api/allocations", params={"date": TODAY})
        assert r_list.status_code == 200
        assert any(a["salesperson_id"] == sp_id and a["product_id"] == pid for a in r_list.json())

        # my-inventory for salesperson
        r_inv = sp_session.get(f"{BASE_URL}/api/my-inventory")
        assert r_inv.status_code == 200
        inv = r_inv.json()
        row = next((i for i in inv if i["product_id"] == pid), None)
        assert row is not None
        assert row["allocated"] >= 20
        remaining_before = row["remaining"]

        # Create sale from salesperson perspective
        sale_qty = 3
        r_sale = sp_session.post(f"{BASE_URL}/api/sales", json={
            "vendor_id": vid, "product_id": pid, "quantity": sale_qty, "date": TODAY,
        })
        assert r_sale.status_code == 200, r_sale.text
        sale = r_sale.json()
        assert sale["salesperson_id"] == sp_id
        assert sale["quantity"] == sale_qty
        assert sale["sale_value"] == sale["unit_price"] * sale_qty
        assert sale["commission"] == sample_product["commission_per_unit"] * sale_qty

        # Oversell should fail
        r_over = sp_session.post(f"{BASE_URL}/api/sales", json={
            "vendor_id": vid, "product_id": pid, "quantity": 100000,
        })
        assert r_over.status_code == 400

        # Admin creates a sale supplying salesperson_id
        r_admin_sale = admin_session.post(f"{BASE_URL}/api/sales", json={
            "vendor_id": vid, "product_id": pid, "quantity": 1, "date": TODAY,
            "salesperson_id": sp_id,
        })
        assert r_admin_sale.status_code == 200, r_admin_sale.text

        # remaining decreased
        r_inv2 = sp_session.get(f"{BASE_URL}/api/my-inventory")
        row2 = next((i for i in r_inv2.json() if i["product_id"] == pid), None)
        assert row2["remaining"] == remaining_before - (sale_qty + 1)

    def test_collections(self, admin_session, sp_session, sample_vendor):
        vid = sample_vendor["id"]
        r_sp = sp_session.post(f"{BASE_URL}/api/collections", json={
            "vendor_id": vid, "amount": 500.0, "payment_mode": "cash",
            "note": "TEST collection", "date": TODAY,
        })
        assert r_sp.status_code == 200, r_sp.text
        assert r_sp.json()["salesperson_id"] == sp_session._user["salesperson_id"]

        # Admin creates collection
        r_admin = admin_session.post(f"{BASE_URL}/api/collections", json={
            "vendor_id": vid, "amount": 200.0, "payment_mode": "upi",
            "salesperson_id": sp_session._user["salesperson_id"],
            "date": TODAY,
        })
        assert r_admin.status_code == 200

        # List filter by date
        r_list = admin_session.get(f"{BASE_URL}/api/collections", params={"date": TODAY})
        assert r_list.status_code == 200
        assert len(r_list.json()) >= 2


# -------- Salesperson Dashboard & EOD --------
class TestSalespersonDashboard:
    def test_sp_dashboard(self, sp_session):
        r = sp_session.get(f"{BASE_URL}/api/dashboard/salesperson")
        assert r.status_code == 200
        data = r.json()
        for k in ["opening_stock", "sold_qty", "remaining_stock", "today_sales",
                  "commission", "today_collections", "inventory"]:
            assert k in data
        assert isinstance(data["inventory"], list)

    def test_eod_summary_sp_sees_only_own(self, sp_session):
        r = sp_session.get(f"{BASE_URL}/api/eod-summary", params={"date": TODAY})
        assert r.status_code == 200
        data = r.json()
        assert data["date"] == TODAY
        assert len(data["rows"]) == 1
        row = data["rows"][0]
        for k in ["opening_stock", "sold_qty", "remaining_stock", "sales_value",
                  "commission_earned", "collection_amount"]:
            assert k in row

    def test_eod_summary_admin_sees_all(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/eod-summary", params={"date": TODAY})
        assert r.status_code == 200
        assert len(r.json()["rows"]) >= 14


# -------- Reports --------
class TestReports:
    @pytest.mark.parametrize("kind", [
        "daily_sales", "salesperson_performance", "product_sales",
        "vendor_outstanding", "collections",
    ])
    def test_report_kind(self, admin_session, kind):
        r = admin_session.get(f"{BASE_URL}/api/reports/{kind}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "title" in data and "columns" in data and "rows" in data
        assert isinstance(data["columns"], list) and len(data["columns"]) > 0
        assert isinstance(data["rows"], list)

    def test_report_export_xlsx(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/reports/daily_sales/export", params={"format": "xlsx"})
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers.get("Content-Type", "")
        assert len(r.content) > 100

    def test_report_export_pdf(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/reports/vendor_outstanding/export", params={"format": "pdf"})
        assert r.status_code == 200
        assert "pdf" in r.headers.get("Content-Type", "")
        assert r.content[:4] == b"%PDF"

    def test_report_sp_forbidden(self, sp_session):
        r = sp_session.get(f"{BASE_URL}/api/reports/daily_sales")
        assert r.status_code == 403
        r_exp = sp_session.get(f"{BASE_URL}/api/reports/daily_sales/export")
        assert r_exp.status_code == 403
