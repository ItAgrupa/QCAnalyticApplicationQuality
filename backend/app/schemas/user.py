from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator


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


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: UserRoleResponse
    is_active: bool
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
