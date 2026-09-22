from datetime import datetime
from pydantic import BaseModel


class TemplateCreate(BaseModel):
    client_id: int
    company_id: int | None = None
    template_name: str
    parser_key: str
    template_version: str = "1"
    file_type: str = "pdf"


class TemplateResponse(BaseModel):
    id: int
    client_id: int
    company_id: int | None = None
    template_name: str
    template_version: str
    parser_key: str
    file_type: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ParserInfo(BaseModel):
    key: str
    version: str
    description: str
