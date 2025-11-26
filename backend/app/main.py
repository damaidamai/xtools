from __future__ import annotations

import asyncio
import os
import re
import uuid
from typing import List, Optional

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import update
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from .database import AsyncSessionLocal, get_session, init_db
from .models import Subdomain, SubdomainRun, Wordlist
from .runner import run_subfinder
from .schemas import (
    RunCreateRequest,
    RunResponse,
    RunResultsResponse,
    RunStatusResponse,
    SubdomainResult,
    WordlistListResponse,
    WordlistOut,
    WordlistUploadResponse,
)

MAX_WORDLIST_BYTES = 10 * 1024 * 1024
WORDLIST_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "wordlists")

app = FastAPI(title="XTools Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup() -> None:
    os.makedirs(WORDLIST_DIR, exist_ok=True)
    await init_db()


async def _start_run_task(run_id: int, domain: str, wordlist_id: Optional[int]) -> None:
    async with AsyncSessionLocal() as session:
        await run_subfinder(session, run_id, domain, wordlist_id)


def _validate_domain(domain: str) -> None:
    if not re.match(r"^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$", domain):
        raise HTTPException(status_code=400, detail="Invalid domain format")


def _map_run(run: SubdomainRun) -> RunResponse:
    return RunResponse(
        id=run.id,
        domain=run.domain,
        status=run.status,
        log_snippet=run.log_snippet,
        error_message=run.error_message,
        started_at=run.started_at,
        finished_at=run.finished_at,
        created_at=run.created_at,
        wordlist_id=run.wordlist_id,
    )


@app.post("/runs", response_model=RunResponse)
async def create_run(
    payload: RunCreateRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
) -> RunResponse:
    _validate_domain(payload.domain)

    if payload.wordlist_id is not None:
        stmt = select(Wordlist).where(Wordlist.id == payload.wordlist_id)
        result = await session.exec(stmt)
        if result.first() is None:
            raise HTTPException(status_code=404, detail="Wordlist not found")

    run = SubdomainRun(domain=payload.domain, status="pending", wordlist_id=payload.wordlist_id)
    session.add(run)
    await session.commit()
    await session.refresh(run)

    background_tasks.add_task(_start_run_task, run.id, payload.domain, payload.wordlist_id)
    return _map_run(run)


@app.get("/runs/{run_id}", response_model=RunStatusResponse)
async def get_run_status(
    run_id: int, session: AsyncSession = Depends(get_session)
) -> RunStatusResponse:
    run = await session.get(SubdomainRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return _map_run(run)


@app.get("/runs/{run_id}/results", response_model=RunResultsResponse)
async def get_run_results(
    run_id: int, session: AsyncSession = Depends(get_session)
) -> RunResultsResponse:
    run = await session.get(SubdomainRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    stmt = select(Subdomain).where(Subdomain.run_id == run_id)
    result = await session.exec(stmt)
    items = result.all()
    return RunResultsResponse(
        run_id=run_id,
        status=run.status,
        results=[
            SubdomainResult(
                host=item.host,
                source=item.source,
                discovered_at=item.created_at,
            )
            for item in items
        ],
    )


@app.get("/wordlists", response_model=WordlistListResponse)
async def list_wordlists(session: AsyncSession = Depends(get_session)) -> WordlistListResponse:
    stmt = select(Wordlist).order_by(Wordlist.created_at.desc())
    result = await session.exec(stmt)
    items = result.all()
    return WordlistListResponse(
        items=[
            WordlistOut(
                id=item.id,
                name=item.name,
                size_bytes=item.size_bytes,
                is_default=item.is_default,
                created_at=item.created_at,
            )
            for item in items
        ]
    )


@app.post("/wordlists", response_model=WordlistUploadResponse)
async def upload_wordlist(
    session: AsyncSession = Depends(get_session),
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    is_default: bool = Form(False),
) -> WordlistUploadResponse:
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Wordlist is empty")
    if len(content) > MAX_WORDLIST_BYTES:
        raise HTTPException(status_code=400, detail="Wordlist too large")
    if file.content_type not in (None, "", "text/plain"):
        raise HTTPException(status_code=400, detail="Only text wordlists are allowed")

    safe_name = name or file.filename or f"wordlist-{uuid.uuid4().hex[:8]}.txt"
    ext = os.path.splitext(safe_name)[1] or ".txt"
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(WORDLIST_DIR, filename)

    with open(path, "wb") as f:
        f.write(content)

    if is_default:
        await session.execute(update(Wordlist).values(is_default=False))

    entry = Wordlist(
        name=safe_name,
        path=path,
        size_bytes=len(content),
        is_default=is_default,
    )
    session.add(entry)
    await session.commit()
    await session.refresh(entry)

    return WordlistUploadResponse(
        id=entry.id,
        name=entry.name,
        size_bytes=entry.size_bytes,
        is_default=entry.is_default,
        created_at=entry.created_at,
    )


@app.post("/wordlists/{wordlist_id}/default", response_model=WordlistOut)
async def set_default_wordlist(
    wordlist_id: int, session: AsyncSession = Depends(get_session)
) -> WordlistOut:
    wordlist = await session.get(Wordlist, wordlist_id)
    if not wordlist:
        raise HTTPException(status_code=404, detail="Wordlist not found")

    await session.execute(update(Wordlist).values(is_default=False))
    wordlist.is_default = True
    session.add(wordlist)
    await session.commit()
    await session.refresh(wordlist)

    return WordlistOut(
        id=wordlist.id,
        name=wordlist.name,
        size_bytes=wordlist.size_bytes,
        is_default=wordlist.is_default,
        created_at=wordlist.created_at,
    )


@app.get("/")
async def health() -> dict[str, str]:
    return {"status": "ok"}
