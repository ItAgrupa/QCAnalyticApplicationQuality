from datetime import datetime
from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: int
    user_id: int | None
    user_email: str | None = None
    action: str
    entity_type: str | None
    entity_id: int | None
    old_value_json: dict | None
    new_value_json: dict | None
    ip_address: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
