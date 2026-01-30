from fastapi import APIRouter
from app.api.v1 import dashboard, rooms

router = APIRouter()
router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
router.include_router(rooms.router, prefix="/rooms", tags=["rooms"])
