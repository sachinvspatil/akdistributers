# PRD — Distribution Management System (DMS)

## Original Problem Statement
Full-stack DMS for a cigarette distributor. Admin manages products, salespersons, vendors, godown, allocations, reports; salesperson records sales & collections and views own EOD summary + commission.

## Architecture
- FastAPI + MongoDB backend (`/api` prefix)
- JWT auth (bcrypt + httpOnly cookies + bearer fallback)
- React 19 + Router + Shadcn UI + Recharts
- Excel export via openpyxl, PDF via reportlab

## What's Been Implemented

### 2026-02-09 — MVP
Auth, all CRUD flows, admin dashboard with charts, salesperson flows, EOD summary, 5 reports (Excel + PDF).

### 2026-02-16 — Real Data Import
Wiped dummy seed data and imported real GPI_MASTER.xlsx:
- **50 products** with new fields `hsn_code`, `gst_pct`, `landing_price` (categories: IPM=15, GPI=22, CANDY=9, FERRERO=4)
- **15 salespersons** with external `salesman_id` (BLRAKDLT01..15); 12 active, 3 inactive placeholders
- **1442 vendors** mapped to routes by name-prefix (e.g. "01 BAKERY" → route "Munnekollal 1")

New features added on top of MVP:
- Category filter + product search on `/api/products`
- Server-side area filter + search on `/api/vendors`
- New `/api/my-vendors` endpoint — salesperson auto-scoped to their route
- Salesperson Record-Sale + Collections pages now show only their route's vendors
- Product page shows HSN, GST%, Landing price columns + category tabs
- Salesperson page shows SE ID column (BLRAKDLT01…)
- Import script `/app/backend/import_data.py` (re-runnable to refresh data)
- Admin-only seed on startup (no dummy data)

## Backlog

### P1 (recommended next)
- Vendor bulk edit (owner name / mobile / address are empty from spreadsheet — needs enrichment)
- Bulk stock allocation (multiple products in one request)
- Products.jsx subtitle: show "Showing X of 50" when filter active
- Multi-day date range in reports

### P2
- WhatsApp/SMS daily EoD digest to each salesperson & consolidated to admin
- Vendor credit-limit alerts & auto-suspend
- Charts on salesperson dashboard (weekly trend)
- Route-optimization for delivery sequence
- GST-compliant tax invoice PDF per sale

## Credentials
See `/app/memory/test_credentials.md` — admin + all 15 salespersons (auto-generated passwords).
