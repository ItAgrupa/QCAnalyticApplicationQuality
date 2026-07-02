from typing import Annotated
from fastapi import APIRouter, Depends, Query, status
from app.api.deps import CurrentUser, DB, require_role
from app.core.permissions import RoleName
from app.schemas.country import CountryCreate, CountryUpdate, CountryResponse
from app.schemas.common import PaginatedResponse
from app.services import master_data_service as svc

router = APIRouter()
AdminOnly = Annotated[CurrentUser, Depends(require_role(RoleName.ADMIN))]


@router.get("/", response_model=PaginatedResponse[CountryResponse])
def list_countries(current_user: CurrentUser, db: DB,
                   page: int = Query(1, ge=1), page_size: int = Query(100, ge=1, le=500),
                   search: str | None = None, include_inactive: bool = False):
    return svc.list_countries(db, page, page_size, search, include_inactive)


@router.post("/", response_model=CountryResponse, status_code=status.HTTP_201_CREATED)
def create_country(data: CountryCreate, current_user: AdminOnly, db: DB):
    return svc.create_country(db, data, current_user.id)


@router.put("/{country_id}", response_model=CountryResponse)
def update_country(country_id: int, data: CountryUpdate, current_user: AdminOnly, db: DB):
    return svc.update_country(db, country_id, data, current_user.id)


@router.delete("/{country_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_country(country_id: int, current_user: AdminOnly, db: DB):
    svc.delete_country(db, country_id, current_user.id)
