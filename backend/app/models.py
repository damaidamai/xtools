from __future__ import annotations

import datetime as dt
from typing import Optional

from sqlmodel import Column, DateTime, Field, SQLModel, UniqueConstraint


class SubdomainRun(SQLModel, table=True):
    __tablename__ = "subdomain_runs"

    id: Optional[int] = Field(default=None, primary_key=True)
    domain: str = Field(index=True)
    status: str = Field(default="pending")
    error_message: Optional[str] = None
    log_snippet: str = Field(default="")
    started_at: Optional[dt.datetime] = Field(
        sa_column=Column(DateTime(timezone=True))
    )
    finished_at: Optional[dt.datetime] = Field(
        sa_column=Column(DateTime(timezone=True))
    )
    created_at: dt.datetime = Field(
        default_factory=lambda: dt.datetime.now(dt.timezone.utc),
        sa_column=Column(DateTime(timezone=True)),
    )
    wordlist_id: Optional[int] = Field(default=None, foreign_key="wordlists.id")


class Subdomain(SQLModel, table=True):
    __tablename__ = "subdomains"
    __table_args__ = (
        UniqueConstraint("run_id", "host"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    run_id: int = Field(foreign_key="subdomain_runs.id")
    host: str = Field(index=True)
    source: Optional[str] = None
    created_at: dt.datetime = Field(
        default_factory=lambda: dt.datetime.now(dt.timezone.utc),
        sa_column=Column(DateTime(timezone=True)),
    )


class Wordlist(SQLModel, table=True):
    __tablename__ = "wordlists"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    path: str
    size_bytes: int
    is_default: bool = Field(default=False)
    created_at: dt.datetime = Field(
        default_factory=lambda: dt.datetime.now(dt.timezone.utc),
        sa_column=Column(DateTime(timezone=True)),
    )
