from sqlalchemy import BigInteger, Date, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import date
from decimal import Decimal

from app.db.base import Base, TimestampMixin


class Pallet(Base, TimestampMixin):
    __tablename__ = "pallets"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    load_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("loads.id", ondelete="RESTRICT"), nullable=False, index=True)
    pallet_number: Mapped[str] = mapped_column(String(100), nullable=False)
    packing_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    grower_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ggn: Mapped[str | None] = mapped_column(String(100), nullable=True)
    variety_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("varieties.id"), nullable=True)
    packaging_type_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("packaging_types.id"), nullable=True)
    cases_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    weight: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    q_score: Mapped[str | None] = mapped_column(String(20), nullable=True)
    cs_score: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="PENDING", nullable=False, index=True)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)

    load: Mapped["Load"] = relationship("Load", back_populates="pallets")
    measurements: Mapped[list["PalletMeasurement"]] = relationship(
        "PalletMeasurement", back_populates="pallet", cascade="all, delete-orphan"
    )
    corrective_actions: Mapped[list["CorrectiveAction"]] = relationship("CorrectiveAction", back_populates="pallet")
