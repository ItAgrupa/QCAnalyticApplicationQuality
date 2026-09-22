from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel


class ScoreRuleCreate(BaseModel):
    client_id: int | None = None
    company_id: int | None = None
    market_id: int | None = None
    parameter_code: str
    score_type: str          # "Q" or "CS"
    score_label: str         # e.g. "1","2","3","4" or "A","B","C","D","O"
    min_value: Decimal | None = None
    max_value: Decimal | None = None
    unit: str | None = None
    meaning: str | None = None


class ScoreRuleUpdate(BaseModel):
    company_id: int | None = None
    min_value: Decimal | None = None
    max_value: Decimal | None = None
    unit: str | None = None
    meaning: str | None = None


class ScoreRuleResponse(BaseModel):
    id: int
    client_id: int | None
    company_id: int | None = None
    market_id: int | None
    parameter_code: str
    score_type: str
    score_label: str
    min_value: Decimal | None
    max_value: Decimal | None
    unit: str | None
    meaning: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
