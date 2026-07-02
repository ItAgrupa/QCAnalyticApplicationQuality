from sqlalchemy import BigInteger, Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class ImportRawPayload(Base, TimestampMixin):
    """Stores the raw JSON output from the parser before human validation."""

    __tablename__ = "import_raw_payloads"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    import_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("imports.id", ondelete="RESTRICT"), nullable=False, unique=True
    )
    payload_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    parser_version: Mapped[str] = mapped_column(String(50), nullable=False)
    ocr_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    source_page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    import_job: Mapped["ImportJob"] = relationship("ImportJob", back_populates="raw_payload")
