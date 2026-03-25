"""Audit Log endpoints: list and filter change history."""
from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.audit_log import AuditLog

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class AuditLogOut(BaseModel):
    id: int
    actor: str
    action: str
    entity_type: str
    entity_id: str
    before_json: dict | None
    after_json: dict | None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=list[AuditLogOut])
async def list_audit_logs(
    entity_type: str | None = Query(None, description="Filter by entity type (e.g. booking, room)"),
    entity_id: str | None = Query(None, description="Filter by entity ID"),
    actor: str | None = Query(None, description="Filter by actor"),
    action: str | None = Query(None, description="Filter by action (e.g. create, update, delete)"),
    from_date: str | None = Query(None, description="From date YYYY-MM-DD"),
    to_date: str | None = Query(None, description="To date YYYY-MM-DD"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    """List audit log entries with optional filters."""
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())

    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if entity_id:
        stmt = stmt.where(AuditLog.entity_id == entity_id)
    if actor:
        stmt = stmt.where(AuditLog.actor.ilike(f"%{actor}%"))
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if from_date:
        try:
            fd = date.fromisoformat(from_date)
            stmt = stmt.where(
                AuditLog.created_at >= datetime.combine(fd, time.min, tzinfo=timezone.utc)
            )
        except ValueError:
            raise HTTPException(400, "from_date must be YYYY-MM-DD")
    if to_date:
        try:
            td = date.fromisoformat(to_date)
            stmt = stmt.where(
                AuditLog.created_at <= datetime.combine(td, time.max, tzinfo=timezone.utc)
            )
        except ValueError:
            raise HTTPException(400, "to_date must be YYYY-MM-DD")

    stmt = stmt.limit(limit).offset(offset)

    result = await session.execute(stmt)
    return result.scalars().all()


@router.get("/{log_id}", response_model=AuditLogOut)
async def get_audit_log(
    log_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Get a single audit log entry."""
    log = await session.get(AuditLog, log_id)
    if not log:
        raise HTTPException(404, "Audit log entry not found")
    return log
