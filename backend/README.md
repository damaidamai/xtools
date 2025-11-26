# XTools Backend (Subdomain Enumeration)

快速启动：

1. 安装依赖（推荐 uv）：`uv pip install -r <(uv pip compile pyproject.toml)` 或 `uv pip install .`
2. 启动接口：`uv run uvicorn app.main:app --reload --port 8000`
3. 可选：设置 `SUBFINDER_BIN` 指向 Subfinder 可执行文件。

目录说明：
- `app/main.py`：FastAPI 入口与 API（任务、字典管理）。
- `app/runner.py`：Subfinder 调用与结果入库。
- `app/models.py`：SQLModel 定义，SQLite WAL。
- `app/database.py`：数据库初始化。
- `tests/`：基础 API/验证测试（禁用真实子进程）。

注意：
- SQLite 文件位于 `backend/data/xtools.db`，启动时自动创建并开启 WAL。
- 字典上传上限 10MB，保存到 `backend/data/wordlists/`，仅允许文本。
- 运行前请安装 Subfinder，否则任务会失败并在状态中返回错误。
