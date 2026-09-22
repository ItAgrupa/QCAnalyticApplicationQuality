"""Validation service — human-validation step (Phase 5).

Takes the corrected extraction data submitted by a Quality Manager,
creates Load + Pallet + PalletMeasurement rows, and transitions the
import status from READY_FOR_VALIDATION → VALIDATED.
"""
from __future__ import annotations

from collections import defaultdict
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.import_job import ImportJob
from app.models.load import Load
from app.models.load_summary_measurement import LoadSummaryMeasurement
from app.models.pallet import Pallet
from app.models.pallet_measurement import PalletMeasurement
from app.schemas.validation import ValidationSubmit, ValidationResponse
from app.services.audit_service import log_action


def _to_dec(v: float | None) -> Decimal | None:
    return Decimal(str(v)) if v is not None else None


def submit_validation(
    db: Session,
    import_id: int,
    data: ValidationSubmit,
    user_id: int,
) -> ValidationResponse:
    # ── Guard: import must be in the right state ──────────────────────────────
    job = db.get(ImportJob, import_id)
    if not job:
        raise HTTPException(status_code=404, detail="Import not found")
    if job.status not in ("READY_FOR_VALIDATION", "VALIDATED"):
        raise HTTPException(
            status_code=409,
            detail=f"Import is in status '{job.status}' — expected READY_FOR_VALIDATION",
        )

    # ── If re-validating, remove old load ────────────────────────────────────
    if job.load:
        db.delete(job.load)
        db.flush()

    load = Load(
        company_id=job.company_id,
        client_id=data.client_id,
        import_id=import_id,
        market_id=data.market_id,
        load_reference=data.load_reference,
        container_number=data.container_number,
        vessel_name=data.vessel_name,
        inspection_date=data.inspection_date,
        inspection_place=data.inspection_place,
        origin_country_id=data.origin_country_id,
        product_id=data.product_id,
        variety_id=data.variety_id,
        packaging_type_id=data.packaging_type_id,
        total_cases=data.total_cases,
        total_pallets=len(data.pallets),
        total_weight=_to_dec(data.total_weight),
        final_status="PENDING",
    )
    db.add(load)
    db.flush()  # get load.id

    # ── Create Pallets + PalletMeasurements ──────────────────────────────────
    measurement_count = 0
    # Accumulate values per parameter for summary stats
    summary_buckets: dict[str, dict] = defaultdict(
        lambda: {"name": "", "unit": None, "values": []}
    )

    for p_in in data.pallets:
        pallet = Pallet(
            load_id=load.id,
            pallet_number=p_in.pallet_number,
            grower_code=p_in.grower_code,
            ggn=p_in.ggn,
            packing_date=p_in.packing_date,
            variety_id=p_in.variety_id,
            packaging_type_id=p_in.packaging_type_id,
            cases_count=p_in.cases_count,
            weight=_to_dec(p_in.weight),
            status="PENDING",
        )
        db.add(pallet)
        db.flush()  # get pallet.id

        for m_in in p_in.measurements:
            meas = PalletMeasurement(
                pallet_id=pallet.id,
                parameter_code=m_in.parameter_code,
                parameter_name=m_in.parameter_name,
                value_numeric=_to_dec(m_in.value_numeric),
                value_text=m_in.value_text,
                unit=m_in.unit,
                source_column=m_in.source_column,
                status="PENDING",
            )
            db.add(meas)
            measurement_count += 1

            # Accumulate for summary
            if m_in.value_numeric is not None:
                bucket = summary_buckets[m_in.parameter_code]
                bucket["name"] = m_in.parameter_name
                bucket["unit"] = m_in.unit
                bucket["values"].append(m_in.value_numeric)

    # ── Create LoadSummaryMeasurements ────────────────────────────────────────
    for code, bucket in summary_buckets.items():
        vals = bucket["values"]
        if not vals:
            continue
        db.add(LoadSummaryMeasurement(
            load_id=load.id,
            parameter_code=code,
            parameter_name=bucket["name"],
            average_value=_to_dec(round(sum(vals) / len(vals), 4)),
            min_value=_to_dec(min(vals)),
            max_value=_to_dec(max(vals)),
            unit=bucket["unit"],
            status="PENDING",
        ))

    # ── Update import status ─────────────────────────────────────────────────
    job.status = "VALIDATED"

    log_action(
        db,
        action="IMPORT_VALIDATED",
        entity_type="ImportJob",
        entity_id=import_id,
        user_id=user_id,
        new_value={
            "load_id": load.id,
            "pallet_count": len(data.pallets),
            "measurement_count": measurement_count,
        },
    )
    db.commit()

    return ValidationResponse(
        load_id=load.id,
        import_id=import_id,
        pallet_count=len(data.pallets),
        measurement_count=measurement_count,
    )
