from pydantic import BaseModel, ConfigDict


class CompanyBase(BaseModel):
    code: str
    name: str
    logo_url: str | None = None
    brand_color: str | None = None
    is_active: bool = True


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    name: str | None = None
    logo_url: str | None = None
    brand_color: str | None = None
    is_active: bool | None = None


class CompanyOut(CompanyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
