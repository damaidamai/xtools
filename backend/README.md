# XTools Backend (Subdomain Enumeration)

快速启动：

1. 安装依赖（推荐 uv）：`uv pip install -r <(uv pip compile pyproject.toml)` 或 `uv pip install .`
2. 启动接口：`uv run uvicorn app.main:app --reload --port 8000`
3. 可选：调整 HTTP 枚举器参数（`ENABLE_HTTP_ENUM`、`MAX_CONCURRENT_REQUESTS`、`REQUEST_TIMEOUT`、`VERIFY_SSL`、`ENABLE_GET_FALLBACK`、`USER_AGENT`）。

目录说明：
- `app/main.py`：FastAPI 入口与 API（任务、字典管理）。
- `app/enumeration_service.py`：纯 Python HTTP 枚举器调度与结果入库。
- `app/models.py`：SQLModel 定义，SQLite WAL。
- `app/database.py`：数据库初始化。
- `tests/`：基础 API/验证测试（禁用真实子进程）。

注意：
- SQLite 文件位于 `backend/data/xtools.db`，启动时自动创建并开启 WAL。
- 字典上传上限 10MB，保存到 `backend/data/wordlists/`，仅允许文本。
- 字典按类型管理（subdomain/username/password），默认值在各类型内独立；子域枚举仅接受 subdomain 类型。
- 字典支持详情查看/文本编辑/一键去重，接口：`GET/PUT /wordlists/{id}`、`POST /wordlists/{id}/dedupe`。
- 删除字典及文件：`DELETE /wordlists/{id}`，用于清理旧文件（适合将 wordlists/ 入库的场景）。
- 清理未引用的字典文件：`uv run python -m app.maintenance --dry-run`（查看），`--delete`（删除孤儿文件）。
- 子域枚举直接使用 Python HTTP 探测（HEAD → OPTIONS → 受限 GET），不再依赖 subfinder/shuffledns 等外部二进制。
