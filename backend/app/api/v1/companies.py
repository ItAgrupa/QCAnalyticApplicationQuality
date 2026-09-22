from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, DB
from app.models.company import Company
from app.schemas.company import CompanyOut

router = APIRouter()


@router.get("/", response_model=list[CompanyOut])
def list_companies(current_user: CurrentUser, db: DB):
    """List all active companies for the company selector portal."""
    return db.query(Company).filter(Company.is_active.is_(True)).order_by(Company.id.asc()).all()


@router.get("/{company_id}", response_model=CompanyOut)
def get_company(company_id: int, current_user: CurrentUser, db: DB):
    """Retrieve details for a specific company."""
    company = db.get(Company, company_id)
    if not company or not company.is_active:
        raise HTTPException(status_code=404, detail="Company not found")
    return company
