"""End-to-end backend API tests for the DMS - Iteration 2 (real GPI_MASTER data)."""
import os
import uuid
import pytest
import requests
from datetime import date

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
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

# From /app/memory/test_credentials.md
SP1_EMAIL = "sales01@dms.com"
SP1_PASSWORD = "vyj6KaB4nv"
SP1_NAME = "Ugendran"
SP1_AREA = "Munnekollal 1"

SP2_EMAIL = "sales02@dms.com"
SP2_PASSWORD = "vjKR7vHVVn"
SP2_AREA = "Munnekollal 2"

TODAY = date.today().isoformat()


# -------- Fixtures --------
def _login(email, password):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    data = r.json()
    s.headers.update({"Authorization": f"Bearer {data['access_token']}"})
    s._user = data
    return s


@pytest.fixture(scope="session")
def admin_session():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="session")
def sp1_session():
    return _login(SP1_EMAIL, SP1_PASSWORD)


@pytest.fixture(scope="session")
def sp2_session():
    return _login(SP2_EMAIL, SP2_PASSWORD)


# -------- AUTH --------
class TestAuth:
    def test_admin_login_me(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        u = r.json()
        assert u["role"] == "admin"
        assert u["email"] == ADMIN_EMAIL

    def test_sp1_login_me(self, sp1_session):
        r = sp1_session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        u = r.json()
        assert u["role"] == "salesperson"
        assert u["name"] == SP1_NAME
        assert u.get("salesperson_id")

    def test_bad_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401


# -------- Admin Dashboard --------
class TestAdminDashboard:
    def test_admin_dashboard_totals(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/dashboard/admin")
        assert r.status_code == 200
        d = r.json()
        # Data assertions per problem statement
        assert d["total_vendors"] == 1442, f"total_vendors got {d['total_vendors']}"
        # test_credentials.md shows 12 active + 3 inactive = 15 total (problem statement said 13 but real data is 12)
        assert d["total_salespersons"] == 12, f"total_salespersons got {d['total_salespersons']}"
        for k in ["total_stock", "today_sales", "today_collections",
                  "top_products", "sales_trend_7d"]:
            assert k in d
        assert len(d["sales_trend_7d"]) == 7


# -------- Products --------
class TestProducts:
    def test_list_products_count_and_new_fields(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200
        products = r.json()
        assert len(products) == 50, f"expected 50 products, got {len(products)}"
        # Assert new fields exist on each (values may be null)
        for p in products:
            assert "hsn_code" in p
            assert "gst_pct" in p
            assert "landing_price" in p
            assert "id" in p and "_id" not in p

    @pytest.mark.parametrize("cat,expected", [
        ("IPM", 15), ("GPI", 22), ("CANDY", 9), ("FERRERO", 4),
    ])
    def test_product_category_filter(self, admin_session, cat, expected):
        r = admin_session.get(f"{BASE_URL}/api/products", params={"category": cat})
        assert r.status_code == 200
        data = r.json()
        assert len(data) == expected, f"category {cat} expected {expected}, got {len(data)}"
        for p in data:
            assert p["brand"] == cat

    def test_product_search_stellar(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/products", params={"q": "STELLAR"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        for p in data:
            assert "STELLAR" in p["name"].upper() or "STELLAR" in p.get("sku", "").upper()

    def test_admin_creates_product_with_new_fields(self, admin_session):
        sku = f"TEST-{uuid.uuid4().hex[:8].upper()}"
        payload = {
            "name": f"TEST Product {sku}", "brand": "IPM", "sku": sku,
            "selling_price": 250.0, "commission_per_unit": 5.5, "current_stock": 0,
            "hsn_code": "24022090", "gst_pct": 28.0, "landing_price": 180.0,
        }
        r = admin_session.post(f"{BASE_URL}/api/products", json=payload)
        assert r.status_code == 200, r.text
        prod = r.json()
        assert prod["hsn_code"] == "24022090"
        assert prod["gst_pct"] == 28.0
        assert prod["landing_price"] == 180.0
        pid = prod["id"]

        # Fetch via list and verify persisted
        r2 = admin_session.get(f"{BASE_URL}/api/products")
        found = next((p for p in r2.json() if p["id"] == pid), None)
        assert found is not None
        assert found["hsn_code"] == "24022090"
        assert found["gst_pct"] == 28.0
        assert found["landing_price"] == 180.0

        # Cleanup
        admin_session.delete(f"{BASE_URL}/api/products/{pid}")


# -------- Salespersons --------
class TestSalespersons:
    def test_list_salespersons_count_and_ids(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/salespersons")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 15, f"expected 15 salespersons, got {len(data)}"
        for sp in data:
            assert "salesman_id" in sp
            assert sp["salesman_id"] and sp["salesman_id"].startswith("BLRAKDLT")

    def test_update_salesman_id(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/salespersons")
        # Pick an inactive/pending one so we don't disrupt active data
        target = next((s for s in r.json() if s.get("salesman_id") == "BLRAKDLT12"), None)
        assert target is not None
        original = target["salesman_id"]
        temp_id = "BLRAKDLT12X"
        r_upd = admin_session.put(f"{BASE_URL}/api/salespersons/{target['id']}",
                                  json={"salesman_id": temp_id})
        assert r_upd.status_code == 200
        assert r_upd.json()["salesman_id"] == temp_id
        # revert
        admin_session.put(f"{BASE_URL}/api/salespersons/{target['id']}",
                          json={"salesman_id": original})


# -------- Vendors --------
class TestVendors:
    def test_list_all_vendors(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/vendors")
        assert r.status_code == 200
        data = r.json()
        assert len(data) <= 1442 and len(data) >= 1000, f"got {len(data)} vendors"

    def test_area_filter_munnekollal_1(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/vendors", params={"area": "Munnekollal 1"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 83, f"expected 83, got {len(data)}"
        for v in data:
            assert v["area"] == "Munnekollal 1"

    def test_search_bakery_case_insensitive(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/vendors", params={"q": "bakery"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        for v in data:
            hay = (v.get("shop_name", "") + v.get("owner_name", "") + v.get("area", "")).lower()
            assert "bakery" in hay


# -------- My-Vendors (new endpoint) --------
class TestMyVendors:
    def test_sp1_my_vendors(self, sp1_session):
        r = sp1_session.get(f"{BASE_URL}/api/my-vendors")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 83, f"sp1 expected 83, got {len(data)}"
        for v in data:
            assert v["area"] == SP1_AREA

    def test_sp2_my_vendors(self, sp2_session):
        r = sp2_session.get(f"{BASE_URL}/api/my-vendors")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 102, f"sp2 expected 102, got {len(data)}"
        for v in data:
            assert v["area"] == SP2_AREA

    def test_admin_forbidden_from_my_vendors(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/my-vendors")
        assert r.status_code == 403


# -------- Allocation + Sale on real data --------
class TestSalespersonSaleFlow:
    def test_sp_cannot_sell_unallocated_product(self, sp1_session, admin_session):
        # Get any product and a vendor from sp1's own route
        products = admin_session.get(f"{BASE_URL}/api/products").json()
        # Pick a product that likely isn't allocated to sp1 today
        pid = products[-1]["id"]
        my_vendors = sp1_session.get(f"{BASE_URL}/api/my-vendors").json()
        vid = my_vendors[0]["id"]

        # Ensure NOT allocated first: try sale for 1 unit — should be 400 (Only 0 remaining)
        r = sp1_session.post(f"{BASE_URL}/api/sales", json={
            "vendor_id": vid, "product_id": pid, "quantity": 1, "date": TODAY,
        })
        assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text}"

    def test_admin_alloc_then_sp_sale(self, admin_session, sp1_session):
        # Pick a product with stock or add stock
        products = admin_session.get(f"{BASE_URL}/api/products").json()
        prod = products[0]
        pid = prod["id"]
        # Add stock to godown for this product
        r_add = admin_session.post(f"{BASE_URL}/api/inventory/transactions", json={
            "product_id": pid, "type": "stock_added", "quantity": 100, "note": "TEST setup",
        })
        assert r_add.status_code == 200

        sp_id = sp1_session._user["salesperson_id"]
        # Allocate 10 to sp1
        r_alloc = admin_session.post(f"{BASE_URL}/api/allocations", json={
            "salesperson_id": sp_id, "product_id": pid, "quantity": 10, "date": TODAY,
        })
        assert r_alloc.status_code == 200, r_alloc.text

        # my-inventory shows the allocation
        r_inv = sp1_session.get(f"{BASE_URL}/api/my-inventory")
        assert r_inv.status_code == 200
        row = next((i for i in r_inv.json() if i["product_id"] == pid), None)
        assert row is not None
        assert row["allocated"] >= 10

        # Record a sale for one of sp1's vendors
        my_vendors = sp1_session.get(f"{BASE_URL}/api/my-vendors").json()
        vid = my_vendors[0]["id"]
        r_sale = sp1_session.post(f"{BASE_URL}/api/sales", json={
            "vendor_id": vid, "product_id": pid, "quantity": 2, "date": TODAY,
        })
        assert r_sale.status_code == 200, r_sale.text
        sale = r_sale.json()
        assert sale["quantity"] == 2
        assert sale["salesperson_id"] == sp_id

        # Salesperson dashboard reflects the sale
        r_dash = sp1_session.get(f"{BASE_URL}/api/dashboard/salesperson")
        assert r_dash.status_code == 200
        d = r_dash.json()
        assert d["sold_qty"] >= 2
        assert d["today_sales"] >= sale["sale_value"]


# -------- Reports --------
class TestReports:
    @pytest.mark.parametrize("kind", ["product_sales", "vendor_outstanding"])
    def test_report_shape(self, admin_session, kind):
        r = admin_session.get(f"{BASE_URL}/api/reports/{kind}")
        assert r.status_code == 200
        data = r.json()
        for k in ["title", "columns", "rows"]:
            assert k in data
        assert isinstance(data["columns"], list) and len(data["columns"]) > 0

    def test_export_xlsx(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/reports/product_sales/export",
                              params={"format": "xlsx"})
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers.get("Content-Type", "")
        assert len(r.content) > 100

    def test_export_pdf(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/reports/vendor_outstanding/export",
                              params={"format": "pdf"})
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"
