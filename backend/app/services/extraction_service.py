"""Synchronous extraction logic — shared by Celery task and direct fallback."""
from __future__ import annotations

import io
import logging
from decimal import Decimal
from pathlib import Path

import pdfplumber

from app.db.session import SessionLocal
from app.models.import_job import ImportJob
from app.models.import_raw_payload import ImportRawPayload
from app.models.user import User
from app.schemas.user import NotificationPrefs
from app.services.email_service import send_import_ready_alert
from app.models.report_template import ReportTemplate
from app.services.parsers.registry import detect_parser, get_parser

logger = logging.getLogger(__name__)


def run_extraction_sync(import_id: int, db=None) -> dict:
    """Extract a PDF import synchronously. Safe to call without Celery/Redis."""
    close_db = db is None
    if db is None:
        db = SessionLocal()
    try:
        job = db.get(ImportJob, import_id)
        if not job:
            return {"status": "error", "message": "Import not found"}

        job.status = "EXTRACTING"
        db.commit()

        pdf_path = Path(job.original_file_path)
        pdf_bytes = pdf_path.read_bytes()

        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            first_page_text = pdf.pages[0].extract_text() or "" if pdf.pages else ""
            page_count = len(pdf.pages)

        # Prefer the parser configured on the client's active template.
        # Fall back to fingerprint detection, then hardcoded default.
        active_template = (
            db.query(ReportTemplate)
            .filter(
                ReportTemplate.client_id == job.client_id,
                ReportTemplate.is_active.is_(True),
            )
            .first()
        )

        parser = None
        if active_template and active_template.parser_key:
            parser = get_parser(active_template.parser_key)
            if parser:
                job.detected_template_id = active_template.id
                logger.info(
                    f"[extraction_service] import={import_id} "
                    f"using client template parser={parser.NAME}/{parser.VERSION}"
                )

        if parser is None:
            parser = detect_parser(first_page_text)
            if parser:
                logger.info(
                    f"[extraction_service] import={import_id} "
                    f"fingerprint detected parser={parser.NAME}/{parser.VERSION}"
                )

        if parser is None:
            parser = get_parser("agroberries_v1")

        if parser is None:
            raise ValueError("No suitable parser found for this document")

        logger.info(f"[extraction_service] import={import_id} parser={parser.NAME}/{parser.VERSION}")
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

        job.status = "READY_FOR_VALIDATION"
        job.extraction_confidence = Decimal(str(round(result.confidence, 2)))
        job.error_message = None
        db.commit()

        # Notify users who subscribed to import-ready alerts
        import os
        app_url = os.getenv("APP_URL", "http://localhost:5173")
        client_name = job.client.name if job.client else "Unknown"
        alert_users = (
            db.query(User)
            .filter(User.email_alerts_enabled.is_(True), User.is_active.is_(True))
            .all()
        )
        ready_recipients = [
            u.email for u in alert_users
            if NotificationPrefs(**(u.notification_prefs or {})).notify_import_ready
        ]
        if ready_recipients:
            send_import_ready_alert(
                recipients   = ready_recipients,
                file_name    = job.file_name,
                client_name  = client_name,
                confidence   = float(result.confidence),
                pallet_count = len(result.pallets),
                import_id    = import_id,
                app_url      = app_url,
            )

        return {
            "status": "READY_FOR_VALIDATION",
            "import_id": import_id,
            "confidence": result.confidence,
            "pallets": len(result.pallets),
        }

    except Exception as exc:
        db.rollback()
        logger.exception(f"Extraction failed for import {import_id}: {exc}")
        try:
            job = db.get(ImportJob, import_id)
            if job:
                job.status = "EXTRACTION_FAILED"
                job.error_message = str(exc)[:500]
                db.commit()
        except Exception:
            pass
        raise
    finally:
        if close_db:
            db.close()
