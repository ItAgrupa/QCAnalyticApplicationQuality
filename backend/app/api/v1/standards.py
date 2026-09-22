from typing import Annotated, Any
from fastapi import APIRouter, Body, Depends, Query, UploadFile, File, HTTPException, status
from app.api.deps import CurrentUser, DB, require_role
from app.core.permissions import RoleName
from app.schemas.standard import QualityStandardCreate, QualityStandardUpdate, QualityStandardResponse
from app.schemas.common import PaginatedResponse
from app.services import master_data_service as svc
from app.services.pdf_standards_parser import parse_standards_from_pdf

router = APIRouter()
AdminOnly = Annotated[CurrentUser, Depends(require_role(RoleName.ADMIN))]


@router.get("/", response_model=PaginatedResponse[QualityStandardResponse])
def list_standards(current_user: CurrentUser, db: DB,
                   company_id: int | None = None,
                   client_id: int | None = None, product_id: int | None = None,
                   variety_id: int | None = None, packaging_type_id: int | None = None,
                   parameter_group: str | None = None,
                   active_only: bool = True,
                   page: int = Query(1, ge=1), page_size: int = Query(100, ge=1, le=500)):
    return svc.list_standards(db, client_id, product_id, variety_id,
                               packaging_type_id, parameter_group, page, page_size, active_only, company_id=company_id)


# ── Parameter Groups ──────────────────────────────────────────────────────────

@router.get("/groups/", response_model=list[dict])
def list_groups(current_user: CurrentUser, db: DB, client_id: int | None = None):
    """Return distinct parameter_group values with a count of standards in each."""
    return svc.list_standard_groups(db, client_id)


@router.patch("/groups/rename", status_code=status.HTTP_200_OK)
def rename_group(current_user: AdminOnly, db: DB,
                 old_name: str = Body(...), new_name: str = Body(...)):
    """Rename a group across all standards that reference it."""
    new_name = new_name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="new_name cannot be blank")
    count = svc.rename_standard_group(db, old_name, new_name, current_user.id)
    return {"renamed": count, "old_name": old_name, "new_name": new_name}


@router.delete("/groups/{group_name}", status_code=status.HTTP_200_OK)
def unassign_group(group_name: str, current_user: AdminOnly, db: DB):
    """Clear the group assignment from all standards in this group (does NOT delete the standards)."""
    count = svc.unassign_standard_group(db, group_name, current_user.id)
    return {"unassigned": count, "group": group_name}


@router.post("/", response_model=QualityStandardResponse, status_code=status.HTTP_201_CREATED)
def create_standard(data: QualityStandardCreate, current_user: AdminOnly, db: DB):
    return svc.create_standard(db, data, current_user.id)


@router.put("/{std_id}", response_model=QualityStandardResponse)
def update_standard(std_id: int, data: QualityStandardUpdate, current_user: AdminOnly, db: DB):
    return svc.update_standard(db, std_id, data, current_user.id)


@router.delete("/{std_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_standard(std_id: int, current_user: AdminOnly, db: DB):
    svc.delete_standard(db, std_id, current_user.id)


@router.post("/parse-pdf", response_model=list[dict[str, Any]])
async def parse_standards_pdf(
    current_user: AdminOnly,
    file: UploadFile = File(...),
):
    """Upload a quality-standards PDF and receive extracted draft rows.
    No data is saved — the caller reviews and POSTs each row individually."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    if file.size and file.size > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 20 MB)")

    pdf_bytes = await file.read()
    try:
        standards = parse_standards_from_pdf(pdf_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    return standards
