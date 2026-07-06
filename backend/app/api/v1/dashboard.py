from datetime import date

from fastapi import APIRouter
from sqlalchemy import func

from app.api.deps import CurrentUser, DB
from app.models.import_job import ImportJob
from app.models.load import Load
from app.models.load_summary_measurement import LoadSummaryMeasurement
from app.models.pallet import Pallet
from app.models.pallet_measurement import PalletMeasurement
from app.models.packaging_type import PackagingType

router = APIRouter()


@router.get("/")
def get_dashboard(current_user: CurrentUser, db: DB):
    """Aggregated KPIs, measurement averages, and Bulk vs Packaged breakdown."""

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

    # ── Pallet status breakdown ───────────────────────────────────────────────
    pallet_rows = (
        db.query(Pallet.status, func.count(Pallet.id))
        .group_by(Pallet.status)
        .all()
    )
    pallet_status = {s: c for s, c in pallet_rows}
    total_pallets_all = sum(pallet_status.values())
    passed_pallets  = pallet_status.get("PASS", 0)
    failed_pallets  = pallet_status.get("FAIL", 0) + pallet_status.get("REJECT", 0)
    hold_pallets    = pallet_status.get("HOLD", 0)
    analysed_pallets = passed_pallets + failed_pallets + hold_pallets
    pass_rate = round(passed_pallets / analysed_pallets * 100, 1) if analysed_pallets > 0 else None

    # ── Cross-load measurement averages ──────────────────────────────────────
    # Average each parameter across all loads using load_summary_measurements
    # (already pre-computed by the decision engine per load)
    sm_rows = (
        db.query(
            LoadSummaryMeasurement.parameter_code,
            LoadSummaryMeasurement.parameter_name,
            LoadSummaryMeasurement.unit,
            func.avg(LoadSummaryMeasurement.average_value).label("avg_value"),
            func.avg(LoadSummaryMeasurement.max_value).label("avg_max"),
            func.avg(LoadSummaryMeasurement.min_value).label("avg_min"),
            func.max(LoadSummaryMeasurement.standard_min).label("standard_min"),
            func.max(LoadSummaryMeasurement.standard_max).label("standard_max"),
        )
        .filter(LoadSummaryMeasurement.average_value.isnot(None))
        .group_by(
            LoadSummaryMeasurement.parameter_code,
            LoadSummaryMeasurement.parameter_name,
            LoadSummaryMeasurement.unit,
        )
        .order_by(LoadSummaryMeasurement.parameter_name)
        .all()
    )

    # Grab worst-case and standards from individual pallet_measurements
    # (decision engine stores standard_min/max there after analysis)
    pm_agg_rows = (
        db.query(
            PalletMeasurement.parameter_code,
            func.max(PalletMeasurement.value_numeric).label("max_value"),
            func.max(PalletMeasurement.standard_min).label("standard_min"),
            func.max(PalletMeasurement.standard_max).label("standard_max"),
        )
        .filter(PalletMeasurement.value_numeric.isnot(None))
        .group_by(PalletMeasurement.parameter_code)
        .all()
    )
    pm_by_code = {
        r.parameter_code: {
            "max_value":    float(r.max_value)    if r.max_value    is not None else 0.0,
            "standard_min": float(r.standard_min) if r.standard_min is not None else None,
            "standard_max": float(r.standard_max) if r.standard_max is not None else None,
        }
        for r in pm_agg_rows
    }

    measurement_averages = [
        {
            "parameter_code": r.parameter_code,
            "parameter_name": r.parameter_name,
            "unit": r.unit or "",
            "avg_value": round(float(r.avg_value), 2) if r.avg_value is not None else None,
            "avg_max":   round(float(r.avg_max),   2) if r.avg_max   is not None else None,
            "avg_min":   round(float(r.avg_min),   2) if r.avg_min   is not None else None,
            # Prefer pallet-level standards (populated by decision engine) over summary-level
            "max_value":    round(pm_by_code.get(r.parameter_code, {}).get("max_value", 0), 2),
            "standard_min": (
                float(r.standard_min) if r.standard_min is not None
                else pm_by_code.get(r.parameter_code, {}).get("standard_min")
            ),
            "standard_max": (
                float(r.standard_max) if r.standard_max is not None
                else pm_by_code.get(r.parameter_code, {}).get("standard_max")
            ),
        }
        for r in sm_rows
    ]

    # ── Bulk vs Packaged breakdown ────────────────────────────────────────────
    # Join loads → packaging_types → pallets → pallet_measurements
    bulk_rows = (
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
        .group_by(
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
        # ── Summary counts ──
        "total_loads": total_loads,
        "total_imports": total_imports,
        "loads_this_month": loads_this_month,
        "pending_validation": pending_validation,
        "load_status_counts": status_counts,
        "import_status_counts": import_counts,
        # ── Pallet quality ──
        "total_pallets": total_pallets_all,
        "analysed_pallets": analysed_pallets,   # = passed + failed + hold (decision made)
        "passed_pallets": passed_pallets,
        "failed_pallets": failed_pallets,
        "hold_pallets": hold_pallets,
        "pass_rate": pass_rate,                 # = passed / analysed_pallets × 100
        # ── Measurement averages ──
        "measurement_averages": measurement_averages,
        "packaging_breakdown": packaging_breakdown,
        # ── Activity ──
        "recent_imports": recent_imports,
        "recent_loads": recent_loads,
    }
