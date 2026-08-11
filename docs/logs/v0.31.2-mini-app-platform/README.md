# v0.32.0 Mini App Platform

本迭代把 NextClaw 现有 `.napp`、Panel App、Service App 和 Apps Registry 收敛成一条面向用户的 Mini App 产品链路，并首发由 Todo、Markdown Notes、Favorites、Calendar 与共享数据 Service 组成的官方“个人空间”。

## 交付结果

- `.napp` schema v2 支持 Panel-only、Service-only 与 Panel + Service 组合包，schema v1 保持兼容。
- 应用包可检查、打包、安装、启停、更新、回滚和卸载；包代码按版本不可变，个人数据使用稳定目录。
- kernel `AppPackageManager` 是包生命周期 owner，Panel/Service manager 继续拥有各自运行时事实。
- 主产品 Apps 页面具备市场发现、搜索、安装、启用、打开、权限确认、包级管理和失败恢复入口。
- `nextclaw.personal-organizer@0.1.1` 提供四个独立 Panel 和一个共享 MCP Service，四类数据均可真实增删读写。
- Apps Registry 与公开 Apps Web 支持 schema v2 artifact；官方 0.1.0 与 0.1.1 历史版本保持不可变。

## 三轮优化

### 第一轮：功能纵向闭环

从官方开发目录跑通 inspect → pack → install → enable → Panel bridge → Service grant/invoke → update/rollback → uninstall/reinstall，并验证四类数据真实持久化。此轮确定“包负责管理、Panel 负责打开、Service 负责 action”的唯一 owner 链路。

### 第二轮：用户体验与视觉

将 Apps 从开发工具列表改成包级市场与个人入口：增加推荐说明、来源/状态、四入口直达、权限确认、空状态、加载/错误恢复和 420px 窄面板适配。真实浏览器分别完成 Todo、Notes、Favorites、Calendar 的创建、读取和删除，并检查桌面与窄面板布局。

### 第三轮：可靠性、安全与可维护性

补齐引擎兼容、精确 checksum、解包体积/文件预算、不可变版本、registry/install 原子事务、失败回滚、授权残留清理、远端下载预算、笔记路径边界、日历订阅 SSRF 防护和个人数据原子写入。随后按职责拆分安装源、Panel 包状态、Panel 呈现和日历订阅，完成 app-runtime 标准角色目录迁移与包内 `#imports`，可维护性门禁达到 0 error。

## 关键验证证据

| 范围 | 结果 |
| --- | --- |
| app-runtime | 11/11 test files、33/33 tests、tsc、lint、build、真实 `.napp` smoke 通过 |
| kernel | 65/65 test files、316/316 tests、tsc、lint（0 error）、build 通过 |
| server | 35/35 test files、181 passed / 2 existing skipped、tsc、lint、build 通过 |
| client-sdk | 2/2 test files、20/20 tests、tsc、lint、双目标 build 通过 |
| service | 隔离复验 49/49 test files、181/181 tests、tsc、lint（0 error）、build 通过 |
| UI | 213 test files、1044 tests、tsc、lint、production build 通过 |
| Marketplace Worker | 4/4 test files、16/16 tests、tsc、lint、build 通过 |
| 顶层 nextclaw | 4/4 test files、8/8 tests、tsc、lint、build 与 UI dist 同步通过 |
| 治理 | maintainability 0 error；new-code governance 与 backlog ratchet 通过 |
| 真实产品 | 公共 Registry 安装、主产品一键安装、四 Panel + Service 投影、授权调用、卸载/重装数据逐文件 hash 一致 |

service 的 cron dev 集成在与 UI 全量测试并行时曾出现 2 个时序超时；日志显示一次性任务创建时已经错过短延时计划点。无并行负载的定向复验 3/3 通过，随后 service 全量隔离复验 181/181 通过，因此判定为验证资源争用噪声而非本功能回归。

## 线上与发布状态

- Cloudflare Worker 已部署至 `marketplace-api.nextclaw.io` / `apps-registry.nextclaw.io`，部署 ID：`30acfe09-9d34-4e3f-a831-7506866352c0`。
- 官方应用 `nextclaw.personal-organizer@0.1.1` 已发布；公共 bundle 下载 hash 为 `e56825c9bf3ed9b2e7456db7b7e1a9268e1738e70fdab6f6cdb82dd722859fd5`，公共 Registry 精确安装通过。
- `nextclaw 0.32.0` stable minor 的双语说明、结构化 release JSON、发布截图和 docs/website/X review 已通过 `release:stable --dry-run`。
- NPM stable、GitHub tag/release、stable runtime channel、已发布安装和 X 公告将在本迭代最终发布阶段补齐，并在完成后更新本节。

## 风险边界与后续

- 第一阶段不开放任意 community Service 本地代码；需要 OS sandbox 或可信网络/文件强制边界。
- 普通聊天 Agent 尚不能通用调用个人空间 Service；本轮证明的是上下文承载、入口、数据与生命周期。
- 当前真实进程与浏览器验收以 macOS 为主；Windows/Linux 实机覆盖仍属于后续平台矩阵。
- 上线后再用不采集个人内容的事件验证发现、启用、首次价值与复用，不用开发环境替代留存结论。

关联文档：

- [方案设计](../../designs/2026-08-12-mini-app-package-and-marketplace.design.md)
- [目标进度](./work/goal-progress.md)
- [工作笔记](./work/working-notes.md)
