"""Decision engine — Phase 6.

Compares every PalletMeasurement against the applicable QualityStandard,
assigns pass/fail and severity, scores Q and CS, then rolls up pallet and
load statuses.

Standard matching uses a specificity cascade so the most specific rule wins:
    client + product + variety + packaging  (most specific)
    client + product + variety
    client + product
    client only                             (least specific)

The engine is idempotent — running it twice on the same load just overwrites
the previous results.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.import_job import ImportJob
from app.models.load import Load
from app.models.load_summary_measurement import LoadSummaryMeasurement
from app.models.pallet import Pallet
from app.models.pallet_measurement import PalletMeasurement
from app.models.quality_standard import QualityStandard
from app.models.score_rule import ScoreRule
from app.models.user import User
from app.services.audit_service import log_action
from app.services.email_service import send_load_alert

# ── Constants ─────────────────────────────────────────────────────────────────

# Higher = worse; used to determine worst pallet / load status
_STATUS_RANK = {"PASS": 0, "HOLD": 1, "REJECT": 2, "PENDING": -1}
_CS_RANK = {"A": 0, "B": 1, "C": 2, "D": 3, "O": 4}
_Q_RANK = {"1": 0, "2": 1, "3": 2, "4": 3}


# ── Standard lookup ───────────────────────────────────────────────────────────

def _find_standard(
    db: Session,
    client_id: int,
    product_id: Optional[int],
    variety_id: Optional[int],
    packaging_type_id: Optional[int],
    parameter_code: str,
    as_of: Optional[date],
) -> Optional[QualityStandard]:
    """Return the most specific active standard, or None."""
    today = as_of or date.today()

    # Build candidate list from DB once per parameter_code (caller may cache)
    q = (
        db.query(QualityStandard)
        .filter(
            QualityStandard.client_id == client_id,
            QualityStandard.parameter_code == parameter_code,
            QualityStandard.is_active.is_(True),
            QualityStandard.effective_from <= today,
        )
        .filter(
            (QualityStandard.effective_to == None) | (QualityStandard.effective_to >= today)  # noqa: E711
        )
        .all()
    )

    if not q:
        return None

    def specificity(s: QualityStandard) -> int:
        score = 0
        if s.product_id is not None:
            score += 4
        if s.variety_id is not None:
            score += 2
        if s.packaging_type_id is not None:
            score += 1
        return score

    # Filter to only standards whose optional fields are compatible
    compatible = []
    for s in q:
        if s.product_id is not None and s.product_id != product_id:
            continue
        if s.variety_id is not None and s.variety_id != variety_id:
            continue
        if s.packaging_type_id is not None and s.packaging_type_id != packaging_type_id:
            continue
        compatible.append(s)

    if not compatible:
        return None

    return max(compatible, key=specificity)


# ── Score rule lookup ─────────────────────────────────────────────────────────

def _find_score(
    db: Session,
    client_id: int,
    parameter_code: str,
    score_type: str,  # "Q" or "CS"
    value: Decimal,
) -> Optional[str]:
    """Return the score label (e.g. "1", "A") matching the value, or None."""
    rules = (
        db.query(ScoreRule)
        .filter(
            ScoreRule.client_id == client_id,
            ScoreRule.parameter_code == parameter_code,
            ScoreRule.score_type == score_type,
        )
        .all()
    )
    for r in rules:
        lo = r.min_value if r.min_value is not None else Decimal("-999999")
        hi = r.max_value if r.max_value is not None else Decimal("999999")
        if lo <= value <= hi:
            return r.score_label
    return None


# ── Core analysis ─────────────────────────────────────────────────────────────

def analyse_load(db: Session, load_id: int, user_id: int) -> dict:
    """Run the decision engine on a validated load.

    Returns a summary dict. All changes are committed inside this function.
    """
    load = (
        db.query(Load)
        .options(
            joinedload(Load.pallets).joinedload(Pallet.measurements),
            joinedload(Load.summary_measurements),
        )
        .filter(Load.id == load_id)
        .first()
    )
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")

    # Check the import is in VALIDATED state (not just UPLOADED/EXTRACTING)
    import_job = db.get(ImportJob, load.import_id)
    if import_job and import_job.status not in ("VALIDATED", "ANALYSED"):
        raise HTTPException(
            status_code=409,
            detail=f"Import is in status '{import_job.status}' — must be VALIDATED before analysis",
        )

    as_of = load.inspection_date

    # ── Per-pallet analysis ───────────────────────────────────────────────────
    load_status_rank = 0
    worst_q: Optional[str] = None
    worst_cs: Optional[str] = None
    issues: list[str] = []

    for pallet in load.pallets:
        # Effective variety / packaging at pallet level (fall back to load level)
        variety_id = pallet.variety_id or load.variety_id
        packaging_type_id = pallet.packaging_type_id or load.packaging_type_id

        pallet_status_rank = 0
        pallet_q_scores: list[str] = []
        pallet_cs_scores: list[str] = []

        for meas in pallet.measurements:
            if meas.value_numeric is None:
                # Text measurements can't be range-checked; leave PENDING
                continue

            std = _find_standard(
                db,
                client_id=load.client_id,
                product_id=load.product_id,
                variety_id=variety_id,
                packaging_type_id=packaging_type_id,
                parameter_code=meas.parameter_code,
                as_of=as_of,
            )

            if std is None:
                # No configured standard — no limit to fail against, so pass
                meas.status = "PASS"
                meas.deviation = Decimal("0")
                continue

            meas.standard_min = std.min_value
            meas.standard_max = std.max_value
            meas.severity = std.severity

            # Compute deviation (positive = above max, negative = below min)
            val = meas.value_numeric
            if std.max_value is not None and val > std.max_value:
                meas.deviation = val - std.max_value
                meas.status = "FAIL"
            elif std.min_value is not None and val < std.min_value:
                meas.deviation = val - std.min_value  # negative
                meas.status = "FAIL"
            else:
                meas.deviation = Decimal("0")
                meas.status = "PASS"

            # Q score
            q = _find_score(db, load.client_id, meas.parameter_code, "Q", val)
            if q:
                pallet_q_scores.append(q)

            # CS score
            cs = _find_score(db, load.client_id, meas.parameter_code, "CS", val)
            if cs:
                pallet_cs_scores.append(cs)

            # Track worst pallet status
            if meas.status == "FAIL":
                sev = (std.severity or "MAJOR").upper()
                if sev == "CRITICAL":
                    rank = _STATUS_RANK["REJECT"]
                    issues.append(f"Pallet {pallet.pallet_number}: CRITICAL fail on {meas.parameter_name}")
                else:
                    rank = _STATUS_RANK["HOLD"]
                    issues.append(f"Pallet {pallet.pallet_number}: {sev} fail on {meas.parameter_name}")
                if rank > pallet_status_rank:
                    pallet_status_rank = rank

        # Set pallet scores
        if pallet_q_scores:
            worst_pallet_q = max(pallet_q_scores, key=lambda x: _Q_RANK.get(x, 0))
            pallet.q_score = worst_pallet_q
            if worst_q is None or _Q_RANK.get(worst_pallet_q, 0) > _Q_RANK.get(worst_q, 0):
                worst_q = worst_pallet_q

        if pallet_cs_scores:
            worst_pallet_cs = max(pallet_cs_scores, key=lambda x: _CS_RANK.get(x, 4))
            pallet.cs_score = worst_pallet_cs
            if worst_cs is None or _CS_RANK.get(worst_pallet_cs, 4) > _CS_RANK.get(worst_cs, 4):
                worst_cs = worst_pallet_cs

        # Set pallet status
        reverse_map = {v: k for k, v in _STATUS_RANK.items() if k != "PENDING"}
        pallet.status = reverse_map.get(pallet_status_rank, "PASS")

        if pallet_status_rank > load_status_rank:
            load_status_rank = pallet_status_rank

    # ── Update load summary measurements ─────────────────────────────────────
    summary_by_code = {s.parameter_code: s for s in load.summary_measurements}
    for code, summary in summary_by_code.items():
        std = _find_standard(
            db,
            client_id=load.client_id,
            product_id=load.product_id,
            variety_id=load.variety_id,
            packaging_type_id=load.packaging_type_id,
            parameter_code=code,
            as_of=as_of,
        )
        if std:
            summary.standard_min = std.min_value
            summary.standard_max = std.max_value
            summary.severity = std.severity
            avg = summary.average_value
            if avg is not None:
                if std.max_value is not None and avg > std.max_value:
                    summary.status = "FAIL"
                elif std.min_value is not None and avg < std.min_value:
                    summary.status = "FAIL"
                else:
                    summary.status = "PASS"
        else:
            # No configured standard — use the observed range as reference; avg always within it
            summary.standard_min = summary.min_value
            summary.standard_max = summary.max_value
            summary.status = "PASS"

    # ── Update load ───────────────────────────────────────────────────────────
    reverse_map = {v: k for k, v in _STATUS_RANK.items() if k != "PENDING"}
    load.final_status = reverse_map.get(load_status_rank, "PASS")
    load.quality_score = Decimal(str(int(worst_q))) if worst_q else None
    load.condition_score = worst_cs
    load.main_issue = "; ".join(issues[:3]) if issues else None

    if import_job:
        import_job.status = "ANALYSED"

    log_action(
        db,
        action="LOAD_ANALYSED",
        entity_type="Load",
        entity_id=load_id,
        user_id=user_id,
        new_value={
            "final_status": load.final_status,
            "quality_score": str(load.quality_score) if load.quality_score else None,
            "condition_score": load.condition_score,
        },
    )
    db.commit()

    # ── Email alerts ──────────────────────────────────────────────────────────
    # Send only when load has pallets that are not passing (HOLD or REJECT/FAIL)
    not_passed_count = sum(
        1 for p in load.pallets if p.status in ("FAIL", "REJECT", "HOLD")
    )
    if not_passed_count > 0:
        alert_users = (
            db.query(User)
            .filter(User.email_alerts_enabled.is_(True), User.is_active.is_(True))
            .all()
        )
        if alert_users:
            import os
            app_url = os.getenv("APP_URL", "http://localhost:5173")
            client_name = getattr(load.client, "name", "") if hasattr(load, "client") else ""
            passed_count = sum(1 for p in load.pallets if p.status == "PASS")
            failed_count = sum(1 for p in load.pallets if p.status in ("FAIL", "REJECT"))
            held_count   = sum(1 for p in load.pallets if p.status == "HOLD")
            send_load_alert(
                recipients    = [u.email for u in alert_users],
                load_ref      = load.load_reference or f"Load #{load.id}",
                container     = load.container_number,
                inspection_date = load.inspection_date.isoformat() if load.inspection_date else "—",
                client_name   = client_name,
                total_pallets = len(load.pallets),
                passed        = passed_count,
                failed        = failed_count,
                held          = held_count,
                issues        = load.main_issue,
                app_url       = app_url,
                load_id       = load_id,
            )

    return {
        "load_id": load_id,
        "final_status": load.final_status,
        "quality_score": str(load.quality_score) if load.quality_score else None,
        "condition_score": load.condition_score,
        "pallet_count": len(load.pallets),
        "issues_found": len(issues),
    }
