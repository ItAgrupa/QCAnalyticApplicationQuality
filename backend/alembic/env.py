import os
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool
from alembic import context

# Load .env from project root so alembic has the correct credentials
# regardless of the working directory when it is invoked.
_env_file = Path(__file__).parent.parent.parent / ".env"
if _env_file.exists():
    for line in _env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip())

# Pull Alembic config object
config = context.config

# Allow env vars to override the sqlalchemy URL components
config.set_section_option("alembic", "POSTGRES_USER", os.getenv("POSTGRES_USER", "qp_user"))
config.set_section_option("alembic", "POSTGRES_PASSWORD", os.getenv("POSTGRES_PASSWORD", "change_me"))
config.set_section_option("alembic", "POSTGRES_HOST", os.getenv("POSTGRES_HOST", "localhost"))
config.set_section_option("alembic", "POSTGRES_PORT", os.getenv("POSTGRES_PORT", "5432"))
config.set_section_option("alembic", "POSTGRES_DB", os.getenv("POSTGRES_DB", "quality_platform"))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import all models so autogenerate can detect them
from app.db.base import Base
import app.models  # noqa: F401 — registers all models

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
