---
name: nextclaw-app-creator
description: Create or update complete NextClaw lightweight apps, deciding whether the user needs a Panel App, a Service App, or a combined Panel + Service App. Use for NextClaw applets, small tools, dashboards, local file tools, AI-assisted UI tools, apps that may combine right-side UI with backend actions, or questions about what NextClaw/Panel apps can do and which app APIs/capabilities they can use.
description_zh: 创建或修改完整的 NextClaw 轻量应用，并判断应使用 Panel App、Service App，还是 Panel App + Service App 组合。适用于 NextClaw 小应用、小工具、dashboard、本地文件工具、AI 辅助 UI 工具、需要右侧 UI 搭配后端动作的应用，或用户询问 NextClaw/Panel App 能做什么、能使用哪些 app API/能力。
---

# NextClaw App Creator

当用户说“做一个应用 / 小工具 / dashboard / 管理器 / 可视化 / 本地文件工具 / AI 辅助工具”时，先使用这个总入口 skill。目标不是把 Panel App 和 Service App 混成一个概念，而是先判断形态，再按需读取专项 skill。

总入口只负责形态决策、组合顺序和最终验收，不拥有 Panel App 或 Service App 的字段细节。判断出形态后，必须继续读取对应专项 skill；不能只读本 skill 就直接编写 `panel-app.json`、`service-app.json`、bridge 调用或 MCP server。

如果用户明确要求 Vite、React、Tailwind、现代前端技术栈、工程化源码、可构建 Panel App，或希望用 pnpm 开发再交付静态产物，先读取 `panel-app-react-vite-creator`，再按需读取 `panel-app-creator` 处理 manifest、bridge、Client SDK 和验收规则。

## 能力发现

当用户问“这个应用能做什么”“Panel App 能接哪些能力”“能不能做 AI 相关应用”“有哪些 API 可以用”时，必须说明 `window.nextclaw.client` 这类 App Client 能力，但不要把 Service Actions 迁移成 App Client 主路径。Service Actions 当前推荐继续使用旧 bridge，因为旧 bridge 拥有 Panel App 所需的授权确认和自动 retry 体验。

能力盘点默认按三层说明：

- Panel UI：右侧面板里的静态 UI、表单、列表、图表和页面内临时状态。
- App Client：声明 `"client": true` 并整体授权后，使用同步注入的 `window.nextclaw.client` 访问标准客户端能力，例如 sessions、agents、agentRuns、assets、events。`client.serviceActions.*` 当前存在，但不要作为 Panel App Service Actions 推荐路径。
- Service App：提供本地文件、外部 API、本地命令和其它需要授权的后端原子动作；Panel App 当前推荐通过旧 bridge `window.nextclaw.serviceActions.*` 调用，以保留授权确认、grant 和自动 retry。

`window.nextclaw.serviceActions.*` 不是待替代的历史细节，而是当前 Panel App 调用 Service Actions 的推荐入口。AI 应用可以优先介绍 App Client 的 `agentRuns`；需要旧 bridge 独有的高层结构化能力，或用户不希望开启整体 client 授权时，再提 `window.nextclaw.agent.*`。

## 先判断应用形态

优先按用户想完成的工作流选择，而不是按技术名词选择：

1. **Panel-only**
   - 用户主要需要一个可交互 UI、表单、列表、看板、图表、计算器或轻量 dashboard。
   - 核心数据不需要跨重新打开持久保存；临时状态只存在内存中，或通过导入/导出 JSON 手动保存。
   - 不需要读写本地文件、调用外部 API、本地命令或权限动作。
   - 下一步：读取 `panel-app-creator`。

2. **Service-only**
   - 用户明确只需要给某个能力提供后端 actions。
   - 不需要新建右侧 UI。
   - 典型场景是给已有 Panel App 或未来应用提供文件读写、外部 API、本地命令封装。
   - 下一步：读取 `service-app-creator`。
   - 禁止只凭本 skill 编写 `service-app.json`；`actions`、`risk`、`command`、依赖和 MCP server 规则都归 `service-app-creator`。

3. **Panel + Service**
   - 用户要的是一个完整小应用，并且 UI 需要后端能力。
   - 典型信号：读写 workspace 文件、管理 Markdown/记忆/配置、调用外部 API、执行本地命令、需要权限确认、需要多个用户可授权 action。
   - 下一步：先读取 `service-app-creator` 设计 actions，再读取 `panel-app-creator` 设计 UI 和调用方式。
   - 不要跳过 `service-app-creator` 直接在 Panel App 中猜 Service Action；后端 action 的 manifest 字段以 `service-app-creator` 为唯一专项规则源。

如果不确定是否需要后端，默认先做 **Panel-only**，但只能依赖页面内临时状态和手动导入/导出；不能依赖 `localStorage`、`sessionStorage`、cookie 或 IndexedDB。只要用户目标需要稳定持久化、文件、网络、命令或权限边界，就加入 Service App 或使用已授权的 App Client 能力。

## 组合原则

- Panel App 是用户界面层，默认展示在右侧面板，必须窄侧栏优先。
- 工程化 React/Vite/Tailwind Panel App 由 `panel-app-react-vite-creator` 负责；最终仍必须产出静态目录式 `.panel`，不要让宿主运行 Vite dev server。
- Service App 是用户自定义后端扩展，提供可授权 actions；它不是 NextClaw 内部系统能力，也不默认投射给 Agent 使用。
- Panel App 调用 Service App 时，当前推荐继续使用 `window.nextclaw.serviceActions.invoke()`，并在 `panel-app.json.actions` 声明 action allowlist；不要因为 App Client 里存在 `client.serviceActions.*` 就默认替代旧 bridge。
- Panel App 如果已经声明 `"client": true`，触发标准 Agent Run 优先使用 `window.nextclaw.client.agentRuns.*`；未开启 App Client 或需要旧 bridge 独有高层能力时，才使用 `window.nextclaw.agent.*` 并声明 capability。
- Panel App 只有确实需要 NextClaw App Client 时，才在 `panel-app.json` 声明 `client: true`，并在运行时使用宿主同步注入的 `window.nextclaw.client`；不要让 Panel App 自己 import、保存 token 或猜测 Client SDK 接口。需要接口形状时，从用户机器已安装的 `@nextclaw/client-sdk` NPM 包声明文件解析 `NextClawAppClient`。
- AI 分析、总结、分类、结构化 JSON 输出优先判断 App Client 的 `agentRuns` 是否能覆盖；只有明确需要旧 bridge 的 `generateObject()` 便利层时才走 `window.nextclaw.agent.generateObject()`。Service App 用于本地文件、外部 API、本地命令和权限动作，不默认承担模型调用。
- 不要让 Panel App 自己启动 HTTP server、直连 Service Gateway、伪造 caller、保存 bridge token 或猜测 sessionId。
- 不要为了“像应用工程”而给 Panel App 创建 Vite、后台 dev server 或无意义的 `package.json`；第一版 NextClaw 轻量应用默认是静态 Panel App + 可选 MCP stdio Service App。Service App 零依赖优先，能用 Node.js 内置模块手写最小 MCP stdio / JSON-RPC server 就不要引入包；确实 import 第三方包时，才在该 Service App 目录声明自己的 `package.json` 并安装依赖。
- 创建或修改 Panel App / Service App 后，默认不需要重启 NextClaw 宿主、server 或桌面应用才会生效；系统会按 workspace 目录动态发现，正确动作是刷新“面板应用/服务应用”列表、重新打开 Panel App，或运行 `nextclaw app check/dev/call` 做验收。

## 实现顺序

### Panel-only

1. 读取 `panel-app-creator`。
2. 创建目录式 Panel App。
3. 确保标题、描述、图标、窄侧栏布局和核心交互完整。
4. 状态默认只保存在内存；需要保存时提供导出/导入 JSON，或升级为 Panel + Service。
5. 做 Panel App 打开和刷新验收。

### Service-only

1. 读取 `service-app-creator`。
2. 设计 `service-app.json.actions`，为每个 action 写清 `title`、`description` 和 `risk`。
3. 实现 MCP stdio server，不创建 HTTP 常驻端口。
4. 优先实现零依赖 `server.mjs`；如果确实 import 官方 MCP SDK 或其它第三方包，在 Service App 目录创建 `package.json` 并运行安装命令。
5. 验证 manifest actions 与 MCP `tools/list` 对齐。
6. 用“服务应用”面板刷新状态。

### Panel + Service

1. 先读取 `service-app-creator`，确定 action 边界、risk 和入参输出。
2. 再读取 `panel-app-creator`，实现 UI、allowlist、调用和降级体验。
3. Panel App 的核心 UI 必须在 Service App 不可用时仍有可理解状态；如确实没有后端就无法完成核心目标，要在 UI 中明确展示需要授权或服务状态，而不是静默失败。
4. 完成后分别验收 Service App 状态、Panel App 展示、首次授权、action 调用和错误提示。

## 设计约束

- 先做能被用户立即使用的小闭环，不做重型工程脚手架。
- 一个小应用的 UI、后端 actions、Agent 调用和授权声明必须互相一致。
- `panel-app.json` 是 Panel App 标题、入口、图标、Agent capabilities 和 Service action allowlist 的唯一事实源；不要在 HTML meta 中重复声明 NextClaw manifest 字段。
- action id 统一使用 `<service-app-id>.<tool-name>`。
- Agent capability 统一使用 `agent:send`、`agent:generateObject`，不要写 `agent.send`、`agent.generateObject` 或泛化的 `agent`。
- `window.nextclaw.serviceActions.list()` 返回数组；`window.nextclaw.serviceActions.invoke()` 返回业务 payload；不要读取 `response.actions` 或 `response.result`。
- `window.nextclaw.client` 是授权后同步可用的 App Client projection，不是完整底层 `NextClawClient`；本 skill 不硬编码其 API schema，需要时读取已安装 `@nextclaw/client-sdk` 包的 `NextClawAppClient` 声明。

## 验收清单

- 创建或修改任何 Panel App / Service App 后，必须运行 `nextclaw app check <app-dir>`；Panel + Service 组合要分别检查两个目录。检查失败必须先修复，不能把失败应用交付给用户。
- 如果创建或修改 Service App，继续运行 `nextclaw app dev <service-app-dir>`，并用 `nextclaw app call <service-app-dir> <action-name> --input '{}'` 抽测至少一个关键 action；这两个命令复用真实 Service App runtime，不是静态检查替代品。
- Panel App：能在“面板应用”列表出现，标题、描述、图标正确；窄侧栏可用；打开后无横向溢出。
- Service App：能在“服务应用”列表出现，状态不是 failed；manifest actions 非空且有 risk。
- Panel + Service：`panel-app.json.actions` 覆盖实际调用的 action；首次调用触发授权；授权后返回值按业务 payload 读取，不读 `response.result`。
- Agent：`panel-app.json.capabilities` 精确覆盖实际调用；需要稳定会话时传 `peerId`，不要外部生成稳定 `sessionId`。
- Client SDK：只有实际使用 `window.nextclaw.client` 时才声明 `client: true`；首次打开会触发整体授权，授权后 App Client projection 同步可用，接口形状以 `@nextclaw/client-sdk` 导出的 `NextClawAppClient` 为准。
- 错误提示：区分 bridge 不存在、未授权、Service Action 调用失败、返回结构不符合预期、Agent capability 未声明。
- 交付说明不要让用户 restart；只有当验证证据明确指向宿主进程自身异常、版本切换或进程崩溃时，才把重启作为异常恢复手段，并说明这是例外不是常规生效步骤。
