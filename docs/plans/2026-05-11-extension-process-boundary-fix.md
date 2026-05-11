# Extension Process Boundary Fix

## 背景

新版 Weixin extension 已经能真实收发消息，但 service 里出现了对 `@nextclaw/channel-extension-weixin` 业务导出的直接 import。这个实现偏离了原始方案：主进程不应该知道微信 schema、扫码登录、账号保存等渠道细节。

## 目标

把 service 与具体渠道业务代码解耦。service 只负责发现 extension manifest、启动 extension 进程、暴露通用 `/webhook` ingress、通过现有 `/ws` app event bus 发送事件。

## 非目标

- 不把微信登录逻辑迁回 service。
- 不新增 extension 专属 HTTP server 或专属 WebSocket。
- 不保留 service 侧 Weixin binding 单例。
- 不引入新的 host / adapter 包装层。

## 目标结构

1. Extension 包通过 `nextclaw.extension.json` 声明 `contributes.channels`。
2. Service discovery 读取 manifest，并从 manifest 生成通用 channel binding 和 UI metadata。
3. 如果 channel 声明 `auth`，service 生成通用 auth handler。
4. 通用 auth handler 不调用渠道代码，只通过 app event bus 发 `extension.request`。
5. Extension 进程监听 `extension.request`，在进程内部调用自己的业务 owner。
6. Extension 通过通用 `/webhook` 回传 `extension.response`。
7. Service 根据 `requestId` resolve pending request。

## 协议

### `extension.request`

由 service 通过现有 app event bus 发布，经 `/ws` 广播给 extension 进程。

```json
{
  "requestId": "uuid",
  "extensionId": "nextclaw-channel-extension-weixin",
  "kind": "channel.auth.start",
  "payload": {
    "channelId": "weixin",
    "pluginConfig": {},
    "accountId": null,
    "baseUrl": null
  }
}
```

### `extension.response`

由 extension 进程通过通用 `/webhook` 提交给 service。

```json
{
  "requestId": "uuid",
  "ok": true,
  "data": {}
}
```

失败时：

```json
{
  "requestId": "uuid",
  "ok": false,
  "error": {
    "message": "..."
  }
}
```

## 代码改造

- 删除 `builtin-extension-channel-bindings.service.ts`。
- `GatewayPluginManager` 不再 import 任何具体 extension 包。
- `ServiceExtensionRuntime` 成为 extension manifest contribution 与 request/response 协议 owner。
- `ExtensionLifecycleService` 保留 manifest 读取和进程生命周期，不承载渠道业务。
- Weixin extension 的 `main.ts` 监听通用 request，并把 auth 请求交给 `WeixinLoginService`。
- `nextclaw.extension.json` 补齐 channel metadata、config UI hints 和 auth 声明。

## 验收

- `rg "from \"@nextclaw/channel-extension-weixin\"|WeixinLoginService|WEIXIN_" packages/nextclaw-service/src` 无输出。
- `rg "WeixinLoginService|WEIXIN_" packages/nextclaw-service/src` 无输出。
- Service tests 覆盖 manifest 生成 channel binding 和 request/response auth。
- Weixin extension tests 覆盖 auth request 处理。
- `@nextclaw/service` 与 `@nextclaw/channel-extension-weixin` 的 `tsc`、targeted tests、lint 通过。
- 旧版 Weixin plugin 仍不被引入。
