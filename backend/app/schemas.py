from __future__ import annotations

import datetime as dt
from typing import Any, List, Literal, Optional

from pydantic import BaseModel, Field

ProxyType = Literal["http", "https", "socks5"]
Headers = dict[str, str]


class RunCreateRequest(BaseModel):
    domain: str
    wordlist_id: Optional[int] = None


class RunResponse(BaseModel):
    id: int
    domain: str
    status: str
    log_snippet: str = ""
    error_message: Optional[str] = None
    started_at: Optional[dt.datetime] = None
    finished_at: Optional[dt.datetime] = None
    created_at: dt.datetime
    wordlist_id: Optional[int] = None
    progress_total: Optional[int] = None
    progress_processed: int = 0
    progress_percent: Optional[float] = None


class RunStatusResponse(RunResponse):
    ...


class SubdomainResult(BaseModel):
    host: str
    source: Optional[str] = None
    discovered_at: dt.datetime = Field(..., alias="created_at")
    metadata: Optional[dict[str, Any]] = None

    class Config:
        populate_by_name = True


class RunResultsResponse(BaseModel):
    run_id: int
    status: str
    results: List[SubdomainResult]


class WordlistOut(BaseModel):
    id: int
    name: str
    size_bytes: int
    is_default: bool
    created_at: dt.datetime
    type: Literal["subdomain", "username", "password"] = "subdomain"


class WordlistUploadResponse(WordlistOut):
    ...


class WordlistListResponse(BaseModel):
    items: List[WordlistOut]


class WordlistDetail(WordlistOut):
    content: str
    line_count: int


class WordlistUpdatePayload(BaseModel):
    content: str
    name: Optional[str] = None


class WordlistDedupeRequest(BaseModel):
    content: Optional[str] = None


class WordlistDedupeResponse(WordlistDetail):
    removed_lines: int
    before_lines: int


class WordlistDeleteResponse(BaseModel):
    ok: bool


class ProxyBase(BaseModel):
    name: str
    type: ProxyType
    host: str
    port: int = Field(gt=0, lt=65536)
    username: Optional[str] = None
    password: Optional[str] = None
    note: Optional[str] = None
    enabled: bool = True


class ProxyCreate(ProxyBase):
    ...


class ProxyUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[ProxyType] = None
    host: Optional[str] = None
    port: Optional[int] = Field(default=None, gt=0, lt=65536)
    username: Optional[str] = None
    password: Optional[str] = None
    note: Optional[str] = None
    enabled: Optional[bool] = None


class ProxyOut(ProxyBase):
    id: int
    created_at: dt.datetime


class ProxyListResponse(BaseModel):
    items: List[ProxyOut]


class ProxyTestResponse(BaseModel):
    ok: bool
    latency_ms: Optional[float] = None
    error: Optional[str] = None


class ProxyDeleteResponse(BaseModel):
    ok: bool


class RequestTestPayload(BaseModel):
    curl: str
    count: int = Field(default=1, ge=1, le=5)
    proxy_id: Optional[int] = None
    mode: Literal["sequential", "parallel"] = "sequential"


class RequestTestResult(BaseModel):
    index: int
    url: Optional[str] = None
    method: Optional[str] = None
    status: Optional[int] = None
    headers: Optional[Headers] = None
    body: Optional[str] = None
    elapsed_ms: Optional[float] = None
    error: Optional[str] = None


class RequestTestResponse(BaseModel):
    results: List[RequestTestResult]
