from typing import Annotated
from fastapi import APIRouter, Depends, Query, status

from app.api.deps import CurrentUser, DB, require_role
from app.core.permissions import RoleName
from app.schemas.user import UserCreate, UserUpdate, UserChangePassword, UserResponse
from app.schemas.common import PaginatedResponse
from app.services import user_service

router = APIRouter()

AdminOnly = Annotated[CurrentUser, Depends(require_role(RoleName.ADMIN))]


@router.get("/", response_model=PaginatedResponse[UserResponse])
def list_users(
    current_user: AdminOnly,
    db: DB,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: str | None = Query(None),
    role_id: int | None = Query(None),
    is_active: bool | None = Query(None),
):
    return user_service.list_users(db, page, page_size, search, role_id, is_active)


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    data: UserCreate,
    current_user: AdminOnly,
    db: DB,
):
    return user_service.create_user(db, data, actor_id=current_user.id)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    current_user: AdminOnly,
    db: DB,
):
    return user_service.get_user_by_id(db, user_id)


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    data: UserUpdate,
    current_user: AdminOnly,
    db: DB,
):
    return user_service.update_user(db, user_id, data, actor_id=current_user.id)


@router.patch("/{user_id}/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    user_id: int,
    data: UserChangePassword,
    current_user: AdminOnly,
    db: DB,
):
    user_service.change_password(db, user_id, data, actor_id=current_user.id)


@router.patch("/{user_id}/deactivate", response_model=UserResponse)
def deactivate_user(
    user_id: int,
    current_user: AdminOnly,
    db: DB,
):
    return user_service.deactivate_user(db, user_id, actor_id=current_user.id)


@router.patch("/{user_id}/reactivate", response_model=UserResponse)
def reactivate_user(
    user_id: int,
    current_user: AdminOnly,
    db: DB,
):
    return user_service.reactivate_user(db, user_id, actor_id=current_user.id)
