"""
Generic CRUD helpers for all master-data entities.
Each public function is thin: validate → mutate → audit → commit.
"""
import math
from typing import TypeVar
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status

from app.db.base import Base
from app.schemas.common import PaginatedResponse
from app.services.audit_service import log_action

T = TypeVar("T", bound=Base)


# ── Generic helpers ────────────────────────────────────────────────────────────

def _get_or_404(db: Session, model: type[T], pk: int) -> T:
    obj = db.get(model, pk)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"{model.__name__} {pk} not found")
    return obj


def _paginate(query, page: int, page_size: int) -> tuple[list, int]:
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def _make_page(items, total, page, page_size) -> PaginatedResponse:
    return PaginatedResponse(
        items=items, total=total, page=page, page_size=page_size,
        pages=max(1, math.ceil(total / page_size)),
    )


# ── Countries ──────────────────────────────────────────────────────────────────

from app.models.country import Country
from app.schemas.country import CountryCreate, CountryUpdate


def list_countries(db: Session, page=1, page_size=100, search: str | None = None,
                   include_inactive=False) -> PaginatedResponse:
    q = db.query(Country)
    if not include_inactive:
        q = q.filter(Country.is_active == True)  # noqa
    if search:
        q = q.filter(func.lower(Country.name).like(f"%{search.lower()}%"))
    items, total = _paginate(q.order_by(Country.name), page, page_size)
    return _make_page(items, total, page, page_size)


def create_country(db: Session, data: CountryCreate, actor_id: int) -> Country:
    existing = db.query(Country).filter(
        func.upper(Country.iso_code) == data.iso_code.upper()
    ).first()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            detail=f"ISO code '{data.iso_code}' already exists")
    obj = Country(**data.model_dump())
    db.add(obj); db.flush()
    log_action(db, "COUNTRY_CREATED", "Country", obj.id, actor_id,
               new_value={"name": obj.name})
    db.commit(); db.refresh(obj)
    return obj


def update_country(db: Session, country_id: int, data: CountryUpdate, actor_id: int) -> Country:
    obj = _get_or_404(db, Country, country_id)
    old = {"name": obj.name, "iso_code": obj.iso_code}
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    log_action(db, "COUNTRY_UPDATED", "Country", country_id, actor_id, old_value=old)
    db.commit(); db.refresh(obj)
    return obj


def delete_country(db: Session, country_id: int, actor_id: int) -> None:
    obj = _get_or_404(db, Country, country_id)
    obj.is_active = False
    log_action(db, "COUNTRY_DEACTIVATED", "Country", country_id, actor_id)
    db.commit()


# ── Markets ────────────────────────────────────────────────────────────────────

from app.models.market import Market
from app.schemas.market import MarketCreate, MarketUpdate


def list_markets(db: Session, page=1, page_size=100, search: str | None = None,
                 include_inactive=False) -> PaginatedResponse:
    q = db.query(Market)
    if not include_inactive:
        q = q.filter(Market.is_active == True)  # noqa
    if search:
        q = q.filter(func.lower(Market.name).like(f"%{search.lower()}%"))
    items, total = _paginate(q.order_by(Market.name), page, page_size)
    return _make_page(items, total, page, page_size)


def create_market(db: Session, data: MarketCreate, actor_id: int) -> Market:
    obj = Market(**data.model_dump())
    db.add(obj); db.flush()
    log_action(db, "MARKET_CREATED", "Market", obj.id, actor_id,
               new_value={"name": obj.name})
    db.commit(); db.refresh(obj)
    return obj


def update_market(db: Session, market_id: int, data: MarketUpdate, actor_id: int) -> Market:
    obj = _get_or_404(db, Market, market_id)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    log_action(db, "MARKET_UPDATED", "Market", market_id, actor_id)
    db.commit(); db.refresh(obj)
    return obj


def delete_market(db: Session, market_id: int, actor_id: int) -> None:
    obj = _get_or_404(db, Market, market_id)
    obj.is_active = False
    log_action(db, "MARKET_DEACTIVATED", "Market", market_id, actor_id)
    db.commit()


# ── Clients ────────────────────────────────────────────────────────────────────

from app.models.client import Client
from app.models.country import Country as CountryModel
from app.models.market import Market as MarketModel
from app.schemas.client import ClientCreate, ClientUpdate
from sqlalchemy.orm import joinedload


def list_clients(db: Session, page=1, page_size=50, search: str | None = None,
                 include_inactive=False, company_id: int | None = None) -> PaginatedResponse:
    from app.schemas.client import ClientResponse  # local import avoids circular
    q = db.query(Client).options(
        joinedload(Client.country), joinedload(Client.market),
        joinedload(Client.templates),
    )
    if not include_inactive:
        q = q.filter(Client.is_active == True)  # noqa
    if company_id is not None:
        q = q.filter((Client.company_id == company_id) | (Client.company_id.is_(None)))
    if search:
        term = f"%{search.lower()}%"
        q = q.filter(
            func.lower(Client.name).like(term) |
            func.lower(Client.client_code).like(term)
        )
    items, total = _paginate(q.order_by(Client.name), page, page_size)
    serialized = [ClientResponse.from_orm_with_template(c) for c in items]
    return _make_page(serialized, total, page, page_size)


def get_client(db: Session, client_id: int) -> Client:
    obj = db.query(Client).options(
        joinedload(Client.country), joinedload(Client.market)
    ).filter(Client.id == client_id).first()
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Client not found")
    return obj


def create_client(db: Session, data: ClientCreate, actor_id: int) -> Client:
    existing = db.query(Client).filter(
        func.lower(Client.client_code) == data.client_code.lower()
    ).first()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            detail=f"Client code '{data.client_code}' already exists")
    if data.country_id and not db.get(CountryModel, data.country_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Country not found")
    if data.market_id and not db.get(MarketModel, data.market_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Market not found")

    obj = Client(**data.model_dump())
    db.add(obj); db.flush()
    log_action(db, "CLIENT_CREATED", "Client", obj.id, actor_id,
               new_value={"name": obj.name, "client_code": obj.client_code})
    db.commit()
    return get_client(db, obj.id)


def update_client(db: Session, client_id: int, data: ClientUpdate, actor_id: int) -> Client:
    obj = _get_or_404(db, Client, client_id)
    old = {"name": obj.name, "is_active": obj.is_active}
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    log_action(db, "CLIENT_UPDATED", "Client", client_id, actor_id, old_value=old)
    db.commit()
    return get_client(db, client_id)


def delete_client(db: Session, client_id: int, actor_id: int) -> None:
    obj = _get_or_404(db, Client, client_id)
    obj.is_active = False
    log_action(db, "CLIENT_DEACTIVATED", "Client", client_id, actor_id)
    db.commit()


# ── Products ───────────────────────────────────────────────────────────────────

from app.models.product import Product
from app.schemas.product import ProductCreate, ProductUpdate


def list_products(db: Session, page=1, page_size=100, search: str | None = None,
                  include_inactive=False) -> PaginatedResponse:
    q = db.query(Product)
    if not include_inactive:
        q = q.filter(Product.is_active == True)  # noqa
    if search:
        q = q.filter(func.lower(Product.name).like(f"%{search.lower()}%"))
    items, total = _paginate(q.order_by(Product.name), page, page_size)
    return _make_page(items, total, page, page_size)


def create_product(db: Session, data: ProductCreate, actor_id: int) -> Product:
    obj = Product(**data.model_dump())
    db.add(obj); db.flush()
    log_action(db, "PRODUCT_CREATED", "Product", obj.id, actor_id,
               new_value={"name": obj.name})
    db.commit(); db.refresh(obj)
    return obj


def update_product(db: Session, product_id: int, data: ProductUpdate, actor_id: int) -> Product:
    obj = _get_or_404(db, Product, product_id)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    log_action(db, "PRODUCT_UPDATED", "Product", product_id, actor_id)
    db.commit(); db.refresh(obj)
    return obj


def delete_product(db: Session, product_id: int, actor_id: int) -> None:
    obj = _get_or_404(db, Product, product_id)
    obj.is_active = False
    log_action(db, "PRODUCT_DEACTIVATED", "Product", product_id, actor_id)
    db.commit()


# ── Varieties ──────────────────────────────────────────────────────────────────

from app.models.variety import Variety
from app.schemas.variety import VarietyCreate, VarietyUpdate


def list_varieties(db: Session, product_id: int | None = None, page=1, page_size=100,
                   include_inactive=False) -> PaginatedResponse:
    q = db.query(Variety).options(joinedload(Variety.product))
    if not include_inactive:
        q = q.filter(Variety.is_active == True)  # noqa
    if product_id:
        q = q.filter(Variety.product_id == product_id)
    items, total = _paginate(q.order_by(Variety.name), page, page_size)
    return _make_page(items, total, page, page_size)


def create_variety(db: Session, data: VarietyCreate, actor_id: int) -> Variety:
    if not db.get(Product, data.product_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Product not found")
    obj = Variety(**data.model_dump())
    db.add(obj); db.flush()
    log_action(db, "VARIETY_CREATED", "Variety", obj.id, actor_id,
               new_value={"name": obj.name, "is_premium": obj.is_premium})
    db.commit()
    db.refresh(obj)
    # eager load product
    return db.query(Variety).options(joinedload(Variety.product)).filter(Variety.id == obj.id).first()


def update_variety(db: Session, variety_id: int, data: VarietyUpdate, actor_id: int) -> Variety:
    obj = _get_or_404(db, Variety, variety_id)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    log_action(db, "VARIETY_UPDATED", "Variety", variety_id, actor_id)
    db.commit()
    return db.query(Variety).options(joinedload(Variety.product)).filter(Variety.id == variety_id).first()


def delete_variety(db: Session, variety_id: int, actor_id: int) -> None:
    obj = _get_or_404(db, Variety, variety_id)
    obj.is_active = False
    log_action(db, "VARIETY_DEACTIVATED", "Variety", variety_id, actor_id)
    db.commit()


# ── Packaging Types ────────────────────────────────────────────────────────────

from app.models.packaging_type import PackagingType
from app.schemas.packaging import PackagingTypeCreate, PackagingTypeUpdate


def list_packaging(db: Session, page=1, page_size=100, include_inactive=False) -> PaginatedResponse:
    q = db.query(PackagingType)
    if not include_inactive:
        q = q.filter(PackagingType.is_active == True)  # noqa
    items, total = _paginate(q.order_by(PackagingType.name), page, page_size)
    return _make_page(items, total, page, page_size)


def create_packaging(db: Session, data: PackagingTypeCreate, actor_id: int) -> PackagingType:
    obj = PackagingType(**data.model_dump())
    db.add(obj); db.flush()
    log_action(db, "PACKAGING_CREATED", "PackagingType", obj.id, actor_id,
               new_value={"name": obj.name})
    db.commit(); db.refresh(obj)
    return obj


def update_packaging(db: Session, pkg_id: int, data: PackagingTypeUpdate, actor_id: int) -> PackagingType:
    obj = _get_or_404(db, PackagingType, pkg_id)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    log_action(db, "PACKAGING_UPDATED", "PackagingType", pkg_id, actor_id)
    db.commit(); db.refresh(obj)
    return obj


def delete_packaging(db: Session, pkg_id: int, actor_id: int) -> None:
    obj = _get_or_404(db, PackagingType, pkg_id)
    obj.is_active = False
    log_action(db, "PACKAGING_DEACTIVATED", "PackagingType", pkg_id, actor_id)
    db.commit()


# ── Quality Standards ──────────────────────────────────────────────────────────

from app.models.quality_standard import QualityStandard
from app.schemas.standard import QualityStandardCreate, QualityStandardUpdate


def list_standards(db: Session, client_id: int | None = None, product_id: int | None = None,
                   variety_id: int | None = None, packaging_type_id: int | None = None,
                   parameter_group: str | None = None,
                   page=1, page_size=100, active_only=True,
                   company_id: int | None = None) -> PaginatedResponse:
    q = db.query(QualityStandard)
    if active_only:
        q = q.filter(QualityStandard.is_active == True)  # noqa
    if company_id is not None:
        q = q.filter((QualityStandard.company_id == company_id) | (QualityStandard.company_id.is_(None)))
    if client_id:
        q = q.filter(QualityStandard.client_id == client_id)
    if product_id:
        q = q.filter(QualityStandard.product_id == product_id)
    if variety_id:
        q = q.filter(QualityStandard.variety_id == variety_id)
    if packaging_type_id:
        q = q.filter(QualityStandard.packaging_type_id == packaging_type_id)
    if parameter_group:
        q = q.filter(QualityStandard.parameter_group == parameter_group)
    items, total = _paginate(
        q.order_by(QualityStandard.parameter_group, QualityStandard.parameter_code),
        page, page_size,
    )
    return _make_page(items, total, page, page_size)


def list_standard_groups(db: Session, client_id: int | None = None) -> list[dict]:
    q = (
        db.query(QualityStandard.parameter_group, func.count(QualityStandard.id).label("count"))
        .filter(
            QualityStandard.is_active == True,  # noqa
            QualityStandard.parameter_group.isnot(None),
            QualityStandard.parameter_group != "",
        )
    )
    if client_id:
        q = q.filter(QualityStandard.client_id == client_id)
    rows = q.group_by(QualityStandard.parameter_group).order_by(QualityStandard.parameter_group).all()
    return [{"name": r.parameter_group, "count": r.count} for r in rows]


def rename_standard_group(db: Session, old_name: str, new_name: str, actor_id: int) -> int:
    count = (
        db.query(QualityStandard)
        .filter(QualityStandard.parameter_group == old_name)
        .update({"parameter_group": new_name}, synchronize_session=False)
    )
    log_action(db, "GROUP_RENAMED", "QualityStandard", None, actor_id,
               old_value={"group": old_name}, new_value={"group": new_name, "affected": count})
    db.commit()
    return count


def unassign_standard_group(db: Session, name: str, actor_id: int) -> int:
    count = (
        db.query(QualityStandard)
        .filter(QualityStandard.parameter_group == name)
        .update({"parameter_group": None}, synchronize_session=False)
    )
    log_action(db, "GROUP_UNASSIGNED", "QualityStandard", None, actor_id,
               old_value={"group": name, "affected": count})
    db.commit()
    return count


def create_standard(db: Session, data: QualityStandardCreate, actor_id: int) -> QualityStandard:
    obj = QualityStandard(**data.model_dump())
    db.add(obj); db.flush()
    log_action(db, "STANDARD_CREATED", "QualityStandard", obj.id, actor_id,
               new_value={"parameter_code": obj.parameter_code, "client_id": obj.client_id})
    db.commit(); db.refresh(obj)
    return obj


def update_standard(db: Session, std_id: int, data: QualityStandardUpdate, actor_id: int) -> QualityStandard:
    obj = _get_or_404(db, QualityStandard, std_id)
    old = {"max_value": str(obj.max_value), "min_value": str(obj.min_value)}
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    log_action(db, "STANDARD_UPDATED", "QualityStandard", std_id, actor_id, old_value=old)
    db.commit(); db.refresh(obj)
    return obj


def delete_standard(db: Session, std_id: int, actor_id: int) -> None:
    obj = _get_or_404(db, QualityStandard, std_id)
    obj.is_active = False
    log_action(db, "STANDARD_DEACTIVATED", "QualityStandard", std_id, actor_id)
    db.commit()


# ── Score Rules ────────────────────────────────────────────────────────────────

from app.models.score_rule import ScoreRule
from app.schemas.score_rule import ScoreRuleCreate, ScoreRuleUpdate


def list_score_rules(db: Session, client_id: int | None = None,
                     score_type: str | None = None, page=1, page_size=100,
                     company_id: int | None = None) -> PaginatedResponse:
    q = db.query(ScoreRule)
    if company_id is not None:
        q = q.filter((ScoreRule.company_id == company_id) | (ScoreRule.company_id.is_(None)))
    if client_id:
        q = q.filter(ScoreRule.client_id == client_id)
    if score_type:
        q = q.filter(ScoreRule.score_type == score_type)
    items, total = _paginate(
        q.order_by(ScoreRule.score_type, ScoreRule.score_label),
        page, page_size,
    )
    return _make_page(items, total, page, page_size)


def create_score_rule(db: Session, data: ScoreRuleCreate, actor_id: int) -> ScoreRule:
    obj = ScoreRule(**data.model_dump())
    db.add(obj); db.flush()
    log_action(db, "SCORE_RULE_CREATED", "ScoreRule", obj.id, actor_id,
               new_value={"score_type": obj.score_type, "score_label": obj.score_label})
    db.commit(); db.refresh(obj)
    return obj


def update_score_rule(db: Session, rule_id: int, data: ScoreRuleUpdate, actor_id: int) -> ScoreRule:
    obj = _get_or_404(db, ScoreRule, rule_id)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    log_action(db, "SCORE_RULE_UPDATED", "ScoreRule", rule_id, actor_id)
    db.commit(); db.refresh(obj)
    return obj


def delete_score_rule(db: Session, rule_id: int, actor_id: int) -> None:
    _get_or_404(db, ScoreRule, rule_id)
    db.query(ScoreRule).filter(ScoreRule.id == rule_id).delete()
    log_action(db, "SCORE_RULE_DELETED", "ScoreRule", rule_id, actor_id)
    db.commit()
