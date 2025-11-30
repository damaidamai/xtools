from __future__ import annotations

import pathlib
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

DATABASE_PATH = pathlib.Path(__file__).resolve().parent.parent / "data" / "xtools.db"
DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite+aiosqlite:///{DATABASE_PATH}"

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    future=True,
)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
        await conn.run_sync(_ensure_wordlist_type_column)
        await conn.run_sync(_ensure_subdomain_metadata_column)
        await conn.exec_driver_sql("PRAGMA journal_mode=WAL;")


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


def _ensure_wordlist_type_column(conn) -> None:
    result = conn.exec_driver_sql("PRAGMA table_info(wordlists);")
    columns = {row[1] for row in result.fetchall()}
    if "type" not in columns:
        conn.exec_driver_sql(
            "ALTER TABLE wordlists ADD COLUMN type TEXT DEFAULT 'subdomain'"
        )
        conn.exec_driver_sql(
            "UPDATE wordlists SET type = 'subdomain' WHERE type IS NULL OR type = ''"
        )


def _ensure_subdomain_metadata_column(conn) -> None:
    result = conn.exec_driver_sql("PRAGMA table_info(subdomains);")
    columns = {row[1] for row in result.fetchall()}
    if "metadata" not in columns:
        conn.exec_driver_sql("ALTER TABLE subdomains ADD COLUMN metadata TEXT")
