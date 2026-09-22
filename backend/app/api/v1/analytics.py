"""
Analytics API — time-series quality trends, parameter compliance,
grower performance, and key-metric progression for the analytics dashboard.
"""
from datetime import date, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Query
from sqlalchemy import case, func, String

from app.api.deps import CurrentUser, DB, ActiveCompanyId
from app.models.load import Load
from app.models.pallet import Pallet
from app.models.pallet_measurement import PalletMeasurement
from app.models.load_summary_measurement import LoadSummaryMeasurement

router = APIRouter()


def _cutoff(months: int) -> date:
    return date.today() - timedelta(days=months * 30)


def _trunc(period: str, col):
    """Return a date_trunc expression grouped by week or month."""
    return func.date_trunc(period if period == "month" else "week", col)


# ── Overview KPIs ─────────────────────────────────────────────────────────────

@router.get("/overview")
def analytics_overview(
    current_user: CurrentUser,
    db: DB,
    months: int = Query(default=12, ge=1, le=60),
    client_id: Optional[int] = Query(default=None),
    company_id: ActiveCompanyId = None,
):
    """Scalar KPIs: overall pass rate, avg quality score, load count, worst parameter."""
    cutoff = _cutoff(months)

    load_q = db.query(Load).filter(
        Load.inspection_date >= cutoff,
        Load.inspection_date.isnot(None),
    )
    if company_id:
        load_q = load_q.filter(Load.company_id == company_id)
    if client_id:
        load_q = load_q.filter(Load.client_id == client_id)
    load_ids = [lo.id for lo in load_q.with_entities(Load.id).all()]

    if not load_ids:
        return {
            "total_loads": 0,
            "total_pallets": 0,
            "pass_rate": None,
            "avg_quality_score": None,
            "worst_parameter": None,
            "worst_compliance_rate": None,
            "trend_vs_prev_period": None,
        }

    # Pallet counts
    pallet_agg = (
        db.query(
            func.count(Pallet.id).label("total"),
            func.sum(case((Pallet.status == "PASS", 1), else_=0)).label("passed"),
            func.sum(case((Pallet.status.in_(["FAIL", "REJECT"]), 1), else_=0)).label("failed"),
            func.sum(case((Pallet.status == "HOLD", 1), else_=0)).label("held"),
        )
        .filter(Pallet.load_id.in_(load_ids))
        .one()
    )
    total_pallets = pallet_agg.total or 0
    passed = pallet_agg.passed or 0
    failed = pallet_agg.failed or 0
    held   = pallet_agg.held   or 0
    analysed = passed + failed + held   # HOLD = not passed, must be in denominator
    pass_rate = round(passed / analysed * 100, 1) if analysed else None

    # Avg quality score
    avg_qs = (
        db.query(func.avg(Load.quality_score))
        .filter(Load.id.in_(load_ids), Load.quality_score.isnot(None))
        .scalar()
    )

    # Worst parameter (lowest compliance rate with >= 3 data points)
    param_agg = (
        db.query(
            PalletMeasurement.parameter_code,
            PalletMeasurement.parameter_name,
            func.count(PalletMeasurement.id).label("total"),
            func.sum(case((PalletMeasurement.status == "PASS", 1), else_=0)).label("passed"),
        )
        .join(Pallet, PalletMeasurement.pallet_id == Pallet.id)
        .filter(
            Pallet.load_id.in_(load_ids),
            PalletMeasurement.status.in_(["PASS", "FAIL"]),
        )
        .group_by(PalletMeasurement.parameter_code, PalletMeasurement.parameter_name)
        .having(func.count(PalletMeasurement.id) >= 3)
        .all()
    )
    worst_param = None
    worst_rate = None
    for row in param_agg:
        cr = round(row.passed / row.total * 100, 1) if row.total else None
        if cr is not None and (worst_rate is None or cr < worst_rate):
            worst_rate = cr
            worst_param = row.parameter_name

    # Trend: pass rate in current half vs previous half of the window
    mid = _cutoff(months // 2)
    def _pass_rate_in(after: date, before: Optional[date] = None):
        q = db.query(
            func.sum(case((Pallet.status == "PASS", 1), else_=0)),
            func.sum(case((Pallet.status.in_(["PASS", "FAIL", "REJECT", "HOLD"]), 1), else_=0)),
        ).join(Load, Pallet.load_id == Load.id).filter(
            Load.inspection_date >= after,
            Load.inspection_date.isnot(None),
        )
        if before:
            q = q.filter(Load.inspection_date < before)
        if client_id:
            q = q.filter(Load.client_id == client_id)
        p, t = q.one()
        return round((p or 0) / (t or 1) * 100, 1) if t else None

    curr_rate = _pass_rate_in(mid)
    prev_rate = _pass_rate_in(cutoff, mid)
    trend = None
    if curr_rate is not None and prev_rate is not None and prev_rate > 0:
        trend = round(curr_rate - prev_rate, 1)

    return {
        "total_loads": len(load_ids),
        "total_pallets": total_pallets,
        "pass_rate": pass_rate,
        "avg_quality_score": round(float(avg_qs), 1) if avg_qs else None,
        "worst_parameter": worst_param,
        "worst_compliance_rate": worst_rate,
        "trend_vs_prev_period": trend,
    }


# ── Quality trends (time-series) ──────────────────────────────────────────────

@router.get("/quality-trends")
def quality_trends(
    current_user: CurrentUser,
    db: DB,
    period: Literal["weekly", "monthly"] = "monthly",
    months: int = Query(default=12, ge=1, le=60),
    client_id: Optional[int] = Query(default=None),
    company_id: ActiveCompanyId = None,
):
    """Pass/fail pallet counts and quality score per week or month."""
    cutoff = _cutoff(months)
    bucket = _trunc(period, Load.inspection_date)

    load_q = (
        db.query(
            bucket.cast(String).label("period"),
            func.count(Load.id).label("load_count"),
            func.avg(Load.quality_score).label("avg_quality"),
        )
        .filter(
            Load.inspection_date >= cutoff,
            Load.inspection_date.isnot(None),
        )
        .group_by("period")
        .order_by("period")
    )
    if company_id:
        load_q = load_q.filter(Load.company_id == company_id)
    if client_id:
        load_q = load_q.filter(Load.client_id == client_id)
    load_rows = {r.period: r for r in load_q.all()}

    pallet_q = (
        db.query(
            bucket.cast(String).label("period"),
            func.count(Pallet.id).label("total"),
            func.sum(case((Pallet.status == "PASS", 1), else_=0)).label("passed"),
            func.sum(case((Pallet.status.in_(["FAIL", "REJECT"]), 1), else_=0)).label("failed"),
            func.sum(case((Pallet.status == "HOLD", 1), else_=0)).label("held"),
        )
        .join(Load, Pallet.load_id == Load.id)
        .filter(
            Load.inspection_date >= cutoff,
            Load.inspection_date.isnot(None),
            Pallet.status.isnot(None),
        )
        .group_by("period")
        .order_by("period")
    )
    if company_id:
        pallet_q = pallet_q.filter(Load.company_id == company_id)
    if client_id:
        pallet_q = pallet_q.filter(Load.client_id == client_id)
    pallet_rows = {r.period: r for r in pallet_q.all()}

    all_periods = sorted(set(load_rows) | set(pallet_rows))
    result = []
    for p in all_periods:
        lr = load_rows.get(p)
        pr = pallet_rows.get(p)
        passed  = int(pr.passed  or 0) if pr else 0
        failed  = int(pr.failed  or 0) if pr else 0
        held    = int(pr.held    or 0) if pr else 0
        total   = int(pr.total   or 0) if pr else 0
        analysed = passed + failed + held
        result.append({
            "period": p[:10],  # trim timestamp to date string
            "load_count":    int(lr.load_count)                      if lr else 0,
            "total_pallets": total,
            "passed":  passed,
            "failed":  failed,
            "held":    held,
            "pass_rate": round(passed / analysed * 100, 1) if analysed else None,
            "avg_quality": round(float(lr.avg_quality), 1) if lr and lr.avg_quality else None,
        })
    return result


# ── Parameter compliance ──────────────────────────────────────────────────────

@router.get("/parameter-compliance")
def parameter_compliance(
    current_user: CurrentUser,
    db: DB,
    months: int = Query(default=12, ge=1, le=60),
    client_id: Optional[int] = Query(default=None),
    company_id: ActiveCompanyId = None,
):
    """Per-parameter compliance rate, avg value, and standard threshold."""
    cutoff = _cutoff(months)

    load_ids_q = db.query(Load.id).filter(
        Load.inspection_date >= cutoff,
        Load.inspection_date.isnot(None),
    )
    if company_id:
        load_ids_q = load_ids_q.filter(Load.company_id == company_id)
    if client_id:
        load_ids_q = load_ids_q.filter(Load.client_id == client_id)
    load_ids = [r.id for r in load_ids_q.all()]

    if not load_ids:
        return []

    rows = (
        db.query(
            PalletMeasurement.parameter_code,
            PalletMeasurement.parameter_name,
            PalletMeasurement.unit,
            func.count(PalletMeasurement.id).label("total"),
            func.sum(case((PalletMeasurement.status == "PASS", 1), else_=0)).label("passed"),
            func.sum(case((PalletMeasurement.status.in_(["FAIL"]), 1), else_=0)).label("failed"),
            func.avg(PalletMeasurement.value_numeric).label("avg_value"),
            func.max(PalletMeasurement.value_numeric).label("max_value"),
            func.max(PalletMeasurement.standard_max).label("std_max"),
            func.max(PalletMeasurement.standard_min).label("std_min"),
        )
        .join(Pallet, PalletMeasurement.pallet_id == Pallet.id)
        .filter(
            Pallet.load_id.in_(load_ids),
            PalletMeasurement.status.in_(["PASS", "FAIL"]),
            PalletMeasurement.value_numeric.isnot(None),
        )
        .group_by(
            PalletMeasurement.parameter_code,
            PalletMeasurement.parameter_name,
            PalletMeasurement.unit,
        )
        .having(func.count(PalletMeasurement.id) >= 2)
        .order_by(func.count(PalletMeasurement.id).desc())
        .all()
    )

    return [
        {
            "parameter_code": r.parameter_code,
            "parameter_name": r.parameter_name,
            "unit": r.unit or "",
            "total": int(r.total),
            "passed": int(r.passed or 0),
            "failed": int(r.failed or 0),
            "compliance_rate": round(float(r.passed or 0) / r.total * 100, 1),
            "avg_value": round(float(r.avg_value), 2) if r.avg_value else None,
            "max_value": round(float(r.max_value), 2) if r.max_value else None,
            "std_max": round(float(r.std_max), 2) if r.std_max else None,
            "std_min": round(float(r.std_min), 2) if r.std_min else None,
        }
        for r in rows
    ]


# ── Grower performance ────────────────────────────────────────────────────────

@router.get("/grower-performance")
def grower_performance(
    current_user: CurrentUser,
    db: DB,
    months: int = Query(default=12, ge=1, le=60),
    client_id: Optional[int] = Query(default=None),
    company_id: ActiveCompanyId = None,
    limit: int = Query(default=12, ge=3, le=30),
):
    """Per-grower pass rate and pallet volume."""
    cutoff = _cutoff(months)

    load_ids_q = db.query(Load.id).filter(
        Load.inspection_date >= cutoff,
        Load.inspection_date.isnot(None),
    )
    if company_id:
        load_ids_q = load_ids_q.filter(Load.company_id == company_id)
    if client_id:
        load_ids_q = load_ids_q.filter(Load.client_id == client_id)
    load_ids = [r.id for r in load_ids_q.all()]

    if not load_ids:
        return []

    rows = (
        db.query(
            Pallet.grower_code,
            func.count(Pallet.id).label("total"),
            func.sum(case((Pallet.status == "PASS", 1), else_=0)).label("passed"),
            func.sum(case((Pallet.status.in_(["FAIL", "REJECT"]), 1), else_=0)).label("failed"),
            func.sum(case((Pallet.status == "HOLD", 1), else_=0)).label("held"),
        )
        .filter(
            Pallet.load_id.in_(load_ids),
            Pallet.grower_code.isnot(None),
            Pallet.grower_code != "",
            Pallet.status.in_(["PASS", "FAIL", "REJECT", "HOLD"]),
        )
        .group_by(Pallet.grower_code)
        .having(func.count(Pallet.id) >= 1)
        .order_by(func.count(Pallet.id).desc())
        .limit(limit)
        .all()
    )

    result = []
    for r in rows:
        passed = int(r.passed or 0)
        failed = int(r.failed or 0)
        held   = int(r.held   or 0)
        total  = int(r.total  or 0)
        analysed = passed + failed + held
        result.append({
            "grower_code":  r.grower_code,
            "total_pallets": total,
            "passed":  passed,
            "failed":  failed,
            "held":    held,
            "pass_rate": round(passed / analysed * 100, 1) if analysed else None,
            "fail_rate": round(failed / analysed * 100, 1) if analysed else None,
        })

    # Sort by pass_rate desc for display
    result.sort(key=lambda x: (x["pass_rate"] or 0), reverse=True)
    return result


# ── Key metric trend (Brix or any param over time) ────────────────────────────

@router.get("/metric-trend")
def metric_trend(
    current_user: CurrentUser,
    db: DB,
    param_code: str = Query(default="brix"),
    period: Literal["weekly", "monthly"] = "monthly",
    months: int = Query(default=12, ge=1, le=60),
    client_id: Optional[int] = Query(default=None),
    company_id: ActiveCompanyId = None,
):
    """Avg/min/max of a single parameter over time, with standard reference band."""
    cutoff = _cutoff(months)
    bucket = _trunc(period, Load.inspection_date)

    q = (
        db.query(
            bucket.cast(String).label("period"),
            func.avg(PalletMeasurement.value_numeric).label("avg_value"),
            func.min(PalletMeasurement.value_numeric).label("min_value"),
            func.max(PalletMeasurement.value_numeric).label("max_value"),
            func.count(PalletMeasurement.id).label("sample_count"),
            func.max(PalletMeasurement.standard_min).label("std_min"),
            func.max(PalletMeasurement.standard_max).label("std_max"),
        )
        .join(Pallet, PalletMeasurement.pallet_id == Pallet.id)
        .join(Load, Pallet.load_id == Load.id)
        .filter(
            PalletMeasurement.parameter_code == param_code,
            PalletMeasurement.value_numeric.isnot(None),
            Load.inspection_date >= cutoff,
            Load.inspection_date.isnot(None),
        )
        .group_by("period")
        .order_by("period")
    )
    if company_id:
        q = q.filter(Load.company_id == company_id)
    if client_id:
        q = q.filter(Load.client_id == client_id)

    rows = q.all()

    # Grab parameter name once
    name_row = (
        db.query(PalletMeasurement.parameter_name, PalletMeasurement.unit)
        .filter(PalletMeasurement.parameter_code == param_code)
        .first()
    )

    return {
        "parameter_code": param_code,
        "parameter_name": name_row.parameter_name if name_row else param_code,
        "unit": name_row.unit if name_row else "",
        "data": [
            {
                "period": r.period[:10],
                "avg_value": round(float(r.avg_value), 2) if r.avg_value else None,
                "min_value": round(float(r.min_value), 2) if r.min_value else None,
                "max_value": round(float(r.max_value), 2) if r.max_value else None,
                "sample_count": int(r.sample_count),
                "std_min": round(float(r.std_min), 2) if r.std_min else None,
                "std_max": round(float(r.std_max), 2) if r.std_max else None,
            }
            for r in rows
        ],
    }
