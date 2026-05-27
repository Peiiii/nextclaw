# Service Apps 与 MCP Gateway 讨论记录

## 背景

Panel Apps 第一阶段解决的是“用户可以低成本生成一个单 HTML 前端应用，并在 NextClaw 右侧面板打开”。这个形态很轻，但仍然偏前端：一旦应用需要读写文件、访问外部系统、执行长任务或复用某些后端逻辑，就会遇到能力闭环不足的问题。

本轮讨论的目标不是立刻实现一套通用后端平台，而是先探索一个足够通用、简洁、解耦、可移植的后端扩展形态，让用户可以为自己的轻应用补充后端能力，同时不把 NextClaw 主产品变成“功能垃圾场”。

这条方向与 NextClaw 愿景的关系是：增强统一入口、能力编排和生态扩展，但不把每个具体小功能都塞进核心产品。

## 核心边界

当前讨论得到的最重要边界是：

**这不是把 NextClaw 内部系统能力暴露给 Panel Apps。**

第一阶段重点应是用户自定义的外部扩展能力：

- 用户可以定义自己的后端能力。
- NextClaw 负责发现、启动、管理、调用、日志、权限和总线。
- 能力本身尽量可移植，不应和 NextClaw kernel manager 强绑定。
- 这些能力不一定和 AI 有关，也不默认给 Agent 使用。
- Panel App 只是第一类消费方，未来 Widget、自动化、脚本、Agent projection 都可能消费同一能力网络。

换句话说，NextClaw 在这里更像一个 app host / service host，而不是能力本体。

## 已形成的判断

### 0. 本轮已确定的具体决策

- 名字暂定为 **Service App**。
- 每个 Service App 是一个目录，目录内包含 `service-app.json`。
- 第一版只支持 `protocol: "mcp"`。
- 不复用现有面向 Agent / MCP marketplace 的 `McpRegistryService` 作为 Service Apps registry，避免语义混在一起。
- 第一版不做 Agent projection，但 action id、schema、description 要保持未来可投影。
- 分发与可移植性是重要目标；Service App 应尽量保持“普通 MCP server + NextClaw manifest”的形态。
- MVP 应包含 Panel App action allowlist 和授权状态，而不是全信任调用。

### 1. 不应直接做微服务平台

“每个后端应用启动一个 HTTP server / 端口 / 进程”的方式通用但过重，会立刻带来端口冲突、CORS、鉴权、健康检查、日志、崩溃恢复和资源回收问题。

第一版应避免把问题做成平台工程。

### 2. MCP 是最接近的协议形态

MCP 已经覆盖了后端能力系统需要的核心语义：

- server 贡献能力；
- tools/list 发现能力；
- tools/call 调用能力；
- tool description 和 input schema 描述如何使用；
- resources / prompts 可作为未来扩展；
- server lifecycle 可支撑独立后端能力源。

但本系统不应等同于“给 Agent 接更多 MCP tools”。MCP 可以是底层协议或兼容协议，但产品抽象应是服务能力网络。

### 3. Agent tools 只是投影，不是默认目标

如果未来 Service Apps 达到几百上千个 action，不可能全部注入 Agent 上下文。Agent 使用必须是后续的 projection：

```text
Service Action Catalog -> Agent Tool Projection
```

而不是：

```text
所有 Service Action == Agent Tool
```

第一阶段应服务 Panel Apps / 应用层调用，不默认改变 Agent tool 暴露策略。

### 4. MCP 应作为 provider，而不是产品本体

推荐结构：

```text
MCP-compatible Service Apps
        |
        v
Service Provider Layer
        |
        v
Service Registry / Catalog
        |
        v
Service Gateway
        |
        +--> Panel Apps / UI Apps
        +--> Automations
        +--> Future Agent Tool Projection
        +--> Future SDK / scripts
```

也就是说，MCP server 可以被 NextClaw 托管并映射成 Service Actions；但对 Panel App 来说，它看到的是 NextClaw Service Gateway，而不是裸 MCP server。

## 暂定术语

命名还没有最终确定，以下只是讨论中的临时词：

- **Panel App**：用户自定义前端界面，第一版是单 HTML。
- **Service App**：用户自定义后端扩展单元，可能实现为 MCP-compatible server。
- **Service Action**：Service App 暴露的可调用动作。
- **Service Resource**：Service App 暴露的数据资源，未来可选。
- **Service Gateway**：NextClaw 提供的统一发现和调用总线。
- **Service Registry / Catalog**：NextClaw 维护的服务与 action 索引。
- **Agent Tool Projection**：未来从 Service Action Catalog 中挑选一小部分能力投影给 Agent。

这里暂时不用 `Capability App` 作为主名，因为它语义准确但过于抽象；也不使用 `Server App` 作为主名，因为它容易把设计带向“一个 app 一个 server”的重实现。

## 候选方案

### 方案 A：直接暴露现有 NextClaw/MCP tools 给 Panel Apps

优点：

- 最快。
- 能复用现有 `McpManager`、`McpRegistryService` 和 tool provider。

缺点：

- 容易把 NextClaw 内部系统能力暴露出去。
- 权限边界模糊。
- 容易被误解为“Panel App 可以调用所有 Agent tools”。
- 不符合“用户自定义外部扩展能力优先”的边界。

当前结论：不推荐作为第一版主路径。

### 方案 B：NextClaw Service Gateway + MCP Provider

NextClaw 建立自己的 Service Gateway / Registry，MCP 是一种 provider。Service App 可以实现为 MCP server，NextClaw 负责启动、发现 tools、映射成 Service Actions，并通过统一 API 给 Panel Apps 调用。

优点：

- 复用 MCP 的成熟协议形态。
- 不把 MCP tools 直接等同于 Agent tools。
- Panel App 与后端实现解耦。
- 用户自定义 Service App 可移植到其他 MCP host。
- 后续可扩展 Agent projection、marketplace、权限系统。

缺点：

- 需要定义 NextClaw 自己的 service catalog / gateway API。
- 需要处理 Service App manifest、生命周期、日志和错误边界。

当前结论：推荐方向。

### 方案 C：Workspace action file / serverless function

在 workspace 中约定 `*.action.ts` 或类似文件，调用时按需加载执行。

优点：

- 写起来轻。
- 比 MCP server 更像 serverless。

缺点：

- 可移植性弱。
- 安全隔离、依赖管理、超时和运行环境会变成自定义运行时问题。
- 很容易重新发明一个比 MCP 更差的协议。

当前结论：可作为未来补充，但不建议先做。

### 方案 D：真实 HTTP Service Apps

每个 Service App 自己启动 HTTP server，NextClaw 做服务发现和代理。

优点：

- 语言无关。
- 与传统微服务心智接近。

缺点：

- 最重。
- 端口、鉴权、CORS、health、进程守护都会进来。
- 早期复杂度和运维感太强。

当前结论：长期可能支持，但不适合第一阶段。

## 推荐方向

当前推荐是：

> NextClaw 托管用户自定义的 MCP-compatible Service Apps；Panel Apps 通过 NextClaw 的 Service Gateway 发现和调用这些 Service Apps 暴露的 actions。第一版不暴露系统内部能力，也不默认给 Agent 使用。

推荐第一阶段只做概念验证级的最小闭环：

1. 约定一个 Service Apps 目录。
2. 每个 Service App 有轻 manifest，声明 id、title、description、enabled、protocol、启动命令。
3. 第一版 protocol 只支持 `mcp`。
4. NextClaw 启动 enabled Service Apps。
5. NextClaw 从 MCP server 读取 tools，并映射为 Service Actions。
6. Panel Apps 通过 NextClaw Service Gateway 查询和调用 actions。
7. Agent 默认不接入这些 actions。

可能目录形态：

```text
~/.nextclaw/workspace/service-apps/
  workspace-notes/
    service-app.json
    server.js
```

manifest 示例：

```json
{
  "id": "workspace-notes",
  "title": "Workspace Notes",
  "description": "Read and update note files in a selected workspace folder.",
  "enabled": true,
  "protocol": "mcp",
  "command": "node",
  "args": ["server.js"]
}
```

MCP server 暴露的 tools 可以映射成：

```text
workspace-notes.notes.list
workspace-notes.notes.read
workspace-notes.notes.write
```

## 与现有 NextClaw MCP 能力的关系

仓库里已经存在：

- `McpManager`
- `McpRegistryService`
- `McpServerLifecycleManager`
- `McpNcpToolRegistryAdapter`
- MCP marketplace / install / doctor
- Agent run 的 MCP tool provider

但它们目前主要服务 Agent tools 和 MCP marketplace。新的 Service App 方向需要避免直接复用成“Agent tools 暴露”，而应考虑是否复用底层 lifecycle / registry 能力，或在其旁边建立面向应用层的 service registry。

设计时要特别避免：

- 把所有 Service Actions 自动注入 Agent 上下文。
- 把 NextClaw 内部 kernel manager 包成第一批 Service Actions。
- 让 Panel App 直接裸连 stdio MCP server。
- 让 iframe 获得不受控的系统级工具调用能力。

## 更具体的 MVP 架构草图

当前更具体的 MVP 形态可以先压成一条主链：

```text
workspace/service-apps/*
        |
        v
ServiceAppManager
  - discover manifests
  - lazy start enabled service apps
  - build action catalog
  - invoke action
        |
        v
McpServiceAppRuntime
  - start MCP server
  - list tools
  - call tool
        |
        v
Service Gateway API
        |
        v
Panel App / future UI apps
```

### Owner 边界

`ServiceAppManager` 应放在 kernel，作为 Service Apps 的业务 owner。它负责目录发现、manifest 解析、runtime 协调、action catalog 和 invoke 语义。

server 仍然只做薄 HTTP 层：

- 读取路径参数和 body。
- 调用 `ServiceAppManager`。
- 把错误映射成 API 响应。

Panel App 和前端 SDK 不直接接触 MCP server，也不直接知道后端进程或 transport。

### 目录形态

更推荐“每个 Service App 一个目录”，而不是一个散落的 `*.service.json` 文件加旁边脚本：

```text
~/.nextclaw/workspace/service-apps/
  workspace-notes/
    service-app.json
    server.js
```

理由：

- 未来自然容纳 `package.json`、README、示例数据、测试文件和静态资源。
- 便于移动、复制、打包和 marketplace 分发。
- 比散落 manifest 更接近“一个可移植 app 单元”。

第一版 manifest 保持很小：

```json
{
  "id": "workspace-notes",
  "title": "Workspace Notes",
  "description": "Read and update notes.",
  "enabled": true,
  "protocol": "mcp",
  "command": "node",
  "args": ["server.js"]
}
```

暂时不放 `version`、`author`、`permissions`、`icon`、`category`、`marketplace` 等字段，避免把 MVP 做重。

### 核心类型草案

```ts
type ServiceAppManifest = {
  id: string;
  title: string;
  description?: string;
  enabled: boolean;
  protocol: "mcp";
  command: string;
  args?: string[];
};

type ServiceAppRecord = {
  id: string;
  title: string;
  description?: string;
  dirPath: string;
  manifestPath: string;
  enabled: boolean;
  protocol: "mcp";
};

type ServiceActionRisk = "read" | "write" | "external" | "dangerous";

type ServiceAction = {
  id: string;
  appId: string;
  name: string;
  title?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  risk: ServiceActionRisk;
};

type ServiceActionCaller = {
  surface: "panel-app";
  appId: string;
};

type ServiceActionInvokeRequest = {
  caller: ServiceActionCaller;
  input?: Record<string, unknown>;
};

type ServiceActionInvokeResult = {
  actionId: string;
  result: unknown;
};
```

这里刻意使用 `ServiceAction`，不使用 `McpTool`。MCP tool 是来源，Service Action 是 NextClaw 应用层能力目录中的统一表示。

### Panel App allowlist 与授权状态

MVP 应该包含轻量权限闭环，不应让 Panel App 默认调用全部 Service Actions。第一版可以先做两层控制：

1. **声明层**：Panel App 声明自己计划使用哪些 actions。
2. **授权层**：用户对具体 Panel App 调用具体 action 做首次授权，授权状态由 kernel 持久化。

Panel App 第一版可以用 HTML meta 声明 action allowlist：

```html
<meta
  name="nextclaw-panel-actions"
  content="workspace-notes.notes.read,workspace-notes.notes.write"
>
```

调用时由宿主补齐或校验 caller context：

```json
{
  "caller": {
    "surface": "panel-app",
    "appId": "workspace-browser"
  },
  "input": {}
}
```

`ServiceAppManager.invokeAction()` 的检查顺序应是：

1. 校验 caller 合法。
2. 校验 action 存在。
3. 校验 Panel App 声明过该 action。
4. 校验 caller 已获得该 action 的 grant。
5. 如果没有 grant，返回 `AUTHORIZATION_REQUIRED`，由 UI 触发确认。
6. grant 写入 kernel 管理的持久状态后，再重试调用。

即使是 `read` 类型 action，MVP 也应要求首次授权。原因是读能力可能暴露用户文件、笔记、配置或外部账户数据。`risk` 第一版主要影响确认文案和未来策略，不作为“read 自动放行”的理由。

授权状态可以先保持很小：

```json
{
  "version": 1,
  "grants": {
    "panel-app:workspace-browser": {
      "actions": {
        "workspace-notes.notes.read": {
          "grantedAt": "2026-05-27T10:00:00.000Z",
          "risk": "read"
        }
      }
    }
  }
}
```

MVP 边界：

- 未声明的 action 不能调用。
- 未授权的 action 不能调用。
- grant state 归 `ServiceAppManager` 或其下属授权 owner 管理，不放在 Panel App localStorage。
- `dangerous` 第一版可以允许持久授权，但保留未来升级成每次确认的口子。

### 代码结构草案

按当前项目的 role-first 组织方式，kernel 侧不额外新建 `features/service-apps/` 目录；Service Apps 是 kernel 的稳定业务 owner，文件先落到既有角色目录：

```text
packages/nextclaw-kernel/src/managers/service-app.manager.ts
packages/nextclaw-kernel/src/services/mcp-service-app-runtime.service.ts
packages/nextclaw-kernel/src/stores/service-action-grant.store.ts
packages/nextclaw-kernel/src/types/service-app.types.ts
packages/nextclaw-kernel/src/utils/service-app-manifest.utils.ts
packages/nextclaw-kernel/src/utils/service-action.utils.ts
```

server：

```text
packages/nextclaw-server/src/features/service-apps/controllers/service-apps.controller.ts
```

client SDK：

```text
packages/nextclaw-client-sdk/src/services/service-apps.service.ts
```

Panel App bridge 属于 Panel Apps 宿主能力，不属于 Service Apps 业务 owner：

```text
packages/nextclaw-kernel/src/utils/panel-app-bridge.utils.ts
packages/nextclaw-ui/src/features/panel-apps/managers/panel-app-bridge.manager.ts
packages/nextclaw-ui/src/features/panel-apps/utils/panel-app-doc-browser.utils.tsx
```

Service Apps 状态面板属于新的 UI feature：

```text
packages/nextclaw-ui/src/features/service-apps/hooks/use-service-apps.ts
packages/nextclaw-ui/src/features/service-apps/components/service-apps-panel.tsx
```

角色边界：

- `ServiceAppManager` 是 kernel 业务 owner，负责 manifest 发现、runtime 协调、action catalog、授权检查和 invoke。
- `McpServiceAppRuntimeService` 是外部进程 / MCP stdio lifecycle owner，必须是 class，不做空心函数集合。
- `ServiceActionGrantStore` 只负责 grant state 的读写和持久化。
- `service-app-manifest.utils.ts` 只做 manifest 解析、校验、归一化，不拥有状态和生命周期。
- `panel-app-bridge.manager.ts` 只连接 React iframe 生命周期和 postMessage bridge，不承载 Service App 业务规则。

### API 草案

第一版 API 可以是：

```text
GET  /api/service-apps
GET  /api/service-actions?surface=panel-app&appId=workspace-browser
POST /api/service-actions/:actionId/invoke
POST /api/service-action-grants
```

不建议用 `/api/mcp/...` 作为产品 API，因为 MCP 是 runtime protocol，不是 NextClaw 应用层语义。

返回 action catalog 时可以包含 app 信息：

```json
{
  "actions": [
    {
      "id": "workspace-notes.notes.read",
      "appId": "workspace-notes",
      "name": "notes.read",
      "description": "Read a note",
      "inputSchema": {},
      "risk": "read",
      "grantState": "granted"
    }
  ]
}
```

grant API 的输入应围绕 caller + action，而不是围绕 MCP server：

```json
{
  "caller": {
    "surface": "panel-app",
    "appId": "workspace-browser"
  },
  "actionId": "workspace-notes.notes.read"
}
```

未授权调用的错误也应稳定，方便前端统一弹确认：

```json
{
  "ok": false,
  "error": {
    "code": "AUTHORIZATION_REQUIRED",
    "message": "This panel app needs permission to call workspace-notes.notes.read."
  }
}
```

### 与现有 MCP 代码的复用方式

现有 `McpManager / McpRegistryService` 主要服务配置里的 MCP servers、MCP marketplace 和 Agent tool provider。Service Apps 不应直接塞进这条 registry，否则容易把应用层服务误变成 Agent tools。

更稳的方向：

- 复用 MCP client / transport / lifecycle 的底层能力。
- 新增 `McpServiceAppRuntime`，专门服务 Service Apps。
- 不接 `McpNcpToolRegistryAdapter`。
- 不自动进入 Agent tools。

也就是复用底层协议和生命周期经验，不复用“Agent tool projection”语义。

### 启动策略

当前倾向是 **lazy start**：

- `GET /api/service-apps` 可以只读 manifest。
- `GET /api/service-actions` 可以按需 warm enabled service apps，或先返回 cached catalog + 状态。
- `POST /api/service-actions/:id/invoke` 必须确保对应 app 已启动，再调用 action。

理由：

- NextClaw 启动更快。
- Service App 启动失败更局部。
- 更符合“不要过早做重平台”的原则。
- 对 disposable / experimental apps 更友好。

后续如果某些 Service App 需要后台任务、watcher、缓存或主动事件，再引入显式 `startup: "eager" | "lazy"`，但第一版不需要。

## 发布级 MVP v0 合同

如果目标是做一个可以给用户发布的 MVP，而不是只跑通内部 demo，第一版应按下面合同实现。

### 1. Service App manifest v0

Service App 目录：

```text
~/.nextclaw/workspace/service-apps/
  workspace-notes/
    service-app.json
    server.js
```

`service-app.json` v0：

```json
{
  "id": "workspace-notes",
  "title": "Workspace Notes",
  "description": "Read and update workspace notes.",
  "enabled": true,
  "protocol": "mcp",
  "command": "node",
  "args": ["server.js"],
  "actions": {
    "notes.read": {
      "risk": "read"
    },
    "notes.write": {
      "risk": "write"
    }
  }
}
```

manifest 规则：

- `id` 必填，使用 kebab-case，并在本机 Service Apps 目录下全局唯一。
- `title` 必填，用于 UI 展示。
- `description` 可选。
- `enabled` 可选，默认 `true`。
- `protocol` v0 只允许 `mcp`。
- `command` 必填。
- `args` 可选，默认 `[]`。
- `command` 和 `args` 中的相对路径以该 Service App 目录为 cwd 解析。
- `actions` 可选，只用于补充 NextClaw 自己需要的 metadata，例如 `risk`；它不替代 MCP `tools/list`。
- MCP tool 未声明 risk 时，默认 `risk: "dangerous"`。

### 2. Kernel owner

核心 owner 是 `ServiceAppManager`，放在 kernel。server、前端和 client SDK 都不拥有 Service App 业务逻辑。

`ServiceAppManager` 至少提供：

```ts
listServiceApps(): Promise<ServiceAppRecord[]>;
getServiceApp(appId: string): Promise<ServiceAppRecord>;
listServiceActions(caller?: ServiceActionCaller): Promise<ServiceAction[]>;
invokeServiceAction(
  actionId: string,
  request: ServiceActionInvokeRequest,
): Promise<ServiceActionInvokeResult>;
grantServiceAction(
  caller: ServiceActionCaller,
  actionId: string,
): Promise<ServiceActionGrant>;
revokeServiceAction(
  caller: ServiceActionCaller,
  actionId: string,
): Promise<void>;
restartServiceApp(appId: string): Promise<ServiceAppRecord>;
```

server controller 只做：

- 参数读取。
- 调用 `ServiceAppManager`。
- 错误码到 HTTP 响应的映射。

### 3. Runtime 合同

v0 只实现 `McpServiceAppRuntime`。

它负责：

- 按 manifest 启动 MCP stdio server。
- 使用 MCP `tools/list` 构建 action catalog。
- 使用 MCP `tools/call` 执行 action。
- 捕获启动失败、调用失败、调用超时、进程退出码和最近一次错误。
- 暴露 runtime status：`idle | starting | running | failed | stopped`。

启动策略：

- `listServiceApps()` 只读 manifest，不启动 service。
- `listServiceActions()` 自动 warm enabled Service Apps；单个 Service App 失败只标记该 app 状态，不阻塞全局 action 列表。
- `invokeServiceAction()` 必须确保对应 app running；如果未启动则 lazy start。

### 4. Panel App 如何访问 Service Actions

Panel App 不直接访问 MCP server，也不直接手写裸 API 细节。宿主向 iframe 注入一个稳定 SDK：

```ts
window.nextclaw.serviceActions.list(): Promise<ServiceAction[]>;
window.nextclaw.serviceActions.invoke(
  actionId: string,
  input?: Record<string, unknown>,
): Promise<ServiceActionInvokeResult>;
window.nextclaw.serviceActions.requestGrant(
  actionId: string,
): Promise<ServiceActionGrant>;
```

调用链：

```text
Panel App iframe
  -> window.nextclaw.serviceActions.invoke()
  -> Panel App host bridge
  -> NextClaw client SDK
  -> Service Gateway API
  -> ServiceAppManager
  -> McpServiceAppRuntime
  -> MCP tools/call
```

caller context 由宿主补齐，而不是由 Panel App 自己伪造：

```json
{
  "caller": {
    "surface": "panel-app",
    "appId": "workspace-browser"
  },
  "input": {}
}
```

Panel App 的 action allowlist 先从 HTML meta 读取：

```html
<meta
  name="nextclaw-panel-actions"
  content="workspace-notes.notes.read,workspace-notes.notes.write"
>
```

宿主读取 meta 后，把该 Panel App 的声明 action 集合作为 caller metadata 交给 Service Gateway。Panel App JS 不能通过修改请求体绕过 allowlist。

### 4.1 Panel App Bridge 注入方案

`window.nextclaw.serviceActions` 不能靠父窗口事后写入 `iframe.contentWindow`。推荐 v0 使用 **服务端 HTML 注入外部 bridge script + 父窗口 postMessage RPC**。

注入链路：

```text
PanelAppManager.getPanelAppContent()
  -> 读取原始 HTML
  -> 解析 nextclaw-panel-actions meta
  -> 注入 <script src="/api/panel-app-bridge.js"></script>
  -> 返回给 iframe
```

注入规则：

- bridge script 尽量插入到 `<head>` 起始处，保证早于用户脚本执行。
- 如果 HTML 没有 `<head>`，prepend 到 HTML 顶部。
- 注入外部 script，不注入大段 inline script，减少 CSP 与调试问题。
- bridge script 不包含 token、caller 或授权状态，只提供 `window.nextclaw.serviceActions` 的 postMessage SDK。

iframe 内 SDK 只做消息封装：

```ts
window.nextclaw.serviceActions.invoke("workspace-notes.notes.read", {});
```

实际发送：

```text
iframe window.nextclaw SDK
  -> window.parent.postMessage({ type, requestId, actionId, input }, "*")
```

父窗口侧由 Panel App host bridge 接收：

```text
window message listener
  -> 校验 event.source === 当前 iframe.contentWindow
  -> 根据 iframe/source 找到 panelAppId、tabId、declaredActions
  -> 使用父窗口持有的 bridge session token 调 Service Gateway
```

Service Gateway 不接受 iframe 自己上报的 caller。Panel App 调用 Service Actions 必须通过父窗口 bridge session：

```text
POST /api/panel-app-bridge-sessions
  -> 创建 parent-only bridge session token

POST /api/service-actions/:actionId/invoke
  X-NextClaw-Panel-Bridge-Session: <token>
```

bridge session 的事实由宿主和 server/kernel 维护：

```ts
type PanelAppBridgeSession = {
  id: string;
  panelAppId: string;
  tabId: string;
  declaredActions: string[];
  createdAt: string;
  expiresAt: string;
};
```

关键安全边界：

- token 只存在于父窗口内存和 server/kernel，不暴露给 iframe。
- iframe postMessage 不携带 caller，也不携带 token。
- server 根据 bridge session 还原 caller：`{ surface: "panel-app", appId: panelAppId }`。
- allowlist 使用 kernel 从 HTML meta 解析出的 `declaredActions`，不信任 iframe 运行时上报。
- API 侧拒绝没有 bridge session token 的 Panel App 调用，即使 iframe 自己手写 `fetch()` 也不能绕过。

推荐同步收紧 Panel App iframe sandbox。当前 Panel App sandbox 可以运行脚本和弹窗，但不应默认保留 `allow-same-origin`：

```text
allow-scripts
allow-forms
allow-modals
allow-popups
allow-popups-to-escape-sandbox
allow-downloads
allow-pointer-lock
allow-presentation
```

移除 `allow-same-origin` 后，iframe 与父窗口之间只通过 postMessage 通信。若未来某些 Panel App 需要 localStorage、cookie 或更强同源能力，应作为显式能力再设计，而不是 MVP 默认放开。

不推荐的注入方式：

- **父窗口直接写 `iframe.contentWindow.nextclaw`**：时序不稳定，依赖同源，未来迁移 WebView / BrowserView 也不自然。
- **把 bridge token 注入 iframe**：Panel App 可以自己拿 token 调后端，安全边界失效。
- **让 Panel App 直接 fetch Service Gateway 并自报 caller**：caller 和 allowlist 都可伪造。

### 5. 授权闭环

授权检查顺序：

1. action 是否存在。
2. caller 是否有效。
3. Panel App 是否声明过该 action。
4. caller 是否已有 grant。
5. 没有 grant 时返回 `AUTHORIZATION_REQUIRED`。
6. 宿主统一弹授权确认。
7. 用户确认后写入 grant，再重试调用。

grant state 由 kernel 管理和持久化：

```json
{
  "version": 1,
  "grants": {
    "panel-app:workspace-browser": {
      "actions": {
        "workspace-notes.notes.read": {
          "risk": "read",
          "grantedAt": "2026-05-27T10:00:00.000Z"
        }
      }
    }
  }
}
```

授权 UI 原则：

- Panel App 不直接控制授权 UI。
- `invoke()` 遇到 `AUTHORIZATION_REQUIRED` 时，由宿主弹统一确认。
- 用户拒绝后，`invoke()` 返回稳定错误，不写 grant。
- 用户必须可以撤销 grant；v0 至少在 Service Apps 状态面板提供 revoke 操作。

### 6. UI MVP

Service Apps 状态入口不需要做重，但必须覆盖发布级可诊断性：

- Service App 列表展示 `title`、`description`、`enabled`、`status`。
- Action 列表展示 `name`、`description`、`risk`、`grantState`。
- 支持 restart Service App。
- 支持 revoke grant。
- 展示最近一次启动失败、调用失败或超时的简短原因。

不做完整日志系统，但不能让用户只看到“不能用”。

### 7. API v0

```text
GET    /api/panel-app-bridge.js
POST   /api/panel-app-bridge-sessions
DELETE /api/panel-app-bridge-sessions/:token
GET    /api/service-apps
GET    /api/service-apps/:appId
POST   /api/service-apps/:appId/restart
GET    /api/service-actions
POST   /api/service-actions/:actionId/invoke
POST   /api/service-actions/:actionId/grant
DELETE /api/service-actions/:actionId/grant
GET    /api/service-action-grants
DELETE /api/service-action-grants/:actionId?surface=panel-app&appId=xxx
```

仍然不使用 `/api/mcp/...`，因为 MCP 是 runtime protocol，不是应用层产品语义。

Panel App 调用 `service-actions` 的 invoke/grant/revoke 必须通过 `x-nextclaw-panel-bridge-session` header 绑定宿主创建的 bridge session；状态面板的 grant 列表和撤销使用显式 `surface/appId` 查询参数，服务于用户管理授权。

未授权调用返回：

```json
{
  "ok": false,
  "error": {
    "code": "AUTHORIZATION_REQUIRED",
    "message": "This panel app needs permission to call workspace-notes.notes.read."
  }
}
```

### 8. 发布级验收样例

MVP 实现完成后必须用一个真实样例验收：

- 一个 `workspace-notes` Service App。
- 一个 `workspace-notes.panel.html` Panel App。
- Panel App 展示 notes。
- 首次读取触发授权。
- 授权后能调用 MCP tool。
- 写入 action 单独授权。
- Service App 崩溃后 UI 显示 failed，并可 restart。
- revoke 后再次调用会重新要求授权。

这组验收比“接口能返回 200”更重要，因为它覆盖了发现、启动、授权、调用、失败、恢复和撤销。

### 9. 内置 Skill 配套

MVP 需要内置两类 AI 使用说明：

- `panel-app-creator`：继续负责单文件 HTML Panel App，同时补充 `nextclaw-panel-actions` 和 `window.nextclaw.serviceActions` 的调用方式。
- `service-app-creator`：负责创建 `workspace/service-apps/<app-id>/service-app.json` 和 MCP-compatible stdio server，明确第一版 protocol 为 `mcp`，并要求 action risk 与 Panel App allowlist 对齐。

这样用户可以让 AI 自己给 Panel App 配套 Service App，但生成物仍然遵守目录、manifest、授权和宿主 bridge 约束。

## 需要继续讨论的问题

1. **日志与可恢复性**
   v0 已要求展示最近一次错误；后续是否需要完整日志查看、日志导出和运行历史？

2. **risk 来源**
   v0 推荐通过 `service-app.json` 的 `actions` 覆盖 risk，未声明默认 `dangerous`。后续是否引入更细的权限分类？

3. **Panel App action 声明来源**
   v0 先用 HTML meta。后续是否补 Panel App manifest？如果补 manifest，如何避免把单 HTML 形态做重？

4. **Grant UI 形态**
   v0 由宿主统一弹确认。后续是否提供 app 可主动触发的授权预申请 API？

5. **Agent Projection**
   第一版不做，但未来如果做，选择依据是用户 intent、Panel App 上下文、显式 allowlist，还是 skill 推荐？

## 当前非目标

第一阶段暂不做：

- 暴露 NextClaw 内部系统能力。
- 把所有 actions 默认给 Agent 使用。
- 通用微服务平台。
- 每个服务一个 HTTP 端口。
- 多语言运行时抽象。
- 完整 marketplace。
- 复杂权限系统；MVP 只做 allowlist + grant state。
- 长期后台任务 / watcher / daemon 模型。

这些都可以作为后续演进，但不应进入第一版。

## 参考

- VS Code Extension Anatomy: https://code.visualstudio.com/api/get-started/extension-anatomy
- Raycast Manifest: https://developers.raycast.com/information/manifest
- MCP Specification: https://modelcontextprotocol.io/specification/2024-11-05/index
- OpenAI Apps SDK: https://help.openai.com/en/articles/12515353-build-with-the-apps-sdk
- Cloudflare Workers RPC / Service Bindings: https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/rpc/
- Chrome Extension MV3 Service Workers: https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers
