from typing import Annotated
from fastapi import APIRouter, Depends, Query, status
from app.api.deps import CurrentUser, DB, require_role
from app.core.permissions import RoleName
from app.schemas.packaging import PackagingTypeCreate, PackagingTypeUpdate, PackagingTypeResponse
from app.schemas.common import PaginatedResponse
from app.services import master_data_service as svc

router = APIRouter()
AdminOnly = Annotated[CurrentUser, Depends(require_role(RoleName.ADMIN))]


@router.get("/", response_model=PaginatedResponse[PackagingTypeResponse])
def list_packaging(current_user: CurrentUser, db: DB,
                   page: int = Query(1, ge=1), page_size: int = Query(100, ge=1, le=500),
                   include_inactive: bool = False):
    return svc.list_packaging(db, page, page_size, include_inactive)


@router.post("/", response_model=PackagingTypeResponse, status_code=status.HTTP_201_CREATED)
def create_packaging(data: PackagingTypeCreate, current_user: AdminOnly, db: DB):
    return svc.create_packaging(db, data, current_user.id)


@router.put("/{pkg_id}", response_model=PackagingTypeResponse)
def update_packaging(pkg_id: int, data: PackagingTypeUpdate, current_user: AdminOnly, db: DB):
    return svc.update_packaging(db, pkg_id, data, current_user.id)


@router.delete("/{pkg_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_packaging(pkg_id: int, current_user: AdminOnly, db: DB):
    svc.delete_packaging(db, pkg_id, current_user.id)
