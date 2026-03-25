"""Initial schema + btree_gist exclusion constraint (no double booking).

Revision ID: 001
Revises:
Create Date: Initial

- Enables Postgres btree_gist extension (required for EXCLUSION on (unit_code, tsrange)).
- Creates room_types, rooms, booking_groups, bookings.
- Adds EXCLUSION constraint on (unit_code, tstzrange(start_datetime, end_datetime))
  so overlapping bookings on the same unit are rejected at DB level.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")

    op.create_table(
        "room_types",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(32), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "rooms",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("unit_code", sa.String(16), nullable=False),
        sa.Column("room_type_id", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.ForeignKeyConstraint(["room_type_id"], ["room_types.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("unit_code"),
    )
    op.create_table(
        "booking_groups",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("guest_name", sa.String(256), nullable=False),
        sa.Column("phone", sa.String(64), nullable=False),
        sa.Column("event_type", sa.String(64), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "bookings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("unit_code", sa.String(16), nullable=False),
        sa.Column("start_datetime", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_datetime", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="reserved"),
        sa.Column("planned_checkin_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_checkin_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_checkout_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rate_snapshot", sa.Numeric(12, 2), nullable=True),
        sa.Column("pricing_policy_snapshot", sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["group_id"], ["booking_groups.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("start_datetime < end_datetime", name="bookings_dates_order"),
    )

    # No double booking: exclude overlapping (unit_code, time range) for non-cancelled bookings.
    op.execute("""
        ALTER TABLE bookings
        ADD CONSTRAINT bookings_no_overlap_per_unit
        EXCLUDE USING gist (unit_code WITH =, tstzrange(start_datetime, end_datetime) WITH &&)
        WHERE (status IS NULL OR status != 'cancelled')
    """)


def downgrade() -> None:
    op.drop_constraint("bookings_no_overlap_per_unit", "bookings", type_="exclusion")
    op.drop_table("bookings")
    op.drop_table("booking_groups")
    op.drop_table("rooms")
    op.drop_table("room_types")
    op.execute("DROP EXTENSION IF EXISTS btree_gist")
