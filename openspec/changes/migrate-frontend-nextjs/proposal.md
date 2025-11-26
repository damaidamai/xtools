# Change: Migrate frontend to Next.js + Tailwind/Shadcn

## Why
- 现有前端为静态原型，缺少正式产品化框架与组件体系，不利于扩展和对齐技术栈。
- 需要符合 `技术栈.md` 的 App Router + Tailwind + Shadcn 深色主题布局，并与后端子域枚举接口稳定对接。

## What Changes
- 新建 Next.js 14+（App Router）前端工程，集成 Tailwind、Shadcn 并落地 Minimal Dark 主题色板。
- 构建左侧导航 + 右侧工作区的应用框架，顶部态势/状态概览。
- 实现子域枚举页面：域名输入、字典选择/上传/设默认、任务触发、状态/日志轮询、结果表格，统一 UI 语言。
- 配置后端 API 基址（env/config），封装请求与错误提示，提供基础 loading/empty/error 状态。
- 补充必要的 lint/test 或最小验证脚本，更新使用说明。

## Impact
- Affected specs: subdomain-enum-frontend
- Affected code: 新增 `frontend/` Next.js 工程（App Router、Tailwind、Shadcn 主题），与后端接口交互封装。
