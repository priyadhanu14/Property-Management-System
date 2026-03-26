import asyncio
from logging.config import fileConfig

from sqlalchemy import create_engine, pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context

from app.config import settings
# Import Base directly (not via app.db which eagerly creates the async engine)
from app.db.base import Base  # noqa: E402
import app.models  # noqa: F401, E402 — register all models with Base.metadata

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Normalise the URL: ensure +asyncpg for async, strip it for sync
raw_url = settings.database_url
async_url = raw_url if "+asyncpg" in raw_url else raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
sync_url = raw_url.replace("+asyncpg", "")

config.set_main_option("sqlalchemy.url", sync_url)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (no DB connection)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online_sync() -> None:
    """Run migrations using a sync psycopg2 connection."""
    connectable = create_engine(sync_url, poolclass=pool.NullPool)
    with connectable.connect() as connection:
        do_run_migrations(connection)
    connectable.dispose()


async def run_migrations_online_async() -> None:
    """Run migrations using an async asyncpg connection."""
    connectable = create_async_engine(async_url, poolclass=pool.NullPool)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    # Use sync engine — works with both postgresql:// and postgresql+asyncpg:// URLs
    run_migrations_online_sync()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
