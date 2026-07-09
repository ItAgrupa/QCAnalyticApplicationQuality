"""add notification_prefs JSONB column to users

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'users',
        sa.Column(
            'notification_prefs',
            JSONB,
            nullable=False,
            server_default='{}',
        ),
    )


def downgrade():
    op.drop_column('users', 'notification_prefs')
