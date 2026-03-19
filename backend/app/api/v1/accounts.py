"""Accounts endpoints: monthly revenue/expense summary and expense CRUD."""
from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.expense import Expense
from app.models.payment import Payment
from app.models.booking import Booking
from app.models.room import Room, RoomType

router = APIRouter()

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

EXPENSE_CATEGORIES = [
    "electricity",
    "wifi",
    "cleaning",
    "maintenance",
    "water",
    "staff_salary",
    "other",
]


class ExpenseCreate(BaseModel):
    room_id: int | None = None
    category: str = Field(..., min_length=1, max_length=64)
    amount: float = Field(..., gt=0)
    month: date  # expects YYYY-MM-DD (first of month)
    description: str | None = None


class ExpenseUpdate(BaseModel):
    room_id: int | None = None
    category: str | None = Field(None, min_length=1, max_length=64)
    amount: float | None = Field(None, gt=0)
    month: date | None = None
    description: str | None = None


class ExpenseOut(BaseModel):
    id: int
    room_id: int | None
    category: str
    amount: float
    month: date
    description: str | None
    created_at: datetime | None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# CRUD: expenses
# ---------------------------------------------------------------------------


@router.post("/expenses", response_model=ExpenseOut, status_code=201)
async def create_expense(
    body: ExpenseCreate,
    session: AsyncSession = Depends(get_session),
):
    """Create a new expense entry."""
    expense = Expense(
        room_id=body.room_id,
        category=body.category.lower().strip(),
        amount=body.amount,
        month=body.month,
        description=body.description,
    )
    session.add(expense)
    await session.flush()
    await session.refresh(expense)
    return expense


@router.get("/expenses", response_model=list[ExpenseOut])
async def list_expenses(
    month: str = "",  # YYYY-MM
    room_id: int | None = None,
    session: AsyncSession = Depends(get_session),
):
    """List expenses, optionally filtered by month and/or room."""
    stmt = select(Expense).order_by(Expense.month.desc(), Expense.id.desc())

    if month:
        try:
            year, mon = month.split("-")
            year_int, mon_int = int(year), int(mon)
        except (ValueError, IndexError):
            raise HTTPException(400, "month must be YYYY-MM")
        stmt = stmt.where(
            extract("year", Expense.month) == year_int,
            extract("month", Expense.month) == mon_int,
        )

    if room_id is not None:
        stmt = stmt.where(Expense.room_id == room_id)

    result = await session.execute(stmt)
    return result.scalars().all()


@router.put("/expenses/{expense_id}", response_model=ExpenseOut)
async def update_expense(
    expense_id: int,
    body: ExpenseUpdate,
    session: AsyncSession = Depends(get_session),
):
    """Update an existing expense."""
    expense = await session.get(Expense, expense_id)
    if not expense:
        raise HTTPException(404, "Expense not found")

    if body.category is not None:
        expense.category = body.category.lower().strip()
    if body.amount is not None:
        expense.amount = body.amount
    if body.month is not None:
        expense.month = body.month.replace(day=1)
    if body.room_id is not None:
        expense.room_id = body.room_id
    if body.description is not None:
        expense.description = body.description

    await session.flush()
    await session.refresh(expense)
    return expense


@router.delete("/expenses/{expense_id}", status_code=204)
async def delete_expense(
    expense_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Delete an expense."""
    expense = await session.get(Expense, expense_id)
    if not expense:
        raise HTTPException(404, "Expense not found")
    await session.delete(expense)


# ---------------------------------------------------------------------------
# Monthly summary
# ---------------------------------------------------------------------------


class UnitExpenseDetail(BaseModel):
    category: str
    amount: float


class UnitSummary(BaseModel):
    room_id: int
    unit_code: str
    room_type: str
    revenue: float
    expenses: list[UnitExpenseDetail]
    total_expenses: float
    net: float


class PropertyExpense(BaseModel):
    id: int
    category: str
    amount: float
    description: str | None
    month: date
    created_at: datetime | None


class MonthlyTotals(BaseModel):
    total_revenue: float
    total_expenses: float
    net: float


class MonthlySummaryResponse(BaseModel):
    month: str
    units: list[UnitSummary]
    property_wide_expenses: list[PropertyExpense]
    totals: MonthlyTotals


@router.get("/monthly-summary", response_model=MonthlySummaryResponse)
async def get_monthly_summary(
    month: str = "",  # YYYY-MM
    session: AsyncSession = Depends(get_session),
):
    """
    Compute per-unit revenue (from payments) and expenses for a given month,
    plus property-wide (no room) expenses.
    """
    if not month:
        # Default to current month
        today = date.today()
        month = f"{today.year}-{today.month:02d}"

    try:
        year, mon = month.split("-")
        first_of_month = date(int(year), int(mon), 1)
    except (ValueError, IndexError):
        raise HTTPException(400, "month must be YYYY-MM")

    year_int = int(year)
    mon_int = int(mon)

    # ---- Revenue per room (payments within the month, excluding cancelled bookings) ----
    revenue_stmt = (
        select(
            Booking.room_id,
            func.coalesce(func.sum(Payment.amount), 0).label("revenue"),
        )
        .select_from(Payment)
        .join(Booking, Payment.booking_id == Booking.id)
        .where(
            extract("year", Payment.paid_at) == year_int,
            extract("month", Payment.paid_at) == mon_int,
            Booking.status != "cancelled",
        )
        .group_by(Booking.room_id)
    )
    revenue_result = await session.execute(revenue_stmt)
    revenue_map: dict[int | None, float] = {}
    for row in revenue_result:
        room_id = row[0]
        rev = float(row[1]) if row[1] else 0.0
        revenue_map[room_id] = rev

    # ---- Expenses per room for the month ----
    expense_stmt = (
        select(Expense)
        .where(
            extract("year", Expense.month) == year_int,
            extract("month", Expense.month) == mon_int,
        )
        .order_by(Expense.room_id, Expense.category)
    )
    expense_result = await session.execute(expense_stmt)
    expenses_all = expense_result.scalars().all()

    room_expenses: dict[int, list[Expense]] = {}
    property_expenses: list[Expense] = []
    for exp in expenses_all:
        if exp.room_id is not None:
            room_expenses.setdefault(exp.room_id, []).append(exp)
        else:
            property_expenses.append(exp)

    # ---- All active rooms ----
    rooms_stmt = (
        select(Room, RoomType.name)
        .join(RoomType, Room.room_type_id == RoomType.id)
        .where(Room.is_active == True)  # noqa: E712
        .order_by(Room.unit_code)
    )
    rooms_result = await session.execute(rooms_stmt)

    units: list[UnitSummary] = []
    total_revenue = 0.0
    total_expenses = 0.0

    for room, room_type_name in rooms_result:
        rev = revenue_map.get(room.id, 0.0)
        exps = room_expenses.get(room.id, [])
        exp_details = [
            UnitExpenseDetail(category=e.category, amount=float(e.amount))
            for e in exps
        ]
        exp_total = sum(float(e.amount) for e in exps)

        units.append(
            UnitSummary(
                room_id=room.id,
                unit_code=room.unit_code,
                room_type=room_type_name,
                revenue=rev,
                expenses=exp_details,
                total_expenses=exp_total,
                net=rev - exp_total,
            )
        )
        total_revenue += rev
        total_expenses += exp_total

    prop_exp_total = sum(float(e.amount) for e in property_expenses)
    total_expenses += prop_exp_total

    return MonthlySummaryResponse(
        month=month,
        units=units,
        property_wide_expenses=[
            PropertyExpense(
                id=e.id,
                category=e.category,
                amount=float(e.amount),
                description=e.description,
                month=e.month,
                created_at=e.created_at,
            )
            for e in property_expenses
        ],
        totals=MonthlyTotals(
            total_revenue=total_revenue,
            total_expenses=total_expenses,
            net=total_revenue - total_expenses,
        ),
    )
