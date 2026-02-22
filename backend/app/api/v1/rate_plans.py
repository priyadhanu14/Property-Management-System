"""Rate Plans endpoints: CRUD for pricing per room type."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.rate_plan import RatePlan
from app.models.room import RoomType

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class RatePlanOut(BaseModel):
    id: int
    room_type_id: int
    room_type_name: str
    rate: float
    pricing_unit: str
    effective_from: datetime
    effective_to: datetime | None

    class Config:
        from_attributes = True


class RatePlanCreate(BaseModel):
    room_type_id: int
    rate: float = Field(..., gt=0)
    pricing_unit: str = Field(..., pattern="^(hour|day)$")
    effective_from: datetime
    effective_to: datetime | None = None


class RatePlanUpdate(BaseModel):
    rate: float | None = Field(None, gt=0)
    pricing_unit: str | None = Field(None, pattern="^(hour|day)$")
    effective_from: datetime | None = None
    effective_to: datetime | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def rate_plan_to_out(rp: RatePlan) -> RatePlanOut:
    return RatePlanOut(
        id=rp.id,
        room_type_id=rp.room_type_id,
        room_type_name=rp.room_type.name if rp.room_type else "",
        rate=float(rp.rate),
        pricing_unit=rp.pricing_unit,
        effective_from=rp.effective_from,
        effective_to=rp.effective_to,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=list[RatePlanOut])
async def list_rate_plans(
    room_type_id: int | None = None,
    session: AsyncSession = Depends(get_session),
):
    """List all rate plans, optionally filtered by room type."""
    stmt = (
        select(RatePlan)
        .options(selectinload(RatePlan.room_type))
        .order_by(RatePlan.effective_from.desc())
    )
    if room_type_id is not None:
        stmt = stmt.where(RatePlan.room_type_id == room_type_id)

    result = await session.execute(stmt)
    return [rate_plan_to_out(rp) for rp in result.scalars().all()]


@router.post("", response_model=RatePlanOut, status_code=201)
async def create_rate_plan(
    body: RatePlanCreate,
    session: AsyncSession = Depends(get_session),
):
    """Create a new rate plan for a room type."""
    rt = await session.get(RoomType, body.room_type_id)
    if not rt:
        raise HTTPException(400, "Room type not found")

    rp = RatePlan(
        room_type_id=body.room_type_id,
        rate=body.rate,
        pricing_unit=body.pricing_unit,
        effective_from=body.effective_from,
        effective_to=body.effective_to,
    )
    session.add(rp)
    await session.flush()
    await session.refresh(rp)

    # Load with relationship
    stmt = (
        select(RatePlan)
        .where(RatePlan.id == rp.id)
        .options(selectinload(RatePlan.room_type))
    )
    loaded = (await session.execute(stmt)).scalar_one()
    return rate_plan_to_out(loaded)


@router.get("/{rate_plan_id}", response_model=RatePlanOut)
async def get_rate_plan(
    rate_plan_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Get a single rate plan."""
    stmt = (
        select(RatePlan)
        .where(RatePlan.id == rate_plan_id)
        .options(selectinload(RatePlan.room_type))
    )
    rp = (await session.execute(stmt)).scalar_one_or_none()
    if not rp:
        raise HTTPException(404, "Rate plan not found")
    return rate_plan_to_out(rp)


@router.put("/{rate_plan_id}", response_model=RatePlanOut)
async def update_rate_plan(
    rate_plan_id: int,
    body: RatePlanUpdate,
    session: AsyncSession = Depends(get_session),
):
    """Update a rate plan."""
    stmt = (
        select(RatePlan)
        .where(RatePlan.id == rate_plan_id)
        .options(selectinload(RatePlan.room_type))
    )
    rp = (await session.execute(stmt)).scalar_one_or_none()
    if not rp:
        raise HTTPException(404, "Rate plan not found")

    if body.rate is not None:
        rp.rate = body.rate
    if body.pricing_unit is not None:
        rp.pricing_unit = body.pricing_unit
    if body.effective_from is not None:
        rp.effective_from = body.effective_from
    if body.effective_to is not None:
        rp.effective_to = body.effective_to

    await session.flush()
    await session.refresh(rp)

    stmt2 = (
        select(RatePlan)
        .where(RatePlan.id == rate_plan_id)
        .options(selectinload(RatePlan.room_type))
    )
    loaded = (await session.execute(stmt2)).scalar_one()
    return rate_plan_to_out(loaded)


@router.delete("/{rate_plan_id}", status_code=204)
async def delete_rate_plan(
    rate_plan_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Delete a rate plan."""
    rp = await session.get(RatePlan, rate_plan_id)
    if not rp:
        raise HTTPException(404, "Rate plan not found")
    await session.delete(rp)
