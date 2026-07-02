from pydantic import BaseModel
from datetime import datetime


class VarietyCreate(BaseModel):
    product_id: int
    name: str
    code: str | None = None
    is_premium: bool = False
    is_active: bool = True


class VarietyUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    is_premium: bool | None = None
    is_active: bool | None = None


class VarietyProductRef(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class VarietyResponse(BaseModel):
    id: int
    product: VarietyProductRef
    name: str
    code: str | None
    is_premium: bool
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
