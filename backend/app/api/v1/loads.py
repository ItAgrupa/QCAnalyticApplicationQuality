from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.api.deps import CurrentUser, DB, require_role
from app.core.permissions import RoleName
from app.models.load import Load
from app.models.pallet import Pallet
from app.schemas.common import PaginatedResponse
from app.schemas.load import LoadOut, LoadDetailOut, AnalysisResultOut
from app.services.decision_engine import analyse_load

router = APIRouter()
AdminOrQM = Annotated[CurrentUser, Depends(require_role(RoleName.ADMIN, RoleName.QUALITY_MANAGER))]


@router.get("/", response_model=PaginatedResponse[LoadOut])
def list_loads(
    current_user: CurrentUser,
    db: DB,
    client_id: int | None = None,
    final_status: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
):
    q = db.query(Load)
    if client_id:
        q = q.filter(Load.client_id == client_id)
    if final_status:
        q = q.filter(Load.final_status == final_status)
    q = q.order_by(Load.id.desc())

    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.get("/{load_id}", response_model=LoadDetailOut)
def get_load(load_id: int, current_user: CurrentUser, db: DB):
    load = (
        db.query(Load)
        .options(
            joinedload(Load.pallets).joinedload(Pallet.measurements),
            joinedload(Load.summary_measurements),
        )
        .filter(Load.id == load_id)
        .first()
    )
    if not load:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Load not found")
    return load


@router.post("/{load_id}/analyse", response_model=AnalysisResultOut)
def run_analysis(load_id: int, current_user: AdminOrQM, db: DB):
    """Trigger the decision engine for a validated load."""
    return analyse_load(db, load_id, current_user.id)
