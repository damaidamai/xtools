# Change: Add subdomain enumeration

## Why
- 交付首个可用的安全能力，用子域枚举支撑资产发现与后续红队链路。
- 验证子进程工具调用与异步任务模式，为后续扫描/分析能力打底。

## What Changes
- 后端新增子域枚举任务入口，使用 Subfinder 子进程封装，异步运行并记录状态/日志。
- 持久化枚举结果到 SQLite，并提供查询接口（状态、结果、输出）。
- 配套字典管理能力：上传/选择字典，配置默认字典并校验文件。
- 前端提供 Minimal Dark 风格界面提交域名、查看运行状态与结果列表，并选择字典。
- 基础校验/测试覆盖任务流程、字典管理与输出解析。

## Impact
- Affected specs: subdomain-enum
- Affected code: backend FastAPI/AsyncIO 任务调度与数据模型、前端页面/状态流、子进程工具配置。
