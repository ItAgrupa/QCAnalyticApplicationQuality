from sqlalchemy import BigInteger, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from decimal import Decimal

from app.db.base import Base, TimestampMixin


class PalletMeasurement(Base, TimestampMixin):
    """One measurement / defect per pallet row. Includes standards comparison output."""

    __tablename__ = "pallet_measurements"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    pallet_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("pallets.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    parameter_code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    parameter_name: Mapped[str] = mapped_column(String(150), nullable=False)
    value_numeric: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    value_text: Mapped[str | None] = mapped_column(String(255), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    source_column: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Decision engine output
    status: Mapped[str] = mapped_column(String(30), default="PENDING", nullable=False)
    standard_min: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    standard_max: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    deviation: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    severity: Mapped[str | None] = mapped_column(String(20), nullable=True)

    pallet: Mapped["Pallet"] = relationship("Pallet", back_populates="measurements")
