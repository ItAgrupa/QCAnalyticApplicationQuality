from fastapi import APIRouter
from app.api.deps import CurrentUser, DB
from app.schemas.role import RoleResponse
from app.models.role import Role

router = APIRouter()


@router.get("/", response_model=list[RoleResponse])
def list_roles(current_user: CurrentUser, db: DB):
    """Return all active roles. Available to all authenticated users (needed for user-create forms)."""
    return db.query(Role).filter(Role.is_active == True).order_by(Role.id).all()  # noqa: E712
