import io
from typing import Annotated, Any
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

import pdfplumber

from app.api.deps import CurrentUser, DB, require_role
from app.core.permissions import RoleName
from app.models.client import Client
from app.models.report_template import ReportTemplate
from app.schemas.template import TemplateCreate, TemplateResponse, ParserInfo
from app.services.parsers.registry import PARSER_REGISTRY

router = APIRouter()
AdminOnly = Annotated[CurrentUser, Depends(require_role(RoleName.ADMIN))]

_PARSER_DESCRIPTIONS: dict[str, str] = {
    "agroberries_v1": "Agroberries Europe BV — standard inspection report",
    "bwqcin_v1":      "WINTERWOOD / BWQCINReport — buyer-side QC report",
}


@router.get("/parsers", response_model=list[ParserInfo])
def list_parsers(current_user: CurrentUser):
    """Return all registered PDF parser types available for template assignment."""
    return [
        ParserInfo(
            key=p.NAME,
            version=p.VERSION,
            description=_PARSER_DESCRIPTIONS.get(p.NAME, p.NAME),
        )
        for p in PARSER_REGISTRY.values()
    ]


@router.post("/detect", response_model=list[dict[str, Any]])
async def detect_parser(current_user: CurrentUser, file: UploadFile = File(...)):
    """Upload a sample PDF report — returns each parser ranked by match confidence.

    The best match (highest confidence, recognised=True) should be used as the
    parser_key when creating the client's report template.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    if file.size and file.size > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 20 MB)")

    pdf_bytes = await file.read()

    # Extract text from first two pages for fingerprint matching
    text_sample = ""
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages[:2]:
                text_sample += (page.extract_text() or "") + "\n"
    except Exception:
        raise HTTPException(status_code=422, detail="Could not read PDF — file may be corrupted or password-protected")

    results: list[dict[str, Any]] = []
    for key, parser in PARSER_REGISTRY.items():
        recognized = parser.can_parse(text_sample)
        confidence = 0.0
        sample: dict[str, Any] = {}
        error: str | None = None

        if recognized:
            try:
                parsed = parser.parse(pdf_bytes)
                confidence = parsed.confidence
                sample = {
                    "load_reference":   parsed.load_reference,
                    "product_name":     parsed.product_name,
                    "inspection_date":  parsed.inspection_date,
                    "client_name":      parsed.client_name,
                    "origin_country":   parsed.origin_country,
                    "total_pallets":    parsed.total_pallets or len(parsed.pallets),
                    "total_cases":      parsed.total_cases,
                }
            except Exception as exc:
                confidence = 0.3  # recognised fingerprint but parse failed
                error = str(exc)[:120]

        results.append({
            "parser_key":   key,
            "description":  _PARSER_DESCRIPTIONS.get(key, key),
            "recognized":   recognized,
            "confidence":   round(confidence, 2),
            "sample":       sample,
            "error":        error,
        })

    # Sort: recognised first, then by confidence descending
    results.sort(key=lambda r: (not r["recognized"], -r["confidence"]))
    return results


@router.get("/", response_model=list[TemplateResponse])
def list_templates(current_user: CurrentUser, db: DB, client_id: int | None = None):
    q = db.query(ReportTemplate)
    if client_id:
        q = q.filter(ReportTemplate.client_id == client_id)
    return q.order_by(ReportTemplate.client_id, ReportTemplate.id).all()


@router.post("/", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
def create_template(data: TemplateCreate, current_user: AdminOnly, db: DB):
    # Validate client exists
    client = db.get(Client, data.client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Validate parser key exists in registry
    if data.parser_key not in PARSER_REGISTRY:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown parser key '{data.parser_key}'. Available: {list(PARSER_REGISTRY.keys())}",
        )

    # Deactivate any existing active template for this client
    db.query(ReportTemplate).filter(
        ReportTemplate.client_id == data.client_id,
        ReportTemplate.is_active == True,
    ).update({"is_active": False})

    template = ReportTemplate(
        client_id=data.client_id,
        template_name=data.template_name,
        template_version=data.template_version,
        file_type=data.file_type,
        parser_key=data.parser_key,
        is_active=True,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_template(template_id: int, current_user: AdminOnly, db: DB):
    template = db.get(ReportTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    template.is_active = False
    db.commit()
