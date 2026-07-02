from sqlalchemy import BigInteger, Boolean, Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import date

from app.db.base import Base, TimestampMixin


class ClientSpecification(Base, TimestampMixin):
    """Uploaded client standards PDFs — stored as audit/reference artifacts only.
    Actual decisioning runs against quality_standards table rows."""

    __tablename__ = "client_specifications"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    client_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False)
    market_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("markets.id"), nullable=True)
    document_code: Mapped[str] = mapped_column(String(100), nullable=False)
    revision: Mapped[str | None] = mapped_column(String(50), nullable=True)
    revision_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    file_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    client: Mapped["Client"] = relationship("Client", back_populates="specifications")
