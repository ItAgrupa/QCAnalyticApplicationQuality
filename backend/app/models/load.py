from sqlalchemy import BigInteger, Date, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import date
from decimal import Decimal

from app.db.base import Base, TimestampMixin


class Load(Base, TimestampMixin):
    """Canonical shipment record — created after human validation of an import."""

    __tablename__ = "loads"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    client_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False)
    market_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("markets.id"), nullable=True)
    import_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("imports.id", ondelete="RESTRICT"), nullable=False, unique=True)

    load_reference: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    container_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    vessel_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    inspection_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    inspection_place: Mapped[str | None] = mapped_column(String(150), nullable=True)

    origin_country_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("countries.id"), nullable=True)
    product_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("products.id"), nullable=True)
    variety_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("varieties.id"), nullable=True)
    packaging_type_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("packaging_types.id"), nullable=True)

    total_cases: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_pallets: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_weight: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)

    # Analysis outputs
    final_status: Mapped[str] = mapped_column(String(30), default="PENDING", nullable=False, index=True)
    quality_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    condition_score: Mapped[str | None] = mapped_column(String(20), nullable=True)
    main_issue: Mapped[str | None] = mapped_column(Text, nullable=True)
    applied_standard_ref: Mapped[str | None] = mapped_column(String(100), nullable=True)

    client: Mapped["Client"] = relationship("Client", back_populates="loads")
    import_job: Mapped["ImportJob"] = relationship("ImportJob", back_populates="load")
    pallets: Mapped[list["Pallet"]] = relationship("Pallet", back_populates="load", cascade="all, delete-orphan")
    summary_measurements: Mapped[list["LoadSummaryMeasurement"]] = relationship(
        "LoadSummaryMeasurement", back_populates="load", cascade="all, delete-orphan"
    )
    generated_reports: Mapped[list["GeneratedReport"]] = relationship("GeneratedReport", back_populates="load")
    corrective_actions: Mapped[list["CorrectiveAction"]] = relationship("CorrectiveAction", back_populates="load")
