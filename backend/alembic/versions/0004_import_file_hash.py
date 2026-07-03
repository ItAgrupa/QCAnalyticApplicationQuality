"""Add file_hash column to imports for duplicate detection

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-03
"""
from alembic import op
import sqlalchemy as sa

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'imports',
        sa.Column('file_hash', sa.String(64), nullable=True),
    )
    op.create_index('ix_imports_file_hash', 'imports', ['file_hash'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_imports_file_hash', table_name='imports')
    op.drop_column('imports', 'file_hash')
