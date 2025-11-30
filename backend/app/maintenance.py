"""
工具：清理 wordlists 目录中未被数据库引用的孤儿文件。

用法：
    uv run python -m app.maintenance --dry-run   # 仅列出
    uv run python -m app.maintenance --delete    # 删除孤儿文件
"""

from __future__ import annotations

import argparse
import asyncio
import os
from typing import Iterable, List, Set

from sqlmodel import select

from .database import AsyncSessionLocal, init_db
from .main import WORDLIST_DIR
from .models import Wordlist


async def _fetch_referenced_paths() -> Set[str]:
    await init_db()
    async with AsyncSessionLocal() as session:
        result = await session.exec(select(Wordlist.path))
        paths = result.all()
    return {os.path.abspath(p) for p in paths}


def _list_files(dir_path: str) -> List[str]:
    entries: List[str] = []
    for name in os.listdir(dir_path):
        candidate = os.path.join(dir_path, name)
        if os.path.isfile(candidate):
            entries.append(os.path.abspath(candidate))
    return entries


async def find_orphan_wordlists(wordlist_dir: str) -> List[str]:
    referenced = await _fetch_referenced_paths()
    existing = _list_files(wordlist_dir)
    return [path for path in existing if path not in referenced]


def delete_files(paths: Iterable[str]) -> List[str]:
    removed: List[str] = []
    for path in paths:
        try:
            os.remove(path)
            removed.append(path)
        except FileNotFoundError:
            continue
        except PermissionError:
            continue
    return removed


async def main() -> None:
    parser = argparse.ArgumentParser(description="Clean orphan wordlist files")
    parser.add_argument(
        "--delete",
        action="store_true",
        help="删除孤儿文件；缺省为 dry-run 仅输出",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="仅输出不删除（默认即 dry-run，提供开关便于兼容旧用法）",
    )
    parser.add_argument(
        "--dir",
        default=WORDLIST_DIR,
        help=f"wordlist 目录，缺省 {WORDLIST_DIR}",
    )
    args = parser.parse_args()

    wordlist_dir = os.path.abspath(args.dir)
    if not os.path.isdir(wordlist_dir):
        raise SystemExit(f"目录不存在：{wordlist_dir}")

    orphans = await find_orphan_wordlists(wordlist_dir)
    if not orphans:
        print("没有发现孤儿字典文件。")
        return

    print("发现孤儿字典文件：")
    for path in orphans:
        print(f" - {path}")

    if args.delete and not args.dry_run:
        removed = delete_files(orphans)
        print(f"\n已删除 {len(removed)} 个文件。")
    else:
        print("\n（dry-run）未删除，如需删除请加 --delete")


if __name__ == "__main__":
    asyncio.run(main())
