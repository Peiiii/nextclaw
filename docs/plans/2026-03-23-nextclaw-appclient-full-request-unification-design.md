# NextClaw AppClient Full Request Unification Design

日期：2026-03-23

## 1. 目标

本次目标不是“remote 页面能工作”，而是让 **几乎所有受控的应用层动态请求都统一经过 `appClient`**。

预期结果：

- 本地模式下，`appClient` 继续走 local transport。
- 远程模式下，`appClient` 自动切到 remote multiplex websocket。
- 现有 `HTTP + SSE + /ws + React Query refetch` 不再在 remote 下各自直接打 Worker。
- DevTools 中 remote 页面空闲与常规交互场景的 `HTTP` 请求显著下降，动态通信主要收敛为：
  - 初始化少量请求
  - 一条 remote websocket
  - 必要时的少量不可避免直连

## 2. 当前差距

当前仓库只完成了部分迁移：

- 已经走 `appClient` 的：
  - 聊天流式输出
  - realtime 订阅
  - remote multiplex transport
- 仍然绕过 `appClient` 的：
  - `api/*.ts` 中大部分 `api.get/post/put/delete`
  - 若干 legacy SSE 读取函数
  - `NcpHttpAgentClientEndpoint` 使用的自定义 `fetchImpl`

因此 remote 下虽然已经有 websocket，但大量 query 仍旧会直接形成 Worker HTTP 请求。

## 3. 设计原则

### 3.1 单一收口

`appClient` 必须成为前端受控动态通信的唯一入口。业务代码不应自行决定“这里走 fetch，那里走 ws”。

### 3.2 兼容本地 / 远程

业务层不感知 local / remote。

- local: `appClient -> LocalAppTransport`
- remote: `appClient -> RemoteSessionMultiplexTransport`

### 3.3 先消灭 HTTP 请求面，再优化 cache 策略

本轮优先完成“请求统一收口”。  
cache patch / invalidate 精细化仍然重要，但属于第二优先级；不能因为它还没完全完成，就继续容忍旧 HTTP 直连。

## 4. 实现方案

### 4.1 API Client 上移到 AppClient

重构 `packages/nextclaw-ui/src/api/client.ts`：

- `requestApiResponse()` 不再直接 `fetch`
- 改为调用 `appClient.request()`
- 成功时重新包装为 `{ ok: true, data }`
- 失败时统一包装为 `{ ok: false, error }`

这样 `api/config.ts`、`api/remote.ts`、`api/marketplace.ts`、`api/mcp-marketplace.ts`、`api/ncp-session.ts` 中所有基于 `api.get/post/put/delete` 的调用，将自动进入 `appClient`。

### 4.2 保留 Transport 内部 Raw HTTP

为避免 `LocalAppTransport -> requestApiResponse -> appClient -> LocalAppTransport` 形成递归：

- 抽出 raw HTTP helper
- 只允许 transport 内部使用 raw helper
- 业务 API 一律不再使用 raw helper

### 4.3 清理 Legacy SSE 直连

`api/config.ts` 中遗留的聊天 SSE helper 继续直接 `fetch`，会在 remote 下形成额外 HTTP。

处理方式：

- 将这类 legacy SSE helper 改到 `appClient.openStream()`
- 统一复用 transport stream 能力

### 4.4 NCP Agent Endpoint 接入 AppClient

`NcpHttpAgentClientEndpoint` 当前通过自定义 `fetchImpl` 直接走 HTTP/SSE。

需要新增一个 `fetch-like adapter`：

- 普通 request -> `appClient.request`
- SSE stream -> `appClient.openStream`
- 再把 stream event 重新编码为 `Response.body` 中的 SSE frame，供现有 NCP client 消费

这样 NCP 页面在 remote 下也能走统一长连接，而不是继续打独立 HTTP/SSE。

## 5. 验收标准

### 5.1 代码层

- `api/*.ts` 受控动态请求默认都经由 `appClient`
- transport 内部 raw HTTP 与业务层 API client 明确分层
- NCP agent client 不再直接用浏览器原生 fetch 打 remote HTTP/SSE

### 5.2 用户层

- remote 页面挂着 1 分钟后，不应再持续看到大量 `status / config / sessions / session-types / installed` HTTP 请求
- 聊天、会话刷新、技能安装状态同步在 remote 下继续可用

### 5.3 验证层

- `tsc`
- `build`
- `lint`
- 受影响单测
- remote transport smoke
- 必要时增加 request-unification smoke，验证 remote 下关键查询经 websocket 收口

## 6. 非目标

- 本轮不保证所有 query 都立即改成 cache patch，不再 invalidate
- 本轮不处理静态资源请求
- 本轮不承诺彻底消灭所有 HTTP；目标是收敛“受控动态请求”的主流路径
