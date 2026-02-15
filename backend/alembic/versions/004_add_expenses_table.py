"""Add expenses table for monthly unit-level and property-wide costs.

Revision ID: 004
Revises: 003
Create Date: Accounts feature

- Creates expenses table with FK to rooms (nullable for property-wide expenses)
- Columns: id, room_id, category, amount, month, description, created_at
- Index on (month, room_id) for fast monthly queries
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "expenses",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("room_id", sa.Integer(), nullable=True),
        sa.Column("category", sa.String(64), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("month", sa.Date(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["room_id"], ["rooms.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_expenses_month_room_id",
        "expenses",
        ["month", "room_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_expenses_month_room_id", table_name="expenses")
    op.drop_table("expenses")
