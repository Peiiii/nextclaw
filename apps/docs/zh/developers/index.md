# NextClaw 开发者

NextClaw 当前提供两组开发入口：Harness SDK 用于把 Agent、Session 和 Run 接入程序或脚本；Portable Runtime 用于开发由 NextClaw 托管的 WASM Service App。

## Harness SDK

使用 Harness SDK 从 Node.js 进程或 CLI 启动 NextClaw 任务，并复用一致的 Session、事件和运行结果语义。

| 入口 | 适合场景 |
| --- | --- |
| [Harness API](./harness) | Node.js 应用、服务和长生命周期进程 |
| [`nextclaw exec`](./exec) | Shell、CI、定时任务和管道 |
| [平台扩展能力](./platform-capabilities) | 注册工具、上下文、模型、Runtime 和 MCP |

[开始使用 Harness SDK](./harness)

## Portable Runtime

使用 Rust 编写 Service App 的业务 Component，由 NextClaw 的共享原生 runner 执行。Panel、Agent 和 CLI 可以通过同一套 Service Actions 使用它。

| 文档 | 内容 |
| --- | --- |
| [Portable Runtime](./portable-runtime) | 什么时候适合用可移植 Component，以及由宿主转交的运行方式 |
| [能力与安全边界](./portable-runtime-contracts) | 清单请求、WIT、文件、存储、网络、密钥、AI 槽位和 Provider |
| [开发 Service App](./portable-service-apps) | Rust Guest、应用包结构，以及 create/build/check/test 循环 |
| [Job、事件与可观测性](./portable-runtime-observability) | 长时间工作、Resident 投递、脱敏运行事实和恢复 |
| [打包与分发](./portable-runtime-distribution) | 通用 `.napp`、支持平台、更新和明确的外部依赖 |

[开始了解 Portable Runtime](./portable-runtime)
