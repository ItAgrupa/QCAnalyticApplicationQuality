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

        parser = detect_parser(first_page_text) or get_parser("agroberries_v1")
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
