# Quality Intelligence Platform

Internal quality intelligence platform for fresh produce exporters.
Import customer PDF quality reports → human validation → standards comparison → decisions → dashboards → exports.

---

## Quick Start

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac/Linux)
- Git

### 1. Clone and configure
```bash
git clone <repo-url>
cd AppAnalyseQuality
cp .env.example .env
# Edit .env — set strong passwords and SECRET_KEY
```

### 2. Start all services
```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend (React) | http://localhost:5173 |
| Backend API (FastAPI) | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/api/docs |
| Celery Flower | http://localhost:5555 |
| PostgreSQL | localhost:5432 |

### 3. Create the first admin user
After `docker compose up`, run:
```bash
docker compose exec backend python -c "
from app.db.session import SessionLocal
from app.models.user import User
from app.models.role import Role
from app.core.security import hash_password
db = SessionLocal()
role = db.query(Role).filter(Role.name == 'Admin').first()
user = User(full_name='Admin', email='admin@example.com', password_hash=hash_password('Admin1234!'), role_id=role.id)
db.add(user)
db.commit()
print('Admin user created: admin@example.com / Admin1234!')
"
```

---

## Project Structure
```
AppAnalyseQuality/
├── docker-compose.yml
├── .env.example
├── ASSUMPTIONS.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic/              # Database migrations
│   └── app/
│       ├── main.py           # FastAPI entry point
│       ├── core/             # Config, security, permissions, logging
│       ├── db/               # SQLAlchemy session + base
│       ├── models/           # ORM models (21 tables)
│       ├── schemas/          # Pydantic request/response schemas
│       ├── api/v1/           # REST API routes
│       ├── services/         # Business logic services
│       ├── parsers/          # PDF parser implementations
│       ├── workers/          # Celery tasks
│       └── tests/            # Test suite
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── app/              # Router + providers
│       ├── api/              # Axios client + API functions
│       ├── hooks/            # Auth store, custom hooks
│       ├── layouts/          # Main layout with sidebar
│       ├── pages/            # All page components
│       └── types/            # TypeScript type definitions
└── storage/
    └── uploads/              # Uploaded PDFs (outside web root)
```

---

## Build Phases

| Phase | Status | Scope |
|---|---|---|
| 1 | ✅ Complete | Project structure, Docker, skeletons, DB models, migrations |
| 2 | Pending | Auth endpoints, user management, full RBAC |
| 3 | Pending | Master data CRUD (clients, products, standards) |
| 4 | Pending | PDF upload, Agroberries parser v1, Celery extraction |
| 5 | Pending | Validation API + validation UI |
| 6 | Pending | Decision engine |
| 7 | Pending | Reports list, load detail, PDF/Excel exports |
| 8 | Pending | Dashboard KPIs + analytics charts |
| 9 | Pending | Tests, security hardening, documentation |

---

## Architecture

```
User → React Frontend → FastAPI Backend → PostgreSQL
                              ↓
                         Redis Broker
                              ↓
                       Celery Workers
                     (PDF Extraction / Analysis)
```

**Three data layers** (never skip or merge):
1. **Raw** — JSON output from parser, stored in `import_raw_payloads`
2. **Validated** — Human-approved data in `loads`, `pallets`, `pallet_measurements`
3. **Analysed** — Decision engine output: statuses, scores, violations

---

## Security

- Passwords: bcrypt
- Auth: JWT (access 60 min, refresh 7 days)
- RBAC: Admin, Quality Manager, Quality Analyst, Management Viewer, Auditor
- File uploads: stored outside web root (`storage/uploads/`)
- Audit logs: immutable, written for all sensitive actions
- Secrets: environment variables only — never hardcoded

---

## API Documentation

Interactive Swagger UI: http://localhost:8000/api/docs

Base path: `/api/v1`

---

## Environment Variables

See `.env.example` for all required variables.
Critical ones:
- `SECRET_KEY` — minimum 64 random characters
- `POSTGRES_PASSWORD` — use a strong password
- `UPLOAD_DIR` — path for PDF storage (default: `/app/storage/uploads`)
