from fastapi import APIRouter
from app.api.deps import CurrentUser, DB

router = APIRouter()


@router.get("/")
def placeholder(current_user: CurrentUser, db: DB):
    return {"message": "templates endpoint — implementation pending"}
