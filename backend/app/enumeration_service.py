from __future__ import annotations

import datetime as dt
import os
from typing import Optional

from loguru import logger
from sqlmodel.ext.asyncio.session import AsyncSession

from .http_enumerator import run_http_enumerator
from .models import SubdomainRun
from .run_progress import clear_progress, clear_stop

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


async def run_subdomain_enumeration(
    session: AsyncSession, run_id: int, domain: str, wordlist_id: Optional[int]
) -> None:
    """
    主入口：使用 Python 实现的 HTTP 子域名枚举器

    目前仅保留 HTTP 直接验证策略，完全移除 subfinder 等外部依赖。
    """
    run = await session.get(SubdomainRun, run_id)
    if run is None:
        return

    clear_stop(run_id)
    clear_progress(run_id)

    if os.getenv("ENABLE_HTTP_ENUM", "true").lower() != "true":
        await _update_run(
            session,
            run,
            status="failed",
            error="HTTP 枚举器已被禁用，请开启 ENABLE_HTTP_ENUM",
            finished=True,
        )
        return

    await _update_run(
        session,
        run,
        log_line="🚀 启动内置 HTTP 枚举器（纯 Python）...",
    )

    logger.info("Run {} started for domain={}", run_id, domain)
    await run_http_enumerator(session, run_id, domain, wordlist_id)
