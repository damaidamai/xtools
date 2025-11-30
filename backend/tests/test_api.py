import asyncio
import os
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from fastapi import BackgroundTasks
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app import database
from app.main import app


@pytest_asyncio.fixture(scope="function", autouse=True)
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


@pytest_asyncio.fixture
async def api_client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.mark.asyncio
async def test_upload_wordlist_and_set_default(api_client: AsyncClient):
    resp = await api_client.post(
        "/wordlists",
        files={"file": ("wl.txt", b"one\ntwo\n")},
        data={"name": "custom.txt", "is_default": "true"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "custom.txt"
    assert data["is_default"] is True
    assert data["type"] == "subdomain"

    resp2 = await api_client.get("/wordlists", params={"type": "subdomain"})
    assert resp2.status_code == 200
    items = resp2.json()["items"]
    assert len(items) == 1
    assert items[0]["is_default"] is True
    assert items[0]["type"] == "subdomain"

    # Set default on same wordlist (idempotent)
    resp3 = await api_client.post(f"/wordlists/{data['id']}/default")
    assert resp3.status_code == 200


@pytest.mark.asyncio
async def test_wordlist_type_filter_and_default_scope(api_client: AsyncClient):
    username = await api_client.post(
        "/wordlists",
        files={"file": ("u.txt", b"user\nadmin\n")},
        data={"type": "username", "is_default": "true"},
    )
    sub_one = await api_client.post(
        "/wordlists",
        files={"file": ("s1.txt", b"a\nb\n")},
        data={"type": "subdomain", "is_default": "true"},
    )
    sub_two = await api_client.post(
        "/wordlists",
        files={"file": ("s2.txt", b"c\nd\n")},
        data={"type": "subdomain"},
    )

    # switch default within subdomain type only
    resp = await api_client.post(f"/wordlists/{sub_two.json()['id']}/default")
    assert resp.status_code == 200

    resp_username = await api_client.get("/wordlists", params={"type": "username"})
    assert resp_username.status_code == 200
    username_items = resp_username.json()["items"]
    assert len(username_items) == 1
    assert username_items[0]["is_default"] is True

    resp_sub = await api_client.get("/wordlists", params={"type": "subdomain"})
    assert resp_sub.status_code == 200
    sub_items = resp_sub.json()["items"]
    assert sub_items[0]["id"] == sub_two.json()["id"]
    assert sub_items[0]["is_default"] is True
    assert any(item["id"] == sub_one.json()["id"] and item["is_default"] is False for item in sub_items)


@pytest.mark.asyncio
async def test_wordlist_detail_and_update(api_client: AsyncClient):
    created = await api_client.post(
        "/wordlists",
        files={"file": ("wl.txt", b"one\ntwo\n")},
        data={"name": "origin.txt"},
    )
    assert created.status_code == 200
    wordlist_id = created.json()["id"]

    detail = await api_client.get(f"/wordlists/{wordlist_id}")
    assert detail.status_code == 200
    detail_data = detail.json()
    assert detail_data["content"] == "one\ntwo\n"
    assert detail_data["line_count"] == 2

    updated = await api_client.put(
        f"/wordlists/{wordlist_id}",
        json={"content": "alpha\nbeta\n", "name": "edited.txt"},
    )
    assert updated.status_code == 200
    updated_data = updated.json()
    assert updated_data["name"] == "edited.txt"
    assert updated_data["content"] == "alpha\nbeta\n"
    assert updated_data["line_count"] == 2

    refetched = await api_client.get(f"/wordlists/{wordlist_id}")
    assert refetched.status_code == 200
    assert refetched.json()["content"] == "alpha\nbeta\n"


@pytest.mark.asyncio
async def test_wordlist_dedupe(api_client: AsyncClient):
    created = await api_client.post(
        "/wordlists",
        files={"file": ("dup.txt", b"a\na\na\nb\nb \n\nc\n")},
    )
    assert created.status_code == 200
    wordlist_id = created.json()["id"]

    deduped = await api_client.post(
        f"/wordlists/{wordlist_id}/dedupe",
        json={"content": "a\na\na\nb\nb \n\nc\n"},
    )
    assert deduped.status_code == 200
    data = deduped.json()
    assert data["removed_lines"] == 3
    assert data["before_lines"] == 6
    assert data["line_count"] == 3
    assert data["content"] == "a\nb\nc"

    detail = await api_client.get(f"/wordlists/{wordlist_id}")
    assert detail.status_code == 200
    assert detail.json()["content"] == "a\nb\nc"


@pytest.mark.asyncio
async def test_wordlist_delete_removes_record_and_file(api_client: AsyncClient, tmp_path, monkeypatch):
    temp_dir = tmp_path / "wordlists"
    temp_dir.mkdir()
    monkeypatch.setattr("app.main.WORDLIST_DIR", str(temp_dir))
    monkeypatch.setattr("app.maintenance.WORDLIST_DIR", str(temp_dir))

    created = await api_client.post(
        "/wordlists",
        files={"file": ("del.txt", b"abc\n"), "name": (None, "del.txt")},
    )
    assert created.status_code == 200
    wordlist_id = created.json()["id"]
    files = list(temp_dir.iterdir())
    assert files, "file should be created"

    deleted = await api_client.delete(f"/wordlists/{wordlist_id}")
    assert deleted.status_code == 200
    # record gone
    missing = await api_client.get(f"/wordlists/{wordlist_id}")
    assert missing.status_code == 404
    # file removed
    assert len(list(temp_dir.iterdir())) == 0


@pytest.mark.asyncio
async def test_create_run_validates_domain_and_wordlist(api_client: AsyncClient):
    bad = await api_client.post("/runs", json={"domain": "not-a-domain"})
    assert bad.status_code == 400

    # wrong type should be rejected
    wrong_type = await api_client.post(
        "/wordlists",
        files={"file": ("wl.txt", b"a\nb\n")},
        data={"type": "password"},
    )
    resp_wrong = await api_client.post(
        "/runs",
        json={"domain": "example.com", "wordlist_id": wrong_type.json()["id"]},
    )
    assert resp_wrong.status_code == 400

    # create subdomain wordlist first
    wl = await api_client.post("/wordlists", files={"file": ("wl.txt", b"a\nb\n")})
    wordlist_id = wl.json()["id"]

    resp = await api_client.post(
        "/runs",
        json={"domain": "example.com", "wordlist_id": wordlist_id},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["domain"] == "example.com"
    assert data["status"] == "pending"
    assert data["wordlist_id"] == wordlist_id
