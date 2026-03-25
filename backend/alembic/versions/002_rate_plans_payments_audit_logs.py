"""Add rate_plans, payments, audit_logs.

Revision ID: 002
Revises: 001
Create Date: Normalized schema (TRD)

- rate_plans: room_type_id, rate, pricing_unit, effective_from, effective_to
- payments: booking_group_id, booking_id nullable, amount, payment_type, payment_mode, paid_at, note
- audit_logs: actor, action, entity_type, entity_id, before_json, after_json, created_at
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "rate_plans",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("room_type_id", sa.Integer(), nullable=False),
        sa.Column("rate", sa.Numeric(12, 2), nullable=False),
        sa.Column("pricing_unit", sa.String(16), nullable=False),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=False),
        sa.Column("effective_to", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["room_type_id"], ["room_types.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_rate_plans_room_type_effective",
        "rate_plans",
        ["room_type_id", "effective_from", "effective_to"],
        unique=False,
    )

    op.create_table(
        "payments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("booking_group_id", sa.Integer(), nullable=False),
        sa.Column("booking_id", sa.Integer(), nullable=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("payment_type", sa.String(32), nullable=False),
        sa.Column("payment_mode", sa.String(32), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["booking_group_id"], ["booking_groups.id"]),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("amount >= 0", name="payments_amount_non_negative"),
    )
    op.create_index("ix_payments_booking_group_id", "payments", ["booking_group_id"], unique=False)
    op.create_index("ix_payments_booking_id", "payments", ["booking_id"], unique=False)

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("actor", sa.String(256), nullable=False),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("entity_type", sa.String(64), nullable=False),
        sa.Column("entity_id", sa.String(64), nullable=False),
        sa.Column("before_json", sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column("after_json", sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_audit_logs_entity",
        "audit_logs",
        ["entity_type", "entity_id"],
        unique=False,
    )
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_audit_logs_created_at", table_name="audit_logs")
    op.drop_index("ix_audit_logs_entity", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_index("ix_payments_booking_id", table_name="payments")
    op.drop_index("ix_payments_booking_group_id", table_name="payments")
    op.drop_table("payments")
    op.drop_index("ix_rate_plans_room_type_effective", table_name="rate_plans")
    op.drop_table("rate_plans")
