"""Async SQLAlchemy 2.0 session configuration supporting PostgreSQL + pgvector and SQLite."""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings


class Base(DeclarativeBase):
    """Base declarative class for all ORM entities."""


def _build_engine(database_url: str | None = None) -> AsyncEngine:
    url = database_url or get_settings().database_url
    connect_args: dict[str, object] = {}
    if url.startswith("sqlite"):
        connect_args = {"check_same_thread": False}
    elif "asyncpg" in url:
        # Required for Supabase Supavisor transaction/session pooler & serverless functions
        connect_args = {"statement_cache_size": 0}
    engine = create_async_engine(
        url,
        echo=False,
        pool_pre_ping=True,
        connect_args=connect_args,
    )
    if url.startswith("sqlite"):
        @event.listens_for(engine.sync_engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, _connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()
    return engine


engine = _build_engine()
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def init_db() -> None:
    """Ensure all relational tables exist (and vector extension on PostgreSQL)."""
    from app.models import entities  # noqa: F401

    async with engine.begin() as conn:
        if conn.dialect.name == "postgresql":
            await conn.exec_driver_sql("CREATE EXTENSION IF NOT EXISTS vector")
        await conn.run_sync(Base.metadata.create_all)

        # Idempotent column check/migrations for SQLite and PostgreSQL
        dialect = conn.dialect.name
        columns_to_add = [
            ("content_projects", "context_notes", "TEXT"),
            ("content_projects", "source_origin", "VARCHAR(100) DEFAULT 'manual'"),
            ("content_projects", "target_platforms", "JSON DEFAULT '[]'"),
            ("content_projects", "content_format", "VARCHAR(50) DEFAULT 'TEXT_AND_VIDEO'"),
            ("ideas", "context_notes", "TEXT"),
            ("ideas", "target_platforms", "JSON DEFAULT '[]'"),
        ]
        for table, col, col_type in columns_to_add:
            try:
                if dialect == "postgresql":
                    await conn.exec_driver_sql(
                        f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {col_type}"
                    )
                else:
                    await conn.exec_driver_sql(
                        f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"
                    )
            except Exception:
                # Column already exists in SQLite
                pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding an AsyncSession."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
