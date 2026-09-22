"""Load-level response schemas (Phase 6)."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict


class MeasurementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    parameter_code: str
    parameter_name: str
    value_numeric: Optional[Decimal] = None
    value_text: Optional[str] = None
    unit: Optional[str] = None
    status: str
    standard_min: Optional[Decimal] = None
    standard_max: Optional[Decimal] = None
    deviation: Optional[Decimal] = None
    severity: Optional[str] = None


class PalletOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    pallet_number: str
    grower_code: Optional[str] = None
    ggn: Optional[str] = None
    packing_date: Optional[date] = None
    cases_count: Optional[int] = None
    weight: Optional[Decimal] = None
    q_score: Optional[str] = None
    cs_score: Optional[str] = None
    status: str
    measurements: list[MeasurementOut] = []


class SummaryMeasurementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    parameter_code: str
    parameter_name: str
    average_value: Optional[Decimal] = None
    min_value: Optional[Decimal] = None
    max_value: Optional[Decimal] = None
    unit: Optional[str] = None
    standard_min: Optional[Decimal] = None
    standard_max: Optional[Decimal] = None
    status: str
    severity: Optional[str] = None


class LoadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: Optional[int] = None
    client_id: int
    market_id: Optional[int] = None
    import_id: int
    load_reference: Optional[str] = None
    container_number: Optional[str] = None
    vessel_name: Optional[str] = None
    inspection_date: Optional[date] = None
    inspection_place: Optional[str] = None
    origin_country_id: Optional[int] = None
    product_id: Optional[int] = None
    variety_id: Optional[int] = None
    packaging_type_id: Optional[int] = None
    total_cases: Optional[int] = None
    total_pallets: Optional[int] = None
    total_weight: Optional[Decimal] = None
    final_status: str
    quality_score: Optional[Decimal] = None
    condition_score: Optional[str] = None
    main_issue: Optional[str] = None
    created_at: Optional[datetime] = None


class LoadDetailOut(LoadOut):
    pallets: list[PalletOut] = []
    summary_measurements: list[SummaryMeasurementOut] = []


class AnalysisResultOut(BaseModel):
    load_id: int
    final_status: str
    quality_score: Optional[str] = None
    condition_score: Optional[str] = None
    pallet_count: int
    issues_found: int
