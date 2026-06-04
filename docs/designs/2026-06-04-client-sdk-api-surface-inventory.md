# Client SDK API Surface 现状清单

## 背景

这份文档先只整理 `@nextclaw/client-sdk` 当前完整 API surface，作为后续 review 的事实底稿。

当前讨论点是：`@nextclaw/client-sdk` 过去主要服务 NextClaw UI 内部调用，命名、namespace、类型出口和 bridge/internal 边界没有按外部 SDK 标准精修。现在 `window.nextclaw.client` 会注入给授权后的 Panel App，Client SDK 需要从内部工具转成生态 API，因此先完整摊开现状，再判断哪些保留、改名、迁移、拆分或废弃。

本文件不做最终整改决策，只标记明显的 review 线索。

## 真实目标

这次不是为了把 `@nextclaw/client-sdk` 包装得更好看，也不是为了给现有 UI 内部 client 换一组名字。

真正目标是：

```text
让 Panel App / AI 生成的 App 能通过一个清晰、解耦、原子、低误用风险的对外 client 接入 NextClaw 能力。
```

这个目标服务 NextClaw 的长期生态扩展能力：

- Panel App 作者不需要理解宿主 bridge、runtime token、grant 管理、config/runtime/provider 等内部控制面。
- AI 生成应用时第一眼看到的是稳定能力集，而不是完整宿主管理 API 拼盘。
- 对外 client 暴露原子能力，不提供过度场景化的 convenience API。
- 宿主仍然负责授权、归因、审计和安全边界。
- 完整底层 client 仍然存在，但它是 host/internal client，不是默认对外 App Client。

因此，`window.nextclaw.client` 应该代表真正的对外 App Client，而不是完整底层 client 的原样透出。

## App Client 准入原则

进入 `window.nextclaw.client` 的 API 需要满足：

1. **原子能力优先**：能力应清晰、可组合，不内置特定业务流程。
2. **领域边界清楚**：`sessions`、`agents`、`agentRuns`、`serviceActions`、`assets`、`events` 各自只表达自己的领域。
3. **高频且确定**：第一版只暴露 Panel App / AI App 高频使用、语义稳定、误用风险低的能力。
4. **不暴露宿主控制面**：配置、provider、runtime、remote、marketplace、bridge、grant 默认不进入对外 client。
5. **授权归边界处理**：App Client 不主动提供细粒度 grant/revoke API；调用时由服务端和宿主根据 caller context 做授权、归因和拒绝。
6. **不做场景快捷方法**：不因为 AI App 难写就加入 `reply`、`sendAndWait`、`analyzeData` 等不稳定 convenience API。确需新增时，必须证明它是通用原子能力。

## Package 入口

来源：`packages/nextclaw-client-sdk/package.json`

- 包名：`@nextclaw/client-sdk`
- 当前版本：`0.2.10-beta.0`
- 主入口：`.`
- types：`./dist/index.d.ts`
- import/default：`./dist/index.js`
- files：`dist`、`README.md`
- browser global build：`dist/browser/browser-global-registration.global.js`

## Browser Global

来源：`packages/nextclaw-client-sdk/src/utils/browser-global-registration.utils.ts`

浏览器 IIFE build 会挂出：

```ts
window.NextClawClient
window.NextClawClientError
```

Panel App 注入链路再用 `window.NextClawClient` 创建并挂载：

```ts
window.nextclaw.client
```

## NextClawClient 根对象

来源：`packages/nextclaw-client-sdk/src/nextclaw-client.manager.ts`

```ts
class NextClawClient {
  baseUrl: string;
  app: AppService;
  agents: AgentsService;
  auth: AuthService;
  channelAuth: ChannelAuthService;
  config: ConfigService;
  eventBus: EventBus;
  marketplace: MarketplaceService;
  mcpMarketplace: McpMarketplaceService;
  panelApps: PanelAppsClientService;
  providers: ProviderService;
  realtime: RealtimeService;
  remote: RemoteService;
  runtimeControl: RuntimeControlService;
  runtimeUpdate: RuntimeUpdateService;
  serverPaths: ServerPathsService;
  serviceApps: ServiceAppsClientService;
  sessions: SessionsService;
}
```

构造参数暂不展开；本文件只关注当前 root namespace 和方法集合。

## API Tree 总览

这棵树只表达当前 `NextClawClient` 实例上能直接访问到的 API 形状。暂不展开入参、返回类型、route 和类型声明细节。

```text
NextClawClient
├── baseUrl
├── app
│   ├── fetchMeta()
│   └── fetchBootstrapStatus()
├── auth
│   ├── fetchStatus()
│   ├── setup()
│   ├── login()
│   ├── logout()
│   ├── updatePassword()
│   └── updateEnabled()
├── agents
│   ├── list()
│   ├── create()
│   ├── update()
│   ├── delete()
│   └── resolveAvatarUrl()
├── sessions
│   ├── list()
│   ├── get()
│   ├── listMessages()
│   ├── listSkills()
│   ├── update()
│   ├── delete()
│   ├── uploadAssets()
│   └── subscribe()
├── realtime
│   └── subscribe()
├── eventBus
│   └── EventBus methods from @nextclaw/shared
├── config
│   ├── fetch()
│   ├── fetchMeta()
│   ├── fetchSchema()
│   ├── updateModel()
│   ├── updateSearch()
│   ├── updateChannel()
│   ├── updateRuntime()
│   ├── updateSecrets()
│   ├── executeAction()
│   ├── fetchChatSessionTypes()
│   ├── fetchCronJobs()
│   ├── deleteCronJob()
│   ├── setCronJobEnabled()
│   └── runCronJob()
├── channelAuth
│   ├── start()
│   ├── poll()
│   └── connect()
├── providers
│   ├── list()
│   ├── listTemplates()
│   ├── update()
│   ├── create()
│   ├── delete()
│   ├── testConnection()
│   ├── startAuth()
│   ├── pollAuth()
│   └── importAuthFromCli()
├── marketplace
│   ├── fetchItems()
│   ├── fetchItem()
│   ├── fetchSkillContent()
│   ├── fetchRecommendations()
│   ├── fetchSkillScenes()
│   ├── install()
│   ├── fetchInstalled()
│   └── manage()
├── mcpMarketplace
│   ├── fetchItems()
│   ├── fetchInstalled()
│   ├── fetchItem()
│   ├── fetchContent()
│   ├── fetchRecommendations()
│   ├── install()
│   ├── manage()
│   └── doctor()
├── panelApps
│   ├── listPanelApps()
│   ├── updatePanelAppPreferences()
│   ├── recordPanelAppOpened()
│   ├── deletePanelApp()
│   ├── createBridgeSession()
│   ├── deleteBridgeSession()
│   ├── grantClient()
│   ├── revokeClient()
│   ├── sendAgentMessage()
│   ├── generateAgentObject()
│   └── grantAgentCapability()
├── serviceApps
│   ├── listServiceApps()
│   ├── getServiceApp()
│   ├── restartServiceApp()
│   ├── deleteServiceApp()
│   ├── listServiceActions()
│   ├── discoverServiceAppActions()
│   ├── invokeServiceAction()
│   ├── grantServiceAction()
│   ├── grantServiceActions()
│   ├── listServiceActionGrants()
│   ├── revokeServiceAction()
│   └── revokeServiceActionGrant()
├── remote
│   ├── fetchStatus()
│   ├── fetchDoctor()
│   ├── login()
│   ├── startBrowserAuth()
│   ├── pollBrowserAuth()
│   ├── logout()
│   ├── updateAccountProfile()
│   ├── updateSettings()
│   └── controlService()
├── runtimeControl
│   ├── fetch()
│   ├── startService()
│   ├── restartService()
│   └── stopService()
├── runtimeUpdate
│   ├── fetch()
│   ├── check()
│   ├── download()
│   ├── apply()
│   ├── updatePreferences()
│   └── updateChannel()
└── serverPaths
    ├── browse()
    └── read()
```

当前 SDK 未包装但 server 已存在的通用 agent run API：

```text
server routes not exposed by @nextclaw/client-sdk
└── ncpAgent
    ├── send()
    ├── stream()
    └── abort()
```

## Review 线索速记

这一节只记录 surface 级别问题，不展开接口细节。

- `agents` 目前是 Agent profile 管理，不是 Agent run / message / reply 能力。
- `sessions` 同时承担 session 查询、message 查询、asset upload 和 subscription，后续可以 review 是否拆出 `assets` / `realtime`。
- `config` 混有配置、cron、session types 等多类宿主管理能力。
- `marketplace` 与 `mcpMarketplace` 存在 MCP 相关 surface 重叠。
- `panelApps` 混有 Panel App 管理、client 授权、bridge session、Panel App agent bridge 等不同职责。
- `serviceApps` 混有 Service App 管理、Service Action 调用、授权 grant 管理和 bridge transport 线索。
- `auth`、`providers`、`remote`、`runtimeControl`、`runtimeUpdate`、`serverPaths` 都偏宿主/管理/高风险能力，是否进入 Panel App app-facing client 需要单独 review。
- 当前完整底层 `NextClawClient` 缺少通用 `agentRuns` namespace。后端已有 Agent Run / Ingress 语义，但历史 UI route、NCP HTTP endpoint 和 Panel App agent facade 不是本次新标准的设计依据。
- root type exports 直接透出大量 server/UI 命名，后续需要判断哪些是 public SDK contract，哪些应改成 SDK 自有类型或 internal 类型。

## 推荐方案：标准 Agent Runs + Thin External Client Projection

### 核心想法

`window.nextclaw.client` 应被理解为真正对外的 App Client，也就是 Panel App / AI App 作者直接面对的产品化 API surface。

底层完整 SDK 仍然可以存在，供 NextClaw UI、宿主内部、调试工具和高级使用者使用。但它不应该和对外 client 混成同一个概念。

`agentRuns` 是应用级 Agent Run 能力，不是某个 Agent profile 的子能力，也不是聊天 UI hook 的 convenience API。它应该先进入完整 `NextClawClient`，再由 App Client 做薄投影。

暂定命名区分：

- `window.nextclaw.client`：对外 App Client，也就是 app-facing client。
- `hostClient`：宿主内部持有的完整底层 client。
- `NextClawAppClient`：对外 client 的类型名候选。
- `NextClawHostClient` / `NextClawFullClient`：完整底层 client 的类型名候选。

当前代码里的完整底层类仍叫 `NextClawClient`，这是历史命名。第一版落地时可以先保留兼容，但文档和新类型应明确区分：

```text
NextClawAppClient  = 对外 App Client
NextClawClient     = 现有完整底层 client，第一版暂时保留
```

后续再决定是否把完整底层类正式改名为 `NextClawHostClient`。

### Agent Runs 新标准

第一版要新增一条标准 Agent Runs HTTP route，不直接复用历史 `/api/ncp/agent/*` 路径，也不复用 `panelApps.sendAgentMessage` 或 NCP HTTP endpoint 作为新标准。

推荐 route：

```text
POST /api/agent-runs/send
GET  /api/agent-runs/stream?sessionId=...
POST /api/agent-runs/abort
```

对应关系：

```text
client.agentRuns.send
  -> POST /api/agent-runs/send
  -> ingressKeys.agentRun.send
  -> AgentRunRequestManager.handleSendRequest
  -> payload: AgentRunSendIngressPayload

client.agentRuns.abort
  -> POST /api/agent-runs/abort
  -> ingressKeys.agentRun.abort
  -> AgentRunRequestManager.handleAbortRequest
  -> payload: NcpMessageAbortPayload

client.agentRuns.stream
  -> GET /api/agent-runs/stream?sessionId=...
  -> createNcpSessionEventStreamResponse(...)
  -> payload: NcpStreamRequestPayload
  -> handler receives NcpEndpointEvent frames
```

`stream` 当前不走 Ingress；它对齐后端现有 session event stream 语义，从 `eventBus` 过滤指定 `sessionId` 的 NCP event。这里不强行把它塞进 Ingress 模型。

旧链路保留但不作为新标准：

```text
POST /api/ncp/agent/send
GET  /api/ncp/agent/stream
POST /api/ncp/agent/abort
NcpHttpAgentClientEndpoint
panelApps.sendAgentMessage
window.nextclaw.agent
```

这些旧链路本次不删除，避免破坏现有 UI chat / bridge 运行路径。但新 `@nextclaw/client-sdk.agentRuns` 不按它们的命名、封装或 convenience 语义设计。

### 完整 Client SDK 映射

完整 `NextClawClient` 第一版应补齐标准 namespace：

```ts
class NextClawClient {
  readonly agentRuns: AgentRunsService;
}
```

`AgentRunsService` 是标准 route client owner，不是高层 convenience API。它只做和新 route 的 1:1 映射：

```ts
class AgentRunsService {
  send(payload: AgentRunSendIngressPayload): Promise<NcpRunHandle>;
  stream(
    payload: NcpStreamRequestPayload,
    handler: NextClawAgentRunStreamHandler,
    options?: NextClawAgentRunStreamOptions,
  ): NextClawAgentRunStreamSubscription;
  abort(payload: NcpMessageAbortPayload): Promise<{ accepted: true }>;
}
```

这里不新增 `reply()`、`sendAndWait()`、`generateObject()`，也不把请求转换成 Panel App agent facade。

### App Client Projection

宿主初始化时先创建完整底层 client：

```ts
const hostClient = new NextClawClient({
  baseUrl,
  headers,
});
```

然后基于它组装对外 client：

```ts
window.nextclaw.client = createNextClawAppClient(hostClient);
```

这里的 projection 是很薄的 namespace 重组：

- 不重写任何业务函数。
- 不写业务语义 wrapper，不把请求转换成另一条旧 facade。
- 只做 pick、rename、regroup。
- 当前 SDK service 方法基本都是箭头函数 class field，直接把方法引用拿出来不会丢失 `this`。

直接用 mapping code 表达：

```ts
function createNextClawAppClient(hostClient) {
  return {
    sessions: {
      list: hostClient.sessions.list,
      get: hostClient.sessions.get,
      listMessages: hostClient.sessions.listMessages,
    },
    agents: {
      list: hostClient.agents.list,
      resolveAvatarUrl: hostClient.agents.resolveAvatarUrl,
    },
    agentRuns: {
      send: hostClient.agentRuns.send,
      stream: hostClient.agentRuns.stream,
      abort: hostClient.agentRuns.abort,
    },
    serviceActions: {
      list: hostClient.serviceApps.listServiceActions,
      invoke: hostClient.serviceApps.invokeServiceAction,
    },
    assets: {
      upload: hostClient.sessions.uploadAssets,
    },
    events: {
      subscribe: hostClient.realtime.subscribe,
    },
  };
}

type NextClawAppClient = ReturnType<typeof createNextClawAppClient>;
```

这里有一个新的明确结论：第一版包含两个层次，先补完整 `NextClawClient.agentRuns` 标准能力，再做 app-facing client 的薄投影。也就是说：

- 新增完整 `NextClawClient.agentRuns`，因为这是缺失的标准应用级能力。
- 不把 `agentRuns` 错误映射到 `hostClient.panelApps.sendAgentMessage`。
- 不把 `agentRuns` 拼成 `createNextClawAppClient({ hostClient, agentRuns })` 这种多来源 projection。
- 不手写一份重复的 `NextClawAppClient` 结构类型。
- 不新增专用单文件 contract / DTO 展开文件；类型发现走 SDK 正常声明入口。
- `createNextClawAppClient()` 的返回对象就是唯一 API map 和唯一事实源。
- `NextClawAppClient` 类型直接用 `ReturnType<typeof createNextClawAppClient>` 推导，避免实现和类型漂移。

这个方案的目标不是限制能力本身，而是把 Panel App / AI 作者第一眼看到的 API surface 变成“高频、稳定、有产品语义、低误用风险”的集合。完整底层 client 仍然可以留在 SDK 包内；只是第一版不把完整底层 client 直接挂给 Panel App。

### 第一版建议暴露的 App-Facing API

第一版优先暴露高频、必要、确定性高、适合 Panel App / AI App 作者直接使用的能力。

```text
window.nextclaw.client
├── sessions
│   ├── list()
│   ├── get()
│   └── listMessages()
├── agents
│   ├── list()
│   └── resolveAvatarUrl()
├── agentRuns
│   ├── send()
│   ├── stream()
│   └── abort()
├── serviceActions
│   ├── list()
│   └── invoke()
├── assets
│   └── upload()
└── events
    └── subscribe()
```

上面的 mapping code 已经表达了第一版建议映射方向：

- `sessions` 取自完整底层 client 的 session 查询与消息读取能力。
- `agents` 取自完整底层 client 的 Agent profile 读取能力。
- `agentRuns` 取自完整底层 client 新增的标准 `agentRuns` namespace，对齐新 `/api/agent-runs/*` route。
- `serviceActions` 从完整底层 client 的 `serviceApps` 中挑出 action list / invoke，并换成使用者视角命名。
- `assets` 可以先从现有 asset upload 能力投影出来，后续 review 是否成为独立完整底层 namespace。
- `events` 取自完整底层 client 的 realtime 订阅能力；对外用 `events`，避免把 transport 特性当成产品 namespace。

### 第一版建议暂不暴露的 API

这些能力不是说永远不能用，而是第一版不建议出现在 Panel App 的默认 `window.nextclaw.client` surface 里。

```text
auth
config
channelAuth
providers
marketplace
mcpMarketplace
panelApps
remote
runtimeControl
runtimeUpdate
serverPaths
eventBus
serviceActions.grant / revoke / grant list
serviceApps management
panelApps bridge / grant / agent methods
```

暂不暴露原因：

- `auth` / `config` / `providers` / `channelAuth`：偏宿主账号、配置和 provider 管理，不是 Panel App 高频能力。
- `runtimeControl` / `runtimeUpdate` / `remote`：偏宿主运行时控制或远程控制，风险更高。
- `marketplace` / `mcpMarketplace`：偏安装、管理和生态市场操作，AI App 第一版不应默认看到。
- `panelApps`：Panel App 自身通常不需要管理 Panel App；暴露后容易误导到 `panelApps.sendAgentMessage` 这类职责混乱 API。
- `serviceActions.grant/revoke`：授权应由宿主和服务端控制，不应鼓励 Panel App 主动管理授权。
- `serverPaths`：文件系统读取能力需要独立权限和产品语义 review。
- `eventBus`：低层事件基础设施，优先让 App 作者使用 `events.subscribe` 或后续更高层事件 API。

### 授权与归因关系

Projection 不改变授权模型：

- `client: true` 仍表示这个 Panel App 申请使用 app-facing client。
- 授权仍按 App 级整体授权处理。
- runtime token 仍只用于服务端识别 caller 和归因，不作为开发者主动依赖的公开合同。
- Agent / Service Action 等通用能力在服务端边界根据 caller context 注入 metadata、审计信息和必要 scope。

尤其是 Agent 交互：

- Agent run 能力本身应该是通用能力，不属于 `panelApps`。
- Panel App 只提供 caller 身份、授权状态、归因信息和 peer scope。
- 第一版要新增完整底层 `hostClient.agentRuns` service，作为标准 Agent Run route 的 SDK owner。
- 后续若要彻底清理旧 Panel App agent facade，应作为单独重构；本次只新增标准路径并让新 App Client 使用标准路径，不删除旧链路。

### 与完整底层 client 的关系

这会修正当前注入设计里的一个表述：

旧表述：

```text
window.nextclaw.client 是完整底层 NextClawClient 实例。
```

更准确的新表述可以是：

```text
window.nextclaw.client 是基于完整底层 client 能力组装出的 app-facing client projection。
```

这仍然复用底层 SDK 的实现和 transport，但不把完整底层 client 的全部 namespace 原样暴露给 Panel App。这样可以降低 AI 生成应用时的选择复杂度和误用概率。

## 一次性落地判断

当前方案已经足够进入第一版实现，但不是所有讨论过的点都应一次性做完。

### 第一版应落地

```text
@nextclaw/client-sdk
├── createNextClawAppClient()
├── type NextClawAppClient = ReturnType<typeof createNextClawAppClient>
└── NextClawClient
    └── agentRuns
        ├── send()
        ├── stream()
        └── abort()
```

server 新 route：

```text
POST /api/agent-runs/send
GET  /api/agent-runs/stream?sessionId=...
POST /api/agent-runs/abort
```

Panel App 注入链路改为：

```ts
const hostClient = new window.NextClawClient(...);
window.nextclaw.client = window.createNextClawAppClient(hostClient);
```

对外 API 第一版：

```text
window.nextclaw.client
├── sessions
│   ├── list()
│   ├── get()
│   └── listMessages()
├── agents
│   ├── list()
│   └── resolveAvatarUrl()
├── agentRuns
│   ├── send()
│   ├── stream()
│   └── abort()
├── serviceActions
│   ├── list()
│   └── invoke()
├── assets
│   └── upload()
└── events
    └── subscribe()
```

同步更新：

- browser global build 挂出 `createNextClawAppClient`。
- Panel App 注入脚本使用 App Client projection。
- Panel App global 类型把 `window.nextclaw.client` 标为 `NextClawAppClient`。
- Panel App creator skill 改为引导从已安装 `@nextclaw/client-sdk` 的正常声明入口读取 `NextClawAppClient`，不再说 `window.nextclaw.client` 是完整底层 client。
- 方案文档和注入设计文档同步修正旧表述。

`stream()` / `abort()` 可以进入第一版，但必须对齐新 `/api/agent-runs/*` route。`send` / `abort` 走 Ingress，`stream` 走后端 session event stream。

### 第一版不做

- 不把完整底层 client 改名为 `NextClawHostClient`，避免扩大破坏面。
- 不复用 `NcpHttpAgentClientEndpoint` 作为新标准 client-sdk agentRuns 实现。
- 不复用旧 `/api/ncp/agent/*` 作为新标准 route；旧 route 暂时保留。
- 不把 `client.agentRuns.send` 映射到 `hostClient.panelApps.sendAgentMessage`。
- 不把 App Client projection 改成多来源拼装。
- 不手写重复的 `NextClawAppClient` 结构类型；类型从 `createNextClawAppClient()` 返回值推导。
- 不新增 `app-client.contract.d.ts` 或把 DTO 展开成第二套合同；AI / 开发者需要类型时从 `@nextclaw/client-sdk` 查 `NextClawAppClient`，必要时跟随声明跳转。
- 不新增 `reply()`、`sendAndWait()`、`generateObject()` 等高层 convenience API。
- 不暴露 `auth/config/providers/runtimeControl/runtimeUpdate/remote/marketplace/panelApps/serverPaths/eventBus`。
- 不清理完整底层 client 中已有的 historical surface；只改变 Panel App 对外看到的 surface。
- 不删除旧 `window.nextclaw.agent` bridge 链路；本次只是新增和切换 client projection。

### 落地前需要确认

- `serviceActions.invoke()` 遇到未授权时的体验：继续抛授权错误，还是由宿主 transport/调用边界触发授权 UI。第一版至少不能暴露 grant/revoke 给 App 作者。
- `assets.upload()` 是否继续从 `sessions.uploadAssets()` 投影，还是先在完整底层 client 补一个 `assets` namespace 再投影。第一版可以先 projection，后续再整理底层 namespace。

### 最小验收标准

- 已授权且声明 `client: true` 的 Panel App 中，`window.nextclaw.client` 同步可用。
- `window.nextclaw.client` 只包含 App Client projection 中的 namespace，不出现 `config`、`runtimeControl`、`panelApps`、`serviceApps` 等完整底层 namespace。
- `sessions.list/get/listMessages`、`agents.list/resolveAvatarUrl`、`serviceActions.list/invoke`、`assets.upload`、`events.subscribe` 能从 projection 正常调用到底层能力。
- `agentRuns.send/stream/abort` 能通过 projection 调到完整 `NextClawClient.agentRuns`。
- `client-sdk.agentRuns.send` 与 `POST /api/agent-runs/send` 的 payload 对齐 `AgentRunSendIngressPayload`。
- `client-sdk.agentRuns.abort` 与 `POST /api/agent-runs/abort` 的 payload 对齐 `NcpMessageAbortPayload`。
- `client-sdk.agentRuns.stream` 与 `GET /api/agent-runs/stream` 的 payload 对齐 `NcpStreamRequestPayload`。
- TypeScript 类型里 `window.nextclaw.client` 是 `NextClawAppClient`，且 `NextClawAppClient` 由 `ReturnType<typeof createNextClawAppClient>` 推导。
- AI / Panel App creator skill 不再引导使用完整底层 client。

## 下一步 Review 维度

后续可以逐项 review：

1. 哪些 namespace 属于 App SDK，哪些属于 Host/Admin SDK，哪些只是 UI internal。
2. 哪些方法名需要改成 namespace 内短命名，例如 `panelApps.list()`。
3. 哪些 bridge transport 字段需要从 public SDK 移出。
4. 是否以及何时删除旧 Panel App agent facade、旧 `/api/ncp/agent/*` UI route 或旧 `window.nextclaw.agent` bridge。
5. 哪些 root types 需要改为 SDK 自有 public contract。
6. 如何把 `window.nextclaw.client` 的 App-facing client 语义写入更多开发者文档、示例和 skill。
