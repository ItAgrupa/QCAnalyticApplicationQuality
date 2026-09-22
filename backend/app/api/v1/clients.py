from typing import Annotated
from fastapi import APIRouter, Depends, Query, status
from app.api.deps import CurrentUser, DB, require_role
from app.core.permissions import RoleName
from app.schemas.client import ClientCreate, ClientUpdate, ClientResponse
from app.schemas.common import PaginatedResponse
from app.services import master_data_service as svc

router = APIRouter()
AdminOnly = Annotated[CurrentUser, Depends(require_role(RoleName.ADMIN))]


@router.get("/", response_model=PaginatedResponse[ClientResponse])
def list_clients(current_user: CurrentUser, db: DB,
                 company_id: int | None = None,
                 page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
                 search: str | None = None, include_inactive: bool = False):
    return svc.list_clients(db, page, page_size, search, include_inactive, company_id=company_id)


@router.get("/{client_id}", response_model=ClientResponse)
def get_client(client_id: int, current_user: CurrentUser, db: DB):
    return svc.get_client(db, client_id)


@router.post("/", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(data: ClientCreate, current_user: AdminOnly, db: DB):
    return svc.create_client(db, data, current_user.id)


@router.put("/{client_id}", response_model=ClientResponse)
def update_client(client_id: int, data: ClientUpdate, current_user: AdminOnly, db: DB):
    return svc.update_client(db, client_id, data, current_user.id)


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(client_id: int, current_user: AdminOnly, db: DB):
    svc.delete_client(db, client_id, current_user.id)
