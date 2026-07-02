"""Celery task definitions."""
import logging
from decimal import Decimal

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="app.workers.tasks.run_extraction", max_retries=3)
def run_extraction(self, import_id: int) -> dict:
    """Extract structured data from a PDF upload.
    Updates import status: EXTRACTING -> READY_FOR_VALIDATION | EXTRACTION_FAILED.
    """
    from app.services.extraction_service import run_extraction_sync
    logger.info(f"[run_extraction] import_id={import_id}")
    try:
        return run_extraction_sync(import_id)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=30)


@celery_app.task(bind=True, name="app.workers.tasks.run_analysis", max_retries=2)
def run_analysis(self, load_id: int, standard_version: str | None = None) -> dict:
    """Apply quality standards to a validated load. Implemented in Phase 6."""
    logger.info(f"[run_analysis] load_id={load_id}")
    return {"status": "pending", "message": "Decision engine not yet implemented (Phase 6)"}
