"""Seed Agroberries master data — countries, markets, client, product, varieties, packaging, standards, score rules.

All values sourced from:
  - Quality Intelligence Platform Specification
  - Agroberries supplier manual (quality/condition tolerances, scoring)
  - Sample report: 20260207 MAGOPCO 8515 (R6960BDG).pdf

Revision ID: 0002
Revises: 0001
"""
from alembic import op
import sqlalchemy as sa
from datetime import date

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

EFFECTIVE_FROM = date(2026, 1, 1)


def upgrade() -> None:
    conn = op.get_bind()

    # ── Countries ──────────────────────────────────────────────────────────────
    conn.execute(sa.text("""
        INSERT INTO countries (name, iso_code, region, is_active, created_at, updated_at)
        VALUES
            ('Morocco',     'MAR', 'Africa',          true, now(), now()),
            ('Netherlands', 'NLD', 'Europe',          true, now(), now()),
            ('Spain',       'ESP', 'Europe',          true, now(), now()),
            ('Portugal',    'PRT', 'Europe',          true, now(), now()),
            ('Peru',        'PER', 'South America',   true, now(), now()),
            ('Chile',       'CHL', 'South America',   true, now(), now())
        ON CONFLICT DO NOTHING
    """))

    # ── Markets ────────────────────────────────────────────────────────────────
    conn.execute(sa.text("""
        INSERT INTO markets (name, description, is_active, created_at, updated_at)
        VALUES
            ('Netherlands', 'Dutch retail and wholesale market',             true, now(), now()),
            ('UK',          'United Kingdom retail market',                   true, now(), now()),
            ('Germany',     'German retail and wholesale market',             true, now(), now()),
            ('General EU',  'General European market (non-specific country)', true, now(), now())
        ON CONFLICT DO NOTHING
    """))

    # ── Client: Agroberries ────────────────────────────────────────────────────
    netherlands_id = conn.execute(
        sa.text("SELECT id FROM countries WHERE iso_code = 'NLD'")
    ).scalar()
    market_nl_id = conn.execute(
        sa.text("SELECT id FROM markets WHERE name = 'Netherlands'")
    ).scalar()

    conn.execute(sa.text("""
        INSERT INTO clients (client_code, name, country_id, market_id, default_language,
                             is_active, notes, created_at, updated_at)
        VALUES (
            'AGRO_EU',
            'Agroberries Europe BV',
            :country_id,
            :market_id,
            'nl',
            true,
            'Pilot client. Inspection conducted at Beekers. Premium varieties: Sekoya Pop, Sekoya Beauty.',
            now(), now()
        )
        ON CONFLICT (client_code) DO NOTHING
    """), {"country_id": netherlands_id, "market_id": market_nl_id})

    # ── Product: Blueberries ───────────────────────────────────────────────────
    conn.execute(sa.text("""
        INSERT INTO products (name, category, is_active, created_at, updated_at)
        VALUES ('Blueberries', 'Berries', true, now(), now())
        ON CONFLICT DO NOTHING
    """))

    product_id = conn.execute(
        sa.text("SELECT id FROM products WHERE name = 'Blueberries'")
    ).scalar()

    # ── Varieties ──────────────────────────────────────────────────────────────
    conn.execute(sa.text("""
        INSERT INTO varieties (product_id, name, code, is_premium, is_active, created_at, updated_at)
        VALUES
            (:pid, 'Sekoya Pop',    'SEK_POP',    true,  true, now(), now()),
            (:pid, 'Sekoya Beauty', 'SEK_BEAUTY', true,  true, now(), now()),
            (:pid, 'Star',          'STAR',       false, true, now(), now()),
            (:pid, 'Duke',          'DUKE',       false, true, now(), now()),
            (:pid, 'Bluecrop',      'BLUECROP',   false, true, now(), now())
        ON CONFLICT DO NOTHING
    """), {"pid": product_id})

    # ── Packaging Types ────────────────────────────────────────────────────────
    conn.execute(sa.text("""
        INSERT INTO packaging_types (name, type, weight_format, is_bulk, is_packaged, is_active, created_at, updated_at)
        VALUES
            ('Bulk Sekoya 3.0 kg',    'bulk',      '3.0 kg per tray', true,  false, true, now(), now()),
            ('Punnet 125g',           'packaged',  '125g punnet',     false, true,  true, now(), now()),
            ('Punnet 250g',           'packaged',  '250g punnet',     false, true,  true, now(), now()),
            ('Punnet 500g',           'packaged',  '500g punnet',     false, true,  true, now(), now()),
            ('Clamshell 150g',        'packaged',  '150g clamshell',  false, true,  true, now(), now()),
            ('Clamshell 300g',        'packaged',  '300g clamshell',  false, true,  true, now(), now()),
            ('Bulk Standard 2.5 kg',  'bulk',      '2.5 kg per tray', true,  false, true, now(), now())
        ON CONFLICT DO NOTHING
    """))

    # Look up IDs needed for standards
    client_id = conn.execute(
        sa.text("SELECT id FROM clients WHERE client_code = 'AGRO_EU'")
    ).scalar()
    market_id = market_nl_id
    sekoya_pop_id = conn.execute(
        sa.text("SELECT id FROM varieties WHERE name = 'Sekoya Pop'")
    ).scalar()
    sekoya_beauty_id = conn.execute(
        sa.text("SELECT id FROM varieties WHERE name = 'Sekoya Beauty'")
    ).scalar()
    bulk_pkg_id = conn.execute(
        sa.text("SELECT id FROM packaging_types WHERE name = 'Bulk Sekoya 3.0 kg'")
    ).scalar()
    punnet_pkg_id = conn.execute(
        sa.text("SELECT id FROM packaging_types WHERE name = 'Punnet 125g'")
    ).scalar()

    # ── Quality Standards ──────────────────────────────────────────────────────
    # From Agroberries spec: general quality rules (apply to all varieties/packaging)
    # Parameters: brix, mold, decay, leakers, soft (condition defects)
    # Packaged vs Bulk have different tolerances
    # Premium (Sekoya Pop/Beauty) have tighter limits

    def ins_std(conn, client_id, market_id, product_id, variety_id, pkg_id,
                category, param_code, param_name, param_group,
                min_val, max_val, unit, severity, score_system):
        conn.execute(sa.text("""
            INSERT INTO quality_standards
                (client_id, market_id, product_id, variety_id, packaging_type_id,
                 category, parameter_code, parameter_name, parameter_group,
                 min_value, max_value, unit, severity, score_system,
                 effective_from, effective_to, is_active, created_at, updated_at)
            VALUES
                (:cid, :mid, :pid, :vid, :pkg,
                 :cat, :pcode, :pname, :pgroup,
                 :minv, :maxv, :unit, :sev, :ssys,
                 :eff_from, NULL, true, now(), now())
        """), {
            "cid": client_id, "mid": market_id, "pid": product_id,
            "vid": variety_id, "pkg": pkg_id,
            "cat": category, "pcode": param_code, "pname": param_name, "pgroup": param_group,
            "minv": min_val, "maxv": max_val, "unit": unit, "sev": severity, "ssys": score_system,
            "eff_from": EFFECTIVE_FROM,
        })

    # -- General quality rules (all varieties, no packaging restriction)
    ins_std(conn, client_id, market_id, product_id, None, None,
            "quality", "brix", "Brix (sugar content)", "quality",
            10.0, None, "%", "MAJOR", "Q")

    # -- General bulk condition tolerances (non-premium varieties)
    ins_std(conn, client_id, market_id, product_id, None, bulk_pkg_id,
            "condition", "mold", "Mold", "condition_defects",
            None, 2.0, "%", "MAJOR", "CS")
    ins_std(conn, client_id, market_id, product_id, None, bulk_pkg_id,
            "condition", "decay", "Decay", "condition_defects",
            None, 2.0, "%", "MAJOR", "CS")
    ins_std(conn, client_id, market_id, product_id, None, bulk_pkg_id,
            "condition", "leakers", "Leakers", "condition_defects",
            None, 1.0, "%", "CRITICAL", "CS")
    ins_std(conn, client_id, market_id, product_id, None, bulk_pkg_id,
            "condition", "soft", "Soft berries", "condition_defects",
            None, 5.0, "%", "MAJOR", "CS")

    # -- General packaged condition tolerances
    ins_std(conn, client_id, market_id, product_id, None, punnet_pkg_id,
            "condition", "mold", "Mold", "condition_defects",
            None, 1.0, "%", "CRITICAL", "CS")
    ins_std(conn, client_id, market_id, product_id, None, punnet_pkg_id,
            "condition", "decay", "Decay", "condition_defects",
            None, 1.0, "%", "CRITICAL", "CS")
    ins_std(conn, client_id, market_id, product_id, None, punnet_pkg_id,
            "condition", "leakers", "Leakers", "condition_defects",
            None, 0.5, "%", "CRITICAL", "CS")

    # -- Premium bulk: Sekoya Pop (tighter tolerances override general bulk)
    ins_std(conn, client_id, market_id, product_id, sekoya_pop_id, bulk_pkg_id,
            "condition", "mold", "Mold (premium bulk)", "condition_defects",
            None, 1.0, "%", "CRITICAL", "CS")
    ins_std(conn, client_id, market_id, product_id, sekoya_pop_id, bulk_pkg_id,
            "condition", "decay", "Decay (premium bulk)", "condition_defects",
            None, 1.0, "%", "CRITICAL", "CS")
    ins_std(conn, client_id, market_id, product_id, sekoya_pop_id, bulk_pkg_id,
            "condition", "leakers", "Leakers (premium bulk)", "condition_defects",
            None, 1.0, "%", "CRITICAL", "CS")
    ins_std(conn, client_id, market_id, product_id, sekoya_pop_id, bulk_pkg_id,
            "condition", "soft", "Soft berries (premium bulk)", "condition_defects",
            None, 5.0, "%", "MAJOR", "CS")
    ins_std(conn, client_id, market_id, product_id, sekoya_pop_id, bulk_pkg_id,
            "condition", "total_condition_defects", "Total condition defects (premium bulk)", "condition_defects",
            None, 10.0, "%", "CRITICAL", "CS")
    ins_std(conn, client_id, market_id, product_id, sekoya_pop_id, bulk_pkg_id,
            "quality", "brix", "Brix (premium Sekoya Pop)", "quality",
            10.0, None, "%", "MAJOR", "Q")

    # -- Premium bulk: Sekoya Beauty (same tolerances as Sekoya Pop)
    ins_std(conn, client_id, market_id, product_id, sekoya_beauty_id, bulk_pkg_id,
            "condition", "mold", "Mold (premium bulk)", "condition_defects",
            None, 1.0, "%", "CRITICAL", "CS")
    ins_std(conn, client_id, market_id, product_id, sekoya_beauty_id, bulk_pkg_id,
            "condition", "decay", "Decay (premium bulk)", "condition_defects",
            None, 1.0, "%", "CRITICAL", "CS")
    ins_std(conn, client_id, market_id, product_id, sekoya_beauty_id, bulk_pkg_id,
            "condition", "leakers", "Leakers (premium bulk)", "condition_defects",
            None, 1.0, "%", "CRITICAL", "CS")
    ins_std(conn, client_id, market_id, product_id, sekoya_beauty_id, bulk_pkg_id,
            "quality", "brix", "Brix (premium Sekoya Beauty)", "quality",
            10.0, None, "%", "MAJOR", "Q")

    # -- Temperature standards (all)
    ins_std(conn, client_id, market_id, product_id, None, None,
            "transport", "temp_min_c", "Temperature minimum", "transport",
            1.0, None, "°C", "MAJOR", None)
    ins_std(conn, client_id, market_id, product_id, None, None,
            "transport", "temp_max_c", "Temperature maximum", "transport",
            None, 6.0, "°C", "MAJOR", None)

    # ── Score Rules ────────────────────────────────────────────────────────────
    # Q score: 1=excellent, 2=good, 3=acceptable, 4=rejected
    # CS score: A=excellent, B=good, C=acceptable, D=losses expected, O=rejected
    score_rules = [
        # Q scores (quality)
        (client_id, market_id, "quality_score", "Q", "1", None,  None,  None, "Excellent quality — no defects"),
        (client_id, market_id, "quality_score", "Q", "2", None,  None,  None, "Good quality — minor defects within tolerance"),
        (client_id, market_id, "quality_score", "Q", "3", None,  None,  None, "Acceptable quality — defects at tolerance limit"),
        (client_id, market_id, "quality_score", "Q", "4", None,  None,  None, "Rejected — defects exceed tolerance"),
        # CS scores (condition)
        (client_id, market_id, "mold",          "CS", "A", 0.0,  0.0,   "%", "Excellent — no mold"),
        (client_id, market_id, "mold",          "CS", "B", 0.0,  0.5,   "%", "Good — mold ≤0.5%"),
        (client_id, market_id, "mold",          "CS", "C", 0.5,  1.0,   "%", "Acceptable — mold 0.5–1.0%"),
        (client_id, market_id, "mold",          "CS", "D", 1.0,  5.0,   "%", "Losses expected — mold 1.0–5.0%"),
        (client_id, market_id, "mold",          "CS", "O", 5.0,  None,  "%", "Rejected — mold >5.0%"),
    ]
    for (cid, mid, pcode, stype, slabel, minv, maxv, unit, meaning) in score_rules:
        conn.execute(sa.text("""
            INSERT INTO score_rules
                (client_id, market_id, parameter_code, score_type, score_label,
                 min_value, max_value, unit, meaning, created_at, updated_at)
            VALUES
                (:cid, :mid, :pcode, :stype, :slabel,
                 :minv, :maxv, :unit, :meaning, now(), now())
        """), {"cid": cid, "mid": mid, "pcode": pcode, "stype": stype, "slabel": slabel,
               "minv": minv, "maxv": maxv, "unit": unit, "meaning": meaning})


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DELETE FROM score_rules WHERE client_id IN (SELECT id FROM clients WHERE client_code='AGRO_EU')"))
    conn.execute(sa.text("DELETE FROM quality_standards WHERE client_id IN (SELECT id FROM clients WHERE client_code='AGRO_EU')"))
    conn.execute(sa.text("DELETE FROM varieties WHERE product_id IN (SELECT id FROM products WHERE name='Blueberries')"))
    conn.execute(sa.text("DELETE FROM packaging_types WHERE name IN ('Bulk Sekoya 3.0 kg','Punnet 125g','Punnet 250g','Punnet 500g','Clamshell 150g','Clamshell 300g','Bulk Standard 2.5 kg')"))
    conn.execute(sa.text("DELETE FROM products WHERE name='Blueberries'"))
    conn.execute(sa.text("DELETE FROM clients WHERE client_code='AGRO_EU'"))
    conn.execute(sa.text("DELETE FROM markets WHERE name IN ('Netherlands','UK','Germany','General EU')"))
    conn.execute(sa.text("DELETE FROM countries WHERE iso_code IN ('MAR','NLD','ESP','PRT','PER','CHL')"))
