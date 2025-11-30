from __future__ import annotations

import asyncio
import contextlib
import datetime as dt
import json
import os
import re
import shlex
import ssl
import uuid
from typing import Optional
from urllib.parse import urlparse

import aiohttp
from aiohttp_socks import ProxyConnector

from loguru import logger
from fastapi import BackgroundTasks, Body, Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import update
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from .enumeration_service import _append_log, run_subdomain_enumeration
from .database import AsyncSessionLocal, get_session, init_db
from .logging_config import setup_logging
from .models import Proxy, Subdomain, SubdomainRun, Wordlist
from .run_progress import clear_progress, get_progress, request_stop
from .schemas import (
    ProxyCreate,
    ProxyDeleteResponse,
    ProxyListResponse,
    ProxyOut,
    ProxyTestResponse,
    ProxyUpdate,
    RequestTestPayload,
    RequestTestResponse,
    RequestTestResult,
    RunCreateRequest,
    RunResponse,
    RunResultsResponse,
    RunStatusResponse,
    SubdomainResult,
    WordlistDetail,
    WordlistDedupeRequest,
    WordlistDedupeResponse,
    WordlistDeleteResponse,
    WordlistListResponse,
    WordlistOut,
    WordlistUpdatePayload,
    WordlistUploadResponse,
)

MAX_WORDLIST_BYTES = 10 * 1024 * 1024
WORDLIST_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "wordlists")
WORDLIST_TYPES = {"subdomain", "username", "password"}
DEFAULT_WORDLIST_TYPE = "subdomain"
PROXY_TYPES = {"http", "https", "socks5"}
# 使用可返回外网 IP/ASN 的测试端点，便于确认代理真实出网
PROXY_TEST_URL = "http://ip.im/info"
MAX_REQUEST_TEST_COUNT = 5
REQUEST_TEST_VERIFY_SSL = os.getenv("REQUEST_TEST_VERIFY_SSL", "true").lower() == "true"

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
    setup_logging()
    logger.info("Starting backend service")
    os.makedirs(WORDLIST_DIR, exist_ok=True)
    await init_db()


async def _start_run_task(run_id: int, domain: str, wordlist_id: Optional[int]) -> None:
    async with AsyncSessionLocal() as session:
        await run_subdomain_enumeration(session, run_id, domain, wordlist_id)


def _validate_domain(domain: str) -> None:
    if not re.match(r"^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$", domain):
        raise HTTPException(status_code=400, detail="Invalid domain format")


def _normalize_wordlist_type(wordlist_type: Optional[str], *, default: Optional[str] = None) -> Optional[str]:
    candidate = wordlist_type or default
    if candidate is None:
        return None
    candidate = candidate.lower()
    if candidate not in WORDLIST_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported wordlist type: {candidate}")
    return candidate


def _normalize_newlines(content: str) -> str:
    return content.replace("\r\n", "\n").replace("\r", "\n")


def _count_non_empty_lines(content: str) -> int:
    return len([line for line in _normalize_newlines(content).split("\n") if line.strip() != ""])


def _read_wordlist_content(wordlist: Wordlist) -> str:
    try:
        with open(wordlist.path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Wordlist file not found")


def _write_wordlist_content(wordlist: Wordlist, content: str) -> str:
    normalized = _normalize_newlines(content)
    encoded = normalized.encode("utf-8")
    if len(encoded) == 0:
        raise HTTPException(status_code=400, detail="Wordlist is empty")
    if len(encoded) > MAX_WORDLIST_BYTES:
        raise HTTPException(status_code=400, detail="Wordlist too large")
    with open(wordlist.path, "w", encoding="utf-8") as f:
        f.write(normalized)
    wordlist.size_bytes = len(encoded)
    return normalized


def _dedupe_content(content: str) -> tuple[str, int, int]:
    normalized = _normalize_newlines(content)
    lines = [line.strip() for line in normalized.split("\n") if line.strip() != ""]
    seen = set()
    deduped: list[str] = []
    for line in lines:
        if line in seen:
            continue
        seen.add(line)
        deduped.append(line)
    deduped_content = "\n".join(deduped)
    return deduped_content, len(lines), len(deduped)


def _map_run(run: SubdomainRun) -> RunResponse:
    total, processed = get_progress(run.id)
    progress_percent = None
    if total and total > 0:
        progress_percent = round(min(processed / total * 100, 100), 2)

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
        progress_total=total,
        progress_processed=processed,
        progress_percent=progress_percent,
    )


def _validate_proxy_type(proxy_type: str) -> str:
    candidate = proxy_type.lower()
    if candidate not in PROXY_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported proxy type: {candidate}")
    return candidate


def _map_proxy(proxy: Proxy) -> ProxyOut:
    return ProxyOut(
        id=proxy.id,
        name=proxy.name,
        type=proxy.type,
        host=proxy.host,
        port=proxy.port,
        username=proxy.username,
        password=proxy.password,
        note=proxy.note,
        enabled=proxy.enabled,
        created_at=proxy.created_at,
    )


async def _test_proxy_connectivity(proxy: Proxy) -> float:
    start = dt.datetime.now(dt.timezone.utc)
    target = urlparse(PROXY_TEST_URL)
    ssl_ctx = _get_request_ssl_context()

    if proxy.type in {"http", "https"}:
        proxy_url = f"http://{proxy.host}:{proxy.port}"
        auth = aiohttp.BasicAuth(proxy.username, proxy.password or "") if proxy.username else None
        try:
            timeout = aiohttp.ClientTimeout(total=5)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(
                    PROXY_TEST_URL,
                    proxy=proxy_url,
                    proxy_auth=auth,
                    ssl=ssl_ctx,
                    allow_redirects=False,
                ) as resp:
                    if resp.status >= 400:
                        raise RuntimeError(f"HTTP 状态码异常：{resp.status}")
        except Exception as exc:
            extra = ""
            if isinstance(exc, aiohttp.ClientConnectorError) and exc.os_error:
                extra = f" [os_error={exc.os_error}]"
            raise RuntimeError(f"无法通过代理访问 {PROXY_TEST_URL}：{exc}{extra}") from exc

    elif proxy.type == "socks5":
        await _test_socks5_proxy(proxy, target.hostname or "example.com", target.port or 80)
    else:
        raise RuntimeError(f"未知代理类型：{proxy.type}")

    elapsed = (dt.datetime.now(dt.timezone.utc) - start).total_seconds() * 1000
    return round(elapsed, 2)


async def _test_socks5_proxy(proxy: Proxy, dest_host: str, dest_port: int) -> None:
    reader: asyncio.StreamReader | None = None
    writer: asyncio.StreamWriter | None = None
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(proxy.host, proxy.port),
            timeout=5.0,
        )

        # auth negotiation
        use_auth = bool(proxy.username)
        methods = b"\x02" if use_auth else b"\x00"
        writer.write(b"\x05\x01" + methods)
        await writer.drain()
        ver_method = await asyncio.wait_for(reader.readexactly(2), timeout=5.0)
        if ver_method[0] != 0x05 or ver_method[1] == 0xFF:
            raise RuntimeError("SOCKS5 握手失败")
        if use_auth and ver_method[1] == 0x02:
            username = proxy.username or ""
            password = proxy.password or ""
            if len(username) > 255 or len(password) > 255:
                raise RuntimeError("用户名或密码过长")
            writer.write(
                b"\x01"
                + bytes([len(username)])
                + username.encode()
                + bytes([len(password)])
                + password.encode()
            )
            await writer.drain()
            auth_resp = await asyncio.wait_for(reader.readexactly(2), timeout=5.0)
            if auth_resp[1] != 0x00:
                raise RuntimeError("SOCKS5 认证失败")

        # connect command
        host_bytes = dest_host.encode()
        if len(host_bytes) > 255:
            raise RuntimeError("目标主机名过长")
        request = (
            b"\x05\x01\x00\x03"
            + bytes([len(host_bytes)])
            + host_bytes
            + dest_port.to_bytes(2, "big")
        )
        writer.write(request)
        await writer.drain()
        resp_head = await asyncio.wait_for(reader.readexactly(4), timeout=5.0)
        if resp_head[1] != 0x00:
            raise RuntimeError(f"SOCKS5 连接失败，返回码 {resp_head[1]}")

        atyp = resp_head[3]
        if atyp == 0x01:  # IPv4
            await asyncio.wait_for(reader.readexactly(4 + 2), timeout=5.0)
        elif atyp == 0x03:  # Domain
            domain_len = await asyncio.wait_for(reader.readexactly(1), timeout=5.0)
            await asyncio.wait_for(
                reader.readexactly(domain_len[0] + 2),
                timeout=5.0,
            )
        elif atyp == 0x04:  # IPv6
            await asyncio.wait_for(reader.readexactly(16 + 2), timeout=5.0)

        # send a tiny request to ensure data flows
        writer.write(b"GET / HTTP/1.1\r\nHost: example.com\r\nConnection: close\r\n\r\n")
        await writer.drain()
        await asyncio.wait_for(reader.read(1), timeout=5.0)
    except Exception as exc:  # noqa: BLE001 - surface readable error
        raise RuntimeError(f"SOCKS5 连接失败：{exc}") from exc
    finally:
        if writer:
            writer.close()
            with contextlib.suppress(Exception):
                await writer.wait_closed()


def _parse_curl_command(curl_command: str) -> tuple[str, str, dict[str, str], Optional[str]]:
    try:
        tokens = shlex.split(curl_command.strip())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"无法解析 curl：{exc}") from exc

    if not tokens:
        raise HTTPException(status_code=400, detail="curl 命令为空")
    if tokens[0] == "curl":
        tokens = tokens[1:]
    method = "GET"
    headers: dict[str, str] = {}
    data: Optional[str] = None
    url: Optional[str] = None
    i = 0
    while i < len(tokens):
        token = tokens[i]
        if token in ("-X", "--request") and i + 1 < len(tokens):
            method = tokens[i + 1].upper()
            i += 2
            continue
        if token in ("-H", "--header") and i + 1 < len(tokens):
            raw_header = tokens[i + 1]
            if ":" not in raw_header:
                raise HTTPException(status_code=400, detail=f"无效请求头：{raw_header}")
            key, value = raw_header.split(":", 1)
            headers[key.strip()] = value.strip()
            i += 2
            continue
        if token in ("-d", "--data", "--data-raw", "--data-binary", "--data-ascii") and i + 1 < len(tokens):
            data = tokens[i + 1]
            if method == "GET":
                method = "POST"
            i += 2
            continue
        if token.startswith("http://") or token.startswith("https://"):
            url = token
            i += 1
            continue
        i += 1

    if url is None:
        raise HTTPException(status_code=400, detail="未找到 URL，请确认 curl 命令包含目标地址")
    return method, url, headers, data


def _build_proxy_url(proxy: Proxy) -> str:
    auth = ""
    if proxy.username:
        auth = proxy.username
        if proxy.password:
            auth += f":{proxy.password}"
        auth += "@"
    scheme = proxy.type if proxy.type != "socks5" else "socks5"
    return f"{scheme}://{auth}{proxy.host}:{proxy.port}"


def _get_request_ssl_context() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    if not REQUEST_TEST_VERIFY_SSL:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    return ctx


async def _execute_single_request(
    method: str,
    url: str,
    headers: dict[str, str],
    data: Optional[str],
    proxy: Optional[Proxy],
) -> RequestTestResult:
    start = dt.datetime.now(dt.timezone.utc)
    proxy_url: Optional[str] = None
    connector = None
    ssl_ctx = _get_request_ssl_context()

    if proxy:
        if proxy.type == "socks5":
            connector = ProxyConnector.from_url(_build_proxy_url(proxy), ssl=ssl_ctx)
        else:
            proxy_url = _build_proxy_url(proxy)

    timeout = aiohttp.ClientTimeout(total=20)
    try:
        async with aiohttp.ClientSession(timeout=timeout, connector=connector, connector_owner=True) as session:
            async with session.request(
                method,
                url,
                headers=headers,
                data=data,
                proxy=proxy_url,
                ssl=ssl_ctx,
                allow_redirects=False,
            ) as resp:
                text = await resp.text(errors="ignore")
                elapsed = (dt.datetime.now(dt.timezone.utc) - start).total_seconds() * 1000
                # 限制响应体展示长度
                body = text if len(text) <= 8000 else text[:8000] + "\n...[truncated]"
                return RequestTestResult(
                    index=0,
                    url=url,
                    method=method,
                    status=resp.status,
                    headers={k: v for k, v in resp.headers.items()},
                    body=body,
                    elapsed_ms=round(elapsed, 2),
                )
    except Exception as exc:  # noqa: BLE001
        elapsed = (dt.datetime.now(dt.timezone.utc) - start).total_seconds() * 1000
        cause = ""
        if isinstance(exc, aiohttp.ClientConnectorError) and exc.os_error:
            cause = f" [os_error={exc.os_error}]"
        return RequestTestResult(
            index=0,
            url=url,
            method=method,
            error=f"{exc.__class__.__name__}: {exc}{cause}",
            elapsed_ms=round(elapsed, 2),
        )


@app.post("/runs", response_model=RunResponse)
async def create_run(
    payload: RunCreateRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
) -> RunResponse:
    _validate_domain(payload.domain)

    selected_wordlist = None
    if payload.wordlist_id is not None:
        stmt = select(Wordlist).where(Wordlist.id == payload.wordlist_id)
        result = await session.exec(stmt)
        selected_wordlist = result.first()
        if selected_wordlist is None:
            raise HTTPException(status_code=404, detail="Wordlist not found")
        if selected_wordlist.type != DEFAULT_WORDLIST_TYPE:
            raise HTTPException(
                status_code=400,
                detail="Wordlist type must be subdomain for enumeration runs",
            )

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


@app.post("/runs/{run_id}/stop", response_model=RunStatusResponse)
async def stop_run(
    run_id: int, session: AsyncSession = Depends(get_session)
) -> RunStatusResponse:
    run = await session.get(SubdomainRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    request_stop(run_id)
    if run.status == "running":
        run.status = "canceled"
        run.finished_at = dt.datetime.now(dt.timezone.utc)
        run.error_message = "任务已被用户停止"
        run.log_snippet = _append_log(run.log_snippet or "", "⏹ 任务已被用户停止")
        session.add(run)
        await session.commit()
        await session.refresh(run)
    clear_progress(run_id)
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
                metadata=(json.loads(item.metadata_json) if item.metadata_json else None),
            )
            for item in items
        ],
    )


@app.get("/wordlists", response_model=WordlistListResponse)
async def list_wordlists(
    session: AsyncSession = Depends(get_session),
    wordlist_type: Optional[str] = Query(default=None, alias="type"),
) -> WordlistListResponse:
    normalized_type = _normalize_wordlist_type(wordlist_type, default=None)
    stmt = select(Wordlist).order_by(Wordlist.created_at.desc())
    if normalized_type:
        stmt = stmt.where(Wordlist.type == normalized_type)
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
                type=item.type,
            )
            for item in items
        ]
    )


@app.get("/wordlists/{wordlist_id}", response_model=WordlistDetail)
async def get_wordlist_detail(
    wordlist_id: int, session: AsyncSession = Depends(get_session)
) -> WordlistDetail:
    wordlist = await session.get(Wordlist, wordlist_id)
    if not wordlist:
        raise HTTPException(status_code=404, detail="Wordlist not found")
    content = _normalize_newlines(_read_wordlist_content(wordlist))
    return WordlistDetail(
        id=wordlist.id,
        name=wordlist.name,
        size_bytes=wordlist.size_bytes,
        is_default=wordlist.is_default,
        created_at=wordlist.created_at,
        type=wordlist.type,
        content=content,
        line_count=_count_non_empty_lines(content),
    )


@app.post("/wordlists", response_model=WordlistUploadResponse)
async def upload_wordlist(
    session: AsyncSession = Depends(get_session),
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    is_default: bool = Form(False),
    wordlist_type: str = Form(DEFAULT_WORDLIST_TYPE, alias="type"),
) -> WordlistUploadResponse:
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Wordlist is empty")
    if len(content) > MAX_WORDLIST_BYTES:
        raise HTTPException(status_code=400, detail="Wordlist too large")
    if file.content_type not in (None, "", "text/plain"):
        raise HTTPException(status_code=400, detail="Only text wordlists are allowed")

    normalized_type = _normalize_wordlist_type(wordlist_type, default=DEFAULT_WORDLIST_TYPE)

    safe_name = name or file.filename or f"wordlist-{uuid.uuid4().hex[:8]}.txt"
    ext = os.path.splitext(safe_name)[1] or ".txt"
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(WORDLIST_DIR, filename)

    with open(path, "wb") as f:
        f.write(content)

    if is_default:
        await session.execute(
            update(Wordlist)
            .where(Wordlist.type == normalized_type)
            .values(is_default=False)
        )

    entry = Wordlist(
        name=safe_name,
        path=path,
        size_bytes=len(content),
        is_default=is_default,
        type=normalized_type,
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
        type=entry.type,
    )


@app.put("/wordlists/{wordlist_id}", response_model=WordlistDetail)
async def update_wordlist(
    wordlist_id: int,
    payload: WordlistUpdatePayload,
    session: AsyncSession = Depends(get_session),
) -> WordlistDetail:
    wordlist = await session.get(Wordlist, wordlist_id)
    if not wordlist:
        raise HTTPException(status_code=404, detail="Wordlist not found")

    if payload.name is not None:
        new_name = payload.name.strip()
        if new_name:
            wordlist.name = new_name

    normalized = _write_wordlist_content(wordlist, payload.content)
    session.add(wordlist)
    await session.commit()
    await session.refresh(wordlist)

    return WordlistDetail(
        id=wordlist.id,
        name=wordlist.name,
        size_bytes=wordlist.size_bytes,
        is_default=wordlist.is_default,
        created_at=wordlist.created_at,
        type=wordlist.type,
        content=normalized,
        line_count=_count_non_empty_lines(normalized),
    )


@app.post("/wordlists/{wordlist_id}/dedupe", response_model=WordlistDedupeResponse)
async def dedupe_wordlist(
    wordlist_id: int,
    payload: WordlistDedupeRequest | None = Body(default=None),
    session: AsyncSession = Depends(get_session),
) -> WordlistDedupeResponse:
    wordlist = await session.get(Wordlist, wordlist_id)
    if not wordlist:
        raise HTTPException(status_code=404, detail="Wordlist not found")

    existing_content = _read_wordlist_content(wordlist)
    base_content = payload.content if payload and payload.content is not None else existing_content
    deduped_content, before_lines, after_lines = _dedupe_content(base_content)
    if after_lines == 0:
        raise HTTPException(status_code=400, detail="Wordlist is empty after dedupe")

    normalized = _write_wordlist_content(wordlist, deduped_content)
    session.add(wordlist)
    await session.commit()
    await session.refresh(wordlist)

    return WordlistDedupeResponse(
        id=wordlist.id,
        name=wordlist.name,
        size_bytes=wordlist.size_bytes,
        is_default=wordlist.is_default,
        created_at=wordlist.created_at,
        type=wordlist.type,
        content=normalized,
        line_count=_count_non_empty_lines(normalized),
        removed_lines=before_lines - after_lines,
        before_lines=before_lines,
    )


@app.post("/wordlists/{wordlist_id}/default", response_model=WordlistOut)
async def set_default_wordlist(
    wordlist_id: int, session: AsyncSession = Depends(get_session)
) -> WordlistOut:
    wordlist = await session.get(Wordlist, wordlist_id)
    if not wordlist:
        raise HTTPException(status_code=404, detail="Wordlist not found")

    await session.execute(
        update(Wordlist)
        .where(Wordlist.type == wordlist.type)
        .values(is_default=False)
    )
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
        type=wordlist.type,
    )


@app.delete("/wordlists/{wordlist_id}", response_model=WordlistDeleteResponse)
async def delete_wordlist(
    wordlist_id: int, session: AsyncSession = Depends(get_session)
) -> WordlistDeleteResponse:
    wordlist = await session.get(Wordlist, wordlist_id)
    if not wordlist:
        raise HTTPException(status_code=404, detail="Wordlist not found")

    # 删除文件
    with contextlib.suppress(FileNotFoundError, PermissionError):
        os.remove(wordlist.path)

    await session.delete(wordlist)
    await session.commit()
    return WordlistDeleteResponse(ok=True)


@app.get("/proxies", response_model=ProxyListResponse)
async def list_proxies(session: AsyncSession = Depends(get_session)) -> ProxyListResponse:
    stmt = select(Proxy).order_by(Proxy.created_at.desc())
    result = await session.exec(stmt)
    items = result.all()
    return ProxyListResponse(items=[_map_proxy(item) for item in items])


@app.post("/proxies", response_model=ProxyOut)
async def create_proxy(
    payload: ProxyCreate, session: AsyncSession = Depends(get_session)
) -> ProxyOut:
    proxy_type = _validate_proxy_type(payload.type)
    proxy = Proxy(
        name=payload.name.strip(),
        type=proxy_type,
        host=payload.host.strip(),
        port=payload.port,
        username=payload.username.strip() if payload.username else None,
        password=payload.password,
        note=payload.note.strip() if payload.note else None,
        enabled=payload.enabled,
    )
    session.add(proxy)
    await session.commit()
    await session.refresh(proxy)
    return _map_proxy(proxy)


@app.put("/proxies/{proxy_id}", response_model=ProxyOut)
async def update_proxy(
    proxy_id: int,
    payload: ProxyUpdate,
    session: AsyncSession = Depends(get_session),
) -> ProxyOut:
    proxy = await session.get(Proxy, proxy_id)
    if not proxy:
        raise HTTPException(status_code=404, detail="Proxy not found")

    if payload.type is not None:
        proxy.type = _validate_proxy_type(payload.type)
    if payload.name is not None:
        proxy.name = payload.name.strip()
    if payload.host is not None:
        proxy.host = payload.host.strip()
    if payload.port is not None:
        proxy.port = payload.port
    if payload.username is not None:
        proxy.username = payload.username.strip() if payload.username else None
    if payload.password is not None:
        proxy.password = payload.password
    if payload.note is not None:
        proxy.note = payload.note.strip() if payload.note else None
    if payload.enabled is not None:
        proxy.enabled = payload.enabled

    session.add(proxy)
    await session.commit()
    await session.refresh(proxy)
    return _map_proxy(proxy)


@app.delete("/proxies/{proxy_id}", response_model=ProxyDeleteResponse)
async def delete_proxy(
    proxy_id: int, session: AsyncSession = Depends(get_session)
) -> ProxyDeleteResponse:
    proxy = await session.get(Proxy, proxy_id)
    if not proxy:
        raise HTTPException(status_code=404, detail="Proxy not found")
    await session.delete(proxy)
    await session.commit()
    return ProxyDeleteResponse(ok=True)


@app.post("/proxies/{proxy_id}/test", response_model=ProxyTestResponse)
async def test_proxy_connectivity(
    proxy_id: int, session: AsyncSession = Depends(get_session)
) -> ProxyTestResponse:
    proxy = await session.get(Proxy, proxy_id)
    if not proxy:
        raise HTTPException(status_code=404, detail="Proxy not found")
    try:
        latency_ms = await _test_proxy_connectivity(proxy)
        return ProxyTestResponse(ok=True, latency_ms=latency_ms)
    except Exception as exc:  # noqa: BLE001 - 返回失败信息给前端
        return ProxyTestResponse(ok=False, error=str(exc))


@app.post("/request-tests", response_model=RequestTestResponse)
async def run_request_test(
    payload: RequestTestPayload,
    session: AsyncSession = Depends(get_session),
) -> RequestTestResponse:
    method, url, headers, data = _parse_curl_command(payload.curl)

    proxy: Optional[Proxy] = None
    if payload.proxy_id is not None:
        proxy = await session.get(Proxy, payload.proxy_id)
        if not proxy:
            raise HTTPException(status_code=404, detail="Proxy not found")
        _validate_proxy_type(proxy.type)
        if not proxy.enabled:
            raise HTTPException(status_code=400, detail="Proxy is disabled")

    count = min(max(payload.count, 1), MAX_REQUEST_TEST_COUNT)
    results: list[RequestTestResult] = []
    if payload.mode == "parallel":
        tasks = [
            _execute_single_request(method, url, headers, data, proxy) for _ in range(count)
        ]
        gathered = await asyncio.gather(*tasks)
        for idx, item in enumerate(gathered):
            item.index = idx + 1
        results = list(gathered)
    else:
        for idx in range(count):
            result = await _execute_single_request(method, url, headers, data, proxy)
            result.index = idx + 1
            results.append(result)
            await asyncio.sleep(0.05)

    return RequestTestResponse(results=results)


@app.get("/")
async def health() -> dict[str, str]:
    return {"status": "ok"}
