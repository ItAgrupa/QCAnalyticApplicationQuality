from sqlalchemy import BigInteger, Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Country(Base, TimestampMixin):
    __tablename__ = "countries"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    iso_code: Mapped[str] = mapped_column(String(3), unique=True, nullable=False, index=True)
    region: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    clients: Mapped[list["Client"]] = relationship("Client", back_populates="country")
