"""Change pallet_measurements.value_text from VARCHAR(255) to TEXT

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-02
"""
from alembic import op
import sqlalchemy as sa

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        'pallet_measurements',
        'value_text',
        existing_type=sa.String(255),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        'pallet_measurements',
        'value_text',
        existing_type=sa.Text(),
        type_=sa.String(255),
        existing_nullable=True,
    )
