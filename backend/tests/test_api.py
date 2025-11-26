import asyncio
import os
from typing import AsyncGenerator

import pytest
from fastapi import BackgroundTasks
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app import database
from app.main import app


@pytest.fixture(scope="function", autouse=True)
async def temp_db(tmp_path) -> AsyncGenerator[None, None]:
    test_db = tmp_path / "test.db"
    os.environ["TEST_DB"] = str(test_db)
    engine = create_async_engine(f"sqlite+aiosqlite:///{test_db}")
    TestSessionLocal = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        async with TestSessionLocal() as session:
            yield session

    # Replace globals for the app runtime
    database.engine = engine
    database.AsyncSessionLocal = TestSessionLocal

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    app.dependency_overrides[database.get_session] = override_get_session

    # Disable background execution during tests
    app.dependency_overrides[BackgroundTasks] = lambda: BackgroundTasks()

    yield

    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.fixture(autouse=True)
def disable_background(monkeypatch):
    async def _noop(*args, **kwargs):
        return None

    monkeypatch.setattr("app.main._start_run_task", _noop)


@pytest.mark.asyncio
async def test_upload_wordlist_and_set_default():
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.post(
            "/wordlists",
            files={"file": ("wl.txt", b"one\ntwo\n")},
            data={"name": "custom.txt", "is_default": "true"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "custom.txt"
        assert data["is_default"] is True

        resp2 = await client.get("/wordlists")
        assert resp2.status_code == 200
        items = resp2.json()["items"]
        assert len(items) == 1
        assert items[0]["is_default"] is True

        # Set default on same wordlist (idempotent)
        resp3 = await client.post(f"/wordlists/{data['id']}/default")
        assert resp3.status_code == 200


@pytest.mark.asyncio
async def test_create_run_validates_domain_and_wordlist():
    async with AsyncClient(app=app, base_url="http://test") as client:
        bad = await client.post("/runs", json={"domain": "not-a-domain"})
        assert bad.status_code == 400

        # create wordlist first
        wl = await client.post(
            "/wordlists", files={"file": ("wl.txt", b"a\nb\n")}
        )
        wordlist_id = wl.json()["id"]

        resp = await client.post(
            "/runs",
            json={"domain": "example.com", "wordlist_id": wordlist_id},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["domain"] == "example.com"
        assert data["status"] == "pending"
        assert data["wordlist_id"] == wordlist_id
