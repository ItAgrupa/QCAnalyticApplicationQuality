"""User management service — all business logic for creating, updating, and querying users."""
import math
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func
from fastapi import HTTPException, status

from app.models.user import User
from app.models.role import Role
from app.core.security import hash_password
from app.schemas.user import UserCreate, UserUpdate, UserChangePassword
from app.schemas.common import PaginatedResponse
from app.services.audit_service import log_action


def get_user_by_id(db: Session, user_id: int) -> User:
    user = db.query(User).options(joinedload(User.role)).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(func.lower(User.email) == email.lower()).first()


def list_users(
    db: Session,
    page: int = 1,
    page_size: int = 25,
    search: str | None = None,
    role_id: int | None = None,
    is_active: bool | None = None,
) -> PaginatedResponse:
    query = db.query(User).options(joinedload(User.role))

    if search:
        term = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(User.full_name).like(term),
                func.lower(User.email).like(term),
            )
        )
    if role_id is not None:
        query = query.filter(User.role_id == role_id)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    total = query.count()
    users = query.order_by(User.full_name).offset((page - 1) * page_size).limit(page_size).all()

    return PaginatedResponse(
        items=users,
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, math.ceil(total / page_size)),
    )


def create_user(db: Session, data: UserCreate, actor_id: int) -> User:
    # Validate email uniqueness
    if get_user_by_email(db, data.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email '{data.email}' is already registered",
        )

    # Validate role exists
    role = db.get(Role, data.role_id)
    if not role:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role not found")

    user = User(
        full_name=data.full_name,
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        role_id=data.role_id,
        is_active=data.is_active,
    )
    db.add(user)
    db.flush()  # get id before commit

    log_action(
        db,
        action="USER_CREATED",
        entity_type="User",
        entity_id=user.id,
        user_id=actor_id,
        new_value={"email": user.email, "role_id": user.role_id},
    )
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user_id: int, data: UserUpdate, actor_id: int) -> User:
    user = get_user_by_id(db, user_id)
    old = {"email": user.email, "role_id": user.role_id, "is_active": user.is_active}

    if data.email is not None and data.email.lower() != user.email.lower():
        if get_user_by_email(db, data.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Email '{data.email}' is already taken",
            )
        user.email = data.email.lower()

    if data.full_name is not None:
        user.full_name = data.full_name.strip()

    if data.role_id is not None:
        if not db.get(Role, data.role_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role not found")
        user.role_id = data.role_id

    if data.is_active is not None:
        user.is_active = data.is_active

    log_action(
        db,
        action="USER_UPDATED",
        entity_type="User",
        entity_id=user.id,
        user_id=actor_id,
        old_value=old,
        new_value={"email": user.email, "role_id": user.role_id, "is_active": user.is_active},
    )
    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user_id: int, data: UserChangePassword, actor_id: int) -> None:
    user = get_user_by_id(db, user_id)
    user.password_hash = hash_password(data.new_password)
    log_action(db, action="USER_PASSWORD_CHANGED", entity_type="User", entity_id=user_id, user_id=actor_id)
    db.commit()


def deactivate_user(db: Session, user_id: int, actor_id: int) -> User:
    if user_id == actor_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account",
        )
    user = get_user_by_id(db, user_id)
    user.is_active = False
    log_action(
        db, action="USER_DEACTIVATED", entity_type="User",
        entity_id=user_id, user_id=actor_id,
    )
    db.commit()
    db.refresh(user)
    return user


def reactivate_user(db: Session, user_id: int, actor_id: int) -> User:
    user = get_user_by_id(db, user_id)
    user.is_active = True
    log_action(
        db, action="USER_REACTIVATED", entity_type="User",
        entity_id=user_id, user_id=actor_id,
    )
    db.commit()
    db.refresh(user)
    return user
