---
name: nextclaw-app-creator
description: Create or update complete NextClaw Mini Apps by first choosing a Panel-only, Service-only, or Panel + Service composition, then choosing Portable WASI or native-process only when a Service exists. Use for applets, dashboards, local tools, AI-assisted interfaces, Service Actions, portable Components, or questions about NextClaw App capabilities and authoring requirements.
description_zh: 创建或修改完整 NextClaw Mini App：先判断是纯 Panel、纯 Service 还是 Panel + Service，再仅对存在的 Service 选择 Portable WASI 或 native-process。适用于小应用、dashboard、本地工具、AI 辅助界面、Service Actions、可移植 Component，或询问 NextClaw App 能力与开发要求。
---

# NextClaw App Creator

当用户说“做一个应用、小工具、dashboard、管理器、可视化、本地文件工具或 AI 辅助工具”时，先使用这个总入口。目标是按用户工作流确定应用边界和运行形态，再把字段细节交给单一专项 owner。

本 skill 只负责：

- Panel-only / Service-only / Panel + Service 的组件组成判断；
- 仅在存在 Service 时判断 Portable WASI / native-process runtime；
- loose 本机应用 / schema v2 完整包边界；
- 前端工程形态和最终验收编排。

确定形态后必须继续读取对应专项 skill。不能只读本入口就猜 `panel-app.json`、`service-app.json`、WIT、MCP server 或 bridge API。

组件组成和 Service runtime 是两条正交维度，不是三个并列 App 类型。`Panel-only` 表示这个 Mini App 没有 Service；Portable WASI 与 native-process 只用于比较 Service 组件如何运行，也都可以出现在 Service-only 或 Panel + Service 包中。

## 先判断用户要交付什么

### 1. Panel-only

适用于交互 UI、表单、列表、看板、图表、计算器或轻量 dashboard，且不需要稳定持久化、本地文件、外部 API、系统命令或权限动作。

- 下一步读取 `panel-app-creator`；
- 页面状态只放内存，或显式导入/导出；
- 不依赖 `localStorage`、`sessionStorage`、cookie 或 IndexedDB；
- 纯 Panel 不需要 Rust。

### 2. Service-only

用户只需要可授权 actions、Resident 事件处理或 Provider 能力，不需要新建 UI。

- 下一步读取 `service-app-creator`；
- 由它继续选择 Portable WASI 或 native-process；
- 不在本入口编写 action、risk、WIT、command 或 MCP 细节。

### 3. Panel + Service

用户需要完整小应用，且 UI 需要持久化、文件、网络、命令、Provider、AI slot 或其它宿主能力。

1. 先读取 `service-app-creator`，冻结 runtime、action、risk 和能力边界；
2. 再读取 `panel-app-creator`，实现 UI、action allowlist 和统一 bridge 调用；
3. Panel 不根据 Service runtime 分叉：Portable 与 native-process 都通过 `window.nextclaw.serviceActions.*` 调用。

## 再判断 Service runtime

涉及 Service 时，不再默认生成 Node MCP stdio。

### Portable WASI 优先条件

- 自包含、面向分发或希望跨支持平台运行；
- KV、SQLite、授权文件、允许域名、密钥、Provider、model slot 或 agent slot 足以覆盖需求；
- 希望 Guest 只获得声明并绑定的能力，而不是完整宿主用户权限；
- 需要 Action、Resident 或 Provider 生命周期。

### native-process 条件

- 必须直接运行 Node、Python、系统程序、平台 SDK、驱动、socket 或外部守护进程；
- 当前 Portable Runtime 没有真实能力承接；
- 用户明确只要一个快速、本机、无需 Rust 的 Service helper，并接受宿主权限边界；
- 维护已有 workspace MCP Service。

开发机缺少 Rust 不是把安全边界静默降级为 native-process 的充分理由。若两种路径都会满足用户目标，可选择 native-process 快速本机闭环，但必须说明它不具备 Portable Runtime 的隔离与通用分发合同。

## Rust 只属于 Portable 的开发期

- 本机创建并构建 Rust/WASI Guest 前运行 `nextclaw app doctor --profile wasi`；开发机器需要 `cargo`、`rustc` 和 `wasm32-wasip2`。
- 最终用户安装、启用和运行已经构建好的 Portable `.napp` 不需要 Rust、Cargo、Wasmtime 或系统 Node；runner 随 NextClaw 提供。
- Panel-only 和 native-process Service 不因本机制而强制安装 Rust。
- 未经用户授权不要自动安装 Rust 工具链；工具链缺失时保留源码并准确报告未完成的 build/test 门。

## 选择包边界

完整、可安装、可发布或长期维护的 Mini App 默认使用 schema v2 包根：

```text
my-app/
├── manifest.json
├── marketplace.json
├── panels/<panel-id>.panel/             # 可选
├── service-components/<service-id>/     # 可选
├── guest/                               # Portable 源码，可选
└── tests/                               # Service smoke，可选
```

根 manifest 的 `components` 是归属事实源；从包根运行当前形态适用的 `build/check/test/dev/call/pack/validate-publish`。

只有用户明确要临时、本机、不可发布的松散扩展时，才直接写 workspace：

- loose Panel：`panels/<panel-id>.panel/`；
- loose native-process Service：`service-apps/<service-id>/`。

不要先制造散落组件，再把组装完整包留给用户。只要目标已经是“完整 Mini App”或“以后要安装/分享”，从一开始就在包根工作。

## 前端工程形态

明显包含多组件 UI、对话/Agent Run、列表筛选、图表、复杂表单、多个状态、TypeScript 类型或持续维护时，先读取 `panel-app-react-vite-creator`，再读取 `panel-app-creator` 处理 manifest、bridge、sandbox 和验收。默认工程栈是完整的 `React + Vite + TypeScript + Tailwind CSS + pnpm`。

极小、一次性、纯展示或简单表单使用轻量目录式 Panel，不为“像工程”创建 npm 工程。工程源码可以在包内或用户指定目录开发，但运行组件仍是静态 `.panel` 产物，宿主不运行 Vite dev server。

## 组合不变量

- `panel-app.json` 是 Panel 标题、入口、图标、Agent capabilities 和 Service action allowlist 的事实源。
- `service-app.json.actions` 是 Service actions、risk 和输入合同的事实源。
- action id 使用 `<service-id>.<action-name>`。
- Panel 调用 Service Action 推荐 `window.nextclaw.serviceActions.invoke()`；`list()` 返回数组，`invoke()` 返回业务 payload，不读取 `response.actions` 或 `response.result`。
- 需要标准 sessions、agents、agentRuns、assets、events 时才声明 `client: true` 并使用同步注入的 `window.nextclaw.client`；不要 import runtime client、保存 token 或猜 API。
- AI 应用优先使用 App Client `agentRuns`；只有需要旧便利层时才使用 `window.nextclaw.agent.generateObject()`。
- Service 不默认自己调用模型；Portable 的模型/Agent 依赖使用 manifest slot，外部模型服务必须是用户明确需求。
- Panel sandbox 不增加 `allow-same-origin`，不直接请求 Gateway，不伪造 caller，不保存 bridge token。
- 普通组件变更不要求重启 NextClaw 宿主。

## 实现与验证顺序

### Panel-only

1. 读取 `panel-app-creator`；
2. 按 loose 或 package-root 边界创建 Panel；
3. 运行 `nextclaw app check <target> --json`；
4. 验收窄侧栏、宽屏、loading/empty/error 和核心交互。

### 包含 Service，且 runtime 为 Portable WASI

1. 读取 `service-app-creator` 及其 Portable reference；
2. 运行 `doctor`，再使用 `nextclaw app create <app-dir> --template rust-wasi`；
3. 修改 schema v2 包内 Service、Guest、权限和 smoke fixture；若组成包含 Panel，再实现 Panel 与 action allowlist；
4. 从包根运行 `build → check → test → dev → call`；
5. 明确区分创作者工具链与最终用户运行依赖。

### 包含 Service，且 runtime 为 native-process

1. 读取 `service-app-creator` 及其 native-process reference；
2. 选择完整包或明确的 loose workspace 形态；
3. 实现 MCP stdio Service；若组成包含 Panel，再实现 Panel 与 action allowlist；
4. 运行 `check → dev → call`，核对 manifest 与 `tools/list`；
5. 披露宿主权限和外部依赖，不声称它是 WASI 沙箱。

## 完成清单

- 组件组成、适用的 Service runtime 和包边界都有明确依据；
- 完整 Mini App 的 Panel、Service、权限、smoke 与根 manifest 同包一致；
- Panel action allowlist、Service manifest 和 runtime exports 完全一致；
- Portable 实际通过 `build/check/test`，或明确披露工具链阻塞，不能把 scaffold 当完成；
- native-process 实际通过 `check/dev` 和一个授权范围内的关键 `call`；
- Panel 能打开、无横向溢出，并区分未授权、Service 失败和返回格式异常；
- 交付说明准确写明：最终用户是否需要外部依赖，以及 Rust 是否只出现在开发期；
- 用户进一步要求发布时读取 `nextclaw-app-publisher`，只使用 `nextclaw app validate-publish/publish`。

验收通过后主动展示可见结果。Panel、编辑器、管理页、大表格和多页工作流使用 side panel；普通本地 HTML 用 `show_file(path, viewer="rendered")`；本地 dev server 用 `show_url(url)`。普通 inline Panel App 使用 `nextclaw-inline` fenced JSON，不调用 `show_panel_app` 做 inline 展示。
