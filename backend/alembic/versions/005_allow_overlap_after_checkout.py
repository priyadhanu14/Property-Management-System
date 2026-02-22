"""Allow new bookings when previous booking was checked_out early.

Revision ID: 005
Revises: 004
Create Date: Fix overlap constraint

- Drops the old exclusion constraint that only excluded 'cancelled' bookings.
- Re-creates it to also exclude 'checked_out' bookings, so early checkouts
  free up the room for new bookings during the remaining period.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop old constraint (only excluded 'cancelled')
    op.execute(
        "ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_overlap_per_room"
    )

    # Re-create: exclude both 'cancelled' and 'checked_out' from overlap check
    op.execute("""
        ALTER TABLE bookings
        ADD CONSTRAINT bookings_no_overlap_per_room
        EXCLUDE USING gist (room_id WITH =, tstzrange(start_datetime, end_datetime) WITH &&)
        WHERE (status NOT IN ('cancelled', 'checked_out'))
    """)


def downgrade() -> None:
    op.execute(
        "ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_overlap_per_room"
    )
    op.execute("""
        ALTER TABLE bookings
        ADD CONSTRAINT bookings_no_overlap_per_room
        EXCLUDE USING gist (room_id WITH =, tstzrange(start_datetime, end_datetime) WITH &&)
        WHERE (status IS NULL OR status != 'cancelled')
    """)
