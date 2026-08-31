---
name: service-app-creator
description: Create or update the Service component of a NextClaw Mini App, choosing between Portable Rust/WASI Components and native-process MCP services. Use after nextclaw-app-creator selects a Service-backed app, or when the user explicitly asks for Service Actions, portable components, local files, external APIs, commands, Resident events, or capability Providers.
description_zh: 创建或修改 NextClaw Mini App 的 Service 组件，并在 Portable Rust/WASI Component 与 native-process MCP 服务之间选择。适用于 nextclaw-app-creator 判断应用需要 Service 后，或用户明确要求 Service Actions、可移植组件、本地文件、外部 API、命令、Resident 事件或能力 Provider。
---

# NextClaw Service App Creator

本 skill 是 Service 运行形态、`service-app.json`、Service Action、risk 和验证入口的唯一 owner。若用户表达的是“做一个完整 NextClaw 小应用”，先由 `nextclaw-app-creator` 判断是否还需要 Panel；本 skill 不拥有 Panel UI 或 bridge 字段。

不要再把所有 schema v2 Service 都等同于 `command/args + MCP stdio + native-process`。当前 NextClaw 同时支持：

- **Portable WASI Service**：`protocol: "wasi-component"`，由 NextClaw 随产品提供的 runner 执行 Rust/WASI Component；
- **native-process Service**：`protocol: "mcp"`，由宿主启动 Node、Python、系统命令或其它本地进程。

## 先选择运行形态

### 优先 Portable WASI

满足以下条件时选择 Portable：

- Service 可以表达为明确的 Action，或确实需要 Resident / Provider 生命周期；
- KV、SQLite、受授权文件、允许域名、密钥槽位、Provider、model slot 或 agent slot 能覆盖需求；
- 希望同一份 `.napp` 在支持的平台运行，且不把用户完整宿主权限交给 Guest；
- 应用面向分发、安装或长期维护，安全能力边界比快速脚本更重要。

选择后必须读取 [`references/portable-wasi-service-app.md`](references/portable-wasi-service-app.md)，不能凭本入口猜 WIT、manifest、生命周期或构建命令。

### 仅在真实需要时选择 native-process

以下情况选择 native-process：

- 必须直接运行 Node/Python/系统程序、平台 SDK、驱动、socket 或外部守护进程；
- 依赖无法由当前 Portable Runtime 能力合同承接；
- 用户明确只要一个快速、本机、无需 Rust 工具链的 Service helper，并接受宿主用户权限边界；
- 正在维护现有 workspace `service-apps/<id>/` MCP Service。

选择后必须读取 [`references/native-process-service-app.md`](references/native-process-service-app.md)。不能仅因开发机暂时缺少 Rust，就把需要可移植或受限能力边界的应用静默降级为宿主进程。

## Rust 工具链边界

必须准确区分创作者与最终用户：

- 在本机**创建并构建** Rust/WASI Guest，需要 `cargo`、`rustc` 和 `wasm32-wasip2`；先运行 `nextclaw app doctor --profile wasi`。
- **安装和运行已经构建好的** Portable `.napp` 不要求最终用户安装 Rust、Cargo、Wasmtime 或系统 Node。WebAssembly Component 已在包内，runner 由 NextClaw 提供。
- 纯 Panel App 和 native-process Service 不因 Portable Runtime 的存在而需要 Rust。

如果用户目标明确要求 Portable，但工具链检查失败，保留已创建的源码和失败证据，说明缺少的开发依赖；未经授权不要自动安装 Rust，也不要把未构建源码说成可交付应用。

## 两种交付边界

### 完整或可发布的 schema v2 Mini App

Service 应位于应用包根：

```text
my-app/
├── manifest.json
├── marketplace.json
├── panels/<panel-id>.panel/              # 可选
├── service-components/<service-id>/
│   └── service-app.json
└── ...runtime-specific sources and artifacts
```

根 `manifest.json.components` 是组件归属的事实源。Portable 使用 `runtime.profile: wasi`；native-process 使用 `runtime.profile: native-process`。适用的 `build/check/test/dev/call/pack/validate-publish` 命令都从包根运行。

### 明确只做本机 loose Service

仅 native-process MCP Service 可以继续落在 NextClaw workspace 的 `service-apps/<app-id>/`。默认 workspace 是 `~/.nextclaw/workspace`，但能读取配置时以 `agents.defaults.workspace` 为准。不要把 loose workspace 目录说成完整可发布包。

## 两种运行时共享的 Service Action 合同

- action id 统一为 `<service-id>.<action-name>`；service id 不包含点号。
- `service-app.json.actions` 静态声明每个 action；Panel、Agent 授权和列表都以它为事实源。
- `risk` 只使用 `read`、`write`、`external`、`dangerous`；不确定时用 `dangerous`。
- 每个 action 使用收窄的 `inputSchema`、准确标题与描述；不要做无类型万能 RPC。
- Panel 在 `panel-app.json.actions` 声明完整 allowlist，并继续通过 `window.nextclaw.serviceActions.invoke()` 调用；Panel 不需要知道后端是 WASI 还是 native-process。
- AI 分析默认走 NextClaw Agent/App Client。只有外部模型服务或 Portable manifest 中明确声明的 model/agent slot 才属于 Service 依赖。
- 不保存 token、宿主私有路径或用户数据到 manifest、日志、验证记录或 action 错误中。

## 统一验收门

完整 schema v2 包从包根运行：

```bash
nextclaw app check <app-dir> --json
nextclaw app dev <app-dir> --json
nextclaw app call <app-dir> <action-name> --input '{}' --json
```

Portable 分支还必须运行 `build` 和 `test`；native-process 分支必须验证 MCP `tools/list` 与 manifest actions 对齐。一个包有多个 Service 时，为 `dev/call` 提供 `--component <service-id>`。

调用带写入、外部访问或危险副作用的 action 前需要用户授权；默认只抽测无副作用的 read action 或专用 smoke fixture。修改普通组件后不要求重启 NextClaw 宿主。live native-process runtime 需要刷新时只运行 `nextclaw app restart <service-id> --json`，不要重启整个产品。

完成后返回使用了哪种 runtime、为什么、创作者工具链状态、实际验证范围，以及最终用户是否需要额外运行时依赖。
