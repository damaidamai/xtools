# XTools Frontend (Next.js + Tailwind + Shadcn 风格)

采用 Next.js 14（App Router）+ Tailwind，定制 Minimal Dark 主题和左侧导航/右侧工作区布局，提供子域枚举与字典管理 UI。

## 开发
```bash
pnpm install
pnpm dev
# 默认连接后端 http://localhost:8000，可通过 NEXT_PUBLIC_API_BASE 覆盖
```

## 目录
- `app/`: App Router 布局与页面（子域枚举）。
- `components/ui/`: 轻量 Shadcn 风格组件（Button/Input/Card/Badge/Table 等）。
- `lib/api.ts`: 后端接口封装（wordlist/run）。
- `tailwind.config.ts`: 深色主题色板配置。

## 功能
- 左侧导航 + 右侧工作区，顶部状态卡片（最近运行状态、默认字典）。
- 子域枚举：域名输入、字典选择，触发后自动轮询状态/日志并展示结果表。
- 字典管理：上传（文本 ≤10MB）、设为默认、列表展示。

## 注意
- 页面以客户端渲染为主（无 SSR）；轮询周期 2.5s。
- 保留旧的 `index.html` 作为原型，可在不需要时删除。
