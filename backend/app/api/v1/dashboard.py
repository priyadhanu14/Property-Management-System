from fastapi import APIRouter

router = APIRouter()


@router.get("/today")
async def get_today():
    """Placeholder: today's check-ins, check-outs, occupancy, pending balances."""
    return {
        "check_ins_today": 0,
        "check_outs_today": 0,
        "occupancy_count": 0,
        "availability_count": 0,
        "pending_balances": 0,
    }
