from fastapi import APIRouter

from app.api.v1 import (
    auth,
    users,
    roles,
    clients,
    markets,
    countries,
    products,
    varieties,
    packaging,
    standards,
    score_rules,
    templates,
    imports,
    loads,
    reports,
    dashboard,
    exports,
    audit,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(roles.router, prefix="/roles", tags=["Roles"])
api_router.include_router(clients.router, prefix="/clients", tags=["Clients"])
api_router.include_router(markets.router, prefix="/markets", tags=["Markets"])
api_router.include_router(countries.router, prefix="/countries", tags=["Countries"])
api_router.include_router(products.router, prefix="/products", tags=["Products"])
api_router.include_router(varieties.router, prefix="/varieties", tags=["Varieties"])
api_router.include_router(packaging.router, prefix="/packaging", tags=["Packaging"])
api_router.include_router(standards.router, prefix="/standards", tags=["Quality Standards"])
api_router.include_router(score_rules.router, prefix="/score-rules", tags=["Score Rules"])
api_router.include_router(templates.router, prefix="/templates", tags=["Report Templates"])
api_router.include_router(imports.router, prefix="/imports", tags=["Imports"])
api_router.include_router(loads.router, prefix="/loads", tags=["Loads"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(exports.router, prefix="/exports", tags=["Exports"])
api_router.include_router(audit.router, prefix="/audit", tags=["Audit"])
