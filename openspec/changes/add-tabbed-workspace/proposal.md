# Change: 引入标签式工作区

## Why
- 现有左侧菜单切换会整体跳转路由，无法同时操作多个工具；用户需要在单个窗口内并行执行子域枚举、字典管理等任务。

## What Changes
- 前端工作区增加右侧标签栏，左侧菜单点击时以“浏览器标签”方式打开或聚焦对应功能。
 - 标签支持切换/关闭且保留各自页面状态，默认存在不可关闭的“首页”标签展示平台介绍，并可再打开子域枚举等功能标签。
 - 将现有子域枚举、字典管理、代理管理、请求测试等页面嵌入标签容器，保持深色 Minimal Dark 主题体验。

## Impact
- Affected specs: workspace
- Affected code: `frontend/components/dashboard-shell.tsx`、工作区布局容器、各 app 路由组件/状态管理（可能新增 Zustand store）
