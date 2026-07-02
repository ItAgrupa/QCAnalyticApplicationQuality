from sqlalchemy import BigInteger, Boolean, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from decimal import Decimal

from app.db.base import Base, TimestampMixin


class ImportJob(Base, TimestampMixin):
    """Upload and extraction job record. Tracks lifecycle from UPLOADED → ANALYSED."""

    __tablename__ = "imports"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    client_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False)
    uploaded_by_user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    original_file_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(20), default="pdf", nullable=False)

    # Lifecycle status
    status: Mapped[str] = mapped_column(
        String(30),
        default="UPLOADED",
        nullable=False,
        index=True,
    )
    # Possible values:
    # UPLOADED → EXTRACTING → EXTRACTION_FAILED
    # EXTRACTING → READY_FOR_VALIDATION
    # READY_FOR_VALIDATION → VALIDATED
    # VALIDATED → ANALYSED
    # Any → CANCELLED

    detected_template_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("report_templates.id"), nullable=True
    )
    extraction_confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    client: Mapped["Client"] = relationship("Client", back_populates="imports")
    uploaded_by: Mapped["User"] = relationship("User", back_populates="imports")
    raw_payload: Mapped["ImportRawPayload | None"] = relationship("ImportRawPayload", back_populates="import_job", uselist=False)
    load: Mapped["Load | None"] = relationship("Load", back_populates="import_job", uselist=False)
    detected_template: Mapped["ReportTemplate | None"] = relationship("ReportTemplate")
