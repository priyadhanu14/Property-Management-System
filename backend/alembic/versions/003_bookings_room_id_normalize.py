"""Normalize bookings: room_id FK instead of unit_code; exclusion on room_id.

Revision ID: 003
Revises: 002
Create Date: Normalized schema

- Add bookings.room_id (nullable), backfill from rooms by unit_code
- Drop exclusion bookings_no_overlap_per_unit
- Drop bookings.unit_code
- Set room_id NOT NULL, add FK to rooms(id)
- Add exclusion on (room_id, tstzrange(start_datetime, end_datetime))
- Add index (room_id, start_datetime)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "bookings",
        sa.Column("room_id", sa.Integer(), nullable=True),
    )
    op.execute("""
        UPDATE bookings b
        SET room_id = r.id
        FROM rooms r
        WHERE r.unit_code = b.unit_code
    """)
    op.execute("ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_overlap_per_unit")
    op.drop_column("bookings", "unit_code")
    op.alter_column(
        "bookings",
        "room_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.create_foreign_key(
        "fk_bookings_room_id_rooms",
        "bookings",
        "rooms",
        ["room_id"],
        ["id"],
    )
    op.execute("""
        ALTER TABLE bookings
        ADD CONSTRAINT bookings_no_overlap_per_room
        EXCLUDE USING gist (room_id WITH =, tstzrange(start_datetime, end_datetime) WITH &&)
        WHERE (status IS NULL OR status != 'cancelled')
    """)
    op.create_index(
        "ix_bookings_room_id_start_datetime",
        "bookings",
        ["room_id", "start_datetime"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_bookings_room_id_start_datetime", table_name="bookings")
    op.execute("ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_overlap_per_room")
    op.drop_constraint("fk_bookings_room_id_rooms", "bookings", type_="foreignkey")
    op.add_column(
        "bookings",
        sa.Column("unit_code", sa.String(16), nullable=True),
    )
    op.execute("""
        UPDATE bookings b
        SET unit_code = r.unit_code
        FROM rooms r
        WHERE b.room_id = r.id
    """)
    op.alter_column(
        "bookings",
        "unit_code",
        existing_type=sa.String(16),
        nullable=False,
    )
    op.drop_column("bookings", "room_id")
    op.execute("""
        ALTER TABLE bookings
        ADD CONSTRAINT bookings_no_overlap_per_unit
        EXCLUDE USING gist (unit_code WITH =, tstzrange(start_datetime, end_datetime) WITH &&)
        WHERE (status IS NULL OR status != 'cancelled')
    """)
