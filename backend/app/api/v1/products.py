from typing import Annotated
from fastapi import APIRouter, Depends, Query, status
from app.api.deps import CurrentUser, DB, require_role
from app.core.permissions import RoleName
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse
from app.schemas.common import PaginatedResponse
from app.services import master_data_service as svc

router = APIRouter()
AdminOnly = Annotated[CurrentUser, Depends(require_role(RoleName.ADMIN))]


@router.get("/", response_model=PaginatedResponse[ProductResponse])
def list_products(current_user: CurrentUser, db: DB,
                  page: int = Query(1, ge=1), page_size: int = Query(100, ge=1, le=500),
                  search: str | None = None, include_inactive: bool = False):
    return svc.list_products(db, page, page_size, search, include_inactive)


@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(data: ProductCreate, current_user: AdminOnly, db: DB):
    return svc.create_product(db, data, current_user.id)


@router.put("/{product_id}", response_model=ProductResponse)
def update_product(product_id: int, data: ProductUpdate, current_user: AdminOnly, db: DB):
    return svc.update_product(db, product_id, data, current_user.id)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, current_user: AdminOnly, db: DB):
    svc.delete_product(db, product_id, current_user.id)
