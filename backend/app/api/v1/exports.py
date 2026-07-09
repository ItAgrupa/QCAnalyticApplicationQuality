"""Exports API — Phase 7.

POST /exports/load/{load_id}/pdf   → generate + download PDF
POST /exports/load/{load_id}/xlsx  → generate + download Excel
GET  /exports/load/{load_id}/      → list previously generated files
"""
from __future__ import annotations

import os
from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, DB, require_role
from app.core.config import settings
from app.core.permissions import RoleName
from app.models.generated_report import GeneratedReport
from app.models.load import Load
from app.services.audit_service import log_action
from app.services.report_generator import generate_pdf, generate_xlsx, generate_analytics_pdf

router = APIRouter()
AdminOrQM = Annotated[CurrentUser, Depends(require_role(RoleName.ADMIN, RoleName.QUALITY_MANAGER))]


def _record_and_serve(
    db: Session,
    load_id: int,
    user_id: int,
    file_path,
    media_type: str,
    report_type: str,
) -> FileResponse:
    """Persist a GeneratedReport record then stream the file."""
    record = GeneratedReport(
        load_id=load_id,
        report_type=report_type,
        file_path=str(file_path),
        generated_by_user_id=user_id,
        created_at=datetime.utcnow(),
    )
    db.add(record)
    log_action(
        db,
        action="REPORT_EXPORTED",
        entity_type="Load",
        entity_id=load_id,
        user_id=user_id,
        new_value={"report_type": report_type, "file": file_path.name},
    )
    db.commit()

    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=file_path.name,
    )


@router.post("/load/{load_id}/pdf")
def export_pdf(load_id: int, current_user: AdminOrQM, db: DB):
    """Generate and download a PDF inspection report."""
    _assert_load_exists(db, load_id)
    path = generate_pdf(db, load_id)
    return _record_and_serve(db, load_id, current_user.id, path, "application/pdf", "pdf")


@router.post("/load/{load_id}/xlsx")
def export_xlsx(load_id: int, current_user: AdminOrQM, db: DB):
    """Generate and download an Excel workbook."""
    _assert_load_exists(db, load_id)
    path = generate_xlsx(db, load_id)
    return _record_and_serve(
        db, load_id, current_user.id, path,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xlsx",
    )


@router.get("/load/{load_id}/")
def list_exports(load_id: int, current_user: CurrentUser, db: DB):
    """List previously generated reports for a load."""
    records = (
        db.query(GeneratedReport)
        .filter(GeneratedReport.load_id == load_id)
        .order_by(GeneratedReport.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": r.id,
            "report_type": r.report_type,
            "file_name": os.path.basename(r.file_path),
            "created_at": r.created_at.isoformat(),
        }
        for r in records
    ]


@router.post("/analytics/pdf")
def export_analytics_pdf(
    current_user: CurrentUser,
    db: DB,
    months: int = Query(default=12, ge=1, le=60),
    client_id: Optional[int] = Query(default=None),
    period: str = Query(default="monthly"),
):
    """Generate and download an analytics summary PDF."""
    path = generate_analytics_pdf(db, months=months, client_id=client_id, period=period)
    log_action(db, action="ANALYTICS_EXPORTED", entity_type="Analytics",
               user_id=current_user.id,
               new_value={"months": months, "client_id": client_id, "period": period})
    db.commit()
    return FileResponse(path=str(path), media_type="application/pdf", filename=path.name)


def _assert_load_exists(db: Session, load_id: int):
    if not db.get(Load, load_id):
        raise HTTPException(status_code=404, detail="Load not found")
