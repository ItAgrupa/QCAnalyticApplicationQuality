from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, DB, require_role
from app.core.permissions import RoleName
from app.schemas.common import PaginatedResponse
from app.schemas.import_job import ImportJobResponse, ImportJobDetailResponse
from app.schemas.validation import ValidationSubmit, ValidationResponse, MeasurementInput, PalletInput
from app.services import import_service as svc
from app.services.validation_service import submit_validation

router = APIRouter()
AdminOrQM = Annotated[CurrentUser, Depends(require_role(RoleName.ADMIN, RoleName.QUALITY_MANAGER))]


@router.post("/upload", response_model=ImportJobResponse, status_code=status.HTTP_201_CREATED)
async def upload_pdf(
    current_user: AdminOrQM,
    db: DB,
    file: UploadFile = File(...),
    client_id: int = Form(...),
):
    """Upload a quality report PDF and run extraction synchronously before returning."""
    job = await svc.upload_import(db, file, client_id, current_user.id)

    from app.services.extraction_service import run_extraction_sync
    try:
        run_extraction_sync(job.id)
    except Exception:
        pass  # status already set to EXTRACTION_FAILED by run_extraction_sync

    return svc._build_response(svc.get_import(db, job.id))


@router.get("/", response_model=PaginatedResponse[ImportJobResponse])
def list_imports(
    current_user: CurrentUser,
    db: DB,
    client_id: int | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
):
    return svc.list_imports(db, page, page_size, client_id, status)


@router.get("/{import_id}", response_model=ImportJobDetailResponse)
def get_import(import_id: int, current_user: CurrentUser, db: DB):
    job = svc.get_import(db, import_id)
    return svc._build_detail(job)


@router.patch("/{import_id}/cancel", response_model=ImportJobResponse)
def cancel_import(import_id: int, current_user: AdminOrQM, db: DB):
    job = svc.cancel_import(db, import_id, current_user.id)
    return svc._build_response(job)


@router.post("/{import_id}/validate", response_model=ValidationResponse, status_code=status.HTTP_201_CREATED)
def validate_import(import_id: int, data: ValidationSubmit, current_user: AdminOrQM, db: DB):
    """Human-validation step: submit corrected extraction data to create a Load record."""
    return submit_validation(db, import_id, data, current_user.id)


@router.post("/{import_id}/quick-validate", response_model=ValidationResponse, status_code=status.HTTP_201_CREATED)
def quick_validate(import_id: int, current_user: AdminOrQM, db: DB):
    """Accept extracted data as-is, auto-resolving names to DB IDs. No manual editing required."""
    return _run_quick_validate(db, import_id, current_user.id)


@router.post("/{import_id}/re-extract", status_code=200)
def re_extract(import_id: int, current_user: AdminOrQM, db: DB):
    """Re-run PDF extraction and update the raw payload. Preserves import status and Load record."""
    from pathlib import Path
    import io
    from decimal import Decimal
    import pdfplumber
    from app.models.import_raw_payload import ImportRawPayload
    from app.services.parsers.registry import detect_parser, get_parser

    job = svc.get_import(db, import_id)
    pdf_path = Path(job.original_file_path)
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF file not found on disk")

    pdf_bytes = pdf_path.read_bytes()
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        first_page_text = pdf.pages[0].extract_text() or "" if pdf.pages else ""
        page_count = len(pdf.pages)

    parser = detect_parser(first_page_text) or get_parser("agroberries_v1")
    if parser is None:
        raise HTTPException(status_code=422, detail="No suitable parser found for this document")

    result = parser.parse(pdf_bytes)

    existing = db.query(ImportRawPayload).filter(ImportRawPayload.import_id == import_id).first()
    if existing:
        existing.payload_json = result.to_dict()
        existing.parser_version = f"{parser.NAME}/{parser.VERSION}"
        existing.ocr_used = result.ocr_used
        existing.source_page_count = page_count
    else:
        db.add(ImportRawPayload(
            import_id=import_id,
            payload_json=result.to_dict(),
            parser_version=f"{parser.NAME}/{parser.VERSION}",
            ocr_used=result.ocr_used,
            source_page_count=page_count,
        ))

    job.extraction_confidence = Decimal(str(round(result.confidence, 2)))
    if job.status in ("UPLOADED", "EXTRACTION_FAILED"):
        job.status = "READY_FOR_VALIDATION"
    db.commit()

    return {"import_id": import_id, "pallets": len(result.pallets), "confidence": result.confidence}


@router.delete("/{import_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_import(import_id: int, current_user: AdminOrQM, db: DB):
    svc.delete_import(db, import_id, current_user.id)


def _resolve_id(db: Session, model, *name_fields: str, value: str | None) -> int | None:
    """Case-insensitive name lookup — returns the first matching row's id."""
    if not value:
        return None
    from sqlalchemy import func
    for field in name_fields:
        col = getattr(model, field, None)
        if col is None:
            continue
        row = db.query(model).filter(func.lower(col) == value.strip().lower()).first()
        if row:
            return row.id
    return None


def _run_quick_validate(db: Session, import_id: int, user_id: int) -> ValidationResponse:
    from app.models.import_job import ImportJob
    from app.models.import_raw_payload import ImportRawPayload
    from app.models.product import Product
    from app.models.variety import Variety
    from app.models.packaging_type import PackagingType
    from app.models.country import Country

    job = db.get(ImportJob, import_id)
    if not job:
        raise HTTPException(status_code=404, detail="Import not found")
    if job.status not in ("READY_FOR_VALIDATION", "VALIDATED"):
        raise HTTPException(status_code=409, detail=f"Import is not ready for validation (status: {job.status})")

    raw = db.query(ImportRawPayload).filter(ImportRawPayload.import_id == import_id).first()
    if not raw or not raw.payload_json:
        raise HTTPException(status_code=422, detail="No extracted payload found — extraction may have failed")

    p = raw.payload_json  # dict from parser

    # Auto-resolve names → IDs
    product_id = _resolve_id(db, Product, "name", value=p.get("product_name"))
    variety_id = _resolve_id(db, Variety, "name", value=p.get("variety_name"))
    packaging_id = _resolve_id(db, PackagingType, "name", value=p.get("packaging_name"))
    country_id = _resolve_id(db, Country, "name", value=p.get("origin_country"))

    # Derive product from variety when PDF doesn't name the product explicitly
    if variety_id and not product_id:
        variety_obj = db.get(Variety, variety_id)
        if variety_obj and variety_obj.product_id:
            product_id = variety_obj.product_id

    # Parse inspection date
    inspection_date = None
    raw_date = p.get("inspection_date")
    if raw_date:
        try:
            inspection_date = date.fromisoformat(str(raw_date)[:10])
        except ValueError:
            pass

    # Build pallets from extracted data
    pallets = []
    for ep in p.get("pallets", []):
        measurements = [
            MeasurementInput(
                parameter_code=m.get("parameter_code", ""),
                parameter_name=m.get("parameter_name", m.get("parameter_code", "")),
                value_numeric=m.get("value_numeric"),
                value_text=m.get("value_text"),
                unit=m.get("unit"),
                source_column=m.get("source_column"),
            )
            for m in ep.get("measurements", [])
        ]
        # Per-pallet variety/packaging fallback to load-level
        p_variety = _resolve_id(db, Variety, "name", value=ep.get("variety_name")) or variety_id
        p_packaging = _resolve_id(db, PackagingType, "name", value=ep.get("packaging_name")) or packaging_id
        pallets.append(PalletInput(
            pallet_number=ep.get("pallet_number", f"P{len(pallets)+1}"),
            grower_code=ep.get("grower_code"),
            ggn=ep.get("ggn"),
            variety_id=p_variety,
            packaging_type_id=p_packaging,
            cases_count=ep.get("cases_count"),
            weight=ep.get("weight"),
            measurements=measurements,
        ))

    if not pallets:
        raise HTTPException(status_code=422, detail="No pallets found in extracted payload")

    payload = ValidationSubmit(
        client_id=job.client_id,
        load_reference=p.get("load_reference"),
        container_number=p.get("container_number"),
        vessel_name=p.get("vessel_name"),
        inspection_date=inspection_date,
        inspection_place=p.get("inspection_place"),
        origin_country_id=country_id,
        product_id=product_id,
        variety_id=variety_id,
        packaging_type_id=packaging_id,
        total_cases=p.get("total_cases"),
        total_pallets=p.get("total_pallets") or len(pallets),
        total_weight=p.get("total_weight"),
        pallets=pallets,
    )

    return submit_validation(db, import_id, payload, user_id)
