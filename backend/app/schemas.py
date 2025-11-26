from __future__ import annotations

import datetime as dt
from typing import List, Optional

from pydantic import BaseModel, Field


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


class RunStatusResponse(RunResponse):
    ...


class SubdomainResult(BaseModel):
    host: str
    source: Optional[str] = None
    discovered_at: dt.datetime = Field(..., alias="created_at")

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


class WordlistUploadResponse(WordlistOut):
    ...


class WordlistListResponse(BaseModel):
    items: List[WordlistOut]
