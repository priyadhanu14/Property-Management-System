# Bahuleya PMS (Lite)

Property Management System for Bahuleya Service Apartments — Manager-only, mobile-first.

## Stack

| Layer | Tech |
|-------|------|
| **Frontend** | React + Vite + TypeScript, TailwindCSS, shadcn/ui, TanStack Query, PWA (vite-plugin-pwa) |
| **Backend** | FastAPI, Uvicorn/Gunicorn, Pydantic |
| **DB** | Supabase Postgres (SQLAlchemy 2.0 async + asyncpg), Alembic |
| **Auth / Storage** | Supabase Auth, Supabase Storage |
| **Excel** | pandas + openpyxl (import/export) |

**Reliability:** No double booking is enforced at the DB using `btree_gist` and an `EXCLUDE` constraint on `(unit_code, tstzrange(start_datetime, end_datetime))`. See [docs/DATABASE_RELIABILITY.md](docs/DATABASE_RELIABILITY.md).

## Repo layout

- `frontend/` — React SPA (mobile-first, PWA)
- `backend/` — FastAPI app, Alembic migrations
- `docs/` — Database and architecture notes

## Quick start

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
# Set .env: DATABASE_URL (Supabase Postgres, postgresql+asyncpg://...)
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

API: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173 (proxies `/api` to backend).

### Env (backend)

Create `backend/.env`:

- `DATABASE_URL` — Supabase Postgres URL, e.g. `postgresql+asyncpg://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`
- Optional: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET` for Auth.

## Calendar / availability UI

- **MVP:** Custom room list + day cards (as in the plan).
- **Later:** FullCalendar or React Big Calendar for timeline/grid.
