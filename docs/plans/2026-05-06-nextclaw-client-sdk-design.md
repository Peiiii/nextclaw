# NextClaw Client SDK Design

日期：2026-05-06

## 这份文档解决什么问题

这份文档定义 NextClaw Client SDK 的长期设计。

Client SDK 的目标不是新增后端能力，而是统一上层客户端访问 NextClaw 服务的方式。Desktop、Companion、Web UI、未来远程客户端都应该通过同一套 SDK 访问 session、agent、realtime 等现有 API。

## 目标

建立一个纯客户端 SDK：

```text
packages/nextclaw-client
```

它负责：

- base URL 配置
- auth / token / header
- session API 访问
- agent API 访问
- realtime stream / websocket / SSE 订阅
- request timeout / abort / reconnect
- local / remote endpoint 差异
- 统一错误形态和响应类型

它不负责：

- 新增 server API
- 判断 Companion 应显示哪个 session
- 判断 Desktop 应显示哪个页面
- 承载 React hook
- 承载 Electron 行为
- 吞掉 server contract 的真实错误

## 基本使用形态

```ts
const client = createNextClawClient({
  baseUrl: "http://127.0.0.1:12345",
  token,
});

const sessions = await client.sessions.list();
const agents = await client.agents.list();

const subscription = client.sessions.subscribe({
  sessionId: "session-id",
  onEvent: (event) => {
    // client decides how to render the event
  },
});
```

远程形态只改变连接配置：

```ts
const client = createNextClawClient({
  baseUrl: "https://remote.nextclaw.com/instances/instance-id",
  token,
});
```

## 模块职责

```text
packages/nextclaw-client/src/
  client.ts
  services/
    session-client.service.ts
    agent-client.service.ts
    realtime-client.service.ts
    request.service.ts
  types/
    client-options.types.ts
    session-client.types.ts
    agent-client.types.ts
    realtime-client.types.ts
    client-error.types.ts
  utils/
    url.utils.ts
    request-error.utils.ts
```

角色说明：

- `client.ts` 是 SDK 创建入口
- `services/*.service.ts` 承载 API 访问和 stream 管理
- `types/*.types.ts` 只描述 SDK 对外类型
- `utils/*.utils.ts` 只做纯解析、归一化和错误转换

不新增 `support`、`helpers`、`common` 目录。

## 与 Server 的关系

Server 提供原子领域 API。

Client SDK 包装这些 API，但不改变它们的语义：

```text
server sessions API -> client.sessions
server agents API   -> client.agents
server realtime     -> client.sessions.subscribe / client.realtime
```

如果某个客户端缺字段，不应先在 SDK 里猜测或拼装隐藏逻辑，而应判断字段属于哪个 server owner：

- session 字段回到 session API
- agent 字段回到 agent API
- realtime 事件回到对应 realtime owner

SDK 可以组合请求，但不应制造新的业务事实。

## 与 UI / Companion / Desktop 的关系

```text
packages/nextclaw-client
  -> pure SDK, no React, no Electron

packages/nextclaw-ui
  -> may wrap SDK with React hooks / managers

apps/desktop
  -> may use SDK directly or through nextclaw-ui wrappers

apps/companion
  -> uses SDK directly for compact avatar UI
```

Companion 的 `companion-session-view.service.ts` 可以基于 SDK 数据决定展示目标，但这个选择逻辑留在 Companion，不进入 SDK。

## Realtime 策略

SDK 应优先复用现有 server realtime 能力。

策略：

1. 支持 snapshot 请求
2. 支持 session realtime 订阅
3. 支持 abort
4. 支持 reconnect
5. 支持 stream 失败后的显式错误返回

是否 refresh、如何展示 stale 状态，由上层客户端决定。SDK 只提供统一访问和恢复能力。

## 验证

SDK 落地时至少覆盖：

- base URL 归一化测试
- auth header 测试
- session list / detail contract 测试
- agent list / metadata contract 测试
- realtime subscribe abort / reconnect 测试
- local / remote endpoint 配置测试

只要触达 TypeScript 源码、类型声明或运行链路，收尾必须运行相关 `tsc`。
