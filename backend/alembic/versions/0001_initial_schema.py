"""Initial schema — all tables

Revision ID: 0001
Revises:
Create Date: 2026-06-30
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── roles ────────────────────────────────────────────────────────────────
    op.create_table(
        "roles",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("permissions_json", postgresql.JSONB(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_roles_name", "roles", ["name"])

    # ── users ────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role_id", sa.BigInteger(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # ── countries ────────────────────────────────────────────────────────────
    op.create_table(
        "countries",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("iso_code", sa.String(3), nullable=False),
        sa.Column("region", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("iso_code"),
    )
    op.create_index("ix_countries_iso_code", "countries", ["iso_code"])

    # ── markets ──────────────────────────────────────────────────────────────
    op.create_table(
        "markets",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── clients ──────────────────────────────────────────────────────────────
    op.create_table(
        "clients",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("client_code", sa.String(50), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("country_id", sa.BigInteger(), nullable=True),
        sa.Column("market_id", sa.BigInteger(), nullable=True),
        sa.Column("default_language", sa.String(16), nullable=False, server_default="en"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["country_id"], ["countries.id"]),
        sa.ForeignKeyConstraint(["market_id"], ["markets.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("client_code"),
    )
    op.create_index("ix_clients_client_code", "clients", ["client_code"])

    # ── products ─────────────────────────────────────────────────────────────
    op.create_table(
        "products",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── varieties ────────────────────────────────────────────────────────────
    op.create_table(
        "varieties",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("product_id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("code", sa.String(100), nullable=True),
        sa.Column("is_premium", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── packaging_types ──────────────────────────────────────────────────────
    op.create_table(
        "packaging_types",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("type", sa.String(50), nullable=True),
        sa.Column("weight_format", sa.String(50), nullable=True),
        sa.Column("is_bulk", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_packaged", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── client_specifications ─────────────────────────────────────────────────
    op.create_table(
        "client_specifications",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("client_id", sa.BigInteger(), nullable=False),
        sa.Column("market_id", sa.BigInteger(), nullable=True),
        sa.Column("document_code", sa.String(100), nullable=False),
        sa.Column("revision", sa.String(50), nullable=True),
        sa.Column("revision_date", sa.Date(), nullable=True),
        sa.Column("file_path", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["market_id"], ["markets.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── report_templates ──────────────────────────────────────────────────────
    op.create_table(
        "report_templates",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("client_id", sa.BigInteger(), nullable=False),
        sa.Column("template_name", sa.String(150), nullable=False),
        sa.Column("template_version", sa.String(50), nullable=False),
        sa.Column("file_type", sa.String(20), nullable=False, server_default="pdf"),
        sa.Column("parser_key", sa.String(100), nullable=False),
        sa.Column("mapping_json", postgresql.JSONB(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── quality_standards ─────────────────────────────────────────────────────
    op.create_table(
        "quality_standards",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("client_id", sa.BigInteger(), nullable=False),
        sa.Column("market_id", sa.BigInteger(), nullable=True),
        sa.Column("product_id", sa.BigInteger(), nullable=True),
        sa.Column("variety_id", sa.BigInteger(), nullable=True),
        sa.Column("packaging_type_id", sa.BigInteger(), nullable=True),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column("parameter_code", sa.String(100), nullable=False),
        sa.Column("parameter_name", sa.String(150), nullable=False),
        sa.Column("parameter_group", sa.String(50), nullable=True),
        sa.Column("min_value", sa.Numeric(10, 4), nullable=True),
        sa.Column("max_value", sa.Numeric(10, 4), nullable=True),
        sa.Column("unit", sa.String(20), nullable=True),
        sa.Column("severity", sa.String(20), nullable=False, server_default="MAJOR"),
        sa.Column("score_system", sa.String(20), nullable=True),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["market_id"], ["markets.id"]),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.ForeignKeyConstraint(["variety_id"], ["varieties.id"]),
        sa.ForeignKeyConstraint(["packaging_type_id"], ["packaging_types.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_quality_standards_parameter_code", "quality_standards", ["parameter_code"])

    # ── score_rules ───────────────────────────────────────────────────────────
    op.create_table(
        "score_rules",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("client_id", sa.BigInteger(), nullable=False),
        sa.Column("market_id", sa.BigInteger(), nullable=True),
        sa.Column("parameter_code", sa.String(100), nullable=False),
        sa.Column("score_type", sa.String(20), nullable=False),
        sa.Column("score_label", sa.String(20), nullable=False),
        sa.Column("min_value", sa.Numeric(10, 4), nullable=True),
        sa.Column("max_value", sa.Numeric(10, 4), nullable=True),
        sa.Column("unit", sa.String(20), nullable=True),
        sa.Column("meaning", sa.String(150), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["market_id"], ["markets.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── imports ───────────────────────────────────────────────────────────────
    op.create_table(
        "imports",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("client_id", sa.BigInteger(), nullable=False),
        sa.Column("uploaded_by_user_id", sa.BigInteger(), nullable=False),
        sa.Column("original_file_path", sa.Text(), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_type", sa.String(20), nullable=False, server_default="pdf"),
        sa.Column("status", sa.String(30), nullable=False, server_default="UPLOADED"),
        sa.Column("detected_template_id", sa.BigInteger(), nullable=True),
        sa.Column("extraction_confidence", sa.Numeric(5, 2), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["uploaded_by_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["detected_template_id"], ["report_templates.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_imports_status_created_at", "imports", ["status", "created_at"])

    # ── import_raw_payloads ───────────────────────────────────────────────────
    op.create_table(
        "import_raw_payloads",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("import_id", sa.BigInteger(), nullable=False),
        sa.Column("payload_json", postgresql.JSONB(), nullable=False),
        sa.Column("parser_version", sa.String(50), nullable=False),
        sa.Column("ocr_used", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("source_page_count", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["import_id"], ["imports.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("import_id"),
    )

    # ── loads ─────────────────────────────────────────────────────────────────
    op.create_table(
        "loads",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("client_id", sa.BigInteger(), nullable=False),
        sa.Column("market_id", sa.BigInteger(), nullable=True),
        sa.Column("import_id", sa.BigInteger(), nullable=False),
        sa.Column("load_reference", sa.String(100), nullable=True),
        sa.Column("container_number", sa.String(100), nullable=True),
        sa.Column("vessel_name", sa.String(100), nullable=True),
        sa.Column("inspection_date", sa.Date(), nullable=True),
        sa.Column("inspection_place", sa.String(150), nullable=True),
        sa.Column("origin_country_id", sa.BigInteger(), nullable=True),
        sa.Column("product_id", sa.BigInteger(), nullable=True),
        sa.Column("variety_id", sa.BigInteger(), nullable=True),
        sa.Column("packaging_type_id", sa.BigInteger(), nullable=True),
        sa.Column("total_cases", sa.Integer(), nullable=True),
        sa.Column("total_pallets", sa.Integer(), nullable=True),
        sa.Column("total_weight", sa.Numeric(12, 3), nullable=True),
        sa.Column("final_status", sa.String(30), nullable=False, server_default="PENDING"),
        sa.Column("quality_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("condition_score", sa.String(20), nullable=True),
        sa.Column("main_issue", sa.Text(), nullable=True),
        sa.Column("applied_standard_ref", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["market_id"], ["markets.id"]),
        sa.ForeignKeyConstraint(["import_id"], ["imports.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["origin_country_id"], ["countries.id"]),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.ForeignKeyConstraint(["variety_id"], ["varieties.id"]),
        sa.ForeignKeyConstraint(["packaging_type_id"], ["packaging_types.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("import_id"),
    )
    op.create_index("ix_loads_client_inspection_date", "loads", ["client_id", "inspection_date"])
    op.create_index("ix_loads_load_reference", "loads", ["load_reference"])
    op.create_index("ix_loads_final_status", "loads", ["final_status"])

    # ── pallets ───────────────────────────────────────────────────────────────
    op.create_table(
        "pallets",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("load_id", sa.BigInteger(), nullable=False),
        sa.Column("pallet_number", sa.String(100), nullable=False),
        sa.Column("packing_date", sa.Date(), nullable=True),
        sa.Column("grower_code", sa.String(100), nullable=True),
        sa.Column("ggn", sa.String(100), nullable=True),
        sa.Column("variety_id", sa.BigInteger(), nullable=True),
        sa.Column("packaging_type_id", sa.BigInteger(), nullable=True),
        sa.Column("cases_count", sa.Integer(), nullable=True),
        sa.Column("weight", sa.Numeric(12, 3), nullable=True),
        sa.Column("q_score", sa.String(20), nullable=True),
        sa.Column("cs_score", sa.String(20), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="PENDING"),
        sa.Column("comments", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["load_id"], ["loads.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["variety_id"], ["varieties.id"]),
        sa.ForeignKeyConstraint(["packaging_type_id"], ["packaging_types.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_pallets_load_id_pallet_number", "pallets", ["load_id", "pallet_number"])
    op.create_index("ix_pallets_status", "pallets", ["status"])

    # ── pallet_measurements ───────────────────────────────────────────────────
    op.create_table(
        "pallet_measurements",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("pallet_id", sa.BigInteger(), nullable=False),
        sa.Column("parameter_code", sa.String(100), nullable=False),
        sa.Column("parameter_name", sa.String(150), nullable=False),
        sa.Column("value_numeric", sa.Numeric(12, 4), nullable=True),
        sa.Column("value_text", sa.String(255), nullable=True),
        sa.Column("unit", sa.String(20), nullable=True),
        sa.Column("source_column", sa.String(100), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="PENDING"),
        sa.Column("standard_min", sa.Numeric(12, 4), nullable=True),
        sa.Column("standard_max", sa.Numeric(12, 4), nullable=True),
        sa.Column("deviation", sa.Numeric(12, 4), nullable=True),
        sa.Column("severity", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["pallet_id"], ["pallets.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_pallet_measurements_pallet_id_param", "pallet_measurements", ["pallet_id", "parameter_code"])

    # ── load_summary_measurements ─────────────────────────────────────────────
    op.create_table(
        "load_summary_measurements",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("load_id", sa.BigInteger(), nullable=False),
        sa.Column("parameter_code", sa.String(100), nullable=False),
        sa.Column("parameter_name", sa.String(150), nullable=False),
        sa.Column("average_value", sa.Numeric(12, 4), nullable=True),
        sa.Column("min_value", sa.Numeric(12, 4), nullable=True),
        sa.Column("max_value", sa.Numeric(12, 4), nullable=True),
        sa.Column("unit", sa.String(20), nullable=True),
        sa.Column("standard_min", sa.Numeric(12, 4), nullable=True),
        sa.Column("standard_max", sa.Numeric(12, 4), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="PENDING"),
        sa.Column("severity", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["load_id"], ["loads.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_load_summary_measurements_load_id_param", "load_summary_measurements", ["load_id", "parameter_code"])

    # ── generated_reports ─────────────────────────────────────────────────────
    op.create_table(
        "generated_reports",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("load_id", sa.BigInteger(), nullable=False),
        sa.Column("report_type", sa.String(30), nullable=False),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("generated_by_user_id", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["load_id"], ["loads.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["generated_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_generated_reports_load_id", "generated_reports", ["load_id"])

    # ── corrective_actions ────────────────────────────────────────────────────
    op.create_table(
        "corrective_actions",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("load_id", sa.BigInteger(), nullable=False),
        sa.Column("pallet_id", sa.BigInteger(), nullable=True),
        sa.Column("issue_type", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("root_cause", sa.Text(), nullable=True),
        sa.Column("action_required", sa.Text(), nullable=False),
        sa.Column("responsible_user_id", sa.BigInteger(), nullable=True),
        sa.Column("deadline", sa.Date(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="OPEN"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["load_id"], ["loads.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["pallet_id"], ["pallets.id"]),
        sa.ForeignKeyConstraint(["responsible_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_corrective_actions_load_id", "corrective_actions", ["load_id"])

    # ── audit_logs ────────────────────────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(100), nullable=True),
        sa.Column("entity_id", sa.BigInteger(), nullable=True),
        sa.Column("old_value_json", postgresql.JSONB(), nullable=True),
        sa.Column("new_value_json", postgresql.JSONB(), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])

    # ── Seed default roles ────────────────────────────────────────────────────
    op.execute("""
        INSERT INTO roles (name, description, is_active) VALUES
        ('Admin', 'Full system access', true),
        ('Quality Manager', 'Manage quality workflows and approve decisions', true),
        ('Quality Analyst', 'Upload, validate, and analyse reports', true),
        ('Management Viewer', 'Read-only dashboard and reports access', true),
        ('Auditor', 'Read-only audit log access', true)
    """)


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("corrective_actions")
    op.drop_table("generated_reports")
    op.drop_table("load_summary_measurements")
    op.drop_table("pallet_measurements")
    op.drop_table("pallets")
    op.drop_table("loads")
    op.drop_table("import_raw_payloads")
    op.drop_table("imports")
    op.drop_table("score_rules")
    op.drop_table("quality_standards")
    op.drop_table("report_templates")
    op.drop_table("client_specifications")
    op.drop_table("packaging_types")
    op.drop_table("varieties")
    op.drop_table("products")
    op.drop_table("clients")
    op.drop_table("markets")
    op.drop_table("countries")
    op.drop_table("users")
    op.drop_table("roles")
