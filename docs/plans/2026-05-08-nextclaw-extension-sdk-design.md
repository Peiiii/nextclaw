# NextClaw Extension SDK 方案设计

日期：2026-05-08

## 1. 文档目的

本文记录 `@nextclaw/extension-sdk` 的当前执行方案。

核心目标是：让被 NextClaw 启动的外部进程，通过一套后端 SDK 接入 NextClaw。这个 SDK 和 `@nextclaw/client-sdk` 保持命名与使用风格一致，但面向的是外部进程，而不是前端 UI。

本文只保留已经确认的设计结论，未进入本方案的内容不写成执行要求。

## 2. 和 Client SDK 的关系

`@nextclaw/client-sdk` 和 `@nextclaw/extension-sdk` 本质上都是访问 NextClaw 能力的 SDK。

共同点：

- 都应该按领域暴露 service。
- 都应该复用 NextClaw 共享基础能力，例如 event bus 基础类型。
- 命名风格尽量一致。
- 都不承载 UI、业务编排和具体渠道私有逻辑。
- 都不应该依赖 NextClaw 的内核运行控制面。

区别：

```text
@nextclaw/client-sdk
  面向 UI、companion、desktop shell、remote shell 等前端和上层应用。

@nextclaw/extension-sdk
  面向被 NextClaw 启动的外部 server 进程，例如 channel extension server。
```

命名上先对齐已有 client SDK。Extension SDK 内部维护 `eventBus`，但 channel 开发者的常用入口固定为 `channels.use(...)`、`channel.submitMessage(...)`、`channel.onNcpEvent(...)` 和 `channel.config.*`。

`@nextclaw/client-sdk` 和 `@nextclaw/extension-sdk` 都不直接依赖 `@nextclaw/kernel`。它们需要的通用 event bus 能力应该来自轻量共享包；各自不通用的事件类型、event keys 和领域 service 由各自 SDK 维护。

## 3. Channel 是一等概念

Channel 是 Extension SDK 的一等概念。

一个 extension server 进程承载至少一个 channel adapter，也允许承载多个 channel adapter。每个 channel adapter 负责一个真实外部渠道，例如 Telegram、飞书、微信、Discord 等。

Channel 的职责边界：

```text
真实渠道消息
  -> channel adapter 自己接收
  -> channel.submitMessage(...) 提交给 NextClaw

NextClaw 事件
  -> channel.onNcpEvent(...) 推回 extension
  -> channel adapter 自己转换并发回真实用户
```

NextClaw 不负责理解 Telegram、微信、飞书的私有发送协议。真实发消息给用户的能力属于 channel adapter。

因此 Extension SDK 不提供 `channels.reply()` 这种让 NextClaw 代替渠道发消息的 API。

## 4. Manifest 声明 Channel

Channel 的静态信息应放在 extension manifest 里。运行时代码通过 manifest 中声明的 channel id 获取对应操作句柄：

```ts
const telegram = extension.channels.use("telegram");
```

`use(...)` 的语义是：使用 manifest 中已经声明过的 channel，并获得它的运行时操作对象。

Manifest 示例：

```json
{
  "id": "nextclaw-channel-telegram",
  "name": "Telegram Channel",
  "version": "0.1.0",
  "server": {
    "type": "stdio",
    "command": "node",
    "args": ["dist/index.js"],
    "env": {}
  },
  "contributes": {
    "channels": [
      {
        "id": "telegram",
        "name": "Telegram",
        "configSchema": {
          "schema": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "enabled": { "type": "boolean", "default": false },
              "token": { "type": "string", "default": "" },
              "allowFrom": {
                "type": "array",
                "items": { "type": "string" },
                "default": []
              },
              "proxy": {
                "type": ["string", "null"],
                "default": null
              },
              "streaming": {
                "enum": ["off", "partial", "block", "progress"],
                "default": "partial"
              }
            }
          },
          "uiHints": {
            "token": { "label": "Bot Token", "sensitive": true },
            "proxy": { "label": "Proxy", "advanced": true },
            "streaming": { "label": "Streaming Mode" }
          }
        }
      }
    ]
  }
}
```

`server` 采用接近 MCP server config 的形态。当前执行方案固定 `type: "stdio"`：

```text
server.type = "stdio"
  表示 NextClaw 通过本地命令启动这个 extension server。
  这里复用 MCP 的 command / args / env 心智。
  这不表示 Extension SDK 的业务通信走 stdio。
```

`server.command` / `server.args` / `server.env` 只描述如何启动 extension server。channel token、proxy 等业务配置仍然保存在 `config.channels[channelId]`，不放进 manifest。

## 5. SDK API

```ts
import { createNextClawExtension } from "@nextclaw/extension-sdk";

const extension = createNextClawExtension();

extension.eventBus.subscribeAll((event) => {
  // 可选：观察 SDK 收到的全部实时事件。
});

const telegram = extension.channels.use("telegram");

const telegramAdapter = createTelegramAdapter();

async function applyConfig(config: TelegramConfig) {
  await telegramAdapter.applyConfig(config);
}

await applyConfig(await telegram.config.get<TelegramConfig>());
telegram.config.onChange(applyConfig);

telegramAdapter.onMessage(async (message) => {
  await telegram.submitMessage({
    conversationId: message.chatId,
    senderId: message.userId,
    content: {
      type: "text",
      text: message.text
    }
  });
});

telegram.onNcpEvent(async (event) => {
  await telegramAdapter.handleNcpEvent(event);
});
```

最小服务形态：

```text
extension.channels
  use(channelId) -> Channel

Channel
  submitMessage(input)
  onNcpEvent(handler)
  config.get()
  config.onChange(handler)

Extension
  eventBus.on(key, handler)
  eventBus.subscribeAll(handler)
```

`channel.config.onChange(...)`、`channel.onNcpEvent(...)` 不是各自维护一套平行监听器；它们都基于 `extension.eventBus` 过滤当前 channel 的事件。这样和 client SDK 的 `client.eventBus` 心智保持一致：WebSocket 只负责接收实时事件，SDK 的领域 service 基于 event bus 提供更易用的订阅 API。

## 6. Channel 配置

Channel 配置沿用 NextClaw 现有配置体系，配置值保存在 `config.channels[channelId]`。

Manifest 只声明 channel 的静态信息、配置 JSON Schema 和 UI hints，不保存用户填写的配置值。`extensionId + channelId` 只用于声明归属和避免冲突，不作为配置路径。

配置路径示例：

```text
config.channels.telegram:
  enabled
  token
  allowFrom
  proxy
  streaming

config.channels.feishu:
  enabled
  appId
  appSecret
  verificationToken
```

配置设计结论：

- 新 extension channel 的配置 schema 放在 extension manifest 的 channel 声明里。
- 内置 channel 继续以现有 `ChannelsConfigSchema` / Zod schema 为 owner。
- 用户配置值继续保存在 `config.channels[channelId]`。
- `channel.config.get()` 读取的是 `config.channels[channelId]`。
- `channel.config.onChange(...)` 监听的是 `config.channels[channelId]` 的变化。
- channel adapter 自己解释和使用配置。
- 敏感配置不应该通过普通环境变量传给 extension。

`onChange` 是 SDK 必备能力。adapter 收到配置变化后必须执行自身重配置逻辑。需要重建连接时，adapter 在 `onChange` 里完成重建并上报状态。

`enabled` 不需要单独的 SDK API。它就是 channel config 里的字段，adapter 通过 `channel.config.get()` / `channel.config.onChange(...)` 拿到完整配置后，自行用 `config.enabled` 驱动自己的 start/stop。

典型策略：

```text
enabled=true
  -> adapter.start()
  -> 开始监听真实渠道，例如长轮询、WebSocket、第三方 SDK 回调

enabled=false
  -> adapter.stop()
  -> 停止监听真实渠道，不再提交新消息
```

SDK / NextClaw 侧也应尊重 `config.enabled` 状态：channel disabled 后不应继续接收该 channel 的 `submitMessage(...)`，也不应继续向该 channel 派发新的 NCP reply 事件。

## 7. Extension Server 加载与运行

NextClaw 主进程负责加载 extension manifest，并按 manifest 中的 `server` 配置启动 extension server。

本方案不包含 extension 自身的 enable / disable 开关。已安装、已发现且 manifest 有效的 extension 默认启动。

职责边界：

```text
extension 运行规则
  -> 已安装、已发现且 manifest 有效即运行

channel 监听规则
  -> 由 config.channels[channelId].enabled 决定
  -> extension server 内部的 channel adapter 自己处理
```

因此，主进程不根据 `config.channels[channelId].enabled` 启动和停止 extension server。一个 extension server 的能力边界不限于 channel；它允许同时提供多个 channel 和其他能力。

主进程只做这些事：

```text
1. 发现 extension manifest
2. 读取并校验 manifest
3. 注册 manifest 中声明的能力元数据，例如 channels、config schema
4. 按 server.type / command / args / env 启动 extension server
5. 给 extension server 注入 NextClaw endpoint、短期 token、extensionId 等连接凭据
6. 复用通用 webhook 接收 extension 提交的消息和事件
7. 复用现有 `/ws` event stream 向 extension 推送事件
8. 主应用退出时停止 extension server
```

这里不引入 `applyConfigChanged` 这类主进程 API。配置变化时，主进程只负责通知，不负责替 extension 应用配置，也不替 channel adapter 判断 start/stop。

```text
config changed
  -> 主进程发布 config.changed 事件
  -> SDK 收到事件
  -> channel.config.onChange(...) 触发
  -> channel adapter 自己决定 reconfigure / start / stop
```

## 8. SDK 底层通信

Channel API 是开发者主要使用的接口。底层通信由 SDK 负责维护。

当前执行方案固定为 HTTP webhook + WebSocket 双通道，并复用 NextClaw 已有 server，不额外启动独立 HTTP server。

```text
extension -> NextClaw
  channel.submitMessage(...)
  HTTP POST /webhook
  webhook 校验 extension token 后发布到 event bus。

NextClaw -> extension
  channel.config.onChange(...)
  channel.onNcpEvent(...)
  WebSocket /ws
  通过现有 event bus 和 /ws 推送 config / NCP event。
```

`server.type = "stdio"` 只负责进程启动。启动后主进程通过环境变量注入：

```text
NEXTCLAW_EXTENSION_ID
NEXTCLAW_EXTENSION_ENDPOINT
NEXTCLAW_EXTENSION_TOKEN
```

SDK 使用 `NEXTCLAW_EXTENSION_ENDPOINT + /webhook` 提交消息，使用 `NEXTCLAW_EXTENSION_ENDPOINT + /ws` 监听事件。

SDK 内部使用 `eventBus` 作为通信抽象。第一层 channel API 不暴露 event bus。

## 9. Channel 事件

Channel 应该能接收与自己相关的 NextClaw/NCP 事件。

这里不只包括最终完成事件，也包括 delta、error、状态变化等 NCP 事件。具体怎么把这些事件转换成真实渠道行为，由 channel adapter 自己决定。

示例：

```ts
telegram.onNcpEvent(async (event) => {
  await telegramAdapter.handleNcpEvent(event);
});
```

这里不新增一套 channel 与会话的绑定机制。现有链路已经用 `channel` / `chatId` / `sessionKey` 表达渠道会话关系，并且已有 `consumeNcpReply(...)` 定向回复链路。

Extension SDK 的 `channel.submitMessage(...)` 应该接入这套现有关系：

```text
channel.submitMessage(...)
  -> 根据 channel/chatId 找到最近绑定的 session
  -> 如果没有可用 session，则创建一个 session
  -> 在这个 session 中发起一次 Agent run
  -> run context 记录本次触发来源 channel/chatId/accountId 等信息
  -> 平台只把该 run 的 NCP reply 事件定向交给触发本次 run 的 channel
  -> SDK 侧通过 channel.onNcpEvent(...) 交给 channel adapter
```

这里的关键约束是：**不是 session 里的所有回复都会自动路由到某个 channel**。Channel 只接收由自己触发的那次 run 的 reply 事件。

也就是说，session 负责承接上下文；run context 负责记录本次触发来源；reply 路由跟随 run context，而不是永久绑定整个 session。

## 10. 本方案边界

当前执行方案固定以下边界：

- manifest 必须包含 `id`、`server`、`contributes.channels`。
- `server.type` 固定为 `"stdio"`。
- NextClaw 主进程通过 `server.command`、`server.args`、`server.env` 启动 extension server。
- 业务通信固定为通用 `/webhook` + 现有 `/ws`。
- 本方案不实现 extension 级 enable / disable。
- 本方案不实现 channel 状态上报 API。
- 本方案只覆盖 channel extension server，不覆盖 agent runtime extension 和 tool extension。

## 11. 包与模块边界

Extension SDK 相关能力按职责拆成六个边界：

```text
packages/nextclaw-shared
  共享基础能力包，只放跨 SDK、kernel、server、runtime 都稳定复用的轻量基础设施。

packages/nextclaw-extension-sdk
  对外发布的后端 SDK，给 extension server 进程使用。

packages/nextclaw-kernel
  NextClaw 控制面，管理 extension 的系统认知、状态和能力注册。

packages/nextclaw-runtime
  NextClaw Node 运行时执行层，负责把 extension lifecycle 落到当前进程环境。

packages/nextclaw-server
  复用现有 server，承载通用 webhook，并继续复用现有 /ws event stream。

packages/extensions/<channel-extension-package>
  具体渠道 extension server，例如新版微信渠道。
```

第一版不新增独立的 `@nextclaw/extension-core` 包。公共开发者入口只暴露 `@nextclaw/extension-sdk`；共享基础设施放入 `@nextclaw/shared`；extension 生命周期控制面和运行时执行层分别归属 kernel / runtime。

### 11.1 Shared 基础包

包路径与发布名：

```text
packages/nextclaw-shared
@nextclaw/shared
```

建议目录：

```text
src/
  index.ts
  configs/
    event-keys.config.ts
  services/
    event-bus.service.ts
  types/
    event-bus.types.ts
    update.types.ts
```

职责边界：

- `@nextclaw/shared` 只放真正跨包稳定复用的轻量基础设施。
- `EventBus`、`EventEnvelope`、`EventKey`、`Unsubscribe` 这类通用事件基础能力放在这里。
- `eventKeys`、`UpdateSnapshot` 这类被 client、server、kernel 共同引用的应用级实时通信契约可以放在这里。
- 不放 NextClaw 控制面对象。
- 不放 extension 专属 event keys。
- 不放 client SDK、extension SDK、server、runtime 的领域类型。
- 不放 Node-only 能力，例如 `child_process`、本地路径、进程句柄。

`@nextclaw/client-sdk`、`@nextclaw/extension-sdk`、`@nextclaw/kernel`、`@nextclaw/server`、`@nextclaw/runtime` 都可以依赖 `@nextclaw/shared`，但 `@nextclaw/shared` 不反向依赖它们。Shared 可以 type-only 复用稳定协议包，例如 `@nextclaw/ncp` 的公共 session summary 类型；不能依赖 kernel / runtime / server / SDK / core 内部实现。

### 11.2 Extension SDK 包

包路径与发布名：

```text
packages/nextclaw-extension-sdk
@nextclaw/extension-sdk
```

建议目录：

```text
src/
  index.ts
  services/
    extension-client.service.ts
    extension-event-bus.service.ts
    extension-channel.service.ts
    extension-transport.service.ts
  types/
    extension-sdk.types.ts
    extension-event.types.ts
    extension-channel.types.ts
    extension-manifest.types.ts
  configs/
    extension-event-keys.config.ts
  utils/
    extension-url.utils.ts
```

职责边界：

- `index.ts` 是 SDK 的公开导出边界。
- `services/` 承载 SDK 生命周期、event bus、channel service 和 transport service。
- `types/` 承载 SDK 公开类型，不放运行时逻辑。
- `configs/` 承载 extension SDK 自己的事件名、协议常量和 SDK 默认配置。
- `utils/` 只放无状态、无副作用的小型纯工具。
- SDK 复用 `@nextclaw/shared` 的 event bus 基础能力。
- SDK 不依赖 `@nextclaw/kernel`、`@nextclaw/runtime`、`@nextclaw/server` 内部实现。

### 11.3 Kernel 控制面

`@nextclaw/kernel` 管理 extension 的系统认知，不直接执行 Node 运行时动作。

```text
packages/nextclaw-kernel/src/managers/
  extension.manager.ts

packages/nextclaw-kernel/src/types/
  extension.types.ts

packages/nextclaw-kernel/src/events/
  extension-event-keys.config.ts
```

职责边界：

- 记录系统知道哪些 extension。
- 管理 extension manifest、contributions、lifecycle state。
- 定义 extension 相关 event keys。
- 提供 extension registry / manager 这类控制面抽象。
- 不启动进程。
- 不处理 webhook 请求。
- 不持有 WebSocket 连接。
- 不包含 SDK 代码。

### 11.4 Runtime 执行层

`@nextclaw/runtime` 承接 kernel 的控制面意图，并在当前 Node 环境里执行 extension 生命周期动作。

```text
packages/nextclaw-runtime/src/extensions/
  index.ts
  services/
    extension-lifecycle-runtime.service.ts
  types/
    extension-lifecycle.types.ts
```

职责边界：

- 根据 kernel 中登记的 extension manifest 启动 extension server。
- 注入 `NEXTCLAW_EXTENSION_ID`、`NEXTCLAW_EXTENSION_ENDPOINT`、`NEXTCLAW_EXTENSION_TOKEN`。
- 维护当前 runtime 内的进程句柄。
- 在主应用退出时停止 extension server。
- 把进程启动、停止、失败等状态回写给 kernel 控制面。

这里不再使用 `extension host` 作为模块名。第一版只保留 lifecycle runtime，不拆 `process service`、`transport router`、`channel bridge` 这类过早模块。

### 11.5 Server 传输入口

`nextclaw-server` 只提供通用传输入口，不承载 extension 业务逻辑：

```text
HTTP webhook
  extension -> NextClaw

WebSocket event stream
  NextClaw -> extension
```

路径命名继续使用已经确认的通用语义：

```text
/webhook
/ws
```

`/ws` 复用现有 event bus 实时流，不新增 extension 专属 WebSocket 路径。

### 11.6 Channel Extension 包

具体渠道 extension server 使用独立包，不复用旧插件入口。新版微信渠道建议使用描述架构的命名，而不是临时版本号：

```text
packages/extensions/nextclaw-channel-plugin-weixin-extension
```

建议目录：

```text
src/
  index.ts
  services/
    weixin-extension.service.ts
    weixin-adapter.service.ts
    weixin-http.service.ts
  configs/
    weixin.config.ts
  types/
    weixin.types.ts
  utils/
    weixin-message.utils.ts
```

职责边界：

- extension 包负责真实渠道协议、连接、轮询、回调、消息发送和渠道私有状态。
- extension 包通过 `@nextclaw/extension-sdk` 接入 NextClaw。
- extension 包不直接依赖主进程内部服务。
- 主进程不理解微信、Telegram、飞书等渠道私有发送协议。

### 11.7 依赖方向

包之间按以下方向依赖：

```text
@nextclaw/shared
  只承载轻量共享基础设施和公共实时通信契约。
  不依赖 kernel / runtime / server / SDK / core 内部实现。
  允许 type-only 依赖稳定协议包，例如 @nextclaw/ncp。

@nextclaw/kernel
  -> @nextclaw/shared

@nextclaw/runtime
  -> @nextclaw/kernel
  -> @nextclaw/shared

@nextclaw/server
  -> @nextclaw/shared
  -> 按现有 server 需要接入应用级 eventBus

@nextclaw/extension-sdk
  -> @nextclaw/shared

channel extension package
  -> @nextclaw/extension-sdk
```

禁止依赖方向：

```text
@nextclaw/shared 不依赖 kernel / runtime / server / SDK。
@nextclaw/extension-sdk 不依赖 kernel / runtime / server。
channel extension package 不依赖 kernel / runtime / server / core 内部实现。
server 不启动 extension 进程。
runtime 不拥有 webhook 或 /ws。
kernel 不直接 spawn 进程。
```

## 12. 核心类型骨架

第一版类型先按四组收敛，不提前扩展成完整协议全集。

### 12.1 Manifest 类型

Manifest 类型描述 extension 的静态能力：

```text
ExtensionManifest
ExtensionServerConfig
ExtensionContributions
ExtensionChannelContribution
ExtensionConfigurationSchema
```

其中：

- `ExtensionManifest` 是 extension manifest 顶层结构。
- `ExtensionServerConfig` 对齐 MCP server config 心智，第一版固定 `type: "stdio"`。
- `ExtensionChannelContribution` 描述 channel id、name、config schema 和 UI hints。
- Manifest 只放静态声明，不保存用户配置值。

### 12.2 SDK 类型

SDK 类型描述开发者使用的公开 API：

```text
NextClawExtension
ExtensionChannelsService
ExtensionChannel
ExtensionEventBus
ExtensionTransport
```

其中：

- `NextClawExtension` 是 `createNextClawExtension()` 返回的根对象。
- `ExtensionChannelsService` 提供 `channels.use(channelId)`。
- `ExtensionChannel` 提供 `submitMessage`、`onNcpEvent`、`config.get` 和 `config.onChange`。
- `ExtensionEventBus` 是 SDK 内部和高级用户共享的事件订阅入口。
- `ExtensionTransport` 封装 webhook 和 WebSocket 通信。

### 12.3 Event 类型

Event 类型描述跨进程通信事件：

```text
ExtensionEventEnvelope
ExtensionEventSource
ExtensionEventType
ChannelSubmittedMessage
ChannelConfigChangedEvent
ChannelNcpEvent
```

其中：

- `ExtensionEventEnvelope` 是所有事件的统一外壳。
- `ExtensionEventSource` 标识事件来源 extension、channel 和 run context。
- `ChannelSubmittedMessage` 表示渠道收到真实用户消息后提交给 NextClaw。
- `ChannelConfigChangedEvent` 表示 channel 配置变化。
- `ChannelNcpEvent` 表示 NextClaw/NCP run 产生并需要推给 channel 的事件。

### 12.4 Channel 类型

Channel 类型描述渠道消息的通用形态：

```text
ChannelMessageContent
ChannelTextContent
ChannelImageContent
ChannelFileContent
ChannelConversationRef
ChannelRunContext
```

其中：

- `ChannelMessageContent` 先覆盖文本、图片和文件。
- `ChannelConversationRef` 表达外部渠道的会话标识。
- `ChannelRunContext` 记录本次 run 的触发来源，用于定向路由 NCP reply。

## 13. 暂不纳入第一版的内容

以下内容暂不写成第一版执行要求：

- extension 级 enable / disable。
- 独立的 channel enabled SDK API。
- `channels.register(...)`。
- `channels.reply(...)`。
- `extension.ready()`。
- 独立的 `@nextclaw/extension-core` 公共包。
- 完整权限模型。
- 状态上报 API。
- 具体渠道迁移实现细节。

如果后续确认这些能力确实必要，再分别进入设计讨论，而不是在当前框架里提前占位。
