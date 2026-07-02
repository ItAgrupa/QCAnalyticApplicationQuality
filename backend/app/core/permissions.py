"""Role-based access control helpers."""
from enum import Enum


class RoleName(str, Enum):
    ADMIN = "Admin"
    QUALITY_MANAGER = "Quality Manager"
    QUALITY_ANALYST = "Quality Analyst"
    MANAGEMENT_VIEWER = "Management Viewer"
    AUDITOR = "Auditor"


# Ordered hierarchy: higher index = more privilege
ROLE_HIERARCHY: list[str] = [
    RoleName.MANAGEMENT_VIEWER,
    RoleName.AUDITOR,
    RoleName.QUALITY_ANALYST,
    RoleName.QUALITY_MANAGER,
    RoleName.ADMIN,
]


def role_index(role_name: str) -> int:
    try:
        return ROLE_HIERARCHY.index(role_name)
    except ValueError:
        return -1


def has_minimum_role(user_role: str, minimum_role: str) -> bool:
    """Return True if user_role is at least as privileged as minimum_role."""
    return role_index(user_role) >= role_index(minimum_role)


# Convenience sets for endpoint guards
ADMIN_ONLY = {RoleName.ADMIN}
MANAGEMENT_AND_ABOVE = {RoleName.ADMIN, RoleName.QUALITY_MANAGER}
ANALYST_AND_ABOVE = {RoleName.ADMIN, RoleName.QUALITY_MANAGER, RoleName.QUALITY_ANALYST}
ALL_AUTHENTICATED = set(RoleName)
