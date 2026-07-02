from pydantic import BaseModel
from datetime import datetime


class ProductCreate(BaseModel):
    name: str
    category: str | None = None
    is_active: bool = True


class ProductUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    is_active: bool | None = None


class ProductResponse(BaseModel):
    id: int
    name: str
    category: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
