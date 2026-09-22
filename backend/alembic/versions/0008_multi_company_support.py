"""Multi-company support (Magopco and Agrupa Marca)

Revision ID: 0008
Revises: 0007
Create Date: 2026-09-22
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Create companies table ─────────────────────────────────────────────
    op.create_table(
        "companies",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("logo_url", sa.String(255), nullable=True),
        sa.Column("brand_color", sa.String(20), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index("ix_companies_code", "companies", ["code"])

    # ── 2. Seed initial companies ─────────────────────────────────────────────
    companies_table = sa.table(
        "companies",
        sa.column("id", sa.BigInteger),
        sa.column("code", sa.String),
        sa.column("name", sa.String),
        sa.column("brand_color", sa.String),
        sa.column("is_active", sa.Boolean),
    )
    op.bulk_insert(
        companies_table,
        [
            {"id": 1, "code": "MAGOPCO", "name": "Magopco", "brand_color": "#7B1FA2", "is_active": True},
            {"id": 2, "code": "AGRUPA_MARCA", "name": "Agrupa Marca", "brand_color": "#2E7D32", "is_active": True},
        ],
    )
    # Sync sequence in PostgreSQL
    op.execute("SELECT setval(pg_get_serial_sequence('companies', 'id'), 2, true)")

    # ── 3. Add company_id to master data tables ──────────────────────────────
    # clients
    op.add_column("clients", sa.Column("company_id", sa.BigInteger(), nullable=True))
    op.create_foreign_key("fk_clients_company_id", "clients", "companies", ["company_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_clients_company_id", "clients", ["company_id"])

    # quality_standards
    op.add_column("quality_standards", sa.Column("company_id", sa.BigInteger(), nullable=True))
    op.create_foreign_key("fk_quality_standards_company_id", "quality_standards", "companies", ["company_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_quality_standards_company_id", "quality_standards", ["company_id"])

    # score_rules
    op.add_column("score_rules", sa.Column("company_id", sa.BigInteger(), nullable=True))
    op.create_foreign_key("fk_score_rules_company_id", "score_rules", "companies", ["company_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_score_rules_company_id", "score_rules", ["company_id"])

    # report_templates
    op.add_column("report_templates", sa.Column("company_id", sa.BigInteger(), nullable=True))
    op.create_foreign_key("fk_report_templates_company_id", "report_templates", "companies", ["company_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_report_templates_company_id", "report_templates", ["company_id"])

    # ── 4. Add company_id to operational tables ──────────────────────────────
    # imports
    op.add_column("imports", sa.Column("company_id", sa.BigInteger(), nullable=True))
    op.create_foreign_key("fk_imports_company_id", "imports", "companies", ["company_id"], ["id"], ondelete="RESTRICT")
    op.create_index("ix_imports_company_id", "imports", ["company_id"])

    # loads
    op.add_column("loads", sa.Column("company_id", sa.BigInteger(), nullable=True))
    op.create_foreign_key("fk_loads_company_id", "loads", "companies", ["company_id"], ["id"], ondelete="RESTRICT")
    op.create_index("ix_loads_company_id", "loads", ["company_id"])

    # ── 5. Backfill existing data with Magopco (id=1) ─────────────────────────
    op.execute("UPDATE clients SET company_id = 1 WHERE company_id IS NULL")
    op.execute("UPDATE quality_standards SET company_id = 1 WHERE company_id IS NULL")
    op.execute("UPDATE imports SET company_id = 1 WHERE company_id IS NULL")
    op.execute("UPDATE loads SET company_id = 1 WHERE company_id IS NULL")


def downgrade() -> None:
    op.drop_constraint("fk_loads_company_id", "loads", type_="foreignkey")
    op.drop_index("ix_loads_company_id", table_name="loads")
    op.drop_column("loads", "company_id")

    op.drop_constraint("fk_imports_company_id", "imports", type_="foreignkey")
    op.drop_index("ix_imports_company_id", table_name="imports")
    op.drop_column("imports", "company_id")

    op.drop_constraint("fk_report_templates_company_id", "report_templates", type_="foreignkey")
    op.drop_index("ix_report_templates_company_id", table_name="report_templates")
    op.drop_column("report_templates", "company_id")

    op.drop_constraint("fk_score_rules_company_id", "score_rules", type_="foreignkey")
    op.drop_index("ix_score_rules_company_id", table_name="score_rules")
    op.drop_column("score_rules", "company_id")

    op.drop_constraint("fk_quality_standards_company_id", "quality_standards", type_="foreignkey")
    op.drop_index("ix_quality_standards_company_id", table_name="quality_standards")
    op.drop_column("quality_standards", "company_id")

    op.drop_constraint("fk_clients_company_id", "clients", type_="foreignkey")
    op.drop_index("ix_clients_company_id", table_name="clients")
    op.drop_column("clients", "company_id")

    op.drop_index("ix_companies_code", table_name="companies")
    op.drop_table("companies")
