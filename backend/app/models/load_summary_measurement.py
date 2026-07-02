from sqlalchemy import BigInteger, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from decimal import Decimal

from app.db.base import Base, TimestampMixin


class LoadSummaryMeasurement(Base, TimestampMixin):
    """Average container and other summary-level facts. One row per parameter per load."""

    __tablename__ = "load_summary_measurements"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    load_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("loads.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    parameter_code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    parameter_name: Mapped[str] = mapped_column(String(150), nullable=False)
    average_value: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    min_value: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    max_value: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Decision engine output
    standard_min: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    standard_max: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="PENDING", nullable=False)
    severity: Mapped[str | None] = mapped_column(String(20), nullable=True)

    load: Mapped["Load"] = relationship("Load", back_populates="summary_measurements")
