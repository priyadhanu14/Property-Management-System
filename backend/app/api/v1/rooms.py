"""Rooms endpoints: list, create, update, deactivate, timeline."""
from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.room import Room, RoomType
from app.models.booking import Booking

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class RoomOut(BaseModel):
    id: int
    unit_code: str
    room_type_id: int
    room_type: str
    is_active: bool
    status: str  # derived: Vacant, Reserved, Occupied

    class Config:
        from_attributes = True


class RoomCreate(BaseModel):
    unit_code: str = Field(..., min_length=1, max_length=16)
    room_type_id: int
    is_active: bool = True


class RoomUpdate(BaseModel):
    unit_code: str | None = Field(None, min_length=1, max_length=16)
    room_type_id: int | None = None
    is_active: bool | None = None


class BookingOut(BaseModel):
    id: int
    group_id: int
    room_id: int
    unit_code: str
    guest_name: str
    event_type: str | None
    start_datetime: datetime
    end_datetime: datetime
    status: str
    actual_checkin_time: datetime | None
    actual_checkout_time: datetime | None


class TimelineResponse(BaseModel):
    room_id: int
    unit_code: str
    bookings: list[BookingOut]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def derive_room_status(room: Room, now: datetime) -> str:
    """Derive current status from active bookings overlapping 'now'."""
    for b in room.bookings:
        if b.status == "cancelled":
            continue
        if b.start_datetime <= now <= b.end_datetime:
            if b.status == "occupied":
                return "Occupied"
            return "Reserved"
    return "Vacant"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=list[RoomOut])
async def list_rooms(
    active_only: bool = True,
    session: AsyncSession = Depends(get_session),
):
    """List all rooms with derived status."""
    stmt = (
        select(Room)
        .join(RoomType, Room.room_type_id == RoomType.id)
        .options(
            selectinload(Room.room_type),
            selectinload(Room.bookings),
        )
        .order_by(Room.unit_code)
    )
    if active_only:
        stmt = stmt.where(Room.is_active == True)  # noqa: E712

    result = await session.execute(stmt)
    rooms = result.scalars().unique().all()

    now = datetime.now(timezone.utc)
    return [
        RoomOut(
            id=r.id,
            unit_code=r.unit_code,
            room_type_id=r.room_type_id,
            room_type=r.room_type.name,
            is_active=r.is_active,
            status=derive_room_status(r, now),
        )
        for r in rooms
    ]


@router.post("", response_model=RoomOut, status_code=201)
async def create_room(
    body: RoomCreate,
    session: AsyncSession = Depends(get_session),
):
    """Create a new room/unit."""
    # Check room type exists
    rt = await session.get(RoomType, body.room_type_id)
    if not rt:
        raise HTTPException(400, "Room type not found")

    # Check unique unit_code
    existing = (
        await session.execute(
            select(Room).where(Room.unit_code == body.unit_code)
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(409, f"Unit code '{body.unit_code}' already exists")

    room = Room(
        unit_code=body.unit_code,
        room_type_id=body.room_type_id,
        is_active=body.is_active,
    )
    session.add(room)
    await session.flush()
    await session.refresh(room)

    return RoomOut(
        id=room.id,
        unit_code=room.unit_code,
        room_type_id=room.room_type_id,
        room_type=rt.name,
        is_active=room.is_active,
        status="Vacant",
    )


@router.get("/{room_id}", response_model=RoomOut)
async def get_room(
    room_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Get a single room by ID."""
    stmt = (
        select(Room)
        .where(Room.id == room_id)
        .options(selectinload(Room.room_type), selectinload(Room.bookings))
    )
    result = await session.execute(stmt)
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(404, "Room not found")

    now = datetime.now(timezone.utc)
    return RoomOut(
        id=room.id,
        unit_code=room.unit_code,
        room_type_id=room.room_type_id,
        room_type=room.room_type.name,
        is_active=room.is_active,
        status=derive_room_status(room, now),
    )


@router.put("/{room_id}", response_model=RoomOut)
async def update_room(
    room_id: int,
    body: RoomUpdate,
    session: AsyncSession = Depends(get_session),
):
    """Update a room (unit_code, room_type, active status)."""
    stmt = (
        select(Room)
        .where(Room.id == room_id)
        .options(selectinload(Room.room_type), selectinload(Room.bookings))
    )
    result = await session.execute(stmt)
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(404, "Room not found")

    if body.unit_code is not None and body.unit_code != room.unit_code:
        dup = (
            await session.execute(
                select(Room).where(Room.unit_code == body.unit_code)
            )
        ).scalar_one_or_none()
        if dup:
            raise HTTPException(409, f"Unit code '{body.unit_code}' already exists")
        room.unit_code = body.unit_code

    if body.room_type_id is not None:
        rt = await session.get(RoomType, body.room_type_id)
        if not rt:
            raise HTTPException(400, "Room type not found")
        room.room_type_id = body.room_type_id

    if body.is_active is not None:
        room.is_active = body.is_active

    await session.flush()
    await session.refresh(room)

    # Re-fetch with relationships
    stmt2 = (
        select(Room)
        .where(Room.id == room_id)
        .options(selectinload(Room.room_type), selectinload(Room.bookings))
    )
    room = (await session.execute(stmt2)).scalar_one()

    now = datetime.now(timezone.utc)
    return RoomOut(
        id=room.id,
        unit_code=room.unit_code,
        room_type_id=room.room_type_id,
        room_type=room.room_type.name,
        is_active=room.is_active,
        status=derive_room_status(room, now),
    )


@router.delete("/{room_id}", status_code=204)
async def deactivate_room(
    room_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Soft-delete: mark room as inactive."""
    room = await session.get(Room, room_id)
    if not room:
        raise HTTPException(404, "Room not found")
    room.is_active = False
    await session.flush()


@router.get("/{room_id}/timeline", response_model=TimelineResponse)
async def get_room_timeline(
    room_id: int,
    from_date: str = Query("", description="YYYY-MM-DD"),
    to_date: str = Query("", description="YYYY-MM-DD"),
    session: AsyncSession = Depends(get_session),
):
    """Timeline: bookings for a room within a date range."""
    stmt = (
        select(Room)
        .where(Room.id == room_id)
        .options(selectinload(Room.room_type))
    )
    room = (await session.execute(stmt)).scalar_one_or_none()
    if not room:
        raise HTTPException(404, "Room not found")

    booking_stmt = (
        select(Booking)
        .where(Booking.room_id == room_id, Booking.status != "cancelled")
        .order_by(Booking.start_datetime)
    )

    if from_date:
        try:
            fd = date.fromisoformat(from_date)
            booking_stmt = booking_stmt.where(
                Booking.end_datetime >= datetime.combine(fd, time.min, tzinfo=timezone.utc)
            )
        except ValueError:
            raise HTTPException(400, "from_date must be YYYY-MM-DD")

    if to_date:
        try:
            td = date.fromisoformat(to_date)
            booking_stmt = booking_stmt.where(
                Booking.start_datetime <= datetime.combine(td, time.max, tzinfo=timezone.utc)
            )
        except ValueError:
            raise HTTPException(400, "to_date must be YYYY-MM-DD")

    bookings_result = await session.execute(
        booking_stmt.options(selectinload(Booking.group))
    )
    bookings = bookings_result.scalars().all()

    return TimelineResponse(
        room_id=room.id,
        unit_code=room.unit_code,
        bookings=[
            BookingOut(
                id=b.id,
                group_id=b.group_id,
                room_id=b.room_id,
                unit_code=room.unit_code,
                guest_name=b.group.guest_name if b.group else "Unknown",
                event_type=b.group.event_type if b.group else None,
                start_datetime=b.start_datetime,
                end_datetime=b.end_datetime,
                status=b.status,
                actual_checkin_time=b.actual_checkin_time,
                actual_checkout_time=b.actual_checkout_time,
            )
            for b in bookings
        ],
    )
