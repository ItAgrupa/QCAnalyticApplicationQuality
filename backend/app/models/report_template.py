from sqlalchemy import BigInteger, Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class ReportTemplate(Base, TimestampMixin):
    """Per-client parsing template definitions — maps to a named parser class."""

    __tablename__ = "report_templates"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    client_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False)
    company_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("companies.id"), nullable=True, index=True)
    template_name: Mapped[str] = mapped_column(String(150), nullable=False)
    template_version: Mapped[str] = mapped_column(String(50), nullable=False)
    file_type: Mapped[str] = mapped_column(String(20), default="pdf", nullable=False)
    parser_key: Mapped[str] = mapped_column(String(100), nullable=False)
    mapping_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    client: Mapped["Client"] = relationship("Client", back_populates="templates")
    company: Mapped["Company | None"] = relationship("Company")
