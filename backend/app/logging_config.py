from __future__ import annotations

import logging
import os
import sys
from typing import Any

from loguru import logger


class InterceptHandler(logging.Handler):
    """将标准 logging 记录转发到 loguru，统一彩色输出。"""

    def emit(self, record: logging.LogRecord) -> None:  # noqa: D401
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        frame, depth = logging.currentframe(), 2
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back  # pragma: no cover
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(
            level,
            record.getMessage(),
        )


def setup_logging() -> None:
    """
    初始化 loguru 彩色日志，拦截标准 logging，确保 uvicorn/fastapi 输出一致。
    """
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()

    # 清理默认 handler
    logging.root.handlers = []
    logging.root.setLevel(logging.NOTSET)

    # 拦截标准 logging
    intercept = InterceptHandler()
    noisy = {
        # 统一 uvicorn/fastapi
        "uvicorn": log_level,
        "uvicorn.error": log_level,
        "uvicorn.access": log_level,
        "fastapi": log_level,
        # 降噪 SQL 日志：只在 WARNING 以上输出
        "sqlalchemy.engine": "WARNING",
        "sqlalchemy.pool": "WARNING",
        "aiosqlite": "WARNING",
    }
    for name, lvl in noisy.items():
        logging_logger = logging.getLogger(name)
        logging_logger.handlers = [intercept]
        logging_logger.propagate = False
        logging_logger.setLevel(lvl)

    logging.basicConfig(handlers=[intercept], level=log_level)

    # 配置 loguru sink，启用颜色和精简格式
    logger.remove()
    logger.add(
        sys.stdout,
        level=log_level,
        colorize=True,
        # 仅打印时间 + level + 文件名:行号
        format="<green>{time:HH:mm:ss.SSS}</green> | <level>{level: <8}</level> | "
        "<cyan>{file:<18.18}</cyan>:<cyan>{line:>4}</cyan> - <level>{message}</level>",
    )

    logger.info("Loguru configured with level={}", log_level)
