"""Schemas for the human-validation step (Phase 5).

The frontend sends back a corrected version of the extracted data.
The service turns it into Load + Pallet + PalletMeasurement rows.
"""
from __future__ import annotations

from datetime import date
from typing import Any

from pydantic import BaseModel, ConfigDict, model_validator


class MeasurementInput(BaseModel):
    parameter_code: str
    parameter_name: str
    value_numeric: float | None = None
    value_text: str | None = None
    unit: str | None = None
    source_column: str | None = None


class PalletInput(BaseModel):
    pallet_number: str
    grower_code: str | None = None
    ggn: str | None = None
    packing_date: date | None = None
    variety_id: int | None = None
    packaging_type_id: int | None = None
    cases_count: int | None = None
    weight: float | None = None
    measurements: list[MeasurementInput] = []


class ValidationSubmit(BaseModel):
    # Load-level header (all optional — validator fills in what was extracted)
    load_reference: str | None = None
    container_number: str | None = None
    vessel_name: str | None = None
    inspection_date: date | None = None
    inspection_place: str | None = None

    client_id: int
    market_id: int | None = None
    origin_country_id: int | None = None
    product_id: int | None = None
    variety_id: int | None = None
    packaging_type_id: int | None = None

    total_cases: int | None = None
    total_pallets: int | None = None
    total_weight: float | None = None

    pallets: list[PalletInput] = []

    @model_validator(mode="after")
    def at_least_one_pallet(self) -> "ValidationSubmit":
        if not self.pallets:
            raise ValueError("At least one pallet must be provided")
        return self


class ValidationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    load_id: int
    import_id: int
    pallet_count: int
    measurement_count: int
