# 统一事件流入口 Principal 鉴权设计

## 背景

当前 NextClaw 的事件流通道存在一个职责错位：

- UI 浏览器通过 `/ws` 接收 runtime 事件，鉴权使用 `UiAuthService.isSocketAuthenticated`，凭 `nextclaw_ui_session` cookie 判断是否登录。
- channel extension 也通过 extension SDK 连接同一个 `/ws`，用于接收 `extension.request`、`ncp.event` 等事件流事件。
- extension 的 HTTP ingress 已经使用 `NEXTCLAW_EXTENSION_TOKEN`，例如 `extension.channel.message.submit` 会走 bearer token 校验。
- 但 extension 的 WebSocket 连接当前没有 UI cookie。当 `ui.auth.enabled=true` 时，extension socket 会被 UI auth 拒绝。

这导致一条链路被拆成两套认证语义：

```text
extension -> /webhook -> extension token -> accepted
extension -> /ws      -> UI cookie        -> rejected when UI auth is enabled
```

表层症状是微信 channel extension 在 UI auth 开启时可能收不到回包、auth capability request 或 outbound request；结构性根因是事件流入口把“连接是不是浏览器 UI”当成了唯一认证模型。

## 产品原则

NextClaw 的上位目标是成为 AI 时代的个人操作层，关键原则包括统一入口、能力编排和生态扩展。这个问题不应通过“给 extension 单独开一个用户不可见入口”作为最终形态解决。

更符合愿景的原则是：

> 入口统一，主体归一，能力授权分流。

也就是说，连接方不需要感知“我是不是 extension”；连接层也不应该用 `isExtension` 这种产品角色分支来写死逻辑。系统只需要完成三件事：

1. 识别连接主体是谁。
2. 归一化为统一 principal。
3. 按 principal 的能力和作用域决定能接收哪些事件流事件。

## 设计目标

- 保留单一事件流入口 `/ws`，符合“统一入口”的产品心智。
- 不再把 `/ws` 顶层鉴权绑定到 UI cookie。
- 支持多种凭证来源：UI cookie、extension bearer token，未来可扩展 remote connector token、service app token 等。
- 连接注册后不关心调用方是不是 extension，只关心 principal 的 grants/scopes。
- 事件投递必须最小授权，避免 UI 与 extension 互相看到不属于自己的事件。
- 保持第一版轻量，不引入完整 RBAC/policy engine。

## 非目标

- 不在本阶段重做所有 HTTP ingress 鉴权。
- 不要求 channel extension 获取 UI cookie。
- 不把 extension socket 拆到 `/extension/ws` 作为最终推荐路径。
- 不引入复杂权限表达式、数据库持久化 principal 或多租户策略引擎。

## 当前证据

- UI auth 配置字段定义在 `packages/nextclaw-core/src/features/config/configs/schema.ts` 的 `ui.auth.enabled / username / passwordHash / passwordSalt`。
- `/api/*` 保护逻辑在 `packages/nextclaw-server/src/app/router.ts`，只有 `/api/health`、`/api/runtime/bootstrap-status`、`/api/auth/*` 默认放行。
- `/ws` upgrade 目前在 `packages/nextclaw-server/src/app/server.ts` 中调用 `authService.isSocketAuthenticated(request)`。
- `UiAuthService.isSocketAuthenticated` 只读取 cookie session。
- extension 子进程启动时由 `ExtensionLifecycleService` 注入 `NEXTCLAW_EXTENSION_ID`、`NEXTCLAW_EXTENSION_ENDPOINT`、`NEXTCLAW_EXTENSION_TOKEN`。
- extension SDK 的 HTTP ingress 已经用 `Authorization: Bearer <token>`。

## 推荐方案

将 `isSocketAuthenticated` 从 boolean 判断升级为统一 principal 鉴权。主流程只接收统一的 `EventStreamPrincipal`，不暴露 `kind: "ui" | "extension"` 这类产品角色分支：

```ts
type EventStreamGrant =
  | "event-stream:ui-events"
  | "event-stream:extension-requests"
  | "event-stream:ncp-events"
  | "event-stream:config-events";

type EventStreamPrincipal = {
  principalId: string;
  grants: EventStreamGrant[];
  scopes: Record<string, string | string[]>;
};
```

认证器内部可以为了调试保留局部来源信息，但连接注册和事件投递统一依赖两个函数：

```ts
authenticateEventStreamPrincipal(request): EventStreamPrincipal | null
canStreamAppEventToPrincipal(principal, event): boolean
```

第一版不做完整 RBAC/policy engine，只保留最小必要三件事：`principalId` 表示是谁，`grants` 表示能做什么，`scopes` 表示能力范围。

## 链路设计

### 1. 连接认证

`/ws` upgrade 时不再直接调用 `UiAuthService.isSocketAuthenticated`，而是调用新的 event stream auth owner：

```text
IncomingMessage
  -> EventStreamAuthService.authenticate(request)
  -> EventStreamPrincipal | null
```

认证顺序建议：

1. 尝试 extension token：如果 bearer token 能由 extension runtime 校验，并且凭证与 extensionId 有绑定关系，返回 extension principal。
2. 尝试 UI cookie：如果 cookie session 有效，返回 UI principal。
3. 未来再追加 remote/service app 等 credential resolver。
4. 全部失败则 401。

先识别 extension credential 的原因是：当 `ui.auth.enabled=false` 或 UI auth 尚未配置时，`UiAuthService.isSocketAuthenticated` 会按“UI 入口公开”返回通过。如果先走 UI cookie，携带 extension token 的 socket 会被误归类为 UI principal，从而收不到 extension request。

注意：extension token 不应作为 query string 首选，避免日志和代理链路泄漏。优先考虑 header 或 websocket subprotocol；如果环境限制导致浏览器 WebSocket API 不支持自定义 header，extension SDK 是 Node 侧，可以使用 `ws` 支持的 header。

### 2. 连接注册

当前 `clients: Set<WebSocket>` 需要升级为保存 principal 的 registry：

```ts
type EventStreamClient = {
  socket: WebSocket;
  principal: EventStreamPrincipal;
};
```

`EventStreamClientRegistry` 负责：

- `add(socket, principal)`
- `remove(socket)`
- `publish(event)`
- `closeAll()`

这个 owner 是完整职责对象：它持有连接状态，维护连接生命周期，并在发布时调用授权判断。

### 3. 事件投递

当前 `createUiEventPublisher` 对所有 client 广播。新模型应改为：

```text
eventBus event
  -> EventStreamClientRegistry.publish(event)
  -> canStreamAppEventToPrincipal(principal, event)
  -> socket.send(event)
```

第一版规则：

- UI principal：可接收现有 UI 需要的 app/runtime events。
- extension principal：只能接收 extension runtime 需要的事件。
  - `extension.request` 必须按 `payload.extensionId` 匹配 principal scope。
  - `ncp.event` 是否投递给 extension，需要保持现有 extension channel 语义；第一版不能把所有 NCP event 无差别发给所有 extension，至少要按现有 route/session/channel metadata 做可证明的最小过滤。如果无法证明目标 extension，应默认不投递。
  - `config.updated` 只投递 `channels` 或 `channels.<channelId>`，用于保留 SDK `channel.config.onChange` 的热更新语义；`extensions` 等其他配置更新不投递给 extension principal。

### 4. extension SDK 改造

`ExtensionTransportService.subscribe` 继续连接 `/ws`，但携带 extension runtime 凭证：

```text
NEXTCLAW_EXTENSION_ID
NEXTCLAW_EXTENSION_TOKEN
NEXTCLAW_EXTENSION_ENDPOINT
```

Node WebSocket 创建时建议传：

- `Authorization: Bearer <NEXTCLAW_EXTENSION_TOKEN>`
- `X-NextClaw-Extension-Id: <NEXTCLAW_EXTENSION_ID>`

如果保留浏览器兼容的 `NextClawExtensionWebSocketLike` 接口，需要让 SDK 的默认 Node 实现与测试 harness 能表达 header；浏览器侧 extension runtime 不是当前主场景，不作为第一优先级。

### 5. 保留 HTTP ingress token

HTTP `/webhook` 的 extension token 校验继续保留，不和 UI auth 合并。统一 event stream principal 不等于所有协议都走同一个认证实现；它只解决事件流连接入口的主体归一。

## 候选方案比较

### 方案 A：关闭 UI auth 或让 extension 伪装 UI cookie

优点：

- 几乎不改代码。
- 可以临时验证问题是否由 UI auth 引起。

缺点：

- 安全语义错误。
- extension 进程被伪装成人类 UI session。
- 不能作为产品设计沉淀。

结论：只适合本地排查，不作为修复方案。

### 方案 B：拆成 `/ws` 和 `/extension/ws`

优点：

- 工程边界清晰。
- UI 和 extension 互不影响。
- 认证逻辑直接。

缺点：

- 入口分裂，不符合“我不关心你是不是 extension，只要能认证通过”的统一入口理念。
- 未来 remote connector、service app 可能继续新增 endpoint。
- 产品心智和运行时心智会变成多入口。

结论：工程保守但产品理念偏弱，可作为备选，不是推荐。

### 方案 C：单 `/ws` + 多认证方式 + principal 授权

优点：

- 保持统一入口。
- extension、UI、未来 remote connector 都能接入同一事件流入口。
- 主流程不需要感知“是不是 extension”，只处理 principal。
- 权限边界集中在认证与投递授权 owner。

缺点：

- 比单纯放行 token 多一些 owner 和测试。
- 必须认真做事件过滤，否则会出现越权投递。
- 第一版需要梳理哪些 event 属于 UI、哪些属于 extension。

结论：推荐方案。

### 方案 D：extension 改轮询

优点：

- 避开 WebSocket 鉴权问题。

缺点：

- 延迟、资源、语义都差。
- 不适合 stream、typing、outbound request。
- 背离 event stream 设计方向。

结论：不推荐。

## 推荐落地步骤

### 第一步：引入 principal 认证 owner

新增 `EventStreamAuthService` 或等价 owner，职责是把 `IncomingMessage` 认证为 `EventStreamPrincipal`。

它可以直接持有：

- `UiAuthService`
- extension runtime token/provider

上层只传 `request`，不在 server upgrade 主流程里拼装 token、cookie、extensionId 等中间事实。

### 第二步：升级 socket registry

把 `Set<WebSocket>` 替换为保存 principal 的 registry。不要在 `server.ts` 里堆事件过滤分支。

### 第三步：集中事件授权

新增 `canStreamAppEventToPrincipal(principal, event)`，第一版保持简单规则，并为 UI 与 extension 两类 principal 写测试。

### 第四步：SDK 携带 extension 凭证

extension SDK WebSocket 连接携带 `Authorization` 和 `X-NextClaw-Extension-Id`。

### 第五步：回归验证

最小验收：

- `ui.auth.enabled=false` 时，UI 与 extension socket 都能连接。
- `ui.auth.enabled=true` 且浏览器未登录时，UI `/ws` 仍然 401。
- `ui.auth.enabled=true` 时，携带 extension token 的 extension `/ws` 可以连接。
- 无效 extension token 被 401。
- `extension.request` 只投递给匹配 `extensionId` 的 extension principal。
- 微信 extension 的 inbound submit、NCP reply、auth capability request、outbound sendText 均能跑通。

## Owner 边界

### `UiAuthService`

继续只负责 UI 用户认证：

- setup/login/logout/password/enabled
- cookie session
- UI status

不负责 extension token，也不负责事件流事件投递授权。

### `EventStreamAuthService`

负责事件流连接主体识别：

- 从 request 中读取 credential。
- 委托 UI auth 或 extension runtime auth 校验。
- 返回统一 `EventStreamPrincipal`。

它不负责保存 socket，也不负责发送事件。

### `EventStreamClientRegistry`

负责连接生命周期与投递：

- 持有 socket/principal。
- 在 socket close 时清理。
- 发布事件时调用 authorizer。

它不负责认证，不读取 config，不读取 cookie。

### `EventStreamAuthorizer`

负责事件可见性：

- 根据 principal grants/scopes 判断能否接收 event。
- 第一版可以是纯函数，不需要独立 class。

## 代码组织与目录结构

第一版不新增跨包通用库，不把 event stream principal 抽进 `@nextclaw/shared`。原因是当前问题发生在 UI server 的 WebSocket 入口，且 principal 仍依赖 server 侧 `UiAuthService` 与 kernel extension runtime token。先放在 `packages/nextclaw-server` 内部，等 remote connector、service app runtime 等也复用同一模型时，再评估提升为共享模块。

推荐新增一个 server feature：

```text
packages/nextclaw-server/src/features/event-stream/
  index.ts
  types/
    event-stream-principal.types.ts
  services/
    event-stream-auth.service.ts
    event-stream-client-registry.service.ts
  utils/
    event-stream-authorizer.utils.ts
```

保留 `index.ts` 的原因是 feature root 需要给 `app/server.ts` 提供稳定边界；它只做导出聚合，不写业务逻辑。

### 文件角色

#### `types/event-stream-principal.types.ts`

纯类型文件，定义事件流主体与权限模型：

```ts
export type EventStreamGrant =
  | "event-stream:ui-events"
  | "event-stream:extension-requests"
  | "event-stream:ncp-events"
  | "event-stream:config-events";

export type EventStreamScopeValue = string | string[];

export type EventStreamPrincipal = {
  principalId: string;
  grants: EventStreamGrant[];
  scopes: Record<string, EventStreamScopeValue>;
};
```

第一版不建议在主类型中暴露 `kind: "ui" | "extension"`。如果调试需要，可以加只用于日志的 `debugLabel` 或在认证 service 内部保留局部 discriminated union，但投递授权不要依赖它。

#### `services/event-stream-auth.service.ts`

有状态/编排 owner，使用 `.service.ts` 是因为它持有稳定依赖并编排多种 credential resolver。职责：

- 从 `IncomingMessage` 读取 cookie、authorization header、extension id header。
- 委托 `UiAuthService` 判断 UI cookie。
- 委托 extension runtime token provider 判断 extension token。
- 返回统一 `EventStreamPrincipal | null`。

建议形状：

```ts
export type EventStreamAuthServiceDeps = {
  uiAuth: UiAuthService;
  extensionRuntimeAuth: {
    authenticateEventStreamCredential: (input: {
      extensionId: string | null;
      token: string | null;
    }) => ExtensionEventStreamAuthResult | null;
  };
};

type ExtensionEventStreamAuthResult = {
  extensionId: string;
};

export class EventStreamAuthService {
  constructor(private readonly deps: EventStreamAuthServiceDeps) {}

  authenticate = (request: IncomingMessage): EventStreamPrincipal | null => {
    return (
      this.authenticateExtension(request) ??
      this.authenticateUi(request)
    );
  };
}
```

这里不建议把 `extensionId`、token 解析塞在 `server.ts`。按 `information-expert`，credential 的读取和归一化属于 event stream auth owner。

注意：kernel 侧只返回 `ExtensionEventStreamAuthResult`，不返回 `EventStreamPrincipal`。server event stream feature 才是 principal 建模 owner，负责把 extension auth result 映射为：

```ts
{
  principalId: `extension:${result.extensionId}`,
  grants: ["event-stream:extension-requests", "event-stream:ncp-events", "event-stream:config-events"],
  scopes: {
    extensionIds: [result.extensionId],
    channelIds: channelsForExtension(result.extensionId),
  },
}
```

#### `services/event-stream-client-registry.service.ts`

有状态 owner，使用 `.service.ts` 是因为它持有 socket 集合并管理连接生命周期。职责：

- 保存 `EventStreamClient`。
- socket close 时删除连接。
- 发布事件时调用 authorizer。
- close 时关闭全部连接。

建议形状：

```ts
type EventStreamClient = {
  socket: WebSocket;
  principal: EventStreamPrincipal;
};

export class EventStreamClientRegistry {
  private readonly clients = new Set<EventStreamClient>();

  add = (socket: WebSocket, principal: EventStreamPrincipal): void => {
    const client = { socket, principal };
    this.clients.add(client);
    socket.on("close", () => this.clients.delete(client));
  };

  publish = (event: AppEventEnvelope): void => {
    for (const client of this.clients) {
      if (
        client.socket.readyState === WebSocket.OPEN &&
        canStreamAppEventToPrincipal(client.principal, event)
      ) {
        client.socket.send(JSON.stringify(event));
      }
    }
  };
}
```

`server.ts` 不再直接持有 `Set<WebSocket>`，避免入口文件同时承担 socket 状态 owner 和事件授权 owner。

#### `utils/event-stream-authorizer.utils.ts`

纯函数，使用 `.utils.ts`。职责：

- 判断 principal 是否能接收某个 event。
- 默认拒绝，显式 allow。
- 对 `extension.request` 按 scope 匹配目标 extension。

建议形状：

```ts
export function canStreamAppEventToPrincipal(
  principal: EventStreamPrincipal,
  event: AppEventEnvelope,
): boolean {
  if (event.type === "extension.request") {
    return hasGrant(principal, "event-stream:extension-requests") &&
      hasScopeValue(principal, "extensionIds", readExtensionRequestTarget(event));
  }
  if (event.type === "ncp.event") {
    const targetChannelId = readNcpEventTargetChannelId(event);
    return hasGrant(principal, "event-stream:ncp-events") &&
      hasScopeValue(principal, "channelIds", targetChannelId);
  }
  if (event.type === "config.updated") {
    const targetChannelId = readConfigUpdatedChannelId(event);
    return hasGrant(principal, "event-stream:config-events") &&
      (isAllChannelsConfigUpdate(event) ||
        hasScopeValue(principal, "channelIds", targetChannelId));
  }
  return hasGrant(principal, "event-stream:ui-events");
}
```

`readNcpEventTargetChannelId` / `readConfigUpdatedChannelId` 是示意函数。真实实现必须从现有 route/session/channel metadata 中得到可证明的目标 channel；如果无法证明目标 channel，应返回空并拒绝投递。后续如果 UI event 类型需要更精确，可以把 UI allowlist 显式化；第一版至少要保证 extension request 和 NCP event 不会广播给所有 extension。

credential 解析第一版先作为 `EventStreamAuthService` 的 private 方法保留，不单独拆 `event-stream-credential.utils.ts`。等 remote connector、service app token 等也复用同一套解析规则时，再抽出 utils，避免为一次性解析提前造文件。

## 旧代码整合与删改边界

这个方案不能做成“新增 event stream principal 旁路，同时旧 `/ws` boolean 鉴权继续存在”。那会形成平行实现，违反 `single-domain-owner`。落地时应明确替换、降级、保留和新增边界。

### 必须替换

`packages/nextclaw-server/src/app/server.ts` 当前承担了太多事件流通道职责，以下逻辑需要迁移或替换：

- `clients: Set<WebSocket>`：不应继续由 `server.ts` 直接持有，迁移到 `EventStreamClientRegistry`。
- `createUiEventPublisher(clients)`：替换为 `EventStreamClientRegistry.publish(event)`，由 registry 内部按 principal 授权过滤。
- `/ws` upgrade 中的 `authService.isSocketAuthenticated(request)`：替换为 `eventStreamAuth.authenticate(request)`。
- `wss.on("connection")` 中只保存 socket 的逻辑：改为保存 `socket + principal`。

替换后的主流程应只表达装配关系：

```text
request -> authenticateEventStreamPrincipal -> handleUpgrade -> registry.add(socket, principal)
eventBus event -> registry.publish(event) -> authorizer -> socket.send(event)
```

### 保留但降级

`UiAuthService.isSocketAuthenticated` 可以第一版保留，但它不再是 `/ws` 的顶层唯一入口判断。它只能作为 `EventStreamAuthService` 内部识别 UI cookie principal 的一个 helper。

后续如果要继续收敛命名，可以把它改成更窄的语义，例如：

```text
authenticateSocketUiSession
readValidUiSessionFromCookie
isUiCookieAuthenticated
```

但第一版不需要为了命名洁癖扩大改动面。关键是调用方向变化：`server.ts` 不再直接问 UI auth，而是问 event stream auth。

### 必须新增窄接口

`packages/nextclaw-kernel/src/services/extension-runtime.service.ts` 现在持有 runtime token。不要让 server event stream auth 直接读取 token 字段并自行比较；extension runtime owner 应提供窄接口，自己判断 token 和 extensionId 是否有效。

这个窄接口不能返回 server 的 `EventStreamPrincipal`，否则 kernel 会反向依赖 server 的事件流连接模型。kernel 只返回 extension 身份事实，server event stream auth 再映射为 principal。

推荐接口：

```ts
type ExtensionEventStreamAuthResult = {
  extensionId: string;
};

authenticateEventStreamCredential = (input: {
  extensionId: string | null;
  token: string | null;
}): ExtensionEventStreamAuthResult | null => {
  if (!input.extensionId) {
    return null;
  }
  if (!this.isExtensionTokenValid(input.extensionId, input.token)) {
    return null;
  }
  return {
    extensionId: input.extensionId,
  };
};
```

`isExtensionTokenValid` 必须证明 token 与 extensionId 绑定，而不只是证明 token 等于某个全局 runtime token。推荐第一版就改为 per-extension token，或者至少维护 `extensionId -> token` 的运行期映射。只校验全局 token 加一个存在的 extensionId 不足够，因为任何拿到全局 token 的 extension 都可能伪造另一个 extensionId。

### 必须保留

以下旧链路不能因为引入 event stream principal 而删除：

- `/webhook` extension ingress token 校验：HTTP ingress 仍然需要独立校验。
- `/api/*` 的 UI auth middleware：它保护普通 UI API，不等于 event stream socket principal。
- `/api/auth/*` setup/login/logout/password/enabled：UI cookie principal 仍然由这条链路产生。
- extension SDK 的 HTTP `Authorization: Bearer <token>`：仍用于 submitMessage、config get、command execute、response ingress。

### SDK 必须整合

`packages/nextclaw-extension-sdk/src/services/extension-transport.service.ts` 的 `subscribe()` 需要继续连接统一 `/ws`，但必须携带 extension credential。否则 UI auth 开启时仍无法通过统一入口认证。

推荐：

```text
Authorization: Bearer <NEXTCLAW_EXTENSION_TOKEN>
X-NextClaw-Extension-Id: <NEXTCLAW_EXTENSION_ID>
```

如果 `webSocketFactory` 当前只能接收 URL，需要扩展 factory 类型以支持 headers。扩展时应保持旧测试 harness 可用，不要把 Node-only header 能力泄漏成浏览器 runtime 的假承诺。

### 必须补测试

旧测试中对 UI auth 的保护断言应保留，同时新增 principal 场景：

- `ui.auth.enabled=true` 且无 cookie 时，普通 `/ws` 仍返回 401。
- `ui.auth.enabled=true` 且带有效 extension token 时，`/ws` 可以连接。
- 无效 extension token 返回 401。
- `extension.request` 只投递给 scope 匹配的 principal。
- UI principal 不接收 extension-only request。
- extension principal 不接收 UI-only event。

### 不应做的兼容

- 不应让 extension 获取或复用 UI cookie。
- 不应在 `/ws` 主流程中写 `if extensionId` / `if sessionId` 分支。
- 不应让 `server.ts` 同时保留 `Set<WebSocket>` 和新的 registry。
- 不应让 authorizer 在多个文件里散落判断；第一版集中到 `event-stream-authorizer.utils.ts`。

## 现有文件调整

### `packages/nextclaw-server/src/app/server.ts`

保留 server 装配职责，但删除直接的 `clients: Set<WebSocket>` 与 `authService.isSocketAuthenticated(request)` 判断。

建议改为：

```text
startUiServer
  -> create UiAuthService
  -> create EventStreamAuthService
  -> create EventStreamClientRegistry
  -> gateway.appEventBus.subscribeAll(registry.publish)
  -> attachUiSocketServer(httpServer, eventStreamAuth, registry)
```

`attachUiSocketServer` 仍可留在 `server.ts`，因为它是 HTTP server 装配细节；但里面只做：

1. pathname 是不是 `/ws`
2. `eventStreamAuth.authenticate(request)`
3. 成功则 `registry.add(ws, principal)`
4. 失败则 401

### `packages/nextclaw-server/src/features/auth/services/ui-auth.service.ts`

建议保留 `isRequestAuthenticated`，但逐步减少对 `isSocketAuthenticated` 的直接使用。

第一版有两种选择：

- 保留 `isSocketAuthenticated` 作为 UI auth 内部能力，`EventStreamAuthService` 调用它生成 UI principal。
- 更干净地新增 `authenticateSocketRequest` 或 `authenticateRequestCookie`，返回 UI principal 所需的稳定身份事实。

推荐第一步保守：先保留 `isSocketAuthenticated`，由 `EventStreamAuthService` 包装成 principal；等后续重构 UI auth 时再收敛命名。

### `packages/nextclaw-kernel/src/services/extension-runtime.service.ts`

需要提供一个窄接口给 server 认证 extension token。不要让 `EventStreamAuthService` 直接读取 `ExtensionRuntimeService.token` 字段后自己比较。

推荐新增方法：

```ts
type ExtensionEventStreamAuthResult = {
  extensionId: string;
};

authenticateEventStreamCredential = (input: {
  extensionId: string | null;
  token: string | null;
}): ExtensionEventStreamAuthResult | null => {
  if (!input.extensionId) {
    return null;
  }
  if (!this.isExtensionTokenValid(input.extensionId, input.token)) {
    return null;
  }
  return {
    extensionId: input.extensionId,
  };
};
```

`isExtensionTokenValid` 可以由 `ExtensionRuntimeService` 在启动 extension 时生成 per-extension token，并传给 `ExtensionLifecycleService.startAll/start` 注入子进程环境。这样 `NEXTCLAW_EXTENSION_TOKEN` 仍然存在，但它不再是所有 extension 共享的全局 token，而是当前 extension 进程自己的 token。

### `packages/nextclaw-extension-sdk/src/services/extension-transport.service.ts`

`subscribe` 创建 WebSocket 时携带凭证：

```text
Authorization: Bearer <token>
X-NextClaw-Extension-Id: <extensionId>
```

如果当前 `webSocketFactory` 类型只接收 URL，需要扩展为：

```ts
webSocketFactory?: (
  url: string,
  options?: { headers?: Record<string, string> },
) => NextClawExtensionWebSocketLike;
```

测试 harness 同步适配。默认 browser `globalThis.WebSocket` 不支持 header 时，可以 fallback 到现有单参数构造；Node extension runtime 应优先提供可带 header 的实现。

## 不建议的组织方式

- 不建议新增 `contracts/`：principal 类型不是跨包协议合同，当前放 `types/` 足够。
- 不建议新增 `handlers/`：WebSocket upgrade 装配可以留在 `server.ts`，复杂度不够支撑新角色。
- 不建议把 authorizer 写成 `.service.ts`：第一版是纯函数，无状态、无生命周期，应放 `utils/`。
- 不建议在 `auth/` feature 里塞 extension token：UI auth feature 的领域是人类 UI 登录，不应扩张为所有 event stream principal 认证。
- 不建议把 event stream principal 放进 `@nextclaw/shared`：还没有跨 package 稳定复用压力，提前提升会扩大公共 API。

## 测试组织

推荐新增或调整测试：

```text
packages/nextclaw-server/src/features/event-stream/tests/
  event-stream-auth.service.test.ts
  event-stream-client-registry.service.test.ts
  event-stream-authorizer.utils.test.ts

packages/nextclaw-server/src/app/
  server-event-stream.test.ts

packages/nextclaw-extension-sdk/src/
  extension-sdk.test.ts
```

测试重点：

- UI auth disabled 时，UI principal 可以建立。
- UI auth enabled 且无 cookie 时，普通 `/ws` 被拒绝。
- extension token 有效时，即使 UI auth enabled 也能建立 principal。
- extension token 无效时被拒绝。
- extension A 的 token 不能认证为 extension B 的 principal。
- `extension.request` 只投递给 scope 匹配的 principal。
- 没有可证明目标 extension 的 `ncp.event` 不投递给 extension principal。
- SDK WebSocket subscribe 带上 token 与 extension id。

## 设计原则映射

- `single-domain-owner`：UI 认证、event stream principal 认证、socket 生命周期、事件授权各自只有一个 owner。
- `information-expert`：cookie session 仍由 `UiAuthService` 判断；extension token 由 extension runtime owner 提供事实；socket registry 只维护连接事实。
- `responsibility-surface-minimization`：`/ws` upgrade 主流程只关心 authenticate/register，不理解 extension 业务。
- `abstraction-calibration`：新增 principal 不是包装层，它消除的是 UI cookie 与 extension token 在同一入口下的权限冲突。
- `ownership-topology`：server event stream owner 持有 socket registry，kernel extension runtime owner 提供 extension token 校验能力，二者通过明确方法协作。

## 风险与缓解

- 风险：事件过滤不完整导致 extension 收到 UI 事件。
  - 缓解：先默认拒绝，显式 allow event type；为 `extension.request` 做 extensionId 匹配测试。
- 风险：extension token 与 extensionId 没有强绑定，导致持有 token 的 extension 冒充其它 extension。
  - 缓解：第一版就使用 per-extension token 或运行期 `extensionId -> token` 映射；kernel 只返回 extension auth result，server 再映射 principal。
- 风险：NCP event 缺少可证明的目标 extension，导致为了跑通回包而广播过宽。
  - 缓解：`ncp.event` 默认拒绝；只有能从 route/session/channel metadata 推导目标 extension 且 scope 匹配时才投递。
- 风险：SDK WebSocket header 在某些 runtime 不可用。
  - 缓解：当前 extension 是 Node 子进程，优先支持 Node；浏览器 runtime 后续单独设计。
- 风险：`server.ts` 膨胀。
  - 缓解：只在 `server.ts` 组合 owner，不放认证细节和投递规则。
- 风险：过早引入复杂 RBAC。
  - 缓解：第一版使用小 principal 数据对象和集中 authorizer，等主体类型增加后再演进更完整的 policy model。

## 决策

推荐采用方案 C：

> 单一 `/ws`，统一认证为 principal，按 principal grants/scopes 做事件投递授权。

这比拆 endpoint 更符合 NextClaw 的统一入口愿景；也比简单地让 `/ws` 同时接受 cookie/token 更稳，因为它把“认证通过”升级为“主体被识别且能力被授权”。

## 待确认问题

- per-extension token 应由 `ExtensionRuntimeService` 直接管理，还是拆出只服务 extension runtime 的 token store？
- extension WebSocket 是否必须支持 reconnect 后补发 missed request，还是仍按当前 event-stream best-effort 模型？
- `ncp.event` 投递给 extension 时，是否需要按 channel/session route 做更细 scope，还是第一版按 extensionId/request 过滤即可？
