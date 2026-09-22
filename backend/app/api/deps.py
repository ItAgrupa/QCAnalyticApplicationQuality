"""FastAPI dependency injection helpers."""
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session, joinedload

from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        if user_id is None or token_type != "access":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = (
        db.query(User)
        .options(joinedload(User.role))
        .filter(User.id == int(user_id))
        .first()
    )
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_role(*roles: str):
    """Return a FastAPI dependency that checks the current user has one of the given roles."""
    def _check(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        if current_user.role.name not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {', '.join(str(r) for r in roles)}",
            )
        return current_user
    return _check


CurrentUser = Annotated[User, Depends(get_current_user)]
DB = Annotated[Session, Depends(get_db)]


def get_active_company_id(
    company_id: Annotated[int | None, Query(description="Explicit company ID query parameter")] = None,
    x_company_id: Annotated[int | None, Header(alias="X-Company-Id", description="Active company ID header")] = None,
) -> int | None:
    """Extract company_id from query parameter if present, falling back to X-Company-Id header."""
    return company_id if company_id is not None else x_company_id


ActiveCompanyId = Annotated[int | None, Depends(get_active_company_id)]
