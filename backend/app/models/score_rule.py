from sqlalchemy import BigInteger, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from decimal import Decimal

from app.db.base import Base, TimestampMixin


class ScoreRule(Base, TimestampMixin):
    """Maps Q and CS score labels to numeric ranges and meanings."""

    __tablename__ = "score_rules"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    client_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False)
    market_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("markets.id"), nullable=True)
    parameter_code: Mapped[str] = mapped_column(String(100), nullable=False)
    score_type: Mapped[str] = mapped_column(String(20), nullable=False)   # "Q" or "CS"
    score_label: Mapped[str] = mapped_column(String(20), nullable=False)  # "1","2","3","4" or "A","B","C","D","O"
    min_value: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)
    max_value: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    meaning: Mapped[str | None] = mapped_column(String(150), nullable=True)

    client: Mapped["Client"] = relationship("Client", back_populates="score_rules")
