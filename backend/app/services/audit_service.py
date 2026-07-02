"""Audit logging service — every call inserts an immutable audit_logs row."""
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def log_action(
    db: Session,
    action: str,
    entity_type: str | None = None,
    entity_id: int | None = None,
    user_id: int | None = None,
    old_value: dict | None = None,
    new_value: dict | None = None,
    ip: str | None = None,
    user_agent: str | None = None,
) -> None:
    """Insert an audit log entry. Never raises — errors are swallowed to avoid
    breaking the caller's transaction."""
    try:
        entry = AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_value_json=old_value,
            new_value_json=new_value,
            ip_address=ip,
            user_agent=user_agent,
            created_at=datetime.now(timezone.utc),
        )
        db.add(entry)
        db.commit()
    except Exception:
        db.rollback()
