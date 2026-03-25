from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class RatePlan(Base):
    __tablename__ = "rate_plans"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    room_type_id: Mapped[int] = mapped_column(ForeignKey("room_types.id"), nullable=False)
    rate: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    pricing_unit: Mapped[str] = mapped_column(String(16), nullable=False)  # hour, day
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    effective_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    room_type: Mapped["RoomType"] = relationship("RoomType", back_populates="rate_plans")
