from sqlalchemy import BigInteger, Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class PackagingType(Base, TimestampMixin):
    __tablename__ = "packaging_types"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    weight_format: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_bulk: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_packaged: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
