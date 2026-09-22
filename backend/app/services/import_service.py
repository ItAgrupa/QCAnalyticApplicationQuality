"""Import job service — file upload, status tracking, list/get."""
from __future__ import annotations

import hashlib
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.models.import_job import ImportJob
from app.models.import_raw_payload import ImportRawPayload
from app.models.client import Client
from app.schemas.common import PaginatedResponse
from app.schemas.import_job import ImportJobResponse, ImportJobDetailResponse
from app.services.audit_service import log_action


MAX_PDF_SIZE = 50 * 1024 * 1024  # 50 MB


def _build_response(job: ImportJob) -> ImportJobResponse:
    return ImportJobResponse(
        id=job.id,
        company_id=job.company_id,
        client_id=job.client_id,
        file_name=job.file_name,
        file_type=job.file_type,
        status=job.status,
        extraction_confidence=float(job.extraction_confidence) if job.extraction_confidence else None,
        error_message=job.error_message,
        created_at=job.created_at,
        updated_at=job.updated_at,
        client_name=job.client.name if job.client else None,
    )


def _build_detail(job: ImportJob) -> ImportJobDetailResponse:
    payload_obj = job.raw_payload
    return ImportJobDetailResponse(
        id=job.id,
        company_id=job.company_id,
        client_id=job.client_id,
        file_name=job.file_name,
        file_type=job.file_type,
        status=job.status,
        extraction_confidence=float(job.extraction_confidence) if job.extraction_confidence else None,
        error_message=job.error_message,
        created_at=job.created_at,
        updated_at=job.updated_at,
        client_name=job.client.name if job.client else None,
        payload=payload_obj.payload_json if payload_obj else None,
        parser_version=payload_obj.parser_version if payload_obj else None,
        ocr_used=payload_obj.ocr_used if payload_obj else None,
        source_page_count=payload_obj.source_page_count if payload_obj else None,
    )


async def upload_import(
    db: Session,
    file: UploadFile,
    client_id: int,
    user_id: int,
    company_id: int | None = None,
) -> ImportJob:
    # Validate client exists
    client = db.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    # Read & size-check
    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_PDF_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 50 MB)")

    # Duplicate detection via SHA-256 content hash
    file_hash = hashlib.sha256(pdf_bytes).hexdigest()
    existing = (
        db.query(ImportJob)
        .filter(
            ImportJob.file_hash == file_hash,
            ImportJob.status != "CANCELLED",
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail={
                "message": (
                    f"This file has already been uploaded as "
                    f"'{existing.file_name}' (Import #{existing.id}, "
                    f"status: {existing.status.replace('_', ' ')}). "
                    f"Open the existing import to continue."
                ),
                "existing_import_id": existing.id,
                "existing_file_name": existing.file_name,
                "existing_status": existing.status,
            },
        )

    # Save file outside web root
    client_dir = Path(settings.UPLOAD_DIR) / str(client_id)
    client_dir.mkdir(parents=True, exist_ok=True)

    safe_name = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = client_dir / safe_name
    file_path.write_bytes(pdf_bytes)

    # Determine company: explicit company_id, or client's assigned company, fallback to 1
    effective_company_id = company_id or client.company_id or 1

    # Create ImportJob record
    job = ImportJob(
        company_id=effective_company_id,
        client_id=client_id,
        uploaded_by_user_id=user_id,
        original_file_path=str(file_path),
        file_name=file.filename,
        file_hash=file_hash,
        file_type="pdf",
        status="UPLOADED",
    )
    db.add(job)
    db.flush()  # get the ID before commit

    log_action(db, action="IMPORT_UPLOADED", entity_type="ImportJob",
               entity_id=job.id, user_id=user_id,
               new_value={"file_name": file.filename, "client_id": client_id, "company_id": effective_company_id})
    db.commit()
    db.refresh(job)
    return job


def list_imports(
    db: Session,
    page: int = 1,
    page_size: int = 25,
    client_id: int | None = None,
    status_filter: str | None = None,
    company_id: int | None = None,
) -> PaginatedResponse[ImportJobResponse]:
    q = (
        db.query(ImportJob)
        .options(joinedload(ImportJob.client))
        .order_by(ImportJob.created_at.desc())
    )
    if company_id:
        q = q.filter(ImportJob.company_id == company_id)
    if client_id:
        q = q.filter(ImportJob.client_id == client_id)
    if status_filter:
        q = q.filter(ImportJob.status == status_filter)

    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedResponse(
        items=[_build_response(j) for j in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, -(-total // page_size)),
    )


def get_import(db: Session, import_id: int) -> ImportJob:
    job = (
        db.query(ImportJob)
        .options(joinedload(ImportJob.client), joinedload(ImportJob.raw_payload))
        .filter(ImportJob.id == import_id)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Import not found")
    return job


def cancel_import(db: Session, import_id: int, user_id: int) -> ImportJob:
    job = get_import(db, import_id)
    if job.status in ("VALIDATED", "ANALYSED"):
        raise HTTPException(status_code=409, detail="Cannot cancel a completed import")
    job.status = "CANCELLED"
    log_action(db, action="IMPORT_CANCELLED", entity_type="ImportJob",
               entity_id=import_id, user_id=user_id)
    db.commit()
    db.refresh(job)
    return job


def delete_import(db: Session, import_id: int, user_id: int) -> None:
    """Hard delete — removes file from disk and all DB records regardless of status."""
    from app.models.load import Load
    from app.models.import_raw_payload import ImportRawPayload

    job = get_import(db, import_id)

    # Delete associated Load and its children first (RESTRICT FK prevents deleting import otherwise)
    load = db.query(Load).filter(Load.import_id == import_id).first()
    if load:
        # generated_reports and corrective_actions have no ORM cascade — bulk-delete them first
        try:
            from app.models.generated_report import GeneratedReport
            db.query(GeneratedReport).filter(GeneratedReport.load_id == load.id).delete(synchronize_session=False)
        except Exception:
            pass
        try:
            from app.models.corrective_action import CorrectiveAction
            db.query(CorrectiveAction).filter(CorrectiveAction.load_id == load.id).delete(synchronize_session=False)
        except Exception:
            pass
        db.delete(load)  # ORM cascade handles pallets → measurements + summary_measurements
        db.flush()

    # Delete raw payload (ImportJob.raw_payload has no cascade, FK is RESTRICT)
    db.query(ImportRawPayload).filter(ImportRawPayload.import_id == import_id).delete(synchronize_session=False)
    db.flush()

    # Remove file from disk (ignore errors)
    try:
        Path(job.original_file_path).unlink(missing_ok=True)
    except Exception:
        pass

    log_action(db, action="IMPORT_DELETED", entity_type="ImportJob",
               entity_id=import_id, user_id=user_id)
    db.delete(job)
    db.commit()
