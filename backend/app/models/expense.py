from datetime import date, datetime
from sqlalchemy import String, Date, DateTime, ForeignKey, Text, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    room_id: Mapped[int | None] = mapped_column(ForeignKey("rooms.id"), nullable=True)
    category: Mapped[str] = mapped_column(String(64), nullable=False)  # electricity, wifi, cleaning, maintenance, water, other
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    month: Mapped[date] = mapped_column(Date, nullable=False)  # first-of-month, e.g. 2026-01-01
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    room: Mapped["Room | None"] = relationship("Room", back_populates="expenses")
