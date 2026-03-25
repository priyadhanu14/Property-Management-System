"""Add enquiries table for logging room enquiry calls.

Revision ID: 006
Revises: 005
Create Date: Enquiries feature

- Creates enquiries table with FK to rooms (nullable for general enquiries)
- Columns: id, room_id, guest_name, phone, enquiry_date, notes, created_at
- Index on enquiry_date for fast date-range queries
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "enquiries",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("room_id", sa.Integer(), nullable=True),
        sa.Column("guest_name", sa.String(128), nullable=False),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("enquiry_date", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["room_id"], ["rooms.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_enquiries_enquiry_date", "enquiries", ["enquiry_date"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_enquiries_enquiry_date", table_name="enquiries")
    op.drop_table("enquiries")
