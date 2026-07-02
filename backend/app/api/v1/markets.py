from typing import Annotated
from fastapi import APIRouter, Depends, Query, status
from app.api.deps import CurrentUser, DB, require_role
from app.core.permissions import RoleName
from app.schemas.market import MarketCreate, MarketUpdate, MarketResponse
from app.schemas.common import PaginatedResponse
from app.services import master_data_service as svc

router = APIRouter()
AdminOnly = Annotated[CurrentUser, Depends(require_role(RoleName.ADMIN))]


@router.get("/", response_model=PaginatedResponse[MarketResponse])
def list_markets(current_user: CurrentUser, db: DB,
                 page: int = Query(1, ge=1), page_size: int = Query(100, ge=1, le=500),
                 search: str | None = None, include_inactive: bool = False):
    return svc.list_markets(db, page, page_size, search, include_inactive)


@router.post("/", response_model=MarketResponse, status_code=status.HTTP_201_CREATED)
def create_market(data: MarketCreate, current_user: AdminOnly, db: DB):
    return svc.create_market(db, data, current_user.id)


@router.put("/{market_id}", response_model=MarketResponse)
def update_market(market_id: int, data: MarketUpdate, current_user: AdminOnly, db: DB):
    return svc.update_market(db, market_id, data, current_user.id)


@router.delete("/{market_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_market(market_id: int, current_user: AdminOnly, db: DB):
    svc.delete_market(db, market_id, current_user.id)
