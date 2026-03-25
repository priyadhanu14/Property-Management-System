"""Bookings endpoints: CRUD, check-in, check-out, list/filter."""
from datetime import date as date_type, datetime, time as time_type, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.booking import Booking, BookingGroup
from app.models.payment import Payment
from app.models.room import Room

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class BookingGroupCreate(BaseModel):
    guest_name: str = Field(..., min_length=1, max_length=256)
    phone: str = Field(..., min_length=1, max_length=64)
    event_type: str | None = None
    notes: str | None = None


class BookingItemCreate(BaseModel):
    room_id: int
    start_datetime: datetime
    end_datetime: datetime
    planned_checkin_time: datetime | None = None
    rate_snapshot: float | None = None


class BookingCreateRequest(BaseModel):
    """Create a booking group with one or more room bookings."""
    group: BookingGroupCreate
    bookings: list[BookingItemCreate] = Field(..., min_length=1)


class BookingGroupOut(BaseModel):
    id: int
    guest_name: str
    phone: str
    event_type: str | None
    notes: str | None
    created_at: datetime | None

    class Config:
        from_attributes = True


class BookingOut(BaseModel):
    id: int
    group_id: int
    room_id: int
    unit_code: str
    guest_name: str
    phone: str
    event_type: str | None
    start_datetime: datetime
    end_datetime: datetime
    status: str
    planned_checkin_time: datetime | None
    actual_checkin_time: datetime | None
    actual_checkout_time: datetime | None
    rate_snapshot: float | None
    group_total_rate: float
    total_paid: float
    balance: float
    created_at: datetime | None


class BookingCreateResponse(BaseModel):
    group: BookingGroupOut
    bookings: list[BookingOut]


class BookingUpdateRequest(BaseModel):
    start_datetime: datetime | None = None
    end_datetime: datetime | None = None
    room_id: int | None = None
    status: str | None = None
    planned_checkin_time: datetime | None = None
    rate_snapshot: float | None = None


class BookingGroupUpdateRequest(BaseModel):
    guest_name: str | None = Field(None, min_length=1, max_length=256)
    phone: str | None = Field(None, min_length=1, max_length=64)
    event_type: str | None = None
    notes: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def booking_to_out(
    b: Booking, total_paid: float = 0.0, group_total_rate: float = 0.0
) -> BookingOut:
    return BookingOut(
        id=b.id,
        group_id=b.group_id,
        room_id=b.room_id,
        unit_code=b.room.unit_code if b.room else "",
        guest_name=b.group.guest_name if b.group else "",
        phone=b.group.phone if b.group else "",
        event_type=b.group.event_type if b.group else None,
        start_datetime=b.start_datetime,
        end_datetime=b.end_datetime,
        status=b.status,
        planned_checkin_time=b.planned_checkin_time,
        actual_checkin_time=b.actual_checkin_time,
        actual_checkout_time=b.actual_checkout_time,
        rate_snapshot=float(b.rate_snapshot) if b.rate_snapshot is not None else None,
        group_total_rate=round(group_total_rate, 2),
        total_paid=round(total_paid, 2),
        balance=round(max(0.0, group_total_rate - total_paid), 2),
        created_at=b.created_at,
    )


async def load_booking(session: AsyncSession, booking_id: int) -> Booking:
    stmt = (
        select(Booking)
        .where(Booking.id == booking_id)
        .options(selectinload(Booking.group), selectinload(Booking.room))
    )
    result = await session.execute(stmt)
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(404, "Booking not found")
    return booking


async def get_group_paid(session: AsyncSession, group_id: int) -> float:
    """Sum of all payments for a booking group."""
    stmt = (
        select(func.coalesce(func.sum(Payment.amount), 0))
        .where(Payment.booking_group_id == group_id)
    )
    return float((await session.execute(stmt)).scalar() or 0)


async def get_group_total_rate(session: AsyncSession, group_id: int) -> float:
    """Sum of rate_snapshot for all non-cancelled bookings in a group."""
    stmt = (
        select(func.coalesce(func.sum(Booking.rate_snapshot), 0))
        .where(Booking.group_id == group_id, Booking.status != "cancelled")
    )
    return float((await session.execute(stmt)).scalar() or 0)


def to_utc(dt: datetime) -> datetime:
    """Ensure a datetime is UTC-aware."""
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


@router.post("", response_model=BookingCreateResponse, status_code=201)
async def create_booking(
    body: BookingCreateRequest,
    session: AsyncSession = Depends(get_session),
):
    """Create a booking group with one or more unit bookings."""
    # Validate all rooms exist and check for overlapping bookings
    for item in body.bookings:
        room = await session.get(Room, item.room_id)
        if not room:
            raise HTTPException(400, f"Room id {item.room_id} not found")
        if not room.is_active:
            raise HTTPException(400, f"Room '{room.unit_code}' is inactive")
        if item.start_datetime >= item.end_datetime:
            raise HTTPException(400, "start_datetime must be before end_datetime")

        # Check for overlapping bookings (back-to-back is allowed)
        start_utc = to_utc(item.start_datetime)
        end_utc = to_utc(item.end_datetime)

        overlap_stmt = select(Booking).where(
            Booking.room_id == item.room_id,
            Booking.status != "cancelled",
            Booking.start_datetime < end_utc,
            Booking.end_datetime > start_utc,
        )
        conflict = (await session.execute(overlap_stmt)).scalars().first()
        if conflict:
            fmt = lambda dt: to_utc(dt).strftime("%d %b %I:%M %p")
            raise HTTPException(
                400,
                f"Room '{room.unit_code}' is already booked from "
                f"{fmt(conflict.start_datetime)} to {fmt(conflict.end_datetime)}",
            )

    # Create group
    group = BookingGroup(
        guest_name=body.group.guest_name,
        phone=body.group.phone,
        event_type=body.group.event_type,
        notes=body.group.notes,
    )
    session.add(group)
    await session.flush()

    # Create bookings
    created_bookings: list[Booking] = []
    for item in body.bookings:
        booking = Booking(
            group_id=group.id,
            room_id=item.room_id,
            start_datetime=item.start_datetime,
            end_datetime=item.end_datetime,
            status="reserved",
            planned_checkin_time=item.planned_checkin_time,
            rate_snapshot=item.rate_snapshot,
        )
        session.add(booking)
        created_bookings.append(booking)

    try:
        await session.flush()
    except IntegrityError as e:
        await session.rollback()
        if "no_overlap" in str(e).lower() or "exclusion" in str(e).lower():
            raise HTTPException(400, "One or more rooms are already booked for the selected time period.") from None
        raise

    # Refresh with relationships
    group_rate = sum(
        float(b.rate_snapshot) if b.rate_snapshot else 0.0 for b in created_bookings
    )
    booking_outs: list[BookingOut] = []
    for b in created_bookings:
        await session.refresh(b)
        loaded = await load_booking(session, b.id)
        booking_outs.append(booking_to_out(loaded, 0.0, group_rate))

    return BookingCreateResponse(
        group=BookingGroupOut(
            id=group.id,
            guest_name=group.guest_name,
            phone=group.phone,
            event_type=group.event_type,
            notes=group.notes,
            created_at=group.created_at,
        ),
        bookings=booking_outs,
    )


@router.get("", response_model=list[BookingOut])
async def list_bookings(
    status: str | None = Query(None, description="Filter by status"),
    room_id: int | None = Query(None, description="Filter by room"),
    guest: str | None = Query(None, description="Search guest name (partial)"),
    from_date: str | None = Query(None, description="From date YYYY-MM-DD"),
    to_date: str | None = Query(None, description="To date YYYY-MM-DD"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    """List bookings with optional filters."""
    stmt = (
        select(Booking)
        .options(selectinload(Booking.group), selectinload(Booking.room))
        .order_by(Booking.start_datetime.desc())
    )

    if status:
        stmt = stmt.where(Booking.status == status)
    if room_id is not None:
        stmt = stmt.where(Booking.room_id == room_id)
    if guest:
        stmt = stmt.join(BookingGroup, Booking.group_id == BookingGroup.id).where(
            BookingGroup.guest_name.ilike(f"%{guest}%")
        )
    if from_date:
        try:
            fd = date_type.fromisoformat(from_date)
            stmt = stmt.where(
                Booking.end_datetime >= datetime.combine(fd, time_type.min, tzinfo=timezone.utc)
            )
        except ValueError:
            raise HTTPException(400, "from_date must be YYYY-MM-DD")
    if to_date:
        try:
            td = date_type.fromisoformat(to_date)
            stmt = stmt.where(
                Booking.start_datetime <= datetime.combine(td, time_type.max, tzinfo=timezone.utc)
            )
        except ValueError:
            raise HTTPException(400, "to_date must be YYYY-MM-DD")

    stmt = stmt.limit(limit).offset(offset)

    result = await session.execute(stmt)
    bookings = result.scalars().unique().all()

    # Batch-fetch payment totals and group total rates
    group_ids = list({b.group_id for b in bookings})
    paid_map: dict[int, float] = {}
    rate_map: dict[int, float] = {}
    if group_ids:
        paid_stmt = (
            select(Payment.booking_group_id, func.coalesce(func.sum(Payment.amount), 0))
            .where(Payment.booking_group_id.in_(group_ids))
            .group_by(Payment.booking_group_id)
        )
        paid_result = await session.execute(paid_stmt)
        for gid, total in paid_result:
            paid_map[gid] = float(total)

        rate_stmt = (
            select(Booking.group_id, func.coalesce(func.sum(Booking.rate_snapshot), 0))
            .where(Booking.group_id.in_(group_ids), Booking.status != "cancelled")
            .group_by(Booking.group_id)
        )
        rate_result = await session.execute(rate_stmt)
        for gid, total in rate_result:
            rate_map[gid] = float(total)

    return [
        booking_to_out(b, paid_map.get(b.group_id, 0.0), rate_map.get(b.group_id, 0.0))
        for b in bookings
    ]


@router.get("/{booking_id}", response_model=BookingOut)
async def get_booking(
    booking_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Get a single booking by ID."""
    booking = await load_booking(session, booking_id)
    paid = await get_group_paid(session, booking.group_id)
    grate = await get_group_total_rate(session, booking.group_id)
    return booking_to_out(booking, paid, grate)


@router.put("/{booking_id}", response_model=BookingOut)
async def update_booking(
    booking_id: int,
    body: BookingUpdateRequest,
    session: AsyncSession = Depends(get_session),
):
    """Update booking dates, room, status, rate."""
    booking = await load_booking(session, booking_id)

    if booking.status == "cancelled":
        raise HTTPException(400, "Cannot update a cancelled booking")

    if body.room_id is not None:
        room = await session.get(Room, body.room_id)
        if not room or not room.is_active:
            raise HTTPException(400, "Target room not found or inactive")
        booking.room_id = body.room_id

    if body.start_datetime is not None:
        booking.start_datetime = body.start_datetime
    if body.end_datetime is not None:
        booking.end_datetime = body.end_datetime
    if body.status is not None:
        valid_statuses = ["reserved", "occupied", "checked_out", "cancelled"]
        if body.status not in valid_statuses:
            raise HTTPException(400, f"Invalid status. Must be one of: {valid_statuses}")
        booking.status = body.status
    if body.planned_checkin_time is not None:
        booking.planned_checkin_time = body.planned_checkin_time
    if body.rate_snapshot is not None:
        booking.rate_snapshot = body.rate_snapshot

    if booking.start_datetime >= booking.end_datetime:
        raise HTTPException(400, "start_datetime must be before end_datetime")

    await session.flush()
    booking = await load_booking(session, booking_id)
    paid = await get_group_paid(session, booking.group_id)
    grate = await get_group_total_rate(session, booking.group_id)
    return booking_to_out(booking, paid, grate)


@router.put("/groups/{group_id}", response_model=BookingGroupOut)
async def update_booking_group(
    group_id: int,
    body: BookingGroupUpdateRequest,
    session: AsyncSession = Depends(get_session),
):
    """Update guest/group details (name, phone, event type, notes)."""
    group = await session.get(BookingGroup, group_id)
    if not group:
        raise HTTPException(404, "Booking group not found")

    if body.guest_name is not None:
        group.guest_name = body.guest_name
    if body.phone is not None:
        group.phone = body.phone
    if body.event_type is not None:
        group.event_type = body.event_type
    if body.notes is not None:
        group.notes = body.notes

    await session.flush()
    await session.refresh(group)
    return BookingGroupOut(
        id=group.id,
        guest_name=group.guest_name,
        phone=group.phone,
        event_type=group.event_type,
        notes=group.notes,
        created_at=group.created_at,
    )


@router.delete("/{booking_id}", status_code=204)
async def cancel_booking(
    booking_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Cancel a booking (soft-delete: sets status to 'cancelled')."""
    booking = await load_booking(session, booking_id)
    if booking.status == "cancelled":
        raise HTTPException(400, "Booking is already cancelled")
    booking.status = "cancelled"
    await session.flush()


# ---------------------------------------------------------------------------
# Check-in / Check-out
# ---------------------------------------------------------------------------


@router.post("/{booking_id}/checkin", response_model=BookingOut)
async def checkin(
    booking_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Mark a booking as checked-in (occupied)."""
    booking = await load_booking(session, booking_id)

    if booking.status not in ("reserved",):
        raise HTTPException(
            400,
            f"Cannot check in: current status is '{booking.status}'. Must be 'reserved'.",
        )

    booking.status = "occupied"
    booking.actual_checkin_time = datetime.now(timezone.utc)
    await session.flush()
    booking = await load_booking(session, booking_id)
    paid = await get_group_paid(session, booking.group_id)
    grate = await get_group_total_rate(session, booking.group_id)
    return booking_to_out(booking, paid, grate)


@router.post("/{booking_id}/checkout", response_model=BookingOut)
async def checkout(
    booking_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Mark a booking as checked-out."""
    booking = await load_booking(session, booking_id)

    if booking.status not in ("occupied",):
        raise HTTPException(
            400,
            f"Cannot check out: current status is '{booking.status}'. Must be 'occupied'.",
        )

    booking.status = "checked_out"
    booking.actual_checkout_time = datetime.now(timezone.utc)
    await session.flush()
    booking = await load_booking(session, booking_id)
    paid = await get_group_paid(session, booking.group_id)
    grate = await get_group_total_rate(session, booking.group_id)
    return booking_to_out(booking, paid, grate)
