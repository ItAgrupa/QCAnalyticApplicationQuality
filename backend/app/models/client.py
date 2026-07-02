from sqlalchemy import BigInteger, Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Client(Base, TimestampMixin):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    client_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    country_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("countries.id"), nullable=True)
    market_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("markets.id"), nullable=True)
    default_language: Mapped[str] = mapped_column(String(16), default="en", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    country: Mapped["Country | None"] = relationship("Country", back_populates="clients")
    market: Mapped["Market | None"] = relationship("Market", back_populates="clients")
    specifications: Mapped[list["ClientSpecification"]] = relationship("ClientSpecification", back_populates="client")
    templates: Mapped[list["ReportTemplate"]] = relationship("ReportTemplate", back_populates="client")
    quality_standards: Mapped[list["QualityStandard"]] = relationship("QualityStandard", back_populates="client")
    score_rules: Mapped[list["ScoreRule"]] = relationship("ScoreRule", back_populates="client")
    imports: Mapped[list["ImportJob"]] = relationship("ImportJob", back_populates="client")
    loads: Mapped[list["Load"]] = relationship("Load", back_populates="client")
