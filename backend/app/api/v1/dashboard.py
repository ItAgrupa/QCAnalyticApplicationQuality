from datetime import date

from fastapi import APIRouter, Query
from sqlalchemy import func, case

from app.api.deps import CurrentUser, DB, ActiveCompanyId
from app.models.import_job import ImportJob
from app.models.load import Load
from app.models.load_summary_measurement import LoadSummaryMeasurement
from app.models.pallet import Pallet
from app.models.pallet_measurement import PalletMeasurement
from app.models.packaging_type import PackagingType
from app.models.quality_standard import QualityStandard

router = APIRouter()


@router.get("/")
def get_dashboard(
    current_user: CurrentUser,
    db: DB,
    company_id: ActiveCompanyId = None,
):
    """Aggregated KPIs, measurement averages, and Bulk vs Packaged breakdown, scoped by company if provided."""

    # ── Load status counts ────────────────────────────────────────────────────
    load_status_q = db.query(Load.final_status, func.count(Load.id))
    if company_id:
        load_status_q = load_status_q.filter(Load.company_id == company_id)
    status_rows = load_status_q.group_by(Load.final_status).all()
    status_counts = {s: c for s, c in status_rows}
    total_loads = sum(status_counts.values())

    # ── Import status counts ──────────────────────────────────────────────────
    import_status_q = db.query(ImportJob.status, func.count(ImportJob.id))
    if company_id:
        import_status_q = import_status_q.filter(ImportJob.company_id == company_id)
    import_rows = import_status_q.group_by(ImportJob.status).all()
    import_counts = {s: c for s, c in import_rows}
    pending_validation = import_counts.get("READY_FOR_VALIDATION", 0)
    total_imports = sum(import_counts.values())

    # ── This-month loads ──────────────────────────────────────────────────────
    first_of_month = date.today().replace(day=1)
    month_loads_q = (
        db.query(func.count(Load.id))
        .filter(func.date(Load.created_at) >= first_of_month)
    )
    if company_id:
        month_loads_q = month_loads_q.filter(Load.company_id == company_id)
    loads_this_month = month_loads_q.scalar() or 0

    # ── Pallet status breakdown ───────────────────────────────────────────────
    pallet_q = db.query(Pallet.status, func.count(Pallet.id))
    if company_id:
        pallet_q = pallet_q.join(Load, Pallet.load_id == Load.id).filter(Load.company_id == company_id)
    pallet_rows = pallet_q.group_by(Pallet.status).all()
    pallet_status = {s: c for s, c in pallet_rows}
    total_pallets_all = sum(pallet_status.values())
    passed_pallets  = pallet_status.get("PASS", 0)
    failed_pallets  = pallet_status.get("FAIL", 0) + pallet_status.get("REJECT", 0)
    hold_pallets    = pallet_status.get("HOLD", 0)
    analysed_pallets = passed_pallets + failed_pallets + hold_pallets
    pass_rate = round(passed_pallets / analysed_pallets * 100, 1) if analysed_pallets > 0 else None

    # ── Live quality standards lookup ─────────────────────────────────────────
    std_q = (
        db.query(QualityStandard)
        .filter(
            QualityStandard.is_active == True,  # noqa: E712
            (QualityStandard.effective_to.is_(None)) |
            (QualityStandard.effective_to >= date.today()),
        )
    )
    if company_id:
        std_q = std_q.filter(
            (QualityStandard.company_id == company_id) | (QualityStandard.company_id.is_(None))
        )
    std_rows = std_q.order_by(
        QualityStandard.parameter_code,
        case((QualityStandard.variety_id.is_(None), 0), else_=1),
        case((QualityStandard.packaging_type_id.is_(None), 0), else_=1),
        QualityStandard.id.desc(),
    ).all()

    live_standards: dict[str, dict] = {}
    for s in std_rows:
        if s.parameter_code not in live_standards:
            live_standards[s.parameter_code] = {
                "standard_min": float(s.min_value) if s.min_value is not None else None,
                "standard_max": float(s.max_value) if s.max_value is not None else None,
            }

    # ── Cross-load measurement averages ──────────────────────────────────────
    sm_q = (
        db.query(
            LoadSummaryMeasurement.parameter_code,
            LoadSummaryMeasurement.parameter_name,
            LoadSummaryMeasurement.unit,
            func.avg(LoadSummaryMeasurement.average_value).label("avg_value"),
            func.avg(LoadSummaryMeasurement.max_value).label("avg_max"),
            func.avg(LoadSummaryMeasurement.min_value).label("avg_min"),
        )
        .filter(LoadSummaryMeasurement.average_value.isnot(None))
    )
    if company_id:
        sm_q = sm_q.join(Load, LoadSummaryMeasurement.load_id == Load.id).filter(Load.company_id == company_id)
    sm_rows = (
        sm_q.group_by(
            LoadSummaryMeasurement.parameter_code,
            LoadSummaryMeasurement.parameter_name,
            LoadSummaryMeasurement.unit,
        )
        .order_by(LoadSummaryMeasurement.parameter_name)
        .all()
    )

    # Worst recorded value per parameter (from pallet-level measurements)
    pm_q = (
        db.query(
            PalletMeasurement.parameter_code,
            func.max(PalletMeasurement.value_numeric).label("max_value"),
        )
        .filter(PalletMeasurement.value_numeric.isnot(None))
    )
    if company_id:
        pm_q = (
            pm_q.join(Pallet, PalletMeasurement.pallet_id == Pallet.id)
            .join(Load, Pallet.load_id == Load.id)
            .filter(Load.company_id == company_id)
        )
    pm_agg_rows = pm_q.group_by(PalletMeasurement.parameter_code).all()
    pm_max_by_code = {r.parameter_code: float(r.max_value) for r in pm_agg_rows}

    measurement_averages = [
        {
            "parameter_code": r.parameter_code,
            "parameter_name": r.parameter_name,
            "unit": r.unit or "",
            "avg_value": round(float(r.avg_value), 2) if r.avg_value is not None else None,
            "avg_max":   round(float(r.avg_max),   2) if r.avg_max   is not None else None,
            "avg_min":   round(float(r.avg_min),   2) if r.avg_min   is not None else None,
            "max_value": round(pm_max_by_code.get(r.parameter_code, 0.0), 2),
            "standard_min": live_standards.get(r.parameter_code, {}).get("standard_min"),
            "standard_max": live_standards.get(r.parameter_code, {}).get("standard_max"),
        }
        for r in sm_rows
    ]

    # ── Bulk vs Packaged breakdown ────────────────────────────────────────────
    bulk_q = (
        db.query(
            PackagingType.is_bulk.label("is_bulk"),
            PalletMeasurement.parameter_code,
            PalletMeasurement.parameter_name,
            PalletMeasurement.unit,
            func.avg(PalletMeasurement.value_numeric).label("avg_value"),
        )
        .join(Load, Load.packaging_type_id == PackagingType.id)
        .join(Pallet, Pallet.load_id == Load.id)
        .join(PalletMeasurement, PalletMeasurement.pallet_id == Pallet.id)
        .filter(PalletMeasurement.value_numeric.isnot(None))
    )
    if company_id:
        bulk_q = bulk_q.filter(Load.company_id == company_id)
    bulk_rows = (
        bulk_q.group_by(
            PackagingType.is_bulk,
            PalletMeasurement.parameter_code,
            PalletMeasurement.parameter_name,
            PalletMeasurement.unit,
        )
        .all()
    )

    packaging_breakdown: dict[str, dict[str, float]] = {"bulk": {}, "packaged": {}}
    for r in bulk_rows:
        key = "bulk" if r.is_bulk else "packaged"
        if r.avg_value is not None:
            packaging_breakdown[key][r.parameter_code] = round(float(r.avg_value), 2)

    # ── Recent imports (last 8) ───────────────────────────────────────────────
    recent_imports_q = db.query(ImportJob)
    if company_id:
        recent_imports_q = recent_imports_q.filter(ImportJob.company_id == company_id)
    recent_imports = [
        {
            "id": j.id,
            "file_name": j.file_name,
            "status": j.status,
            "client_id": j.client_id,
            "extraction_confidence": float(j.extraction_confidence) if j.extraction_confidence else None,
            "created_at": j.created_at.isoformat() if j.created_at else None,
        }
        for j in recent_imports_q.order_by(ImportJob.id.desc()).limit(8).all()
    ]

    # ── Recent loads (last 8) ─────────────────────────────────────────────────
    recent_loads_q = db.query(Load)
    if company_id:
        recent_loads_q = recent_loads_q.filter(Load.company_id == company_id)
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
        for lo in recent_loads_q.order_by(Load.id.desc()).limit(8).all()
    ]

    return {
        "total_loads": total_loads,
        "total_imports": total_imports,
        "loads_this_month": loads_this_month,
        "pending_validation": pending_validation,
        "load_status_counts": status_counts,
        "import_status_counts": import_counts,
        "total_pallets": total_pallets_all,
        "analysed_pallets": analysed_pallets,
        "passed_pallets": passed_pallets,
        "failed_pallets": failed_pallets,
        "hold_pallets": hold_pallets,
        "pass_rate": pass_rate,
        "measurement_averages": measurement_averages,
        "packaging_breakdown": packaging_breakdown,
        "recent_imports": recent_imports,
        "recent_loads": recent_loads,
    }
