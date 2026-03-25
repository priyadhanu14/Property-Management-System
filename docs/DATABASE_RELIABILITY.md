# Database reliability: no double booking

## Requirement

The system **must** prevent double booking per unit at the **database level**, so that even if the API or application has a bug, two overlapping bookings for the same unit cannot be committed.

## Implementation

- **Postgres extension:** `btree_gist` (required for `EXCLUDE` constraints that mix a scalar column with a range).
- **Constraint:** On table `bookings`, an exclusion constraint on `(room_id, tstzrange(start_datetime, end_datetime))` so that no two rows with the same `room_id` have overlapping time ranges. (Normalized schema uses `room_id` FK to `rooms`; migration 003 replaced the original `unit_code`-based constraint.)
- **Partial constraint:** Applied only to non-cancelled bookings (`WHERE status IS NULL OR status != 'cancelled'`), so cancelled bookings do not block the same slot.

## Where it lives

- **Migration 001:** [backend/alembic/versions/001_initial_and_no_double_booking.py](backend/alembic/versions/001_initial_and_no_double_booking.py) — creates `btree_gist` and initial `bookings_no_overlap_per_unit` on `unit_code`.
- **Migration 003:** [backend/alembic/versions/003_bookings_room_id_normalize.py](backend/alembic/versions/003_bookings_room_id_normalize.py) — replaces with `bookings_no_overlap_per_room` on `room_id` (normalized schema).

## Supabase

Supabase Postgres supports the `btree_gist` extension. No extra configuration is required; the first migration enables it and creates the constraint.

## Testing

After running migrations, attempt to insert two bookings for the same unit with overlapping `start_datetime`/`end_datetime`. The second insert should fail with a Postgres exclusion violation.
