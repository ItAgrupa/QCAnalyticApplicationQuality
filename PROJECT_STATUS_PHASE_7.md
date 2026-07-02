# PROJECT STATUS REPORT — PHASE 7
**Quality Intelligence Platform**
**Audit Date:** 2026-07-02
**Auditor:** Senior Architect / Full-Stack Audit
**Current Phase:** 7 (Reports, Load Detail, Exports)

---

## A. EXECUTIVE SUMMARY

The platform is **substantially implemented through Phase 7** with most backend and frontend code in place. However, the application has **one critical blocking bug** (`.env` file resolution failure under local dev) that must be fixed before continued development. Additionally, several Phase 7 items are partially complete or untested, the Celery `run_analysis` task still contains a Phase 6 stub, the `reports.py` API is still a placeholder stub, the Dashboard and Analytics pages are empty stubs, and **there are zero automated tests**.

**Overall completion estimate:**
- Phase 1–2: 100%
- Phase 3: 95% (templates module is a stub router)
- Phase 4: 90% (parser works; Celery sync fallback only — Redis not running locally)
- Phase 5: 85% (backend complete; ValidationPage implemented but untested end-to-end)
- Phase 6: 80% (decision engine implemented; Celery `run_analysis` task still a stub)
- Phase 7: 60% (ReportsPage + LoadDetailPage built; reports.py API stub not replaced; no original PDF access; export not end-to-end tested)
- Phase 8: 5% (stubs only)
- Phase 9: 0% (no tests, no hardening)

**Main working features (verified by code inspection + API test):**
- Authentication (JWT, bcrypt, refresh tokens, audit on login)
- RBAC (5 roles, enforced on all endpoints)
- Full master data CRUD (clients, markets, countries, products, varieties, packaging, standards, score rules)
- PDF upload + import job lifecycle
- Agroberries v1 parser (text + table extraction)
- Human validation service and API
- Decision engine (`analyse_load`)
- Loads API (list, get, analyse)
- PDF and Excel export generation (ReportLab + openpyxl)
- Audit logging on all sensitive actions
- Full frontend UI for Settings, Imports, Validation, Reports, Load Detail

**Main blockers:**
1. **CRITICAL:** `.env` file at project root is not found when running uvicorn from `backend/` directory — login returns HTTP 500
2. **HIGH:** `run_analysis` Celery task is still a stub (`return {"status": "pending"}`) — async analysis via queue never runs
3. **HIGH:** `backend/app/api/v1/reports.py` is still a placeholder stub — `/api/v1/reports/` returns a static message
4. **MEDIUM:** No original PDF download endpoint — uploaded files inaccessible after upload
5. **MEDIUM:** Zero automated tests

**Phase 7 complete?** No — partially. See Section K.

---

## B. PHASE COMPLETION MATRIX

| Phase | Expected Scope | Status | Evidence | Missing Items | Priority |
|-------|---------------|--------|----------|---------------|----------|
| 1 | Project structure, Docker Compose, backend skeleton, frontend skeleton, PostgreSQL, Redis, Celery | ✅ Complete | `docker-compose.yml`, `Dockerfile` (backend+frontend), Celery app, FastAPI main.py | Nothing | — |
| 2 | DB models, Alembic migrations, auth, roles, permissions, audit logs | ✅ Complete | `0001_initial_schema.py` (17 tables), `auth.py`, `security.py`, `permissions.py`, `audit_service.py` | Nothing | — |
| 3 | Master data CRUD: clients, markets, countries, products, varieties, packaging, standards, score rules, templates | ✅ 95% | All CRUD endpoints verified working, PDF standards import implemented | `templates.py` is a placeholder stub (not a CRUD endpoint) | Low |
| 4 | PDF upload, import records, Celery extraction jobs, Agroberries parser v1 | ✅ 90% | `import_service.py`, `tasks.py` `run_extraction`, `agroberries_v1.py`, `parsers/registry.py` | Redis not running locally; sync fallback used. No end-to-end test with Agroberries PDF | Medium |
| 5 | Validation API + validation frontend | ✅ 85% | `validation_service.py`, `POST /imports/{id}/validate`, `ValidationPage.tsx` | Not end-to-end tested; edge cases with empty pallets not guarded in UI | Medium |
| 6 | Decision engine + apply standards | ⚠️ 80% | `decision_engine.py`, `POST /loads/{id}/analyse`, `loads.py` router | `run_analysis` Celery task still has Phase 6 stub body; engine not wired to Celery; no standard version tracking stored per analysis | High |
| 7 | Reports list, load detail, PDF/Excel exports, filtering, original PDF access | ⚠️ 60% | `ReportsPage.tsx`, `LoadDetailPage.tsx`, `exports.py`, `report_generator.py`, `loads.py` | `reports.py` API still a placeholder; no original PDF download endpoint; exports not end-to-end tested; no corrective actions UI | High |
| 8 | Dashboard + analytics | ❌ 5% | `DashboardPage.tsx` stub, `AnalyticsPage.tsx` stub, `dashboard.py` placeholder stub | Everything | High (next phase) |
| 9 | Testing, security hardening, docs, production readiness | ❌ 0% | `tests/__init__.py` only (empty) | All unit/integration/e2e tests, security scan, production config | High (after Phase 8) |

---

## C. IMPLEMENTED FEATURES

### Backend
- FastAPI application with CORS, lifespan, health check (`/health`)
- JWT authentication: login (`POST /auth/login`), token refresh (`POST /auth/refresh`), `/auth/me`
- bcrypt password hashing via passlib
- 5 RBAC roles enforced via `require_role()` dependency
- Audit logging on: LOGIN_SUCCESS, LOGIN_FAILED, all CRUD operations, IMPORT_UPLOADED, IMPORT_VALIDATED, LOAD_ANALYSED, REPORT_EXPORTED
- Full CRUD APIs: `/clients/`, `/markets/`, `/countries/`, `/products/`, `/varieties/`, `/packaging/`, `/standards/`, `/score-rules/`
- Standards PDF import: `POST /standards/parse-pdf` with pdfplumber rule-based extraction
- Import job lifecycle: upload → EXTRACTING → READY_FOR_VALIDATION → VALIDATED → ANALYSED
- Agroberries v1 parser: header regex extraction + pdfplumber table extraction + text fallback
- Parser registry pattern (extensible to new clients without code changes)
- Human validation service: creates Load + Pallets + PalletMeasurements, summary statistics
- Decision engine: specificity-cascade standard lookup, PASS/FAIL per measurement, Q score (1-4), CS score (A-D/O), pallet rollup (CRITICAL→REJECT, MAJOR→HOLD), load rollup
- Loads API: `GET /loads/`, `GET /loads/{id}` (with pallets + measurements), `POST /loads/{id}/analyse`
- Export service: PDF (ReportLab, branded Magopco header), Excel (openpyxl, 3-sheet workbook)
- Export API: `POST /exports/load/{id}/pdf`, `POST /exports/load/{id}/xlsx`, `GET /exports/load/{id}/`
- Audit log API: `GET /audit/` with filters (action, entity_type, user_id), Admin+Auditor role
- Users API: full CRUD with role assignment, deactivate/reactivate
- Alembic: single migration `0001_initial_schema.py` with all 17 tables + seed roles

### Frontend
- Login page: email/password form, URLSearchParams Content-Type (correct for OAuth2)
- Main layout: sidebar nav with Magopco brand (#7B1FA2), active route highlighting
- Settings page with 5 tabs: Clients, Countries/Markets, Products/Varieties, Packaging, Quality Standards, Score Rules
- Standards tab: DataGrid CRUD + PDF import workflow (upload → review/edit parsed rows → bulk import)
- Imports page: upload zone (drag+drop), client selector, status list with auto-refresh, cancel/delete, ImportDetailDialog with pallet table
- Validation page: header form pre-filled from extraction, editable pallet table, per-pallet edit dialog, submit button
- Reports page: paginated DataGrid with client/status filters, Q/CS score chips, click-through to detail
- Load Detail page: score cards (status/Q/CS/fail count), summary measurements table with standard comparison, per-pallet accordion, Run Analysis + Re-analyse + PDF/Excel download buttons
- Users page: user management (Admin only)
- Audit page: audit log viewer (Admin + Auditor)
- TanStack Query for all data fetching, axios interceptor for JWT injection + 401 redirect
- TypeScript: 0 errors (verified `npx tsc --noEmit`)

### Database
- 17 tables in single migration
- 3-layer data model properly separated: `import_raw_payloads` (raw) → `loads/pallets/pallet_measurements` (validated) → status/score fields + `load_summary_measurements` (analysed)
- Standards versioned via `effective_from` / `effective_to` dates + `is_active` flag
- Indexes on frequently queried fields: `imports.status+created_at`, `loads.client_id+inspection_date`, `loads.final_status`, `pallets.status`, `pallet_measurements.pallet_id+parameter_code`, `audit_logs.action+created_at`
- Audit logs have no `updated_at` — effectively immutable once inserted
- Seed data: 5 default roles inserted in migration

---

## D. MISSING FEATURES

### Critical Missing
1. **`backend/app/api/v1/reports.py`** — Still a placeholder stub. The route `/api/v1/reports/` returns `{"message": "reports endpoint — implementation pending"}`. This file needs to either be removed (since `/loads/` serves the same purpose) or reimplemented.
2. **Celery `run_analysis` task** (`tasks.py` line 88–92) — Still the original Phase 6 stub body: `return {"status": "pending", "message": "Decision engine not yet implemented"}`. The decision engine exists in `decision_engine.py` but is never called from Celery; only the HTTP endpoint `POST /loads/{id}/analyse` calls it.
3. **Original PDF download endpoint** — No endpoint exists to retrieve the uploaded source PDF. `original_file_path` is stored in the DB but never exposed via API. Phase 7 requires this.

### High Priority Missing
4. **`backend/app/api/v1/templates.py`** — Still a placeholder stub (`{"message": "reports endpoint — implementation pending"}`).
5. **`.env` local startup documentation** — The README only documents Docker Compose startup. No documented command for local dev that correctly passes env vars to uvicorn.
6. **`EXPORT_DIR` not in `main.py` lifespan** — Only `UPLOAD_DIR` is created on startup; `EXPORT_DIR` is not. First export will fail if directory doesn't exist.
7. **`run_analysis` Celery task not wired** — Analysis only works via the HTTP `POST /loads/{id}/analyse` endpoint. Async queue-based analysis never triggers.
8. **Re-validation guard in ValidationPage** — The submit button is disabled if `pallets.length === 0`, but the backend `ValidationSubmit` schema also requires at least one pallet. If data is inconsistent, the 422 error from the backend is not clearly shown to the user.

### Medium Priority Missing
9. **Corrective Actions** — Model `corrective_actions` exists in DB + ORM but has no API endpoints and no frontend.
10. **Seed data** — No seed script for Agroberries client, sample standards, sample score rules, or test users. DB only has the 5 role rows from migration. (Actual data exists because someone added it manually, but there is no reproducible seed.)
11. **Frontend templates tab** — No TemplatesTab in Settings page. The `templates.py` router is a stub.
12. **`main.py` does not create `EXPORT_DIR`** — Only `UPLOAD_DIR` is mkdir'd at startup.

### Low Priority Missing
13. **Token refresh logic in frontend** — The axios interceptor redirects to login on 401 but does not attempt a token refresh first. When the 60-minute access token expires, users are logged out instead of silently refreshed.
14. **Pagination on `GET /loads/`** — The load list uses `total_pallets` from the Load record for display but the actual pallet count is the number of Pallet rows. These can diverge after re-validation.
15. **`applied_standard_ref` field** — `Load.applied_standard_ref` column exists in DB and ORM but the decision engine never populates it.
16. **Docker Compose volume for exports** — `docker-compose.yml` mounts `uploads_data` volume but does not mount a separate `exports_data` volume. Generated PDFs/Excel would be lost on container restart.

---

## E. BUGS / BROKEN FEATURES

### BUG-001 — CRITICAL: `.env` not found in local development
**Description:** When running uvicorn from `backend/` directory (the natural working directory), pydantic-settings resolves `env_file=".env"` relative to that directory. The `.env` file is at the project root. As a result, `POSTGRES_PASSWORD` defaults to `"change_me"`, the DB connection fails, and every authenticated endpoint returns HTTP 500.
**Affected module:** `backend/app/core/config.py`
**Severity:** Critical — blocks all local development without a specific workaround
**Reproduction:**
```bash
cd AppAnalyseQuality/backend
.\venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000
# Health check passes but POST /auth/login → HTTP 500
```
**Confirmed via:**
```python
# Running from backend/ dir:
from app.core.config import settings
print(settings.POSTGRES_PASSWORD)  # → "change_me"
```
**Suggested fix (Option A — minimal, no code change):** Always start uvicorn from the project root:
```bash
cd AppAnalyseQuality
set PYTHONPATH=backend
backend\venv\Scripts\uvicorn.exe app.main:app --app-dir backend --host 0.0.0.0 --port 8000
```
**Suggested fix (Option B — code change):** Change `env_file` to use an absolute/relative path:
```python
# In config.py:
import os
_ENV_FILE = os.path.join(os.path.dirname(__file__), '..', '..', '..', '.env')
model_config = SettingsConfigDict(env_file=_ENV_FILE, ...)
```

---

### BUG-002 — HIGH: `run_analysis` Celery task is still a stub
**Description:** The Celery task `run_analysis` in `tasks.py` (lines 88–92) returns `{"status": "pending", "message": "Decision engine not yet implemented (Phase 6)"}`. The actual decision engine exists in `decision_engine.py` but is never called from Celery. Only the synchronous HTTP endpoint `POST /loads/{id}/analyse` calls it.
**Affected module:** `backend/app/workers/tasks.py`
**Severity:** High — async analysis queue never works; only synchronous endpoint works
**Suggested fix:**
```python
@celery_app.task(bind=True, name="app.workers.tasks.run_analysis", max_retries=2)
def run_analysis(self, load_id: int, user_id: int) -> dict:
    from app.db.session import SessionLocal
    from app.services.decision_engine import analyse_load
    db = SessionLocal()
    try:
        return analyse_load(db, load_id, user_id)
    except Exception as exc:
        db.rollback()
        raise self.retry(exc=exc, countdown=30)
    finally:
        db.close()
```

---

### BUG-003 — HIGH: `reports.py` API is still a placeholder
**Description:** `GET /api/v1/reports/` returns `{"message": "reports endpoint — implementation pending"}`. Since the `LoadDetailPage.tsx` and `ReportsPage.tsx` both use `/loads/` endpoints (not `/reports/`), this stub creates a confusing dead route.
**Affected module:** `backend/app/api/v1/reports.py`
**Severity:** High — route is misleading and not useful
**Suggested fix:** Either replace `reports.py` with a redirect/alias to `/loads/`, or repurpose it as a report-specific endpoint that includes client/product names from joins for richer display.

---

### BUG-004 — HIGH: `EXPORT_DIR` not created at startup
**Description:** `main.py` lifespan creates `UPLOAD_DIR` but not `EXPORT_DIR`. The first call to `POST /exports/load/{id}/pdf` or `xlsx` will fail with a `FileNotFoundError` if `EXPORT_DIR` doesn't already exist.
**Affected module:** `backend/app/main.py`
**Severity:** High — first export attempt fails on a fresh install
**Suggested fix:**
```python
# In lifespan():
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.EXPORT_DIR, exist_ok=True)
```

---

### BUG-005 — MEDIUM: Docker Compose has no `exports_data` volume
**Description:** `docker-compose.yml` mounts `uploads_data:/app/storage/uploads` but no corresponding volume for exports. Generated PDF/Excel files are written to the container filesystem and lost on container restart.
**Affected module:** `docker-compose.yml`
**Severity:** Medium — data loss on Docker restart in the Docker environment
**Suggested fix:** Add `exports_data:/app/storage/exports` to both backend and worker service volumes.

---

### BUG-006 — MEDIUM: No token refresh in frontend axios interceptor
**Description:** When the 60-minute JWT access token expires, the 401 interceptor clears localStorage and redirects to `/login`. It never attempts `POST /auth/refresh` first.
**Affected module:** `frontend/src/api/axiosClient.ts`
**Severity:** Medium — users are unexpectedly logged out after 60 minutes of activity
**Suggested fix:** Add refresh token logic to the 401 interceptor before redirect.

---

### BUG-007 — LOW: README build phase table is outdated
**Description:** `README.md` shows Phase 1 as "✅ Complete" and Phases 2–9 as "Pending". This is significantly out of date.
**Affected module:** `README.md`
**Severity:** Low — documentation only

---

## F. TEST RESULTS

### Automated Tests
```
backend/app/tests/__init__.py   (empty file — no tests written)
```
**Result: ZERO automated tests exist.** No pytest tests, no integration tests, no end-to-end tests.

### Manual API Tests (performed during audit)

| Test | Command | Result |
|------|---------|--------|
| Health check | `GET /health` | ✅ PASS — `{"status":"ok","version":"1.0.0"}` |
| Login (correct credentials) | `POST /auth/login` w/ valid creds | ✅ PASS (when env vars are set correctly) |
| Login (wrong credentials) | `POST /auth/login` w/ wrong password | ✅ PASS — HTTP 401 |
| Unauthenticated access | `GET /clients/` without token | ✅ PASS — HTTP 401 |
| `GET /auth/me` | With valid token | ✅ PASS — returns id, role |
| `GET /clients/` | With valid token | ✅ PASS — `total=1` |
| `GET /markets/` | With valid token | ✅ PASS — `total=4` |
| `GET /countries/` | With valid token | ✅ PASS — `total=5` |
| `GET /products/` | With valid token | ✅ PASS — `total=1` |
| `GET /varieties/` | With valid token | ✅ PASS — `total=5` |
| `GET /packaging/` | With valid token | ✅ PASS — `total=7` |
| `GET /standards/` | With valid token | ✅ PASS — `total=20` |
| `GET /score-rules/` | With valid token | ✅ PASS — `total=9` |
| `GET /imports/` | With valid token | ✅ PASS — `total=2` |
| `GET /imports/{id}` (status UPLOADED) | With valid token | ✅ PASS — payload=null (not yet extracted) |
| `GET /loads/` | With valid token | ✅ PASS — `total=0` |
| `GET /reports/` (stub) | With valid token | ✅ PASS — returns stub message |
| `GET /dashboard/` (stub) | With valid token | ✅ PASS — returns stub message |
| `GET /audit/` | With valid token | ✅ PASS — `total=20` |
| `GET /users/` | With valid token (Admin) | ✅ PASS — `total=3` |
| `GET /exports/load/1/` | With valid token | ✅ PASS — returns empty array |
| `GET /templates/` | Verified route registered | ✅ PASS — HTTP 401 without token |
| Backend import check | `python -c "from app.main import app"` | ✅ PASS |
| All routers import | `from app.api.v1 import loads, exports` | ✅ PASS |
| TypeScript compile | `npx tsc --noEmit` | ✅ PASS — 0 errors |

### Blocked Tests (require end-to-end flow)
| Test | Blocked By |
|------|-----------|
| PDF upload → extraction → READY_FOR_VALIDATION | Redis not running; sync fallback depends on file existing at UPLOAD_DIR |
| Validation form submission | Requires a READY_FOR_VALIDATION import |
| Decision engine via HTTP | Requires a VALIDATED load |
| PDF export download | Requires a ANALYSED load |
| Excel export download | Requires a ANALYSED load |
| Celery worker queue | Redis not installed/running locally |

---

## G. API STATUS

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/health` | GET | None | ✅ Working |
| `/api/v1/auth/login` | POST | None | ✅ Working (when env correct) |
| `/api/v1/auth/refresh` | POST | None | ✅ Working |
| `/api/v1/auth/me` | GET | JWT | ✅ Working |
| `/api/v1/users/` | GET/POST | Admin | ✅ Working |
| `/api/v1/users/{id}` | GET/PUT | Admin | ✅ Working |
| `/api/v1/users/{id}/password` | PATCH | Admin | ✅ Working |
| `/api/v1/users/{id}/deactivate` | PATCH | Admin | ✅ Working |
| `/api/v1/roles/` | GET | Auth | ✅ Working |
| `/api/v1/clients/` | GET/POST | Auth/Admin | ✅ Working |
| `/api/v1/clients/{id}` | GET/PUT/DELETE | Auth/Admin | ✅ Working |
| `/api/v1/markets/` | GET/POST | Auth/Admin | ✅ Working |
| `/api/v1/countries/` | GET/POST | Auth/Admin | ✅ Working |
| `/api/v1/products/` | GET/POST | Auth/Admin | ✅ Working |
| `/api/v1/varieties/` | GET/POST | Auth/Admin | ✅ Working |
| `/api/v1/packaging/` | GET/POST | Auth/Admin | ✅ Working |
| `/api/v1/standards/` | GET/POST/PUT/DELETE | Auth/Admin | ✅ Working |
| `/api/v1/standards/parse-pdf` | POST | Admin | ✅ Working |
| `/api/v1/score-rules/` | GET/POST/PUT/DELETE | Auth/Admin | ✅ Working |
| `/api/v1/templates/` | GET | Auth | ⚠️ Stub (returns placeholder) |
| `/api/v1/imports/` | GET | Auth | ✅ Working |
| `/api/v1/imports/upload` | POST | Admin/QM | ✅ Working |
| `/api/v1/imports/{id}` | GET | Auth | ✅ Working |
| `/api/v1/imports/{id}/cancel` | PATCH | Admin/QM | ✅ Working |
| `/api/v1/imports/{id}/validate` | POST | Admin/QM | ✅ Working (code only; untested e2e) |
| `/api/v1/imports/{id}` | DELETE | Admin/QM | ✅ Working |
| `/api/v1/loads/` | GET | Auth | ✅ Working |
| `/api/v1/loads/{id}` | GET | Auth | ✅ Working |
| `/api/v1/loads/{id}/analyse` | POST | Admin/QM | ✅ Working (code only; untested e2e) |
| `/api/v1/reports/` | GET | Auth | ⚠️ Stub (returns placeholder message) |
| `/api/v1/exports/load/{id}/pdf` | POST | Admin/QM | ⚠️ Implemented; untested e2e; EXPORT_DIR issue |
| `/api/v1/exports/load/{id}/xlsx` | POST | Admin/QM | ⚠️ Implemented; untested e2e |
| `/api/v1/exports/load/{id}/` | GET | Auth | ✅ Working |
| `/api/v1/dashboard/` | GET | Auth | ❌ Stub (returns placeholder) |
| `/api/v1/audit/` | GET | Admin/Auditor | ✅ Working |
| `/api/v1/imports/{id}/pdf` | GET | — | ❌ Missing — original PDF download |

---

## H. UI STATUS

| Screen | Route | Status | Notes |
|--------|-------|--------|-------|
| Login | `/login` | ✅ Working | Correct URLSearchParams Content-Type |
| Dashboard | `/dashboard` | ⚠️ Stub | Shows placeholder text only |
| Imports / Upload | `/imports` | ✅ Implemented | Upload zone, status list, detail dialog, cancel/delete |
| Human Validation | `/imports/:id/validate` | ✅ Implemented | Not end-to-end tested |
| Reports List | `/reports` | ✅ Implemented | Uses `/loads/` API; status chips, filters |
| Load Detail | `/reports/:loadId` | ✅ Implemented | Score cards, pallet accordion, analysis + export buttons |
| Analytics | `/analytics` | ❌ Stub | Shows placeholder text only |
| Settings — Clients | `/settings/clients` | ✅ Working | |
| Settings — Countries/Markets | `/settings/countries-markets` | ✅ Working | |
| Settings — Products/Varieties | `/settings/products-varieties` | ✅ Working | |
| Settings — Packaging | `/settings/packaging` | ✅ Working | |
| Settings — Standards | `/settings/standards` | ✅ Working | PDF import feature included |
| Settings — Score Rules | `/settings/score-rules` | ✅ Working | |
| Settings — Templates | `/settings/templates` | ❌ Missing | No TemplatesTab component exists |
| Users | `/users` | ✅ Working | Admin-only |
| Audit Log | `/audit` | ✅ Working | Admin + Auditor |

---

## I. DATABASE STATUS

### Migration Status
- **1 migration file:** `0001_initial_schema.py` — creates all 17 tables in one operation
- **Alembic head:** confirmed at `0001`
- **Downgrade:** full downgrade script present

### Tables Present (17 total)
`roles`, `users`, `countries`, `markets`, `clients`, `products`, `varieties`, `packaging_types`, `client_specifications`, `report_templates`, `quality_standards`, `score_rules`, `imports`, `import_raw_payloads`, `loads`, `pallets`, `pallet_measurements`, `load_summary_measurements`, `generated_reports`, `corrective_actions`, `audit_logs`

### Missing Fields
- `loads.applied_standard_ref` — exists in model and migration but never populated by decision engine

### Relationship Issues
- `Pallet.measurements` uses `ondelete="RESTRICT"` at DB level but `cascade="all, delete-orphan"` in SQLAlchemy ORM. When a pallet is deleted via ORM, SQLAlchemy cascades correctly, but direct DB DELETE would fail due to RESTRICT. This is intentional for data integrity.
- `generated_reports` has no `updated_at` column (correct — it should be immutable)

### Seed Data Status
- **In migration:** 5 roles seeded automatically
- **In current DB (observed via API):** 1 client, 4 markets, 5 countries, 1 product, 5 varieties, 7 packaging types, 20 standards, 9 score rules, 3 users
- **No reproducible seed script** — data was created manually and is not version-controlled

### Data Integrity
- 3-layer separation confirmed: `import_raw_payloads` (JSONB, parser output) → `loads/pallets/pallet_measurements` (structured, human-validated) → status/score fields (decision engine output)
- Standards versioned via `effective_from` / `effective_to` + `is_active` ✅
- Audit logs have no UPDATE/DELETE API endpoints and no `updated_at` column ✅

---

## J. SECURITY STATUS

| Area | Status | Details |
|------|--------|---------|
| Password hashing | ✅ bcrypt | `passlib[bcrypt]` with `CryptContext(schemes=["bcrypt"])` |
| JWT tokens | ✅ | `python-jose`, access (60 min) + refresh (7 days) tokens, `type` claim checked |
| RBAC enforcement | ✅ | `require_role()` dependency on all write endpoints; verified 401 on unauth access |
| CORS | ✅ | `CORS_ORIGINS` from env var, not hardcoded; defaults to localhost only |
| File upload validation | ✅ | `.pdf` extension check + 50MB size limit in `import_service.py` |
| Uploaded PDFs not public | ✅ | Files stored at `UPLOAD_DIR` (not under web root), no static file serving of uploads |
| SQL injection | ✅ | All queries via SQLAlchemy ORM parameterized queries |
| Secrets in env vars | ✅ | `SECRET_KEY`, `POSTGRES_PASSWORD` in `.env`, not hardcoded |
| `.env` in `.gitignore` | ✅ | Confirmed |
| Audit logs | ✅ | Login, all CRUD, import upload/validate/analyse, export actions logged |
| Standards parse-pdf | ⚠️ | 20MB limit enforced, but checks `file.size` which may be None for streamed uploads — use `len(await file.read())` instead |
| PDF size validation | ✅ | Import upload: reads bytes first, checks `len(pdf_bytes) > 50MB` (correct approach) |
| Error exposure | ✅ | FastAPI default 500 does not expose traceback to client in production mode |
| bcrypt version warning | ⚠️ | `passlib` logs `"(trapped) error reading bcrypt version"` on startup — cosmetic only, passwords hash/verify correctly; upgrade passlib to ≥1.7.5 or use `bcrypt` 4.1.x |
| Token refresh in frontend | ⚠️ | No refresh attempt before logout on 401 — see BUG-006 |
| Hardcoded credentials | ✅ | None found |
| Database connection string | ✅ | Built from env vars, never hardcoded |

---

## K. PHASE 7 READINESS DECISION

### Is Phase 7 complete?
**No. Phase 7 is approximately 60% complete.**

**Done:**
- Reports list (`ReportsPage.tsx` using `/loads/` API) ✅
- Load detail page (`LoadDetailPage.tsx`) ✅
- PDF export generation (ReportLab) ✅
- Excel export generation (openpyxl) ✅
- Export API endpoints ✅
- Report filtering (client, status) ✅
- Standards comparison display in load detail ✅

**Not done:**
- Original PDF download (source file access) ❌
- `reports.py` API stub not replaced ❌
- Exports not end-to-end tested ❌
- `EXPORT_DIR` not auto-created at startup ❌
- No corrective actions UI ❌

### Can we move to Phase 8?
**Not yet.** Before moving to Phase 8 (Dashboard + Analytics), the following must be addressed:

1. Fix BUG-001 (`.env` resolution) — makes local dev reliable
2. Fix BUG-004 (`EXPORT_DIR` mkdir) — prevents export crash on fresh install
3. Fix BUG-002 (wire `run_analysis` Celery task to decision engine)
4. Add original PDF download endpoint (`GET /imports/{id}/file`)
5. Run one end-to-end test of the full workflow (upload → extract → validate → analyse → export)

### What must be fixed before Phase 8?
See Section L — items 1–5 are mandatory.

---

## L. NEXT ACTION PLAN

### 1. Critical Fixes (do first, in order)

**Fix 1A — `.env` resolution (BUG-001)**
In `backend/app/core/config.py`, change:
```python
model_config = SettingsConfigDict(env_file=".env", ...)
```
To:
```python
from pathlib import Path
_ENV_PATH = Path(__file__).parent.parent.parent.parent / ".env"
model_config = SettingsConfigDict(env_file=str(_ENV_PATH), env_file_encoding="utf-8", extra="ignore")
```

**Fix 1B — `EXPORT_DIR` mkdir (BUG-004)**
In `backend/app/main.py` lifespan:
```python
os.makedirs(settings.EXPORT_DIR, exist_ok=True)
```

**Fix 1C — Wire Celery `run_analysis` task (BUG-002)**
Replace stub body in `tasks.py` `run_analysis` with real call to `analyse_load`.

### 2. High-Priority Missing Items

**Item 2A — Original PDF download endpoint**
Add `GET /imports/{id}/file` that reads `original_file_path` from DB and streams the file:
```python
@router.get("/{import_id}/file")
def download_original_pdf(import_id: int, current_user: CurrentUser, db: DB):
    job = svc.get_import(db, import_id)
    return FileResponse(job.original_file_path, media_type="application/pdf", filename=job.file_name)
```

**Item 2B — Replace `reports.py` stub**
Either delete it (and document that `/loads/` is the canonical reports API) or implement a joined query that includes client_name, product_name, variety_name for richer list display.

**Item 2C — Add Docker Compose exports volume**
Add `exports_data:/app/storage/exports` to docker-compose.yml.

### 3. Phase 7 Completion Tasks

**Item 3A — End-to-end test of full workflow**
Using the Agroberries sample PDF, test: upload → extraction → validation → analysis → export (PDF + Excel). Document the result.

**Item 3B — Frontend: add "Download Source PDF" link in Load Detail**
Once endpoint 2A exists, add a button in `LoadDetailPage.tsx` that opens `GET /imports/{import_id}/file`.

**Item 3C — Handle export failures gracefully in UI**
Currently the download button shows no error if export fails. Add error state feedback.

### 4. Phase 8 Preparation Tasks

**Item 4A — Design dashboard KPIs**
Define: total loads this month, % PASS/HOLD/REJECT by client, average Q score trend, worst performing parameters.

**Item 4B — Add dashboard API endpoint**
Implement `GET /dashboard/` with aggregate queries (non-placeholder).

**Item 4C — Install Recharts** (already in tech stack spec)
Build `DashboardPage.tsx` with at least: KPI cards, status distribution pie chart, Q score trend line chart.

### 5. Testing Tasks (Phase 9 prep, start now)

**Item 5A — Add `conftest.py` and test DB setup**
```python
# backend/app/tests/conftest.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.base import Base
```

**Item 5B — Unit test: decision engine**
Test case: Agroberries / Sekoya Pop / Bulk
- Brix = 9.5 (below min 10.0) → FAIL, MAJOR, deviation = -0.5
- Mold = 1.5% (above max 1.0%) → FAIL, CRITICAL → pallet REJECT
- Decay = 0.5% (within 0–1.0%) → PASS

**Item 5C — Unit test: standard specificity cascade**
Verify most specific standard is selected over less specific ones for the same parameter_code.

**Item 5D — Integration test: login + protected routes**
Verify 401 on unauthenticated, 403 on wrong role, 200 on correct role.

**Item 5E — Integration test: full PDF workflow**
Upload a test PDF → poll until READY_FOR_VALIDATION → POST validate → POST analyse → GET load → check final_status.

---

## M. RECOMMENDED DEVELOPMENT ORDER

Execute in this exact order to minimize risk and build on stable ground:

```
1.  Fix BUG-001: .env path in config.py              (30 min — 2 lines changed)
2.  Fix BUG-004: EXPORT_DIR mkdir in main.py          (5 min — 1 line added)
3.  Fix BUG-002: Wire run_analysis Celery task        (15 min — replace stub body)
4.  Add GET /imports/{id}/file endpoint               (30 min — add FileResponse route)
5.  Replace reports.py stub with real implementation  (1 hour — add client/product name joins)
6.  Add exports_data Docker volume                    (5 min — docker-compose.yml)
7.  Update README with correct startup commands       (30 min)
8.  Run one full end-to-end test manually             (1 hour — document results)
9.  Add frontend "Source PDF" button in LoadDetail    (30 min)
10. Add token refresh to axios interceptor            (1 hour)
11. Write conftest.py + 5 core unit tests            (3 hours)
12. Start Phase 8: dashboard API                     (2 hours)
13. Build DashboardPage.tsx with KPI cards           (3 hours)
14. Build AnalyticsPage.tsx with Recharts            (4 hours)
15. Write 5 integration tests                        (3 hours)
16. Phase 9: security hardening                      (ongoing)
```

**Estimated time to Phase 8 entry:** ~3–4 hours of focused work (items 1–9)
**Estimated time to Phase 8 completion:** ~10 additional hours
**Estimated time to production-ready (Phase 9):** ~20+ additional hours
