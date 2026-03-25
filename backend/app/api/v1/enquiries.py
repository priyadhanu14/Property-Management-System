"""Enquiries endpoints: log and retrieve room enquiry calls."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_session
from app.models.enquiry import Enquiry

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class EnquiryCreate(BaseModel):
    room_id: int | None = None
    guest_name: str = Field(..., min_length=1, max_length=128)
    phone: str = Field(..., min_length=1, max_length=20)
    enquiry_date: date
    notes: str | None = None


class EnquiryOut(BaseModel):
    id: int
    room_id: int | None
    unit_code: str | None
    guest_name: str
    phone: str
    enquiry_date: date
    notes: str | None
    created_at: str | None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=list[EnquiryOut])
async def list_enquiries(
    from_date: str | None = Query(None, description="YYYY-MM-DD"),
    to_date: str | None = Query(None, description="YYYY-MM-DD"),
    room_id: int | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    """List enquiries, optionally filtered by date range and/or room."""
    stmt = (
        select(Enquiry)
        .options(selectinload(Enquiry.room))
        .order_by(Enquiry.enquiry_date.desc(), Enquiry.id.desc())
    )

    if from_date:
        try:
            stmt = stmt.where(Enquiry.enquiry_date >= date.fromisoformat(from_date))
        except ValueError:
            raise HTTPException(400, "from_date must be YYYY-MM-DD")

    if to_date:
        try:
            stmt = stmt.where(Enquiry.enquiry_date <= date.fromisoformat(to_date))
        except ValueError:
            raise HTTPException(400, "to_date must be YYYY-MM-DD")

    if room_id is not None:
        stmt = stmt.where(Enquiry.room_id == room_id)

    result = await session.execute(stmt)
    enquiries = result.scalars().all()

    return [
        EnquiryOut(
            id=e.id,
            room_id=e.room_id,
            unit_code=e.room.unit_code if e.room else None,
            guest_name=e.guest_name,
            phone=e.phone,
            enquiry_date=e.enquiry_date,
            notes=e.notes,
            created_at=e.created_at.isoformat() if e.created_at else None,
        )
        for e in enquiries
    ]


@router.post("", response_model=EnquiryOut, status_code=201)
async def create_enquiry(
    body: EnquiryCreate,
    session: AsyncSession = Depends(get_session),
):
    """Log a new room enquiry."""
    enquiry = Enquiry(
        room_id=body.room_id,
        guest_name=body.guest_name.strip(),
        phone=body.phone.strip(),
        enquiry_date=body.enquiry_date,
        notes=body.notes,
    )
    session.add(enquiry)
    await session.flush()
    await session.refresh(enquiry)

    # Load room for unit_code
    await session.refresh(enquiry, ["room"])

    return EnquiryOut(
        id=enquiry.id,
        room_id=enquiry.room_id,
        unit_code=enquiry.room.unit_code if enquiry.room else None,
        guest_name=enquiry.guest_name,
        phone=enquiry.phone,
        enquiry_date=enquiry.enquiry_date,
        notes=enquiry.notes,
        created_at=enquiry.created_at.isoformat() if enquiry.created_at else None,
    )


@router.delete("/{enquiry_id}", status_code=204)
async def delete_enquiry(
    enquiry_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Delete an enquiry."""
    enquiry = await session.get(Enquiry, enquiry_id)
    if not enquiry:
        raise HTTPException(404, "Enquiry not found")
    await session.delete(enquiry)
