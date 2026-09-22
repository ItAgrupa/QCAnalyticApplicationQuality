from sqlalchemy import BigInteger, Boolean, Date, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import date
from decimal import Decimal

from app.db.base import Base, TimestampMixin


class QualityStandard(Base, TimestampMixin):
    """Normalized threshold rows — the actual decision engine input.
    One row per parameter per client/market/product/variety/packaging combination."""

    __tablename__ = "quality_standards"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    client_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False)
    company_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("companies.id"), nullable=True, index=True)
    market_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("markets.id"), nullable=True)
    product_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("products.id"), nullable=True)
    variety_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("varieties.id"), nullable=True)
    packaging_type_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("packaging_types.id"), nullable=True)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    parameter_code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    parameter_name: Mapped[str] = mapped_column(String(150), nullable=False)
    parameter_group: Mapped[str | None] = mapped_column(String(50), nullable=True)
    min_value: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)
    max_value: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    severity: Mapped[str] = mapped_column(String(20), default="MAJOR", nullable=False)
    score_system: Mapped[str | None] = mapped_column(String(20), nullable=True)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    client: Mapped["Client"] = relationship("Client", back_populates="quality_standards")
    company: Mapped["Company | None"] = relationship("Company")
