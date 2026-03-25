"""Room Types endpoints: CRUD for room categories (2BHK, 3BHK, etc.)."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.room import RoomType

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class RoomTypeOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class RoomTypeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=32)


class RoomTypeUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=32)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=list[RoomTypeOut])
async def list_room_types(session: AsyncSession = Depends(get_session)):
    """List all room types."""
    result = await session.execute(select(RoomType).order_by(RoomType.name))
    return result.scalars().all()


@router.post("", response_model=RoomTypeOut, status_code=201)
async def create_room_type(
    body: RoomTypeCreate,
    session: AsyncSession = Depends(get_session),
):
    """Create a new room type."""
    existing = (
        await session.execute(
            select(RoomType).where(RoomType.name == body.name)
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(409, f"Room type '{body.name}' already exists")

    rt = RoomType(name=body.name)
    session.add(rt)
    await session.flush()
    await session.refresh(rt)
    return rt


@router.get("/{room_type_id}", response_model=RoomTypeOut)
async def get_room_type(
    room_type_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Get a single room type."""
    rt = await session.get(RoomType, room_type_id)
    if not rt:
        raise HTTPException(404, "Room type not found")
    return rt


@router.put("/{room_type_id}", response_model=RoomTypeOut)
async def update_room_type(
    room_type_id: int,
    body: RoomTypeUpdate,
    session: AsyncSession = Depends(get_session),
):
    """Rename a room type."""
    rt = await session.get(RoomType, room_type_id)
    if not rt:
        raise HTTPException(404, "Room type not found")

    if body.name != rt.name:
        dup = (
            await session.execute(
                select(RoomType).where(RoomType.name == body.name)
            )
        ).scalar_one_or_none()
        if dup:
            raise HTTPException(409, f"Room type '{body.name}' already exists")
        rt.name = body.name

    await session.flush()
    await session.refresh(rt)
    return rt


@router.delete("/{room_type_id}", status_code=204)
async def delete_room_type(
    room_type_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Delete a room type (fails if rooms still reference it)."""
    rt = await session.get(RoomType, room_type_id)
    if not rt:
        raise HTTPException(404, "Room type not found")
    try:
        await session.delete(rt)
        await session.flush()
    except Exception:
        raise HTTPException(
            409,
            "Cannot delete: rooms still reference this type. Reassign rooms first.",
        )
