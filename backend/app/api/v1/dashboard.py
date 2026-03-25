"""Dashboard endpoints: today's KPIs (check-ins, check-outs, occupancy, pending balances)."""
from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.booking import Booking, BookingGroup
from app.models.payment import Payment
from app.models.room import Room

router = APIRouter()


class DashboardToday(BaseModel):
    check_ins_today: int
    check_outs_today: int
    occupancy_count: int
    availability_count: int
    total_rooms: int
    pending_balances: float


@router.get("/today", response_model=DashboardToday)
async def get_today(session: AsyncSession = Depends(get_session)):
    """Today's check-ins, check-outs, occupancy, availability, pending balances."""
    today = date.today()
    today_start = datetime.combine(today, time.min, tzinfo=timezone.utc)
    today_end = datetime.combine(today, time.max, tzinfo=timezone.utc)

    # Check-ins today: bookings with start_datetime today AND status in (reserved, occupied)
    check_ins_stmt = (
        select(func.count())
        .select_from(Booking)
        .where(
            Booking.start_datetime >= today_start,
            Booking.start_datetime <= today_end,
            Booking.status.in_(["reserved", "occupied"]),
        )
    )
    check_ins_today = (await session.execute(check_ins_stmt)).scalar() or 0

    # Check-outs today: bookings with end_datetime today AND status in (occupied, checked_out)
    check_outs_stmt = (
        select(func.count())
        .select_from(Booking)
        .where(
            Booking.end_datetime >= today_start,
            Booking.end_datetime <= today_end,
            Booking.status.in_(["occupied", "checked_out"]),
        )
    )
    check_outs_today = (await session.execute(check_outs_stmt)).scalar() or 0

    # Currently occupied: bookings where now is within [start, end] and status = 'occupied'
    now_utc = datetime.now(timezone.utc)
    occupancy_stmt = (
        select(func.count(func.distinct(Booking.room_id)))
        .select_from(Booking)
        .where(
            Booking.start_datetime <= now_utc,
            Booking.end_datetime >= now_utc,
            Booking.status == "occupied",
        )
    )
    occupancy_count = (await session.execute(occupancy_stmt)).scalar() or 0

    # Total active rooms
    total_rooms_stmt = (
        select(func.count()).select_from(Room).where(Room.is_active == True)  # noqa: E712
    )
    total_rooms = (await session.execute(total_rooms_stmt)).scalar() or 0
    availability_count = max(0, total_rooms - occupancy_count)

    # Pending balances: for each group with active bookings, sum rates minus payments
    # First get group_ids that have at least one active booking
    active_group_ids_stmt = (
        select(Booking.group_id)
        .where(Booking.status.in_(["reserved", "occupied"]))
        .distinct()
    )

    # Sum of rate_snapshot for active bookings in those groups
    expected_stmt = (
        select(func.coalesce(func.sum(Booking.rate_snapshot), 0))
        .select_from(Booking)
        .where(
            Booking.group_id.in_(active_group_ids_stmt),
            Booking.status != "cancelled",
        )
    )
    total_expected = float((await session.execute(expected_stmt)).scalar() or 0)

    # Total payments only for those active groups
    paid_stmt = (
        select(func.coalesce(func.sum(Payment.amount), 0))
        .select_from(Payment)
        .where(Payment.booking_group_id.in_(active_group_ids_stmt))
    )
    total_paid = float((await session.execute(paid_stmt)).scalar() or 0)

    pending_balances = max(0.0, total_expected - total_paid)

    return DashboardToday(
        check_ins_today=check_ins_today,
        check_outs_today=check_outs_today,
        occupancy_count=occupancy_count,
        availability_count=availability_count,
        total_rooms=total_rooms,
        pending_balances=round(pending_balances, 2),
    )
