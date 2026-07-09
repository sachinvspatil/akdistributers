# PRD — Distribution Management System (DMS)

## Original Problem Statement
Build a modern web application called "Distribution Management System" for a cigarette distributor to manage inventory, salespersons, vendors, daily stock allocation, sales entry, collections, EoD summary and reports. Admin + Salesperson roles. White + dark blue theme.

## Architecture
- FastAPI + MongoDB backend (all routes under `/api`)
- JWT-based auth (bcrypt + httpOnly cookies + Authorization bearer fallback via localStorage token)
- React 19 + React Router + Shadcn UI + Recharts frontend
- Excel export via openpyxl, PDF export via reportlab

## User Personas
- **Admin (distributor owner)**: manages catalog, team, vendors, godown, allocations; views reports & dashboard.
- **Salesperson (field agent)**: views daily allocation, records sales & collections, sees own commission and EOD summary.

## Core Requirements (Implemented)
- Products CRUD (name, brand, SKU, price, commission, stock)
- Salespersons CRUD + user account (email/password) + status toggle
- Vendors CRUD + purchase history with outstanding
- Godown inventory: current stock per product + transaction log (added / allocated / returned)
- Daily stock allocation (reduces godown, adds to salesperson inventory)
- Sales entry (auto compute sale value & commission; enforces remaining stock)
- Collections (payment mode + notes)
- Admin dashboard (6 metric cards + 7-day sales trend chart + top selling bar chart)
- Salesperson dashboard (opening / sold / remaining / sales / collection / commission + stock table)
- End-of-day summary per salesperson
- Reports: Daily Sales, Salesperson Performance, Product-wise Sales, Vendor Outstanding, Collections
- Excel + PDF export for every report
- Seed data: 10 products, 14 salespersons, 50 vendors

## Auth / Test Credentials
See `/app/memory/test_credentials.md`.

## Backlog (P1/P2 for future iterations)
- P1: Search & pagination for large tables (allocations, sales, collections)
- P1: Filter EOD summary by salesperson
- P2: Charts on salesperson dashboard (weekly trend)
- P2: Multi-day date range selector in reports
- P2: Vendor credit limit alerts
- P2: Push notifications / daily WhatsApp SMS integration
- P2: Bulk stock allocation (multiple products in one request)

## What's Been Implemented (2026-02-09)
- Full end-to-end MVP wired: auth, all CRUD flows, dashboard, sales/collections flows, reports (Excel + PDF).
