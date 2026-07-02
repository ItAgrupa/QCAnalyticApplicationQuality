from pydantic import BaseModel
from datetime import datetime


class MarketCreate(BaseModel):
    name: str
    description: str | None = None
    is_active: bool = True


class MarketUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None


class MarketResponse(BaseModel):
    id: int
    name: str
    description: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
