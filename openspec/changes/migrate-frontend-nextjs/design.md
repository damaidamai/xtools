## Context
- 现有前端为静态 HTML 原型，无法匹配项目的 Next.js + Tailwind + Shadcn 规范，也缺少组件化与状态管理。
- 后端已提供子域枚举与字典管理 API，需要在正式前端实现任务触发、轮询与结果展示。
- UI 需符合 Minimal Dark 红/蓝语义，左侧导航 + 右侧工作区布局。

## Goals / Non-Goals
- Goals: 搭建 Next.js 14 App Router 工程，接入 Tailwind/Shadcn 色板；实现子域枚举页面与字典管理 UI；封装后端 API 客户端，提供状态/错误处理。
- Non-Goals: 构建复杂的全局状态或多页应用（除导航框架外）；实现实时 WebSocket（保持轮询即可）；引入额外设计系统。

## Decisions
- Next.js 14 App Router + TypeScript，使用 `pnpm` 依赖管理；CSS via Tailwind，Shadcn 提供基础组件（Button/Input/Card/Table/Badge/Alert/Dialog）。
- 主题：在 `tailwind.config.ts` 定义语义色（背景/卡片/边框/文本/主蓝/红/绿/黄），Shadcn tokens 与 CSS 变量对齐 Minimal Dark。
- 布局：`app/(root)/layout.tsx` 定义左侧导航（高亮子域枚举）、右侧内容区；顶栏展示最近运行状态与默认字典；页面组件化（FormCard、WordlistPanel、RunStatusPanel、ResultsTable）。
- 数据与交互：使用 `fetch` + React hooks（`useEffect`/`useState`）；API 基址通过 `NEXT_PUBLIC_API_BASE`，统一在 `lib/api.ts` 封装请求与错误；轮询采用 `setInterval` 清理。
- 上传：使用 `FormData` 走 `/wordlists`，上传进度可用简单的 loading 状态；设默认通过 POST `/wordlists/{id}/default`。
- 表格：使用 Shadcn Table 样式；日志区域使用 Scrollable Card；状态 Badge 采用色彩语义（running=blue，succeeded=green，failed=red）。

## Risks / Trade-offs
- 未引入全局状态（如 Zustand/SWR），短期通过局部 state 与轮询满足需求；后续可重构。
- 轮询 vs 流式：继续使用轮询，可能略有延迟，但实现简单且与后端契合。
- Shadcn 组件库初始化耗时：保持最小组件集，避免过度拉取 icons/组件。

## Migration Plan
- 在 `frontend/` 新建 Next.js 工程，不破坏现有静态原型，可平行保留；后续可删除旧文件。
- 完成页面后在 README 标注使用方式，确保 `pnpm dev` 可启动并访问子域枚举页。

## Open Questions
- 是否需要 SSR 数据预取？当前以客户端渲染为主，若需要 SSR 再调整。
- 是否需要表格分页/排序？初版不做，列表直接渲染全部结果。
