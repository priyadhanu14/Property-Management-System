from fastapi import APIRouter, Depends
from app.api.v1 import (
    dashboard,
    rooms,
    room_types,
    bookings,
    payments,
    accounts,
    rate_plans,
    audit_logs,
    enquiries,
)
from app.auth import require_auth

router = APIRouter(dependencies=[Depends(require_auth)])
router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
router.include_router(rooms.router, prefix="/rooms", tags=["rooms"])
router.include_router(room_types.router, prefix="/room-types", tags=["room-types"])
router.include_router(bookings.router, prefix="/bookings", tags=["bookings"])
router.include_router(payments.router, prefix="/payments", tags=["payments"])
router.include_router(accounts.router, prefix="/accounts", tags=["accounts"])
router.include_router(rate_plans.router, prefix="/rate-plans", tags=["rate-plans"])
router.include_router(audit_logs.router, prefix="/audit-logs", tags=["audit-logs"])
router.include_router(enquiries.router, prefix="/enquiries", tags=["enquiries"])
