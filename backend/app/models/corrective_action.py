from sqlalchemy import BigInteger, Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import date

from app.db.base import Base, TimestampMixin


class CorrectiveAction(Base, TimestampMixin):
    __tablename__ = "corrective_actions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    load_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("loads.id", ondelete="RESTRICT"), nullable=False, index=True)
    pallet_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("pallets.id"), nullable=True)
    issue_type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    root_cause: Mapped[str | None] = mapped_column(Text, nullable=True)
    action_required: Mapped[str] = mapped_column(Text, nullable=False)
    responsible_user_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=True)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="OPEN", nullable=False)

    load: Mapped["Load"] = relationship("Load", back_populates="corrective_actions")
    pallet: Mapped["Pallet | None"] = relationship("Pallet", back_populates="corrective_actions")
