import math
from typing import Annotated
from fastapi import APIRouter, Depends, Query

from app.api.deps import CurrentUser, DB, require_role
from app.core.permissions import RoleName
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.audit import AuditLogResponse
from app.schemas.common import PaginatedResponse

router = APIRouter()

AuditorOrAdmin = Annotated[CurrentUser, Depends(require_role(RoleName.ADMIN, RoleName.AUDITOR))]


@router.get("/", response_model=PaginatedResponse[AuditLogResponse])
def list_audit_logs(
    current_user: AuditorOrAdmin,
    db: DB,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    action: str | None = Query(None),
    entity_type: str | None = Query(None),
    user_id: int | None = Query(None),
):
    query = db.query(AuditLog)

    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)

    total = query.count()
    logs = (
        query.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    user_map: dict[int, str] = {}
    user_ids = {log.user_id for log in logs if log.user_id}
    if user_ids:
        users = db.query(User.id, User.email).filter(User.id.in_(user_ids)).all()
        user_map = {u.id: u.email for u in users}

    items = [
        AuditLogResponse(
            id=log.id,
            user_id=log.user_id,
            user_email=user_map.get(log.user_id) if log.user_id else None,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            old_value_json=log.old_value_json,
            new_value_json=log.new_value_json,
            ip_address=log.ip_address,
            created_at=log.created_at,
        )
        for log in logs
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, math.ceil(total / page_size)),
    )
