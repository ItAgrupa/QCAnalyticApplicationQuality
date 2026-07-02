# ASSUMPTIONS.md

This file documents assumptions made during implementation where the specification was not explicit.

## General

- **Team size / hosting**: Unspecified. Effort expressed as person-weeks. Docker Compose is used for local/pilot; Kubernetes docs are referenced for future production.
- **Language**: UI defaults to English. Multi-language is out of scope for MVP.
- **Email / SMTP**: Password reset and notification emails are out of scope for MVP. Placeholders are included.
- **Azure Document Intelligence**: Not required for MVP. The parser registry is designed to accept an Azure DI adapter in the future. pdfplumber + PyMuPDF cover MVP.
- **File storage**: Uploaded PDFs are stored on the Docker host volume `./storage/uploads` (outside the web root). A cloud-storage adapter (S3/Azure Blob) can replace this without API changes.

## Authentication

- JWT access tokens expire after 60 minutes. Refresh tokens expire after 7 days.
- Password minimum length: 8 characters. bcrypt is used.
- No SSO/LDAP for MVP.

## Database

- Primary keys are `BIGSERIAL` (bigint auto-increment), not UUID, for simplicity and index performance. The schema allows switching to UUID without business logic changes.
- `created_at` and `updated_at` timestamps are `TIMESTAMPTZ` in UTC.
- Soft delete (`is_active` flag) is used for master data. Hard delete is not exposed via API.

## Decision Engine

- Quality score scoring formula follows the specification exactly (start 100, deduct per breach, clamp 0-100).
- When a standard is not found for a specific variety/packaging combination, the engine falls back to the product-level standard. If still not found, the analysis fails with `STANDARD_NOT_FOUND` and a clear error message.
- Score mapping thresholds: 90-100=CONFORME, 75-89=ACCEPTABLE_WITH_RESERVE, 60-74=RISK, 40-59=NON_CONFORME, 0-39=CRITICAL/REJECTED.

## Parser

- The Agroberries parser v1 targets machine-generated PDFs (digital, not scanned). If a page has < 100 characters of extracted text, the parser raises `OCR_REQUIRED` and the import is flagged for manual review or future Azure DI processing.
- Parser confidence is computed as the ratio of successfully extracted expected fields to total expected fields.
- Pallet table parsing uses `pdfplumber` table extraction with Agroberries-specific column header matching. Column order may vary slightly; matching is by header name, not position.

## Standards Entry for MVP

- Agroberries pilot standards are entered via the admin UI (parametrization module), not seeded by a migration script with hardcoded values. A seed script is provided as an optional helper for demo/testing.
- Standard effective dates: if no `effective_to` is set, the standard is considered current.

## Exports

- PDF reports use WeasyPrint with an HTML template. Charts are rendered as SVG and embedded.
- Excel exports use openpyxl with a structured multi-sheet workbook (header, pallets, measurements, summary).

## Frontend

- Axios is used for HTTP requests, wrapped by TanStack Query.
- Form validation uses React Hook Form + Zod schemas that mirror backend Pydantic schemas.
- MUI DataGrid Community edition is used (no Enterprise license required for MVP).

## Testing

- Backend tests use pytest with an in-memory SQLite DB for unit tests and a separate test PostgreSQL DB for integration tests.
- Frontend tests use Vitest + React Testing Library for critical components.
