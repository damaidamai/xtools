from __future__ import annotations

import asyncio
import datetime as dt
import json
import os
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from .models import Subdomain, SubdomainRun, Wordlist

LOG_LIMIT = 4000


def _append_log(log: str, new_line: str) -> str:
    combined = (log + "\n" + new_line).strip()
    if len(combined) > LOG_LIMIT:
        return combined[-LOG_LIMIT:]
    return combined


async def _update_run(
    session: AsyncSession,
    run: SubdomainRun,
    *,
    status: Optional[str] = None,
    log_line: Optional[str] = None,
    error: Optional[str] = None,
    finished: bool = False,
) -> None:
    if status:
        run.status = status
    if log_line:
        run.log_snippet = _append_log(run.log_snippet, log_line)
    if error:
        run.error_message = error
    if run.started_at is None and status == "running":
        run.started_at = dt.datetime.now(dt.timezone.utc)
    if finished:
        run.finished_at = dt.datetime.now(dt.timezone.utc)
    session.add(run)
    await session.commit()
    await session.refresh(run)


async def _ensure_wordlist(
    session: AsyncSession, wordlist_id: Optional[int]
) -> Optional[str]:
    if wordlist_id is None:
        stmt = select(Wordlist).where(Wordlist.is_default.is_(True)).limit(1)
        result = await session.exec(stmt)
        wordlist = result.first()
    else:
        stmt = select(Wordlist).where(Wordlist.id == wordlist_id)
        result = await session.exec(stmt)
        wordlist = result.first()
    if wordlist is None:
        return None
    return wordlist.path


async def run_subfinder(
    session: AsyncSession, run_id: int, domain: str, wordlist_id: Optional[int]
) -> None:
    run = await session.get(SubdomainRun, run_id)
    if run is None:
        return

    wordlist_path = await _ensure_wordlist(session, wordlist_id)
    cmd = [
        os.getenv("SUBFINDER_BIN", "subfinder"),
        "-d",
        domain,
        "-silent",
        "-json",
    ]
    if wordlist_path:
        cmd.extend(["-w", wordlist_path])

    try:
        await _update_run(session, run, status="running")
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except FileNotFoundError:
        await _update_run(
            session,
            run,
            status="failed",
            error="Subfinder not found. Please install and set SUBFINDER_BIN.",
            finished=True,
        )
        return

    seen_hosts: set[str] = set()

    async def handle_stdout():
        assert process.stdout is not None
        async for raw_line in process.stdout:
            line = raw_line.decode().strip()
            if not line:
                continue
            await _update_run(session, run, log_line=line)
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue
            host = data.get("host") or data.get("subdomain")
            if not host or host in seen_hosts:
                continue
            seen_hosts.add(host)
            sub = Subdomain(
                run_id=run.id, host=host, source=data.get("source")
            )
            session.add(sub)
            try:
                await session.commit()
            except IntegrityError:
                await session.rollback()
            else:
                await session.refresh(sub)

    async def handle_stderr():
        assert process.stderr is not None
        async for raw_line in process.stderr:
            line = raw_line.decode().strip()
            if line:
                await _update_run(session, run, log_line=line)

    await asyncio.gather(handle_stdout(), handle_stderr())
    await process.wait()

    if process.returncode == 0:
        await _update_run(session, run, status="succeeded", finished=True)
    else:
        await _update_run(
            session,
            run,
            status="failed",
            error=f"Subfinder exited with code {process.returncode}",
            finished=True,
        )
