"""Payments endpoints: record, list, update, delete payments."""
from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func, extract
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.payment import Payment
from app.models.booking import Booking, BookingGroup
from app.models.room import Room

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

PAYMENT_TYPES = ["Advance", "Check-in", "Balance", "Refund"]
PAYMENT_MODES = ["Cash", "UPI", "Bank"]


class PaymentCreate(BaseModel):
    booking_group_id: int
    booking_id: int | None = None
    amount: float = Field(..., gt=0)
    payment_type: str = Field(..., min_length=1, max_length=32)
    payment_mode: str = Field(..., min_length=1, max_length=32)
    paid_at: datetime
    note: str | None = None


class PaymentUpdate(BaseModel):
    amount: float | None = Field(None, gt=0)
    payment_type: str | None = Field(None, min_length=1, max_length=32)
    payment_mode: str | None = Field(None, min_length=1, max_length=32)
    paid_at: datetime | None = None
    note: str | None = None


class PaymentOut(BaseModel):
    id: int
    booking_group_id: int
    booking_id: int | None
    guest_name: str
    unit_codes: list[str]
    amount: float
    payment_type: str
    payment_mode: str
    paid_at: datetime
    note: str | None

    class Config:
        from_attributes = True


class PaymentSummary(BaseModel):
    total_collected: float
    count: int
    by_mode: dict[str, float]
    by_type: dict[str, float]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _payment_load_options():
    """Eager-load options for payment queries (group + bookings + rooms)."""
    return selectinload(Payment.booking_group).selectinload(
        BookingGroup.bookings
    ).selectinload(Booking.room)


def payment_to_out(p: Payment) -> PaymentOut:
    unit_codes: list[str] = []
    if p.booking_group:
        for b in (p.booking_group.bookings or []):
            if b.status != "cancelled" and b.room and b.room.unit_code not in unit_codes:
                unit_codes.append(b.room.unit_code)
    unit_codes.sort()
    return PaymentOut(
        id=p.id,
        booking_group_id=p.booking_group_id,
        booking_id=p.booking_id,
        guest_name=p.booking_group.guest_name if p.booking_group else "",
        unit_codes=unit_codes,
        amount=float(p.amount),
        payment_type=p.payment_type,
        payment_mode=p.payment_mode,
        paid_at=p.paid_at,
        note=p.note,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("", response_model=PaymentOut, status_code=201)
async def record_payment(
    body: PaymentCreate,
    session: AsyncSession = Depends(get_session),
):
    """Record a payment against a booking group."""
    # Validate booking group exists
    group = await session.get(BookingGroup, body.booking_group_id)
    if not group:
        raise HTTPException(400, "Booking group not found")

    # Validate booking if provided
    if body.booking_id is not None:
        booking = await session.get(Booking, body.booking_id)
        if not booking:
            raise HTTPException(400, "Booking not found")
        if booking.group_id != body.booking_group_id:
            raise HTTPException(400, "Booking does not belong to this group")

    payment = Payment(
        booking_group_id=body.booking_group_id,
        booking_id=body.booking_id,
        amount=body.amount,
        payment_type=body.payment_type,
        payment_mode=body.payment_mode,
        paid_at=body.paid_at,
        note=body.note,
    )
    session.add(payment)
    await session.flush()
    await session.refresh(payment)

    # Load with relationships
    stmt = (
        select(Payment)
        .where(Payment.id == payment.id)
        .options(_payment_load_options())
    )
    loaded = (await session.execute(stmt)).scalar_one()
    return payment_to_out(loaded)


@router.get("", response_model=list[PaymentOut])
async def list_payments(
    booking_group_id: int | None = Query(None),
    booking_id: int | None = Query(None),
    payment_mode: str | None = Query(None),
    from_date: str | None = Query(None, description="YYYY-MM-DD"),
    to_date: str | None = Query(None, description="YYYY-MM-DD"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    """List payments with optional filters."""
    stmt = (
        select(Payment)
        .options(_payment_load_options())
        .order_by(Payment.paid_at.desc())
    )

    if booking_group_id is not None:
        stmt = stmt.where(Payment.booking_group_id == booking_group_id)
    if booking_id is not None:
        stmt = stmt.where(Payment.booking_id == booking_id)
    if payment_mode:
        stmt = stmt.where(Payment.payment_mode == payment_mode)
    if from_date:
        try:
            fd = date.fromisoformat(from_date)
            stmt = stmt.where(
                Payment.paid_at >= datetime.combine(fd, time.min, tzinfo=timezone.utc)
            )
        except ValueError:
            raise HTTPException(400, "from_date must be YYYY-MM-DD")
    if to_date:
        try:
            td = date.fromisoformat(to_date)
            stmt = stmt.where(
                Payment.paid_at <= datetime.combine(td, time.max, tzinfo=timezone.utc)
            )
        except ValueError:
            raise HTTPException(400, "to_date must be YYYY-MM-DD")

    stmt = stmt.limit(limit).offset(offset)
    result = await session.execute(stmt)
    payments = result.scalars().all()
    return [payment_to_out(p) for p in payments]


@router.get("/summary", response_model=PaymentSummary)
async def payment_summary(
    month: str | None = Query(None, description="YYYY-MM"),
    session: AsyncSession = Depends(get_session),
):
    """Summary: total collected, count, by mode, by type. Optionally filtered by month."""
    base_stmt = select(Payment)
    if month:
        try:
            year, mon = month.split("-")
            base_stmt = base_stmt.where(
                extract("year", Payment.paid_at) == int(year),
                extract("month", Payment.paid_at) == int(mon),
            )
        except (ValueError, IndexError):
            raise HTTPException(400, "month must be YYYY-MM")

    result = await session.execute(base_stmt)
    payments = result.scalars().all()

    total = sum(float(p.amount) for p in payments)
    by_mode: dict[str, float] = {}
    by_type: dict[str, float] = {}
    for p in payments:
        by_mode[p.payment_mode] = by_mode.get(p.payment_mode, 0) + float(p.amount)
        by_type[p.payment_type] = by_type.get(p.payment_type, 0) + float(p.amount)

    return PaymentSummary(
        total_collected=round(total, 2),
        count=len(payments),
        by_mode=by_mode,
        by_type=by_type,
    )


@router.get("/{payment_id}", response_model=PaymentOut)
async def get_payment(
    payment_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Get a single payment."""
    stmt = (
        select(Payment)
        .where(Payment.id == payment_id)
        .options(_payment_load_options())
    )
    payment = (await session.execute(stmt)).scalar_one_or_none()
    if not payment:
        raise HTTPException(404, "Payment not found")
    return payment_to_out(payment)


@router.put("/{payment_id}", response_model=PaymentOut)
async def update_payment(
    payment_id: int,
    body: PaymentUpdate,
    session: AsyncSession = Depends(get_session),
):
    """Update a payment."""
    stmt = (
        select(Payment)
        .where(Payment.id == payment_id)
        .options(_payment_load_options())
    )
    payment = (await session.execute(stmt)).scalar_one_or_none()
    if not payment:
        raise HTTPException(404, "Payment not found")

    if body.amount is not None:
        payment.amount = body.amount
    if body.payment_type is not None:
        payment.payment_type = body.payment_type
    if body.payment_mode is not None:
        payment.payment_mode = body.payment_mode
    if body.paid_at is not None:
        payment.paid_at = body.paid_at
    if body.note is not None:
        payment.note = body.note

    await session.flush()
    await session.refresh(payment)

    # Reload with relationships
    stmt2 = (
        select(Payment)
        .where(Payment.id == payment_id)
        .options(_payment_load_options())
    )
    loaded = (await session.execute(stmt2)).scalar_one()
    return payment_to_out(loaded)


@router.delete("/{payment_id}", status_code=204)
async def delete_payment(
    payment_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Delete a payment record."""
    payment = await session.get(Payment, payment_id)
    if not payment:
        raise HTTPException(404, "Payment not found")
    await session.delete(payment)
    await session.flush()
