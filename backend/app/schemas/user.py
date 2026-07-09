from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role_id: int
    is_active: bool = True

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("full_name")
    @classmethod
    def full_name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Full name cannot be empty")
        return v.strip()


class UserUpdate(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    role_id: int | None = None
    is_active: bool | None = None


class UserChangePassword(BaseModel):
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserRoleResponse(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class NotificationPrefs(BaseModel):
    """Per-user granular notification preferences (stored as JSONB on User)."""
    notify_on_reject: bool = True
    notify_on_hold: bool = True
    notify_all_passed: bool = False
    notify_analysis_done: bool = False
    notify_import_ready: bool = False
    pass_rate_threshold: int | None = Field(default=None, ge=0, le=100)
    digest_enabled: bool = False
    digest_time: str = "08:00"


class UserAlertSettings(BaseModel):
    """Request body for PATCH /users/me/alert-settings."""
    email_alerts_enabled: bool
    notification_prefs: NotificationPrefs = Field(default_factory=NotificationPrefs)


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: UserRoleResponse
    is_active: bool
    email_alerts_enabled: bool
    notification_prefs: NotificationPrefs = Field(default_factory=NotificationPrefs)
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("notification_prefs", mode="before")
    @classmethod
    def coerce_prefs(cls, v):
        if v is None or v == {}:
            return NotificationPrefs()
        if isinstance(v, dict):
            return NotificationPrefs(**{k: val for k, val in v.items() if k in NotificationPrefs.model_fields})
        return v
