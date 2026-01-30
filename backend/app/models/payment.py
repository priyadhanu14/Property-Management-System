from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    booking_group_id: Mapped[int] = mapped_column(ForeignKey("booking_groups.id"), nullable=False)
    booking_id: Mapped[int | None] = mapped_column(ForeignKey("bookings.id"), nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    payment_type: Mapped[str] = mapped_column(String(32), nullable=False)  # Advance, Check-in, Balance, Refund
    payment_mode: Mapped[str] = mapped_column(String(32), nullable=False)  # Cash, UPI, Bank
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    booking_group: Mapped["BookingGroup"] = relationship("BookingGroup", back_populates="payments")
    booking: Mapped["Booking | None"] = relationship("Booking", back_populates="payments")
