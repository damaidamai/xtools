# Project Context

## Purpose
XTools 是一个面向红蓝对抗/安全监测的 AI 原生工具套件。目标：以极快的开发/运行速度提供扫描、分析、可视化能力，形成控制室风格的高密度深色界面，并通过 LLM 提升审计、Payload 生成与结果解读效率。

## Tech Stack
- 前端：Next.js 14+（App Router）、TypeScript、Tailwind CSS、Shadcn/UI（深度定制 `globals.css` 与 Tailwind 主题）、Zustand、Recharts
- 后端：FastAPI（AsyncIO/BackgroundTasks）、SQLite + SQLModel、Subprocess 封装安全工具
- 包/运行：pnpm（前端）、uv（Python 依赖与运行）
- AI：LangChain、OpenAI/Ollama 模型、ChromaDB（本地向量库）

## Project Conventions

### Code Style
- TypeScript/JavaScript：保持严格类型，组件尽量无状态或小状态；样式通过 Tailwind 语义化颜色变量；Shadcn 组件需匹配深色红蓝对抗主题。
- Python：异步优先（AsyncIO），FastAPI 路由/任务使用类型标注；依赖统一由 `uv` 管理。
- 前后端统一使用英文代码标识（变量/函数/文件），文档与沟通尽量中文。

### Architecture Patterns
- Monorepo：`backend/`（FastAPI + uv）与 `frontend/`（Next.js + pnpm）并列。
- 数据：SQLite 默认 WAL 模式；模型层使用 SQLModel。
- UI：控制室风格 Minimal Dark，卡片扁平、细边框，颜色仅用于引导注意（红=攻击，蓝=防御）。
- 状态与可视化：Zustand 管理全局任务/消息，Recharts 做图表（定制 Tooltip/Axis 颜色）。

### Testing Strategy
- 后端：为 API/核心逻辑编写单元/集成测试（AsyncIO 友好），覆盖典型红/蓝队场景与子进程封装。
- 前端：组件与关键交互使用单测/轻量集成测试，确保深色主题下的可读性与状态切换正确。
- 尽量在提交前运行必要的测试或最小复现脚本，保持快速反馈。

### Git Workflow
- 变更遵循 OpenSpec 提案流程：先提案（`changes/<id>/`），待批准后实现。
- 建议使用简洁动词开头的分支/commit 信息；避免在未获批准的情况下实现新功能。

## Domain Context
- 面向网络安全红蓝对抗：红队动作（扫描/攻击）用红色语义，蓝队动作（检测/防御）用蓝色语义。
- 界面偏高密度信息展示，强调实时性、日志/任务流与可视化并存。

## Important Constraints
- 初期拒绝外部依赖（无 Redis/Postgres/Celery），单机 SQLite+AsyncIO 即可。
- 性能与体验优先：启动与依赖安装需尽可能快（uv、pnpm）。
- UI 必须保持 Minimal Dark 主题，不使用厚重阴影与拟物化。

## External Dependencies
- LLM/向量：OpenAI/Ollama（模型），ChromaDB（向量存储）
- 安全工具：Subfinder、Nuclei 等通过子进程封装（标准流采集输出）
