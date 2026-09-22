from pydantic import BaseModel
from datetime import datetime


class ClientCreate(BaseModel):
    client_code: str
    name: str
    country_id: int | None = None
    market_id: int | None = None
    company_id: int | None = None
    default_language: str = "en"
    is_active: bool = True
    notes: str | None = None


class ClientUpdate(BaseModel):
    client_code: str | None = None
    name: str | None = None
    country_id: int | None = None
    market_id: int | None = None
    company_id: int | None = None
    default_language: str | None = None
    is_active: bool | None = None
    notes: str | None = None


class ClientCountryRef(BaseModel):
    id: int
    name: str
    iso_code: str

    model_config = {"from_attributes": True}


class ClientMarketRef(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class ActiveTemplateRef(BaseModel):
    id: int
    template_name: str
    parser_key: str

    model_config = {"from_attributes": True}


class ClientResponse(BaseModel):
    id: int
    client_code: str
    name: str
    country: ClientCountryRef | None
    market: ClientMarketRef | None
    company_id: int | None = None
    default_language: str
    is_active: bool
    notes: str | None
    created_at: datetime
    active_template: ActiveTemplateRef | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_template(cls, client) -> "ClientResponse":
        active = next((t for t in client.templates if t.is_active), None)
        obj = cls.model_validate(client)
        if active:
            obj.active_template = ActiveTemplateRef.model_validate(active)
        return obj
