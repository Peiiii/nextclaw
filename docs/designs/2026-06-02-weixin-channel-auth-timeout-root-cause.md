# Weixin Channel Auth Start Timeout Root Cause

## 背景

用户在微信渠道配置里点击“重新生成二维码”后，界面持续等待。按接口复现，这个等待不是 UI 渲染或轮询问题，而是 `auth/start` 接口本身没有及时返回。

复现接口：

```text
POST /api/config/channels/weixin/auth/start
```

复现结果：

```json
{
  "ok": false,
  "error": {
    "code": "AUTH_START_FAILED",
    "message": "Extension request timed out: channel.auth.start"
  }
}
```

实测等待约 60 秒，和 `ExtensionRuntimeService` 中 extension request 的超时时间一致。

## 当前链路

微信渠道 auth start 的主链路如下：

```text
UI
  -> POST /api/config/channels/weixin/auth/start
  -> ConfigRoutesController.startChannelAuth
  -> startChannelAuth()
  -> binding.channel.auth.start()
  -> ExtensionRuntimeService.requestExtension()
  -> appEventBus emit extension.request
  -> extension WebSocket receives extension.request
  -> weixin extension handles channel.auth.start
  -> extension POST /webhook with extension.response
  -> ExtensionRuntimeService resolves pending request
  -> API returns QR auth start result
```

其中 `binding` 只表示 server 从 extension manifest 生成的能力声明：某个 extension 提供某个 channel 的 auth/outbound 能力。它不表示 extension 进程已经在线，也不表示 extension WebSocket 已认证连接。

## 已证实事实

- 当前全局安装的 `@nextclaw/channel-extension-weixin@0.1.17` 的 `nextclaw.extension.json` 声明了 `weixin` channel 的 auth 能力。
- 当前接口复现路径不是立即返回 `NOT_SUPPORTED`，而是等待 60 秒后返回 `Extension request timed out: channel.auth.start`。
- 因此当前本地复现的超时问题不是“server 不知道 weixin auth”，而是“server 知道这个能力后发出了 extension request，但没有收到 extension response”。
- 历史日志中也出现过 weixin outbound 的 `Extension request timed out`，说明该类问题不是 auth start 独有，属于 extension request-response 链路风险。

## 直接根因

直接根因是 extension request-response 链路断在 event-stream 接收侧：

```text
server emitted extension.request
  -> extension did not receive it or did not respond
  -> pending request timed out after 60s
```

当前最强代码证据在 `@nextclaw/extension-sdk` 的 `ExtensionTransportService`：

```ts
const socket = this.createSocket(resolveWebSocketUrl(this.endpoint, "/ws"), {
  headers: {
    authorization: `Bearer ${this.token}`,
    "x-nextclaw-extension-id": this.extensionId,
  },
});
```

但默认实现里：

```ts
return new globalThis.WebSocket(url) as unknown as NextClawExtensionWebSocketLike;
```

也就是说，SDK 构造了 extension WebSocket 认证 headers，但默认 `globalThis.WebSocket` 分支没有把 options 传进去。

server 侧 `/ws` upgrade 会先用 `EventStreamAuthService` 认证：

```text
Authorization: Bearer <extension token>
x-nextclaw-extension-id: <extension id>
```

如果真实 Node 运行态的 WebSocket 没带这两个 header，server 会拒绝该 socket，extension 就收不到后续 `extension.request`。

## 为什么已有测试没有挡住

已有 SDK 测试主要使用自定义 `webSocketFactory`。在这个路径里，factory 能收到 `headers` options，所以测试可以验证 options 被传入 factory。

但真实运行态使用默认 `globalThis.WebSocket` 分支。这个分支没有把 `options` 传给 WebSocket 构造器，导致“测试替身路径正确、真实 Node 路径丢 header”的缺口。

## 影响范围

影响不只限于微信二维码：

- `channel.auth.start`
- `channel.auth.poll`
- `channel.auth.connect`
- `channel.outbound.sendText`
- 其他依赖 extension request-response 的能力

只要 extension WebSocket 没有成功认证连接，server 发出的 request 都可能等到 60 秒超时。

## 推荐解决方案

### 方案一：修复 SDK 默认 WebSocket 创建逻辑

在 Node 运行态中，默认 WebSocket 创建必须携带 headers。推荐做法：

- 优先使用支持 Node headers 的 WebSocket 实现。
- `createSocket(url, options)` 默认分支必须把 options 传入构造器。
- 如果当前 WebSocket 实现不支持 headers，应 fail fast，报清晰错误，而不是静默建立一个无认证 socket。

这是当前超时问题的最小必要修复。

### 方案二：增加 extension connection readiness

server 当前只知道 capability binding，不知道 extension socket 是否在线。推荐把能力声明和连接状态拆开：

```text
capability registry: manifest 声明了什么能力
connection registry: 当前哪些 extension socket 已认证在线
request dispatcher: 只向在线 extension 发送 request
```

在 channel auth start 前增加判断：

- 无 auth binding：返回 `CHANNEL_AUTH_NOT_SUPPORTED`
- 有 auth binding，但 extension 未连接：返回 `EXTENSION_NOT_CONNECTED`
- extension 已连接但执行失败：返回 `CHANNEL_AUTH_START_FAILED`
- extension 已连接但超时：返回 `EXTENSION_REQUEST_TIMEOUT`

这样可以避免用户等待 60 秒，也能让错误定位更清楚。

### 方案三：补通用 channel auth request-response 测试

新增一个不依赖真实微信上游的通用测试，但必须走真实 server event-stream 链路：

```text
startUiServer
  -> authenticated extension WebSocket
  -> POST /api/config/channels/test-channel/auth/start
  -> extension receives channel.auth.start
  -> extension POST /webhook extension.response
  -> API returns auth start result within a short timeout
```

这个测试不需要真实微信账号或扫码，但要覆盖真实 `/ws` 认证、真实 `/webhook`、真实 API route 和真实 request-response 协议。

## 推荐落地顺序

1. 先补一个能复现当前问题的通用链路测试。
2. 修复 `ExtensionTransportService` 默认 WebSocket headers 丢失问题。
3. 用同一个测试证明 request-response 链路恢复。
4. 再增加 extension connection readiness，避免未来 extension 进程退出、token 错误、旧包或重复 channel 时继续表现为 60 秒等待。

## 和 `channel auth is not supported: weixin` 的区别

这份文档只描述 `auth/start` 超时问题。

`channel auth is not supported: weixin` 是另一条路径：

```text
server 没有拿到 weixin auth binding
  -> startChannelAuth returns null
  -> API returns 404 NOT_SUPPORTED
```

二者区别：

```text
有 binding，但 extension 没响应
  -> 60 秒后 AUTH_START_FAILED: Extension request timed out

无 binding 或 binding 无 auth
  -> 立即 NOT_SUPPORTED: channel auth is not supported: weixin
```

