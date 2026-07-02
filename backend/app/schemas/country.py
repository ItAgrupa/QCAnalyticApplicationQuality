from pydantic import BaseModel
from datetime import datetime


class CountryCreate(BaseModel):
    name: str
    iso_code: str
    region: str | None = None
    is_active: bool = True


class CountryUpdate(BaseModel):
    name: str | None = None
    iso_code: str | None = None
    region: str | None = None
    is_active: bool | None = None


class CountryResponse(BaseModel):
    id: int
    name: str
    iso_code: str
    region: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
