from typing import Annotated
from fastapi import APIRouter, Depends, Query, status
from app.api.deps import CurrentUser, DB, require_role
from app.core.permissions import RoleName
from app.schemas.score_rule import ScoreRuleCreate, ScoreRuleUpdate, ScoreRuleResponse
from app.schemas.common import PaginatedResponse
from app.services import master_data_service as svc

router = APIRouter()
AdminOnly = Annotated[CurrentUser, Depends(require_role(RoleName.ADMIN))]


@router.get("/", response_model=PaginatedResponse[ScoreRuleResponse])
def list_score_rules(current_user: CurrentUser, db: DB,
                     company_id: int | None = None,
                     client_id: int | None = None, score_type: str | None = None,
                     page: int = Query(1, ge=1), page_size: int = Query(100, ge=1, le=500)):
    return svc.list_score_rules(db, client_id, score_type, page, page_size, company_id=company_id)


@router.post("/", response_model=ScoreRuleResponse, status_code=status.HTTP_201_CREATED)
def create_score_rule(data: ScoreRuleCreate, current_user: AdminOnly, db: DB):
    return svc.create_score_rule(db, data, current_user.id)


@router.put("/{rule_id}", response_model=ScoreRuleResponse)
def update_score_rule(rule_id: int, data: ScoreRuleUpdate, current_user: AdminOnly, db: DB):
    return svc.update_score_rule(db, rule_id, data, current_user.id)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_score_rule(rule_id: int, current_user: AdminOnly, db: DB):
    svc.delete_score_rule(db, rule_id, current_user.id)
