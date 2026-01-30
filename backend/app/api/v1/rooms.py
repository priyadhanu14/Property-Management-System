from fastapi import APIRouter

router = APIRouter()


@router.get("")
async def list_rooms():
    """Placeholder: list rooms with derived status."""
    return {"rooms": []}


@router.get("/{unit_code}/timeline")
async def get_room_timeline(unit_code: str, from_date: str = "", to_date: str = ""):
    """Placeholder: timeline for a unit in date range."""
    return {"unit_code": unit_code, "bookings": []}
