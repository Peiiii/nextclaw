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
| [Portable Runtime](./portable-runtime) | 运行方式、角色、宿主能力和当前边界 |
| [Runtime 模型与能力合同](./portable-runtime-contracts) | WIT、清单、生命周期、超时和恢复语义 |
| [开发 WASM Service App](./portable-service-apps) | Rust Guest、App 结构、Panel 调用和 CLI 调试 |

[开始了解 Portable Runtime](./portable-runtime)
