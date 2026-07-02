from pydantic import BaseModel
from datetime import datetime


class PackagingTypeCreate(BaseModel):
    name: str
    type: str | None = None
    weight_format: str | None = None
    is_bulk: bool = False
    is_packaged: bool = True
    is_active: bool = True


class PackagingTypeUpdate(BaseModel):
    name: str | None = None
    type: str | None = None
    weight_format: str | None = None
    is_bulk: bool | None = None
    is_packaged: bool | None = None
    is_active: bool | None = None


class PackagingTypeResponse(BaseModel):
    id: int
    name: str
    type: str | None
    weight_format: str | None
    is_bulk: bool
    is_packaged: bool
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
