# Copilot instructions for akdistributers

## Repository shape

This repo contains two app layers that are intentionally separate:

- `backend/` is a Python FastAPI service backed by MongoDB. It exposes the business logic under `/api` and owns auth, data access, and reporting endpoints.
- `frontend/` is a React 19 + CRACO + Tailwind app with shadcn-inspired UI primitives and role-based routing.
- `memory/PRD.md` and `test_reports/` capture the product requirements and previous test expectations; use them when a change affects workflow behavior or acceptance criteria.

## Build, test, and validation commands

### Frontend

Install dependencies:

```bash
cd frontend
npm install
```

Run the app:

```bash
cd frontend
npm start
```

Create a production build:

```bash
cd frontend
npm run build
```

Run the frontend test runner:

```bash
cd frontend
CI=true npm test -- --watch=false
```

Run a single frontend test or file:

```bash
cd frontend
CI=true npm test -- --watch=false --runTestsByPath src/path/to/test-file.js
```

If the project adds React tests later, prefer `-t "test name"` or `--runTestsByPath` to narrow execution instead of running the full suite.

There is no dedicated lint script in `frontend/package.json`; the repo relies on the CRA build/test flow and targeted validation rather than an explicit lint command.

### Backend

Install Python dependencies:

```bash
cd backend
python -m venv .venv
. .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Run the backend test suite:

```bash
cd backend
pytest
```

Run a single backend test file:

```bash
cd backend
pytest tests/backend_test.py
```

Run one specific case:

```bash
cd backend
pytest tests/backend_test.py::TestAuth::test_admin_login_me
```

`backend/pytest.ini` configures xdist with `-n 2 --dist loadscope`; keep that default unless you intentionally need a serial run such as `pytest -n 0 ...`.

The backend tests target a live API instance and expect `REACT_APP_BACKEND_URL` to be set in the environment. In addition, the app itself requires `MONGO_URL`, `DB_NAME`, and `JWT_SECRET` to boot the FastAPI server.

## High-level architecture

### Frontend architecture

- `frontend/src/App.js` is the top-level router and role gate.
  - Admin routes live under `/admin` and sales routes under `/sales`.
  - `AuthProvider` in `frontend/src/context/AuthContext.jsx` owns bootstrapping auth state and login/logout.
  - `frontend/src/components/layout/AppShell.jsx` renders the shell and nav for the current role.
- `frontend/src/lib/api.js` is the shared API client. It reads `REACT_APP_BACKEND_URL`, builds the `/api` base URL, and attaches the auth token via the Authorization header when present.
- UI conventions follow the existing shadcn-style components under `frontend/src/components/ui`, with most route pages organized under `frontend/src/pages/admin` and `frontend/src/pages/salesperson`.

### Backend architecture

- `backend/server.py` is the app entry point. It creates the FastAPI app, configures MongoDB access via `app.state.db`, and registers routes under `api = APIRouter(prefix="/api")`.
- `backend/models.py` defines the public Pydantic DTOs used by requests and responses; the API boundary is intentional and typed.
- `backend/auth.py` handles password hashing, JWT issuance, cookie setting, and user/session authorization (including admin enforcement).
- `backend/seed.py` and `backend/import_data.py` seed or refresh the database. This project imports real product and vendor data, not disposable mock fixtures.
- API responses purposely convert Mongo `_id` fields to `id` before returning to the frontend; keep that convention when adding or modifying endpoints.

## Key conventions specific to this repo

- Use the existing role split: admin flows and salesperson flows are separate, and the UI is designed around those permissions. Do not add a single “catch-all” page or route that bypasses the role gates.
- Reuse the shared API and auth patterns already in place rather than creating ad hoc fetch logic in individual pages.
- Keep new frontend work aligned with the app’s existing Tailwind + component-library pattern instead of introducing a second UI system.
- When you change business rules or data contracts, check the product docs in `memory/PRD.md` and previous results in `test_reports/` before editing the API or route behavior.
- The app expects route-scoped business logic: salesperson actions should stay limited to their assigned route / vendor list, and admin-only actions should remain behind `Depends(require_admin)`.
- Avoid treating MongoDB objects as API responses; public responses should use the serialized `id` shape, not raw `_id`.
- For backend work, remember that the app uses JWT-based auth with `HttpOnly` cookies. Preserve the existing login/logout flow and token validation semantics.

## Scope notes for changes

- Prefer targeting the smallest relevant backend route or frontend page rather than building parallel logic in multiple places.
- When a fix affects admin/salesperson behavior, check both the route’s server-side permission guard and the corresponding frontend screen navigation.
- Keep the project’s live-data assumptions in mind: this is not a purely mock-data app; many tests and flows depend on the seeded Mongo data and real route/vendor mappings.

## Practical reminders

- Frontend dev work usually needs `REACT_APP_BACKEND_URL` configured in the app environment.
- Backend work usually needs a running MongoDB instance and the env vars defined in the app config.
- There is no custom AI config file in this repo (`CLAUDE.md`, `AGENTS.md`, `.cursorrules`, etc.) at the moment; keep changes aligned with the project structure above instead of inventing parallel conventions.
