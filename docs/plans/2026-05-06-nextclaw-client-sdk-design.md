# NextClaw Client SDK 方案设计

日期：2026-05-06

## 1. 文档目的

本文定义 `@nextclaw/client-sdk` 的正式长期设计，用于统一 NextClaw 所有上层前端访问后端能力的方式。

这里的“上层前端”包括：

- `packages/nextclaw-ui`
- `apps/companion`
- 未来可能存在的 desktop shell / remote shell / 其他接入形态

本文不是实现说明，不引入新的后端能力，也不讨论某个具体页面如何组织状态。它只回答一件事：

**NextClaw 的所有上层前端，应该通过什么样的一个统一 client contract 访问现有后端能力。**

## 2. 结论

`@nextclaw/client-sdk` 应成为 NextClaw 所有上层前端访问后端的唯一正式入口。

它的核心抽象不是“一个基于 `fetch` 的 helper 集合”，而是：

- 一个稳定的 `transport contract`
- 一组按领域划分的 `domain services`
- 一套由 server / kernel owner 持有的 contract types

换句话说：

- `client-sdk` 是前端的统一 client contract owner
- `server` / `kernel` 是接口 contract 和能力语义 owner
- `ui` / `companion` / `desktop` 是 SDK consumer，不再各自维护平行 API 层

## 3. 设计目标

### 3.1 必须达到的目标

1. **完整覆盖当前前端实际使用的后端能力**
2. **允许多个上层前端共用同一套 client contract**
3. **不把 React、store、query、view model 混进 SDK**
4. **不要求所有运行环境都直接使用 `fetch + WebSocket(baseUrl)`**
5. **允许 UI 通过已有 transport 机制接入，而不是倒逼 UI 改造成某种固定网络实现**
6. **把请求、订阅、流式链路、上传链路收敛到统一抽象下面**
7. **把类型 owner 收回到 server / kernel contract，而不是让 UI 和 SDK 各维护一份**

## 3.2 本次需求范围

本次不是只做一个“未来可用的 SDK 雏形”，而是要完成一轮**可真实接入、可真实验收**的 SDK 收口。

本次交付范围明确包括：

1. **补全 `@nextclaw/client-sdk`**
   - 补齐当前前端实际使用到的后端能力
   - 建立正式的 `transport + domain services + server-owned contracts` 结构

2. **前端接入 SDK**
   - `packages/nextclaw-ui` 必须开始真实接入 SDK
   - `shared/lib/api` 必须收敛为 SDK 的薄适配层，而不是继续独立维护请求 owner
   - 至少要完成一轮对当前真实 UI 能力面的收口，而不是只把 SDK 写完放在那里

3. **companion 接入 SDK**
   - `apps/companion` 必须通过 SDK 访问后端能力
   - 不再保留 companion 侧平行的 request / websocket owner

4. **保持现有行为不退化**
   - UI 当前 local / remote transport 语义不能退化
   - realtime 不能退化
   - upload 不能退化

5. **结构治理同步成立**
   - SDK 包内结构必须符合当前目录与角色规范
   - 不允许为了 SDK 便利临时突破目录治理规则
6. **迁移期主动简化与删减**
   - SDK 接入过程中，已经失去 owner 意义的旧实现、无效兼容层、重复胶水代码、无人使用的访问路径，应主动删除
   - 不允许为了“先接上”而长期保留一堆已经没有必要的平行实现

### 3.3 本次不在交付范围内

以下内容本次明确不做：

- React hooks 层统一改造
- TanStack Query 层统一改造
- Zustand / store 层统一改造
- 页面 presenter / manager / view model 的整体重构
- 顺手重写整个 frontend 数据流
- 新增后端 API，只为 SDK 设计服务

这次的目标是：

**把 SDK 变成正式 owner，并完成第一轮真实接入，而不是借 SDK 之名重做整个前端架构。**

同时，这次不是纯搬运迁移。

**凡是因为 SDK 接入而已经失去存在理由的旧代码，应在同一轮里积极删除、收口或重构，不应消极保留。**

### 3.4 非目标

以下内容不属于本次 SDK 设计范围：

- React hooks
- TanStack Query 封装
- Zustand / store
- 页面级状态编排
- presenter / manager / controller
- query cache mutation helpers
- Electron 生命周期
- companion 展示策略
- “当前显示哪个 agent” 这样的上层产品逻辑
- 新增 server API

## 4. 核心设计原则

### 4.1 SDK 只负责访问能力，不负责页面逻辑

SDK 的职责是“以统一方式访问现有后端能力”。

它不负责：

- 决定某个页面怎么组织请求
- 决定 query cache 怎么更新
- 决定某个 view 何时刷新
- 决定 companion 用哪个 session 驱动 UI

这些都属于上层前端 owner。

### 4.2 contract type 必须单一来源

如果 server 或 kernel 已经定义了某个请求/响应 contract，SDK 必须直接复用它，不再复制一份平行类型。

类型归属原则如下：

- server UI / runtime / config / remote / marketplace contract 归 `@nextclaw/server`
- runtime update contract 归 `@nextclaw/kernel/update-contract`
- NCP session / message / chat 相关 contract 优先归其已有 owner
- SDK 只持有 transport、组合参数、少量 client 侧抽象类型

### 4.3 SDK 的稳定中心是 transport，不是 fetch

如果 SDK 只支持：

- `baseUrl`
- `fetch`
- `WebSocket(baseUrl)`

那么 `packages/nextclaw-ui` 一接入就会退化。

原因很简单：当前 UI 已经有一层 `appClient` / transport 机制，它负责：

- local / remote runtime 选择
- request 转发
- realtime 订阅

所以正确方向不是“让 UI 迁就 SDK 内部的固定网络实现”，而是：

**让 SDK 依赖一个稳定 transport contract，然后由不同运行环境提供 transport adapter。**

### 4.4 SDK 必须按领域暴露，而不是按 URL 暴露

外部应该写：

```ts
client.config.get();
client.sessions.list();
client.runtimeControl.start();
client.remote.getStatus();
```

而不是到处写：

```ts
request("/api/config");
request("/api/ncp/sessions");
request("/api/runtime/control/start");
```

SDK 的目标是提供领域语义，不是把 URL 改写成别的字符串。

### 4.5 UI API 只允许保留兼容适配层，不再做第二个 owner

`packages/nextclaw-ui/src/shared/lib/api` 可以在迁移期继续存在，但其角色必须收缩为：

- 兼容旧调用点
- 内部转调 `@nextclaw/client-sdk`

它不能继续演化成第二套平行 API owner。

## 5. 目标架构

### 5.1 分层

```text
server / kernel contracts
        ↓
@nextclaw/client-sdk
  - transport
  - domain services
  - client-only types
        ↓
ui / companion / desktop / other shells
  - hooks
  - stores
  - presenters
  - view models
  - query caches
```

### 5.2 包内组织

```text
packages/nextclaw-client-sdk/src/
  index.ts
  services/
    app.service.ts
    agents.service.ts
    auth.service.ts
    channel-auth.service.ts
    config.service.ts
    marketplace.service.ts
    mcp-marketplace.service.ts
    nextclaw-client.service.ts
    remote.service.ts
    request.service.ts
    realtime.service.ts
    runtime-control.service.ts
    runtime-update.service.ts
    server-paths.service.ts
    sessions.service.ts
  types/
    nextclaw-client.types.ts
    nextclaw-request.types.ts
    nextclaw-realtime.types.ts
    nextclaw-transport.types.ts
  utils/
    normalize-base-url.util.ts
```

约束如下：

- 不新增 `support`、`helpers`、`common` 之类的模糊目录
- 作为 `L1` library package，不额外引入 `features/`、`shared/`、`platforms/` 或新的顶层角色目录
- 根目录只保留 package 边界文件，例如 `index.ts`
- `services/` 放有状态编排、远程 IO 协调和协议实现 owner
- `types/` 只放 SDK 自己拥有的 client 抽象类型
- 后端 contract types 不复制进 `types/`

这里要特别说明：

- `nextclaw-client` 是领域名，不是角色名
- 因此 `nextclaw-client.service.ts` 必须位于 `services/`，而不是根目录
- `transport` 是本 SDK 的核心抽象名，不是目录角色名
- 在当前项目规范下，`transport` 相关实现应落到现有允许的角色目录里
- 因此 transport contract 落在 `types/`
- transport 默认实现和运行时协调落在 `services/`

## 6. Public API 设计

### 6.1 创建入口

SDK 对外只暴露一个正式创建入口：

```ts
const client = createNextClawClient(options);
```

这个入口由根目录的 `index.ts` 作为 package public boundary 暴露，而不是把 service 实现文件直接挂在根目录。

### 6.2 client 形态

```ts
type NextClawClient = {
  readonly app: AppService;
  readonly agents: AgentsService;
  readonly auth: AuthService;
  readonly channelAuth: ChannelAuthService;
  readonly config: ConfigService;
  readonly marketplace: MarketplaceService;
  readonly mcpMarketplace: McpMarketplaceService;
  readonly remote: RemoteService;
  readonly runtimeControl: RuntimeControlService;
  readonly runtimeUpdate: RuntimeUpdateService;
  readonly serverPaths: ServerPathsService;
  readonly sessions: SessionsService;
  readonly realtime: RealtimeService;
};
```

这里保留单独的 `realtime` service，是为了给“全局订阅”一个清晰 owner；但 session 相关的订阅能力仍然可以通过 `client.sessions` 暴露更贴近领域的入口。

### 6.3 创建参数

```ts
type CreateNextClawClientOptions = {
  baseUrl?: string;
  transport?: NextClawTransport;
  authToken?: string;
  getAuthToken?: () => string | null | Promise<string | null>;
  headers?: Record<string, string>;
};
```

约束：

- `transport` 与 `baseUrl` 至少提供其一
- 提供 `transport` 时，SDK 不强行要求底层一定使用 `fetch`
- `baseUrl` 模式下，由 SDK 内置默认 transport
- `getAuthToken` 优先级高于静态 `authToken`

## 7. Transport Contract 设计

### 7.1 为什么必须先定义 transport

当前 `packages/nextclaw-ui` 并不是一个单纯的浏览器端 `fetch` 调用者，它已经拥有自己的 runtime-aware transport：

- local transport
- remote transport
- realtime subscribe

如果 SDK 不抽 transport，这部分能力就无法无损接入。

因此 transport 不是实现细节，而是 SDK 的核心边界。

### 7.2 transport contract

```ts
type NextClawTransport = {
  request<TResponse>(input: NextClawRequestInput): Promise<TResponse>;
  openStream<TFinal = unknown>(input: NextClawStreamInput): NextClawStreamSession<TFinal>;
  subscribe(handler: (event: NextClawRealtimeEvent) => void): () => void;
};
```

### 7.3 request input

```ts
type NextClawRequestInput = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  headers?: Record<string, string>;
  body?: NextClawRequestBody;
  timeoutMs?: number;
  signal?: AbortSignal;
};
```

### 7.4 request body

```ts
type NextClawRequestBody =
  | { kind: "json"; value: unknown }
  | { kind: "form-data"; value: FormData };
```

这里明确只支持当前真实需要的两类 body：

- JSON
- multipart / `FormData`

本次不为了“将来可能有二进制场景”额外抽象更多层。

### 7.5 stream input

```ts
type NextClawStreamInput = {
  method: "GET" | "POST";
  path: string;
  headers?: Record<string, string>;
  body?: NextClawRequestBody;
  signal?: AbortSignal;
  onEvent: (event: NextClawStreamEvent) => void;
};
```

### 7.6 为什么 stream 也要进 contract

即使当前 `shared/lib/api` 里没有把 stream 暴露成一堆独立 API，transport 仍然必须拥有 `openStream`，原因有两个：

1. 当前 UI transport 已经把它建模成一等能力
2. SDK 必须完整表达上层前端访问后端的通道能力，而不是只表达当前某个模块恰好用到的函数集合

### 7.7 默认 transport

SDK 内置默认 transport，用于 companion、Node 脚本、独立前端壳等直接基于 URL 访问的场景：

- HTTP request：基于 `fetch`
- realtime subscribe：基于 `WebSocket`
- stream：基于现有后端支持的流式通道

但这个默认 transport 不是唯一实现，只是一个默认实现。

## 8. Domain Service 设计

### 8.1 service 设计原则

每个 service 负责一个稳定领域，不做跨领域 UI 编排。

例如：

- `config.service.ts` 负责配置读取与更新
- `remote.service.ts` 负责远程实例相关能力
- `runtime-control.service.ts` 负责 runtime 启停控制

不做：

- `dashboard.service.ts`
- `settings-page.service.ts`
- `companion-support.service.ts`

因为这些都不是稳定后端领域，只是上层产品视图或场景。

### 8.2 领域服务覆盖面

本 SDK 必须完整覆盖当前前端已经在使用的所有后端能力。

正式领域划分如下：

#### `app`

- `getMeta()`
- `getBootstrapStatus()`

#### `agents`

- `list()`
- `create()`
- `update(id, input)`
- `delete(id)`

#### `auth`

- `getStatus()`
- `setup(input)`
- `login(input)`
- `logout()`
- `updatePassword(input)`
- `setEnabled(input)`

#### `channelAuth`

- `start(input)`
- `poll(input)`

#### `config`

- `get()`
- `getMeta()`
- `getSchema()`
- `updateModel(input)`
- `updateSearch(input)`
- `updateProvider(input)`
- `createProvider(input)`
- `deleteProvider(input)`
- `testProviderConnection(input)`
- `startProviderAuth(input)`
- `pollProviderAuth(input)`
- `importProviderAuthFromCli(input)`
- `updateChannel(input)`
- `updateRuntime(input)`
- `updateSecrets(input)`
- `executeAction(input)`
- `getNcpChatSessionTypes()`
- `listCronJobs()`
- `deleteCronJob(input)`
- `setCronJobEnabled(input)`
- `runCronJob(input)`

#### `marketplace`

- `listItems(input?)`
- `getItem(id)`
- `getSkillContent(id)`
- `getPluginContent(id)`
- `getRecommendations(input?)`
- `installItem(input)`
- `manageItem(input)`
- `listInstalled()`

#### `mcpMarketplace`

- `listItems(input?)`
- `listInstalled()`
- `getItem(id)`
- `getContent(id)`
- `getRecommendations(input?)`
- `installItem(input)`
- `manageItem(input)`
- `doctorItem(input)`

#### `remote`

- `getStatus()`
- `getDoctor()`
- `login(input)`
- `startBrowserAuth(input)`
- `pollBrowserAuth(input)`
- `logout()`
- `updateAccountProfile(input)`
- `updateSettings(input)`
- `controlService(input)`

#### `runtimeControl`

- `getStatus()`
- `start()`
- `restart()`
- `stop()`

#### `runtimeUpdate`

- `getStatus()`
- `check()`
- `download()`
- `apply()`
- `updatePreferences(input)`
- `updateChannel(input)`

#### `serverPaths`

- `browse(input)`
- `read(input)`

#### `sessions`

- `list(input?)`
- `getMessages(sessionId, input?)`
- `getSkills(sessionId)`
- `update(sessionId, input)`
- `delete(sessionId)`
- `uploadAssets(sessionId, formData)`

#### `realtime`

- `subscribe(handler)`

说明：

- `uploadAssets` 虽然底层是 multipart 上传，但从领域上仍然属于 `sessions`
- 不单独创造 `attachments.service.ts`，避免把会话附件拆成伪领域
- `realtime` 只承载全局订阅入口；基于 session 的事件消费由 `sessions` 或上层完成组合

## 9. 与当前前端 API 的对应关系

当前 `packages/nextclaw-ui/src/shared/lib/api` 里的能力，在迁移后应成为 SDK 的薄兼容适配层。

对应关系如下：

| 当前 UI API 文件 | SDK owner |
| --- | --- |
| `agents.ts` | `client.agents` |
| `channel-auth.ts` | `client.channelAuth` |
| `config.ts` 中 auth/app/config/cron/session-type 能力 | `client.auth` / `client.app` / `client.config` |
| `marketplace.ts` | `client.marketplace` |
| `mcp-marketplace.ts` | `client.mcpMarketplace` |
| `ncp-session.ts` | `client.sessions` |
| `ncp-attachments.ts` | `client.sessions.uploadAssets` |
| `remote.ts` | `client.remote` |
| `runtime-control.ts` | `client.runtimeControl` |
| `runtime-update.service.ts` | `client.runtimeUpdate` |
| `server-path.ts` | `client.serverPaths` |

以下内容不进 SDK，继续留在 UI 层：

- `ncp-session-query-cache.ts`
- 任何 query cache mutation helper
- 任何 React hook
- 任何页面状态拼装逻辑

## 10. 类型归属策略

### 10.1 哪些类型属于 SDK

SDK 自己拥有的类型只包括：

- client 创建参数
- transport contract
- stream session
- realtime 订阅函数形态
- 少量 client 侧错误类型

### 10.2 哪些类型不属于 SDK

以下类型不应在 SDK 内复制 owner：

- config 请求/响应
- auth 请求/响应
- runtime update 请求/响应
- marketplace item contract
- remote runtime contract
- session/message/skill contract

这些都应直接从其已有 owner 包导入。

### 10.3 错误建模

SDK 可以提供统一错误外形，但不能吞掉后端真实语义。

正确做法是：

- transport 层把网络错误、超时错误、非 JSON 响应错误转成可识别 client 错误
- 服务层保留后端返回的真实 message / status / payload

不做：

- 把后端所有错误压平为 `"Request failed"`
- 在 SDK 内“猜测”业务错误含义

## 11. 与 `packages/nextclaw-ui` 的集成策略

### 11.1 UI 不直接依赖默认 transport

`packages/nextclaw-ui` 的正确接入方式不是：

- 直接传 `baseUrl`
- 让 SDK 自己用裸 `fetch` 和裸 `WebSocket`

而是：

- UI 提供基于现有 `appClient` 行为的 transport adapter
- SDK 基于该 adapter 工作

这样可以保留现有能力：

- local / remote runtime 自动选择
- request 转发
- realtime 订阅

### 11.2 UI transport adapter 的 owner

UI 使用的 transport adapter 必须继续归 UI 自己 owner，而不是倒灌回 SDK。

原因是：

- SDK 不能反向依赖 UI 包
- local / remote runtime 选择属于 UI 当前运行环境能力
- 这层适配本质上是“把 UI 环境翻译成 SDK transport contract”，不是 SDK 的通用能力

因此应遵守：

- SDK 定义 `NextClawTransport`
- UI 提供 `NextClawTransport` 的 adapter 实现
- companion / 其他独立壳可直接使用 SDK 默认 transport

### 11.3 依赖环警戒线

当 `shared/lib/api` 改为 SDK 薄适配层后，UI transport 的底层实现不能再反向依赖 `shared/lib/api` 聚合出口。

必须避免出现这种链路：

```text
shared/lib/api -> @nextclaw/client-sdk -> UI transport adapter -> shared/lib/api
```

这会形成职责环和模块依赖环。

因此实现时必须遵守：

- UI transport 的底层 request 实现只能依赖更低层的 raw transport utility
- 不能从 `shared/lib/api/index` 或其领域 API 文件反向取 request 能力
- SDK 薄适配层在依赖方向上必须位于 UI transport 之上，而不是之下

### 11.4 UI API 迁移后的形态

迁移后：

- `shared/lib/api` 仍可短期保留
- 但它内部必须全部转为调用 `@nextclaw/client-sdk`

例如：

```ts
export const fetchAgents = () => client.agents.list();
```

而不是继续自己维护 `request("/api/agents")`。

### 11.5 迁移期硬约束

从 SDK 迁移开始起：

**禁止新增新的 UI 直调 API。**

也就是：

- 不再新增新的 `shared/lib/api/*.ts` 直接请求实现
- 不再新增新的 `appClient.request(...)` 业务调用点
- 新能力先进入 SDK，再由 UI 消费
- 对于已经被 SDK 覆盖、且已无真实消费价值的旧 API 包装、薄转发、重复 request helper、无效兼容胶水，默认应直接删除，而不是继续长期保留

## 12. 与 companion / desktop / 其他壳的关系

### 12.1 companion

`apps/companion` 直接使用 `@nextclaw/client-sdk`，优先走默认 transport。

companion 负责：

- 决定显示哪个 agent
- 决定如何渲染头像/状态
- 决定窗口交互

SDK 只负责：

- 拉取数据
- 订阅事件
- 访问现有配置/会话/agent 能力

### 12.2 desktop shell

未来若 desktop shell 需要直接访问后端能力，也应复用 `@nextclaw/client-sdk`，而不是再长出一套 desktop 专属 API 层。

### 12.3 未来其他远程壳

只要某个新壳能够提供：

- base URL

或

- transport adapter

它就可以接入同一套 SDK，而不需要再重新设计访问协议。

## 13. 迁移策略

### 13.1 顺序

迁移顺序应固定为：

1. 先把 SDK 扩到完整覆盖当前前端使用面
2. 再让 UI 的 `shared/lib/api` 改为薄适配层
3. 再逐步收掉直接 `appClient.subscribe(...)` 的调用点
4. 最后删除失去 owner 意义的旧实现

这里的“删除旧实现”不是可选清理项，而是本次迁移的一部分。

只要满足下面任一条件，就应默认删除或重构，而不是挂着不动：

- 该实现已经被 SDK 完整替代
- 该实现只剩一层无意义薄转发
- 该实现只是为了旧结构存活而保留的胶水代码
- 该兼容层已经没有真实消费方

### 13.2 为什么不直接全量替换调用点

因为 UI 当前已经有较多模块依赖 `shared/lib/api` 的导出形态。

直接全量替换容易带来：

- 迁移面过大
- 风险扩散
- 评审难度上升

先把 owner 收到 SDK，再逐步瘦身 UI 适配层，路径更稳，也更符合当前项目演进。

## 14. 验收标准

当本设计实现完成后，必须满足以下条件，才算 SDK 设计真正落地：

1. `@nextclaw/client-sdk` 覆盖当前前端正在使用的全部后端能力
2. `packages/nextclaw-ui/src/shared/lib/api` 内部不再维护独立请求 owner
3. `apps/companion` 通过 SDK 访问后端，而不是直调 request / websocket
4. UI 现有 local / remote transport 语义不退化
5. multipart 附件上传能力进入 SDK 正式 contract
6. stream 能力进入 SDK 正式 transport contract
7. 新增前端能力时，默认先进入 SDK
8. 不产生第二套平行 contract types
9. `packages/nextclaw-ui` 已有真实模块通过 SDK 工作，而不是只有 SDK 包本身完成
10. `apps/companion` 已通过 SDK 工作，而不是继续保留平行访问层
11. 因 SDK 接入而失去 owner 意义的旧访问层、重复胶水、无效兼容代码已被积极删除或收口，而不是继续滞留

## 14.1 本次交付的通过线

本次工作只有同时满足下面四组条件，才算验收通过：

1. **SDK 完整**
   - `@nextclaw/client-sdk` 覆盖当前前端真实使用面
   - transport / realtime / upload / domain services 全部到位

2. **真实接入**
   - frontend 已开始真实通过 SDK 访问后端
   - companion 已真实通过 SDK 访问后端

3. **owner 收口**
   - SDK 成为唯一正式 client contract owner
   - UI 的 `shared/lib/api` 退化为薄适配层
   - 不再新增新的前端直调 API owner

4. **行为与结构都不退化**
   - UI 与 companion 行为不退化
   - local / remote / realtime / upload 不退化
   - 代码组织符合当前目录治理规范
   - 迁移后代码比迁移前更收敛、更少、更清晰，而不是新增一层 SDK 后旧垃圾继续原样堆着

## 15. 验证要求

只要开始实现本设计，收尾至少要包含：

- `@nextclaw/client-sdk` 的 `tsc`
- `@nextclaw/client-sdk` 的测试
- `packages/nextclaw-ui` 的 `tsc`
- `apps/companion` 的 `tsc`
- 相关行为的定向冒烟

定向冒烟至少覆盖：

1. UI 通过 SDK 正常读取 agent / session / config 等基础能力
2. UI 的 realtime 订阅在 local / remote 模式下都不退化
3. companion 通过 SDK 正常展示运行中 session 对应的 agent 信息
4. session 附件上传链路在 SDK 接入后保持可用

## 16. 明确拒绝的设计

以下设计方向明确拒绝：

### 16.1 “SDK 只是 fetch helper”

拒绝原因：

- 无法承载 UI 的 runtime-aware transport
- 会把环境差异硬编码进 SDK 内部实现

### 16.2 “每个前端各维护一套 API 层，再共享少量工具”

拒绝原因：

- contract 漂移不可避免
- realtime / 错误模型 / 上传链路会重复

### 16.3 “SDK 里顺手做 React hooks / query 封装”

拒绝原因：

- 会把 client contract 和 UI 框架层揉在一起
- companion / 非 React 场景无法自然复用

### 16.4 “为附件单独抽一个 attachments 顶层领域”

拒绝原因：

- 当前附件能力本质上属于 session 领域
- 会制造一个伪领域，增加心智负担

### 16.5 “继续保留 UI API 与 SDK 双 owner”

拒绝原因：

- 这会让迁移永远收不拢
- 未来任何 API 演进都会变成双写维护

## 17. 本设计的最终判断

这套方案的关键不在于“把现有请求代码搬进另一个包”，而在于：

1. 正式确立 `@nextclaw/client-sdk` 作为唯一 client contract owner
2. 用 transport 抽象承接不同运行环境差异
3. 用领域 service 维持清晰、稳定、可审的访问边界
4. 把 UI、companion、desktop 都收敛到同一访问模型上

如果这四点成立，那么它会是一个：

- 简洁的设计
- 长期稳定的设计
- 可维护的设计
- 能持续支撑后续端形态扩展的设计

如果这四点不成立，那它就只会是一次名字更好看的 API 搬运。
