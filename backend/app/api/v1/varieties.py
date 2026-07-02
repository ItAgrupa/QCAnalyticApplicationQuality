from typing import Annotated
from fastapi import APIRouter, Depends, Query, status
from app.api.deps import CurrentUser, DB, require_role
from app.core.permissions import RoleName
from app.schemas.variety import VarietyCreate, VarietyUpdate, VarietyResponse
from app.schemas.common import PaginatedResponse
from app.services import master_data_service as svc

router = APIRouter()
AdminOnly = Annotated[CurrentUser, Depends(require_role(RoleName.ADMIN))]


@router.get("/", response_model=PaginatedResponse[VarietyResponse])
def list_varieties(current_user: CurrentUser, db: DB,
                   product_id: int | None = None,
                   page: int = Query(1, ge=1), page_size: int = Query(100, ge=1, le=500),
                   include_inactive: bool = False):
    return svc.list_varieties(db, product_id, page, page_size, include_inactive)


@router.post("/", response_model=VarietyResponse, status_code=status.HTTP_201_CREATED)
def create_variety(data: VarietyCreate, current_user: AdminOnly, db: DB):
    return svc.create_variety(db, data, current_user.id)


@router.put("/{variety_id}", response_model=VarietyResponse)
def update_variety(variety_id: int, data: VarietyUpdate, current_user: AdminOnly, db: DB):
    return svc.update_variety(db, variety_id, data, current_user.id)


@router.delete("/{variety_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_variety(variety_id: int, current_user: AdminOnly, db: DB):
    svc.delete_variety(db, variety_id, current_user.id)
