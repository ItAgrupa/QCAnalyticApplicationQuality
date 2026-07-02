from decimal import Decimal
from datetime import date, datetime
from pydantic import BaseModel, model_validator


class QualityStandardCreate(BaseModel):
    client_id: int
    market_id: int | None = None
    product_id: int
    variety_id: int | None = None
    packaging_type_id: int | None = None
    category: str | None = None
    parameter_code: str
    parameter_name: str
    parameter_group: str | None = None
    min_value: Decimal | None = None
    max_value: Decimal | None = None
    unit: str | None = None
    severity: str = "MAJOR"
    score_system: str | None = None
    effective_from: date
    effective_to: date | None = None
    is_active: bool = True

    @model_validator(mode="after")
    def at_least_one_bound(self) -> "QualityStandardCreate":
        if self.min_value is None and self.max_value is None:
            raise ValueError("At least one of min_value or max_value must be provided")
        return self


class QualityStandardUpdate(BaseModel):
    parameter_name: str | None = None
    parameter_group: str | None = None
    min_value: Decimal | None = None
    max_value: Decimal | None = None
    unit: str | None = None
    severity: str | None = None
    score_system: str | None = None
    effective_to: date | None = None
    is_active: bool | None = None


class QualityStandardResponse(BaseModel):
    id: int
    client_id: int
    market_id: int | None
    product_id: int
    variety_id: int | None
    packaging_type_id: int | None
    category: str | None
    parameter_code: str
    parameter_name: str
    parameter_group: str | None
    min_value: Decimal | None
    max_value: Decimal | None
    unit: str | None
    severity: str
    score_system: str | None
    effective_from: date
    effective_to: date | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
