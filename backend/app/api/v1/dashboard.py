from datetime import date, timedelta

from fastapi import APIRouter
from sqlalchemy import func

from app.api.deps import CurrentUser, DB
from app.models.import_job import ImportJob
from app.models.load import Load

router = APIRouter()


@router.get("/")
def get_dashboard(current_user: CurrentUser, db: DB):
    """Aggregated KPIs and recent activity for the dashboard."""

    # ── Load status counts ────────────────────────────────────────────────────
    status_rows = (
        db.query(Load.final_status, func.count(Load.id))
        .group_by(Load.final_status)
        .all()
    )
    status_counts = {s: c for s, c in status_rows}
    total_loads = sum(status_counts.values())

    # ── Import status counts ──────────────────────────────────────────────────
    import_rows = (
        db.query(ImportJob.status, func.count(ImportJob.id))
        .group_by(ImportJob.status)
        .all()
    )
    import_counts = {s: c for s, c in import_rows}
    pending_validation = import_counts.get("READY_FOR_VALIDATION", 0)
    total_imports = sum(import_counts.values())

    # ── This-month loads ──────────────────────────────────────────────────────
    first_of_month = date.today().replace(day=1)
    loads_this_month = (
        db.query(func.count(Load.id))
        .filter(func.date(Load.created_at) >= first_of_month)
        .scalar()
    ) or 0

    # ── Recent imports (last 8) ───────────────────────────────────────────────
    recent_imports_q = (
        db.query(ImportJob)
        .order_by(ImportJob.id.desc())
        .limit(8)
        .all()
    )
    recent_imports = [
        {
            "id": j.id,
            "file_name": j.file_name,
            "status": j.status,
            "client_id": j.client_id,
            "extraction_confidence": float(j.extraction_confidence) if j.extraction_confidence else None,
            "created_at": j.created_at.isoformat() if j.created_at else None,
        }
        for j in recent_imports_q
    ]

    # ── Recent loads (last 8) ─────────────────────────────────────────────────
    recent_loads_q = (
        db.query(Load)
        .order_by(Load.id.desc())
        .limit(8)
        .all()
    )
    recent_loads = [
        {
            "id": lo.id,
            "load_reference": lo.load_reference,
            "inspection_date": lo.inspection_date.isoformat() if lo.inspection_date else None,
            "container_number": lo.container_number,
            "total_pallets": lo.total_pallets,
            "final_status": lo.final_status,
            "quality_score": float(lo.quality_score) if lo.quality_score else None,
            "condition_score": lo.condition_score,
            "main_issue": lo.main_issue,
        }
        for lo in recent_loads_q
    ]

    return {
        "total_loads": total_loads,
        "total_imports": total_imports,
        "loads_this_month": loads_this_month,
        "pending_validation": pending_validation,
        "load_status_counts": status_counts,
        "import_status_counts": import_counts,
        "recent_imports": recent_imports,
        "recent_loads": recent_loads,
    }
