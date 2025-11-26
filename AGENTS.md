<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# XTools AGENTS 指南

本文档提炼自 `技术栈.md`，作为后续开发的统一指引。默认沟通语言请尽量使用中文，除非对方明确要求或需要展示代码/命令。

## 交流规则
- 优先用中文回答或讨论，确保描述简洁、可执行。
- 代码、命令与路径保持原文格式，必要时附简短中文注释。
- 不确定时先询问再行动，避免破坏性操作。

## 核心理念
- Speed & Vibe：开发与运行追求极致速度；后端用 `uv`，前端用 `pnpm`。
- Lightweight First：初期零外部依赖，SQLite+AsyncIO 单机高性能。
- AI-Native：架构原生集成 LLM，用于审计、生成 Payload、分析结果。
- Minimal Dark：控制室风格的深色极简界面，高信息密度、低噪点。

## 技术栈速览
- 前端：Next.js 14+ (App Router) + TypeScript + Tailwind + Shadcn/UI（深度定制 `globals.css` 和 Tailwind 主题），状态用 Zustand，图表用 Recharts（定制 Tooltip/Axis 颜色）。
- 后端：FastAPI + AsyncIO/BackgroundTasks，依赖管理与运行统一用 `uv`；数据库 SQLite + SQLModel；安全工具封装基于 Subprocess 实时捕获输出。
- AI 层：LangChain 编排，模型优先 OpenAI 兼容，生产可切换 Ollama，本地向量库用 ChromaDB。

## UI/UX 关键规范（深色红蓝对抗）
- 颜色令牌：背景 `#121212`，卡片/弹层 `#1E1E1E`，边框 `#2A2A2A`，主文本 `#E0E0E0`，次文本 `#A0A0A0`，主色蓝 `#3B82F6`，红队 `#E53E3E`，成功绿 `#22C55E`，警告黄 `#F6C23E`。在 `tailwind.config.ts` 定义语义色。
- 布局：顶部态势总览，下方左右分栏（左红队攻击流，右蓝队防御流）；侧边栏深色，选中态用亮蓝高亮。
- 交互：卡片扁平+细边，拒绝厚重阴影，Hover 轻微 ring/shadow；颜色仅用于引导注意，红队动作恒红，蓝队动作恒蓝；主按钮亮蓝，禁用态中灰。

## 开发与运行约定
- 后端：`uv run uvicorn main:app --reload`；依赖通过 `uv add` 管理，Python 3.11。避免额外中间件/队列，优先 AsyncIO。
- 前端：`pnpm` 作为包管理器；初始化用 `pnpm create next-app@latest frontend --typescript --tailwind --eslint`；Shadcn 初始化后手改色板。
- 数据：默认 SQLite，WAL 模式支持并发；模型使用 SQLModel。
- 目录：采用 monorepo 结构 `backend/` 与 `frontend/` 并列，`backend/data/` 存放 SQLite；Tailwind 颜色配置在 `frontend/tailwind.config.ts`。

## 快速开始（摘要）
- 安装 `uv` 后创建后端：`uv init --name backend --python 3.11 backend`，进入后 `uv add fastapi uvicorn sqlmodel python-multipart openai langchain chromadb`。
- 前端在根目录执行 `pnpm create next-app@latest frontend --typescript --tailwind --eslint`，进入后 `pnpm dlx shadcn@latest init`（Base Color 选 Slate，后续手动调整颜色变量）。

## 参考
- 详细内容与后续更新请查阅 `技术栈.md`。如有冲突，以本指南和最新的 `技术栈.md` 为准。
