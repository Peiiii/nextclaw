# Panel App Client SDK 注入链路设计

## 背景

Panel App 目前已经能通过既有 bridge 触发一部分 NextClaw 能力，例如 service action、agent send、generate object。这证明 Panel App 作为 NextClaw 内嵌应用形态，已经具备接入平台能力的基础。

但当前讨论的目标不是替换旧 bridge，也不是让每个 Panel App 自行安装、打包或 import `@nextclaw/client-sdk`。我们希望新增一条更轻量的能力接入路径：宿主在 Panel App 运行环境中注入标准 Client SDK 实例，让 Panel App 可以直接通过既有 namespace 获取已初始化的 client。

这条链路服务 NextClaw 的统一入口与能力编排愿景：Panel App 不应成为孤立网页，而应能自然调用 NextClaw 已有能力；同时平台不应为了每个 App 复制一套业务 API proxy。

## 已确认结论

### 不破坏旧链路

现有 Panel App bridge、postMessage 请求、service action 调用、agent send、generate object 等能力先全部保留。

本方案只新增能力入口，不做迁移、不删旧 API、不重命名旧 namespace。旧 postMessage bridge 的用户侧调用表面和 response 语义保留；内部 request payload 可以为统一 runtime token 做必要改造。

### 在既有 namespace 上追加 client

如果当前 Panel App 已经存在一个宿主注入对象或 namespace，则新能力应挂在这个既有对象上，而不是另建平行入口。

概念形态：

```ts
window.nextclaw.client
```

这里的 `nextclaw` 代表现有宿主注入对象；如果实际代码中对象名不同，应以现有对象为准。

### client 同步可用

`window.nextclaw.client` 必须同步可用。Panel App 自己的脚本执行时，可以直接读取并使用：

```ts
const client = window.nextclaw.client;
```

因此第一版不采用 `window.nextclaw.ready`、`await window.nextclaw.getClient()` 或 postMessage 异步创建 client 的合同。异步加载失败可以导致 client 不可用错误，但成功路径中，Panel App 读 `window.nextclaw.client` 不应等待。

### client 是标准 Client SDK 实例

`window.nextclaw.client` 应尽量就是标准 `NextClawClient` 实例，而不是一套“看起来像 client、实际由宿主手写转发”的 proxy。

如果 Panel App 获得 client 使用权限，则这个 client 就应作为完整标准 client 使用。第一版不做 API 裁剪、不做 per-method 授权、不做 endpoint 白名单，也不在服务端为 injected client 单独维护一套“哪些 SDK 方法可用”的映射表。

Panel App 可以选择直接链式调用：

```ts
await window.nextclaw.client.panelApps.sendAgentMessage(...);
```

也可以按自己的代码风格先取局部变量：

```ts
const client = window.nextclaw.client;

await client.panelApps.sendAgentMessage(...);
await client.serviceApps.invokeServiceAction(...);
```

这是 Panel App 自己的使用方式选择，不应影响平台 contract。

### 宿主职责保持克制

宿主不应该因为这条链路而变成所有 SDK 方法的业务代理。宿主主要负责：

- 注入 SDK 脚本或可用的 SDK runtime；
- 创建并配置标准 `NextClawClient` 实例；
- 将实例追加到既有 namespace；
- 提供必要的运行上下文，例如 API base 和 panel app runtime token；
- 保持旧 bridge 行为不变。

Client SDK 仍然是 API 调用 owner；服务端仍然是身份、权限、审计与风险控制 owner。

## 推荐第一版范围

第一版只验证“标准 Client SDK 实例可以被注入并使用”，不扩展新的业务 API 表面。

建议成功标准：

- Panel App 页面加载后，旧 namespace 仍然存在；
- 旧 bridge 功能不受影响；
- `window.nextclaw.client` 存在；
- `client` 使用标准 Client SDK 类型和方法形态；
- `client` 已配置好调用 NextClaw 服务所需的基础参数；
- Panel App 可以零 import 调用一个现有 SDK 方法；
- client 使用权限不存在或失效时，能得到明确错误或明确的不可用状态。

## 权限方向

权限机制采用整体授权模型，不拆 client 内部能力。

已确认原则：

- 是否允许使用 injected client，是一个整体授权问题；
- 授权后，`window.nextclaw.client` 是完整标准 `NextClawClient` 实例；
- 不对 client 内部每个 API 做单独授权；
- 不按 endpoint / method 对 injected client 做额外裁剪；
- 不新增 `window.nextclaw.permissions.request()` 这类 Panel App 专属权限 API；
- 不把现有 service action / agent capability 的旧 bridge 权限模型扩展成 injected client 的通用细粒度权限模型。

因此第一版权限问题只回答：

```text
这个 Panel App 是否允许获得完整 injected client？
```

如果允许，则挂载完整 client；如果不允许，则不挂载 client，或挂载一个会返回明确不可用错误的占位对象。

## 推荐方案

### 初始化方式

推荐第一版使用标准 `NextClawClient` 初始化，不修改 Client SDK 构造函数。

概念形态：

```ts
const client = new NextClawClient({
  baseUrl,
  headers: {
    "x-nextclaw-panel-bridge-session": runtimeToken,
  },
});

window.nextclaw.client = client;
```

理由：

- 复用现有 Client SDK；
- 复用现有 panel bridge session header；
- 实现最小，不需要先引入 transport 抽象改造；
- 能尽快验证 Panel App 零 import 使用标准 client。

中期可再评估是否改成 scoped transport：

```ts
const client = new NextClawClient({
  baseUrl,
  transport: panelAppClientTransport,
});
```

transport 的价值主要是隐藏 token、统一错误包装和未来做更复杂的宿主协调；但第一版不必为了未来能力提前加重实现。

## 具体实现方案

### 主链路

因为 `window.nextclaw.client` 已拍板同步可用，推荐把 client 初始化前置到 Panel App HTML 响应期：

```text
UI 打开 Panel App
  -> iframe 加载 /api/panel-apps/:id/content
  -> server/kernel 读取 manifest
  -> 判断是否需要 injected client
  -> 创建 panel app runtime token session
  -> 注入 bridge script + client sdk bundle + client init script
  -> Panel App 自己的脚本开始执行
  -> window.nextclaw.client 已经存在
```

这比“Panel App 脚本启动后再 postMessage 请求宿主创建 client”更符合同步可用合同。

### 初始化数据

第一版初始化 client 需要的最小数据：

```ts
type PanelAppInjectedClientInit = {
  baseUrl: string;
  runtimeToken: string;
};
```

推荐 `baseUrl` 使用同源相对基准：

```ts
baseUrl: window.location.origin
```

Panel App 当前内容来自 NextClaw server 的 `/api/panel-apps/:id/content` 或 tokenized asset 路径，同源 baseUrl 能同时覆盖本地 UI、desktop、远程访问和 dev proxy 下的 API 请求。

`runtimeToken` 用作标准 client 默认 header。为复用现有服务端 header，第一版仍使用当前 header 名：

```ts
new NextClawClient({
  baseUrl: window.location.origin,
  headers: {
    "x-nextclaw-panel-bridge-session": runtimeToken,
  },
});
```

第一版不额外挂出 token 字段；token 只进入初始化脚本闭包和 client headers。

### runtime token 创建

为满足同步可用，推荐新增一条 server/kernel 内部创建路径，而不是复用当前 UI 侧首次 postMessage 时才创建 session 的路径。

当前已有：

```ts
PanelAppManager.createPanelAppBridgeSession({ id, tabId })
```

推荐改造为更语义化的方法：

```ts
createPanelAppRuntimeTokenSession(params: {
  appId: string;
  declaredCapabilities: string[];
  declaredActions: string[];
  clientDeclared: boolean;
}): PanelAppRuntimeTokenSession
```

`tabId` / `iframeInstanceId` 不是必要语义，不进入新设计；既不作为授权字段，也不作为 debug 字段保留。token 的核心职责是让服务端可信解析 appId。

推荐数据结构：

```ts
type PanelAppRuntimeTokenSession = {
  id: string;
  token: string;
  appId: string;
  caller: {
    surface: "panel-app";
    appId: string;
  };
  declaredActions: string[];
  declaredCapabilities: string[];
  clientDeclared: boolean;
  createdAt: string;
  expiresAt: string;
};
```

这里的 `id` 是 runtime token session 自身的记录 id；Panel App 身份字段必须显式命名为 `appId`。

第一版可以继续复用当前内存 map 形态，但 owner 语义应从 `bridgeSessions` 收敛为 runtime token session store：

```text
token -> PanelAppRuntimeTokenSession
```

已确认：第一版就统一成一个 Panel App runtime / bridge token，不再为 injected client 和旧 bridge 分别创建两条 session，也不做 token 懒创建。

每次 `/api/panel-apps/:id/content` 响应期都会为该 appId 创建一个 runtime token：

```text
appId
  -> one runtime token for this content response
  -> window.nextclaw.client 使用它
  -> 旧 window.nextclaw.serviceActions / window.nextclaw.agent 也使用它
```

`panel-app.json` 里的 client 声明只决定是否挂出完整 `window.nextclaw.client`，不决定是否创建 token。token 不是授权记录；它只用于让服务端可信地把请求归因到 appId。

推荐策略：

```text
未声明 client:
  创建 token
  注入旧 bridge
  不注入 window.nextclaw.client

声明 client:
  创建 token
  注入旧 bridge
  若 appId 已有持久 client grant，则注入 window.nextclaw.client
  若 appId 没有持久 client grant，则不注入 client
```

因此旧 UI bridge manager 中“收到 postMessage 后懒创建第二个 bridge session”的链路不再必要，应删除或改造成仅使用已注入 token 的路径。

### appId 与授权模型

用户授权对象是 Panel App 应用身份，不是 tab、iframe、PID 或 token。

推荐模型：

```text
runtime token:
  临时凭证，只用于可信解析 appId。

client grant:
  持久授权，绑定 appId。

service action / agent grants:
  既有持久授权，也绑定 appId。
```

`panel-app.json.id` 是推荐的稳定 appId 来源；如果缺省，才 fallback 到 folder name。由于授权绑定 appId，后续如果 appId 改变，应视为另一个应用，不能继承旧授权。

client 整体授权建议新增独立持久化记录：

```text
workspace/panels/.panel-app-client-grants.json
```

概念结构：

```ts
type PanelAppClientGrant = {
  appId: string;
  grantedAt: string;
};
```

打开声明了 `client: true` 的 app 时：

```text
若 appId 已有 client grant:
  注入完整 window.nextclaw.client

若 appId 没有 client grant:
  Apps / Panel Apps 层先触发整体授权确认
  用户允许后写入持久 client grant
  后续 content 响应期同步注入 client
```

由于 `window.nextclaw.client` 必须同步可用，推荐授权交互发生在打开 Panel App 之前或 Apps 面板层，而不是 iframe 原始脚本执行后再异步补 client。

### manifest 声明

已确认：单文件 HTML Panel App 不再作为后续支持和维护对象。本方案不为单文件 HTML 设计 injected client 声明，也不新增或维护 HTML meta 声明路径。

推荐第一版只通过 folder Panel App 的 `panel-app.json` 显式声明需要 injected client：

```json
{
  "client": true
}
```

对应扩展 `PanelAppManifest`：

```ts
export type PanelAppManifest = {
  id?: string;
  title?: string;
  description?: string;
  icon?: string;
  entry?: string;
  capabilities: string[];
  serviceActions: string[];
  client: boolean;
};
```

未声明时，第一版不注入 `window.nextclaw.client`。旧 bridge 仍照常注入。

### 脚本组织

推荐拆成三个脚本责任，而不是把所有逻辑堆进现有 `getPanelAppBridgeScript()` 字符串：

```text
packages/nextclaw-kernel/src/utils/panel-app-bridge.utils.ts
  继续负责旧 window.nextclaw.serviceActions / window.nextclaw.agent bridge

packages/nextclaw-kernel/src/utils/panel-app-client-injection.utils.ts
  负责生成 client init inline script

packages/nextclaw-server/src/features/panel-apps/controllers/panel-apps.controller.ts
  新增 /api/panel-app-client-sdk.js 路由，返回 browser bundle

packages/nextclaw-service/src/shared/utils/panel-app-client-sdk-script.utils.ts
  读取已安装 @nextclaw/client-sdk 的 browser bundle，并通过 router option 交给 server route
```

注入后的 HTML 结构概念上是：

```html
<script src="/api/panel-app-client-sdk.js"></script>
<script>
  (() => {
    const existing = window.nextclaw && typeof window.nextclaw === "object" ? window.nextclaw : {};
    const client = new window.NextClawClient({
      baseUrl: window.location.origin,
      headers: {
        "x-nextclaw-panel-bridge-session": "...server issued token..."
      }
    });
    Object.defineProperty(window, "nextclaw", {
      configurable: true,
      value: {
        ...existing,
        client
      }
    });
  })();
</script>
<script>
  // existing panel-app bridge script
</script>
```

实际注入顺序要确保旧 bridge 不覆盖 `client`。现有旧 bridge 已经读取 `existing` 并 spread，因此只要继续保持这个模式，顺序可以是 client init 在旧 bridge 前或后；推荐顺序是：

```text
client sdk bundle
client init script
old bridge script
Panel App 原始脚本
```

这样 Panel App 原始脚本执行前，`window.nextclaw.client` 和旧 bridge 字段都已存在。

### Client SDK browser bundle

`@nextclaw/client-sdk` 当前是 ESM 包。为了在任意 Panel App HTML 中零 import 使用，需要提供浏览器全局 bundle。

推荐新增构建产物：

```text
packages/nextclaw-client-sdk/dist/browser/browser-global-registration.utils.iife.js
```

全局名：

```ts
window.NextClawClient
window.NextClawClientError
```

推荐在 `@nextclaw/client-sdk` 内新增 build target，而不是在 server 或 kernel 手写一个迷你 client。这样 `window.nextclaw.client` 仍来自标准 Client SDK。

server 包不直接依赖 `@nextclaw/client-sdk`，避免形成不必要的反向依赖；service 宿主负责读取已安装包产物并注入给 router。

服务端新增静态脚本路由：

```text
GET /api/panel-app-client-sdk.js
```

它读取并返回 browser bundle，headers：

```text
content-type: application/javascript; charset=utf-8
cache-control: no-store
```

第一版也可以先内联 bundle 内容，但不推荐长期这样做，因为会让 Panel App content 响应过大，也不利于后续缓存策略。

### 代码 owner

推荐 owner 分工：

- `PanelAppManager`：Panel App 事实 owner。读取 manifest、决定是否需要 injected client、创建 runtime token session、组装 content HTML。
- `panel-app-manifest.utils.ts`：声明解析 owner。新增 `client` 字段解析，不承担注入。
- `panel-app-client-injection.utils.ts`：HTML 注入 owner。只负责把 SDK script 和 init script 插入 HTML，不读取文件系统、不创建 session。
- `PanelAppsRoutesController`：HTTP 边界 owner。新增 browser bundle route，继续把 content 响应交给 manager。
- `@nextclaw/client-sdk`：标准 client owner。新增 browser global build，不知道 Panel App 业务。

### 生命周期和过期

第一版采用比旧 bridge 更长的运行时 token TTL：

```text
expiresAt = createdAt + 24h
```

重新请求 content 会获得新的 runtime token。

第一版可以不立即删除 runtime token session，依赖过期清理。runtime token 过期不代表用户授权过期；过期后应通过重新加载 content 获取新 token，不能要求用户重新授权。

### 错误形态

如果 Panel App 未声明 client：

```ts
window.nextclaw.client === undefined
```

如果声明了 client 但 SDK bundle 加载失败：

```ts
window.nextclaw.client === undefined
window.nextclaw.clientError = { code: "PANEL_APP_CLIENT_SDK_LOAD_FAILED", message: "..." }
```

是否引入 `clientError` 还可讨论；第一版也可以只在 console error 中披露，避免扩大 namespace 合同。我的推荐是不把 `clientError` 做成公开合同，测试里只验证旧 bridge 不受影响。

### 与旧 bridge 的关系

旧 bridge 的使用表面继续保留：

```ts
window.nextclaw.serviceActions
window.nextclaw.agent
```

但旧 bridge 的 token 创建链路应收敛到新的单 token 模型。

推荐实现：

```text
/api/panel-apps/:id/content
  -> 创建唯一 runtime token
  -> 注入 client init script，client headers 使用该 token
  -> 注入旧 bridge script，bridge request 闭包内也持有该 token

window.nextclaw.serviceActions.invoke(...)
  -> postMessage payload 携带 runtimeToken
  -> UI PanelAppBridgeManager 使用该 token 调 nextclawClient
  -> 不再调用 createBridgeSession 创建第二个 token
```

也就是说，旧 bridge manager 仍然负责：

- 接收 iframe postMessage；
- 校验消息来源是否为当前 iframe；
- 执行旧 serviceActions / agent 的授权确认和调用；
- 把结果 postMessage 回 iframe。

但它不再负责：

- 为当前 iframe 懒创建 bridge session；
- 缓存 `iframeInstanceId + panelAppId -> session promise`；
- 在旧 bridge 调用时制造第二个 token。

这不是删除旧 bridge 能力，而是删除旧 bridge 中不再必要的 session 创建分支。旧能力表面保留，底层 runtime context 收敛为同一个 token。

### PanelAppBridgeManager 删除清单

`packages/nextclaw-ui/src/features/panel-apps/managers/panel-app-bridge.manager.ts` 当前是旧 postMessage bridge 的 UI 侧 manager。统一 token 后，它不再是 bridge session 创建 owner。

实现时应删除或改造以下职责：

```text
删除:
  private readonly sessions = new Map<string, Promise<PanelAppBridgeSessionView>>();

删除或改造为不创建 session:
  getSession(...)
  readPanelAppId(...)
  createBridgeSession(...) 调用链

删除流程:
  iframeInstanceId + panelAppId -> session promise cache
  收到旧 bridge request 后懒创建 bridge session
  旧 bridge request 每次先 await getSession(params)
```

对应地，旧 bridge request 需要携带已注入的运行上下文：

```ts
type PanelAppBridgeRequest = {
  type: "nextclaw:panel-app-service-actions:request";
  requestId: string;
  appId: string;
  runtimeToken: string;
  method:
    | "agent.generateObject"
    | "agent.send"
    | "invoke"
    | "list"
    | "requestGrant"
    | "revokeGrant";
  payload?: {
    actionId?: string;
    input?: unknown;
    request?: unknown;
  };
};
```

旧 bridge request 可以携带 `appId` 作为 UI 授权弹窗的展示上下文，但服务端归因与授权判断必须以 `runtimeToken -> appId` 解析结果为准。也就是说，`appId` 不是信任凭证，不能替代 token。

保留职责：

```text
保留:
  handleIframeMessage(...)
  dispatchRequest(...)
  invokeWithAuthorization(...)
  sendAgentMessageWithAuthorization(...)
  generateAgentObjectWithAuthorization(...)
  confirmAndGrant(...)
  confirmAndGrantAgentCapability(...)
  postResponse(...)
  toBridgeError(...)
```

这些保留方法需要改成直接消费 request 中的 `runtimeToken`，不再消费 `PanelAppBridgeSessionView` 对象。

典型改造：

```ts
const runtimeToken = this.requireRuntimeToken(request);

await nextclawClient.serviceApps.invokeServiceAction(actionId, input, {
  bridgeSessionToken: runtimeToken,
});
```

授权确认改造：

```text
旧:
  confirmAndGrant(session, actionId, input)
  使用 session.panelAppId / session.token

新:
  confirmAndGrant({ runtimeToken }, actionId, input)
  grant/list/invoke 调用使用 runtimeToken
```

这样可以删除旧 manager 的 session cache 和懒创建分支，同时保留旧 bridge 的授权弹窗、错误归一化和 postMessage response 行为。

### client 授权策略

推荐第一版采用“声明 + 持久授权后注入完整 client”：

- folder Panel App 通过 `panel-app.json` 声明需要 injected client；
- 宿主解析声明后为该 Panel App 创建 runtime token；
- 若 appId 没有 client grant，Apps / Panel Apps 层先弹整体授权；
- 授权通过后持久化 appId 级 client grant；
- content 响应期把完整 client 追加到既有 namespace；
- 不做用户逐项确认，也不做 per-method 权限。

如果要更快验证，也可以先对本地 Panel App 默认注入，再在文档中明确“当前按可信本地 Panel App 处理”。但从产品和治理角度，声明式开关更利于后续演进。

### token 暴露

第一版可以接受 runtime token 作为 client 初始化内部材料，但不建议在 namespace 上额外挂出：

```ts
// 推荐
window.nextclaw.client

// 不推荐第一版额外挂出
window.nextclaw.runtimeToken
```

这不是因为 token 对 Panel App 绝对不可见，而是避免把 token 变成开发者主动依赖的公开合同。公开合同应是 `window.nextclaw.client`，token 只是初始化细节。

### 旧 bridge 兼容

旧字段继续保留：

```ts
window.nextclaw.serviceActions
window.nextclaw.agent
```

新增字段只追加：

```ts
window.nextclaw.client
```

实现时必须保留 existing namespace，不覆盖旧字段，不改变旧 postMessage bridge 的用户侧调用表面和 response 语义。

### 加载时机

已确认 `window.nextclaw.client` 同步可用。推荐让 HTML 注入层负责最终挂载，Client SDK bundle 作为独立脚本在 init script 前加载。

推荐形态：

```html
<script src="/api/panel-app-client-sdk.js"></script>
<script>
  // create window.nextclaw.client synchronously
</script>
<script>
  // existing bridge script
</script>
```

若 SDK 脚本加载失败，旧 bridge 仍应继续可用。重新请求 content 时会重新创建 runtime token。

### 类型体验

推荐提供一个 Panel App 开发者类型声明，而不是让开发者自己猜 namespace 形状。

概念形态：

```ts
import type { NextClawClient } from "@nextclaw/client-sdk";

declare global {
  interface Window {
    nextclaw: {
      client: NextClawClient;
      serviceActions?: unknown;
      agent?: unknown;
    };
  }
}
```

这个类型声明只描述注入合同，不新增运行时 API。

### Skill 更新原则

实现落地后，应同步更新 Panel App 创建相关 skill，让 AI 知道 injected client 的使用方式。但 skill 不应硬编码 Client SDK 的完整 API schema。

推荐写入 `panel-app-creator` / `nextclaw-app-creator` 的规则：

- Panel App 需要完整 Client SDK 时，在 `panel-app.json` 声明 `client: true`；
- 运行时通过 `window.nextclaw.client` 获取已初始化的标准 `NextClawClient` 实例；
- 不要让 Panel App 保存 runtime token、伪造 caller、伪造 appId 或直连内部 gateway；
- Client SDK API 形状以当前安装环境中的 `@nextclaw/client-sdk` NPM 包类型声明为准；
- skill 不复制 SDK 方法表、参数表或返回值表，避免随 SDK 演进失真；
- 需要确认方法、参数或返回值时，优先解析已安装的 `@nextclaw/client-sdk` 包，并读取其 `package.json` exports/types 指向的 `.d.ts` 或 dist 类型声明；
- 不假设用户机器上存在 NextClaw 源码仓库路径。

这让 skill 负责使用纪律和查找权威来源，SDK 包负责真实接口合同。

### 验证方式

第一版最小验证应覆盖：

- 旧 bridge 仍可调用；
- `window.nextclaw.client` 存在；
- `client` 能调用一个标准 SDK 方法；
- 未声明 client 的 Panel App 不会意外获得 client；
- 重新打开 Panel App 后 client 仍能初始化；
- runtime token 过期后重新加载 content 可获得新 token，且不要求重新授权；
- SDK 注入失败时不影响旧 bridge。

## 已落地决策

- manifest 字段采用 `client: true`。
- browser bundle 构建放在 `@nextclaw/client-sdk` 包内。
- server 暴露 `/api/panel-app-client-sdk.js`，但脚本内容由 service 宿主读取已安装 SDK 产物后通过 router option 注入。
- client grant 使用独立文件 `.panel-app-client-grants.json`。
- runtime token 只作为初始化闭包和请求 header 细节，不挂到 `window.nextclaw.runtimeToken`。
- client 初始化第一版使用标准 SDK headers，不提前引入 scoped transport。
- SDK bundle 加载失败第一版只 console error，不引入公开 `window.nextclaw.clientError` 合同。
- 旧 bridge manager 删除 session cache 和懒创建 session 链路，改用注入消息中的 runtime token。
- `tabId` / `iframeInstanceId` 不进入新 token/session/授权模型。

## 后续仍可讨论

- 类型声明如何提供给 Panel App 开发者，使 `window.nextclaw.client` 有完整 IDE 类型体验。
- 自行 import `@nextclaw/client-sdk` 的高级用法如何与注入 client 保持一致。
- 新注入链路稳定后，旧 bridge 是否、何时、如何降级为兼容层。

## 非目标

- 不删除旧 Panel App bridge 的用户侧能力表面；
- 不删除旧 postMessage method；
- 不把所有 SDK 方法映射成 `window.nextclaw.agent.*`、`window.nextclaw.actions.*` 等新表面；
- 不要求 Panel App 自己 import Client SDK；
- 不在本阶段做 client 内部 API 裁剪；
- 不在本阶段做 per-method / per-endpoint 授权；
- 不在本阶段做全新权限系统；复用现有授权弹窗完成 appId 级 client 整体授权；
- 不提前决定旧链路迁移时间表。

## 阶段性判断

当前最稳的方向是：

```text
旧 namespace / 旧 bridge 不动
在旧 namespace 上追加 client
client 是已初始化的标准 NextClawClient 实例
Panel App 可零 import 使用标准 SDK 能力
client 权限是整体授权；授权后完整 client 可用
第一版不做 API 裁剪、不做细粒度 capability、不做 endpoint 白名单
runtime token 总是在 content 响应期创建，只用于可信解析 appId
client 声明与持久 client grant 共同决定是否挂出 client
不做 token/session 懒创建
旧 bridge manager 的懒创建第二个 session 链路可以删除
```

这条路径能让 Pan App 轻量接入完整平台能力，同时避免宿主成为第二套 Client SDK。
