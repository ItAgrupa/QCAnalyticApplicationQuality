from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class ImportJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    file_name: str
    file_type: str
    status: str
    extraction_confidence: float | None = None
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime

    client_name: str | None = None   # joined from client relationship


class ImportJobDetailResponse(ImportJobResponse):
    payload: dict[str, Any] | None = None    # import_raw_payload.payload_json
    parser_version: str | None = None
    ocr_used: bool | None = None
    source_page_count: int | None = None
