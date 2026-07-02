from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime

from app.db.base import Base


class GeneratedReport(Base):
    """Output artifacts — PDF and Excel exports."""

    __tablename__ = "generated_reports"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    load_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("loads.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    report_type: Mapped[str] = mapped_column(String(30), nullable=False)  # "pdf" | "xlsx"
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    generated_by_user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    load: Mapped["Load"] = relationship("Load", back_populates="generated_reports")
    generated_by: Mapped["User"] = relationship("User", back_populates="generated_reports")
