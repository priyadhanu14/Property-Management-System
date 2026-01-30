from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text, Numeric
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class BookingGroup(Base):
    __tablename__ = "booking_groups"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    guest_name: Mapped[str] = mapped_column(String(256), nullable=False)
    phone: Mapped[str] = mapped_column(String(64), nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="group")
    payments: Mapped[list["Payment"]] = relationship("Payment", back_populates="booking_group")


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("booking_groups.id"), nullable=False)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), nullable=False)
    start_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="reserved")
    planned_checkin_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_checkin_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_checkout_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rate_snapshot: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    pricing_policy_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    group: Mapped["BookingGroup"] = relationship("BookingGroup", back_populates="bookings")
    room: Mapped["Room"] = relationship("Room", back_populates="bookings")
    payments: Mapped[list["Payment"]] = relationship("Payment", back_populates="booking")
