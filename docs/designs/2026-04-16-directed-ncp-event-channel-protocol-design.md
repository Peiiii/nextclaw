# Directed NCP Event Channel Protocol Design

相关实施计划：

- [Directed NCP Event Channel Cutover Plan](../plans/2026-04-16-directed-ncp-event-channel-cutover-plan.md)

## 背景

当前 Web UI、微信、Telegram、飞书等输出链路并不统一：

- Web UI 更接近直接消费 NCP session / realtime event。
- 微信、Telegram 等传统渠道仍主要依赖 `MessageBus outbound`、私有 control message 和最终字符串。
- 飞书插件内部已经有 reply dispatcher，但上游仍通过 `dispatchPrompt(): Promise<string>` 获得最终字符串。
- `message-channel` 抽象已经在 `@nextclaw/ncp-toolkit` 中出现，但目前还没有成为主链。

这导致同一次 Agent 回复在系统里有多套表达方式：NCP event、最终字符串、control message、插件 reply dispatcher。它们描述的是同一件事，却分散成多条合同，维护成本高，也让“边说边做”“块级快发”“工具过程展示”“卡片增量更新”变得困难。

本设计的目标是把回复输出主链收敛为一个更简单的模型：

**NCP EventStream 是唯一上游真相源；平台负责定向路由；channel 插件只消费属于自己的那条回复事件流。**

## 核心结论

最终协议不是开放式事件总线。

我们不希望每个 channel 插件监听全系统事件，再自己过滤 session、channel、message、sender。那会把路由、权限、生命周期和匹配逻辑推给插件，复杂且容易出错。

最终协议也不是强制所有 channel 先经过一个厚重 runtime。

我们希望 channel 插件直接面对 NCP 事件流。`message-channel` 只作为官方 toolkit，帮助插件更方便地把 NCP event 转成 typing、block、final、error 等动作，而不是成为新的强制中间层。

最终模型是：

```text
channel 收到用户输入
-> platform 创建 Agent run
-> platform 建立本次 run 与 channel reply consumer 的定向绑定
-> Agent run 产出 NCP EventStream
-> platform 只把这条 EventStream 送给本次绑定的 consumer
-> channel 插件消费 event stream 并发送到自己的聊天世界
-> run 结束，绑定释放
```

一句话：

**主协议是 NCP EventStream；分发模型是一对一定向路由；message-channel 是可选工具包。**

## 设计原则

### 1. 唯一真相源

所有回复输出都应以 `AsyncIterable<NcpEndpointEvent>` 为上游输入。

不再把以下形式作为主协议：

- `Promise<string>`
- `MessageBus outbound final string`
- `assistant_stream reset/delta` 私有 control message
- 每个插件自定义一套 reply event 协议

这些形式可以在迁移期短暂存在，但不能继续作为目标态主链。

### 2. 定向路由，不做全局订阅

channel 插件不订阅全系统事件。

平台在每次 channel 输入触发 run 时，就已经知道：

- 输入来自哪个 channel。
- 回复应该回到哪个 conversation。
- 是否需要 reply-to / thread / topic。
- 目标插件实例是谁。

因此平台应该直接把本次 run 的 event stream 交给对应 channel consumer，而不是广播后让插件自筛。

### 3. 插件直接消费 NCP event

插件的核心入口应该非常简单：

```ts
export type ChannelReplyInput = {
  endpoint: MessageChannelEndpoint;
  eventStream: AsyncIterable<NcpEndpointEvent>;
};

export interface ChannelReplyConsumer {
  consumeReply(input: ChannelReplyInput): Promise<void>;
}
```

插件只需要关心：

- `endpoint` 告诉我回复要发到哪里。
- `eventStream` 告诉我 Agent 正在发生什么。
- 我把这些事件变成微信、飞书、Telegram、邮件、GitHub issue comment 等具体输出。

### 4. Toolkit 辅助，不绑死实现

`@nextclaw/ncp-toolkit/message-channel` 的定位应从“强制 runtime layer”收敛为“channel 插件工具包”。

插件可以选择：

- 直接手写消费 NCP event。
- 使用 toolkit 的 translator / delivery helper。
- 使用 toolkit 的 typing lifecycle、block aggregation、final collector。
- 为飞书、Telegram 这类高级渠道复用 card / edit / streaming helper。

但主协议不依赖某个特定 service class 名称。

### 5. 平台负责绑定关系

平台负责把 channel 输入和 Agent run 绑定起来。

插件不应该自己猜：

- 哪个 session 属于我。
- 哪个 event 应该回给我。
- 这个 event 是否应该发送给 Web UI。
- 是否要同时发给多个 channel。

这些都是平台调度责任。

### 6. 复用现有插件生命周期

这套设计不应再引入一套新的“reply consumer 注册机制”。

NextClaw 当前已经有稳定的 channel 插件生命周期：

- 插件通过 `register(api)` 进入系统。
- 插件调用 `api.registerChannel(...)` 注册 channel。
- 平台在装配阶段把 plugin registry 转成 extension registry。
- `ChannelManager` 调用 `createChannel(...)` 创建 channel 实例。

目标态应继续复用这条生命周期，而不是新增：

- `registerReplyConsumer(...)`
- `registerChannelRuntime(...)`
- `registerReplyHandler(...)`

之类的新注册点。

更简单的做法是：

**插件仍然只注册 channel；channel 实例本身如果支持新链，就额外实现 `consumeReply(...)`。**

也就是说，reply consumer 不是独立注册对象，而是 channel instance 的一项能力。

### 7. MessageBus 不是目标态 reply 主协议

`MessageBus` 现在确实已经覆盖了一部分“输入进入系统、输出按 channel 发送”的职责。

当前模型大致是：

```text
channel -> MessageBus.inbound -> platform dispatch -> MessageBus.outbound -> ChannelManager -> channel.send()
```

所以它不是“没用到”，而是已经在当前系统里承担了一个比较底层、比较粗粒度的消息运输职责。

但它不适合继续承担目标态的 Agent reply 主协议，原因有三个：

1. 它的合同太粗
   - 当前 `OutboundMessage` 只有 `channel / chatId / content / media / metadata`
   - 它天然表达的是“一条已经成型的外发消息”
   - 它不直接表达 `AsyncIterable<NcpEndpointEvent>` 这种过程性事件流

2. 它会把回复过程压扁
   - 现在为了在 bus 上表达 streaming，只能额外塞入 `assistant_stream reset/delta` control message
   - 这说明 bus 本身并没有原生承载 reply event stream，而是靠私有 metadata 补洞

3. 它混合了 transport 与 reply 语义
   - inbound/outbound queue 本身是运输层能力
   - `assistant_stream`、`typing-stop` 这类 control message 已经把 Agent reply 语义塞进了 transport 合同
   - 这会让 channel、platform、NCP 之间的边界越来越混

因此，目标态不是“删除 MessageBus 这个概念”，而是“收窄它的定位”：

- `MessageBus` 可以继续承担历史 inbound/outbound transport、系统消息、迁移桥接等职责
- 但 Agent reply 主链不再以 `OutboundMessage` 为真相源
- Agent reply 主链应直接以 `NcpEventStream` 为真相源
- 如果某次 run 最终需要落到 channel，则由平台把该 event stream 定向交给对应 channel instance 的 `consumeReply(...)`

一句话：

**MessageBus 可以保留，但应该退回运输层；Agent reply 主协议不应继续建立在 MessageBus outbound 之上。**

## 协议草案

### MessageChannelEndpoint

`MessageChannelEndpoint` 表达的是“这次回复要回到哪个聊天世界”。

```ts
export type MessageChannelEndpoint = {
  channelType: string;
  channelInstanceId: string;
  conversationId: string;
  participantId: string;
  messageId?: string;
  threadId?: string;
  accountId?: string;
  metadata?: Record<string, unknown>;
};
```

字段含义：

- `channelType`：通道类型，例如 `weixin`、`feishu`、`telegram`、`web-ui`。
- `channelInstanceId`：同一 channel 类型下的实例，例如微信账号、飞书 app/account、Telegram bot。
- `conversationId`：外部世界中的会话、群、用户、issue、email thread。
- `participantId`：触发输入的人或实体。
- `messageId`：原始消息 ID，用于 reply / edit / thread。
- `threadId`：平台可选传入的 thread/topic 信息。
- `accountId`：可选账号标识；如果与 `channelInstanceId` 重合，后续可删除一个。
- `metadata`：只放 channel 私有但必要的最小上下文。

约束：

- `endpoint` 由平台创建，不由插件反推。
- 插件可以读取 `endpoint`，但不负责全局路由。
- `metadata` 不应成为隐藏协议垃圾桶；稳定字段应提升为显式字段。

### ChannelReplyConsumer

这是 channel 插件需要实现的核心接口。

```ts
export type ChannelReplyInput = {
  endpoint: MessageChannelEndpoint;
  eventStream: AsyncIterable<NcpEndpointEvent>;
};

export interface ChannelReplyConsumer {
  consumeReply(input: ChannelReplyInput): Promise<void>;
}
```

消费语义：

- `eventStream` 只包含本次 run 的事件。
- 插件不需要过滤其它 session。
- 插件不需要处理其它 channel 的事件。
- `consumeReply` 应在 run 结束或 stream 结束后完成。
- 如果外部发送失败，插件可以抛错；平台负责记录和上报。

### ReplyCapableChannel

为了与现有插件生命周期自然衔接，平台不需要再维护一套独立的 reply consumer 注册表。

更自然的类型是：

```ts
export type ReplyCapableChannel = BaseChannel<Record<string, unknown>> &
  Partial<ChannelReplyConsumer>;
```

含义：

- 老 channel 仍然可以只实现 `start/stop/send`。
- 新链 channel 额外实现 `consumeReply(...)`。
- 平台在需要走新主链时，只查找“这个 channel instance 是否具备 `consumeReply`”。

这让插件作者的心智模型保持简单：

- 仍然写一个 channel class
- 仍然通过 `createChannel(...)` 创建实例
- 只是这个实例现在多了一个可选的新能力

### 插件注册入口

插件注册代码不应出现本质变化。

目标态仍然类似：

```ts
register(api) {
  api.registerChannel({
    plugin: {
      id: "weixin",
      nextclaw: {
        isEnabled: (config) => ...,
        createChannel: (ctx) => new WeixinChannel(...),
      },
    },
  });
}
```

区别只在于：

```ts
class WeixinChannel extends BaseChannel<Record<string, unknown>>
  implements ChannelReplyConsumer {
  consumeReply = async (input: ChannelReplyInput): Promise<void> => {
    // 直接消费 NcpEventStream
  };
}
```

也就是说：

- 注册入口不变
- 创建时机不变
- 生命周期不变
- 只是实例能力扩展了

### ExtensionChannel 类型演化

当前 `ExtensionChannel.nextclaw.createChannel(...)` 返回的是普通 `BaseChannel`。

目标态应把它收敛为可以返回支持 reply 能力的 channel instance：

```ts
export type ExtensionChannel = {
  id: string;
  meta?: Record<string, unknown>;
  capabilities?: Record<string, unknown>;
  nextclaw?: {
    isEnabled?: (cfg: Config) => boolean;
    createChannel?: (ctx: {
      config: Config;
      bus: MessageBus;
      sessionManager?: SessionManager;
    }) => ReplyCapableChannel;
  };
};
```

注意：

- 这里并不是把 channel 注册协议改成另一套。
- 这里只是把实例返回值从“只能做老链发送”扩成“也可以做新链 reply consumer”。

### ChannelReplyRouter

这是平台内部设施，不是插件主协议。

```ts
export type ChannelReplyRoute = {
  endpoint: MessageChannelEndpoint;
  consumer: ChannelReplyConsumer;
};

export interface ChannelReplyRouter {
  dispatch(input: {
    route: ChannelReplyRoute;
    eventStream: AsyncIterable<NcpEndpointEvent>;
  }): Promise<void>;
}
```

职责：

- 根据 channel 输入解析目标 consumer。
- 创建 Agent run。
- 将本次 run 的 event stream 定向交给 consumer。
- 管理 abort、cleanup、错误记录。

非职责：

- 不解释每个 NCP event 的展示语义。
- 不实现具体 channel 发送。
- 不广播事件。

### ChannelReplyRouter 与插件生命周期的关系

`ChannelReplyRouter` 不参与插件注册。

它只在运行时工作：

1. 某个 channel instance 收到用户输入。
2. 平台从这次输入中解析 `MessageChannelEndpoint`。
3. 平台调用 NCP runner，拿到 `eventStream`。
4. 平台根据 `endpoint.channelType` 找到对应 channel instance。
5. 如果该 instance 实现了 `consumeReply(...)`，则定向调用。

所以：

- 插件注册阶段只负责提供 channel instance。
- reply router 运行阶段只负责把 event stream 交给该 instance。

这两个职责不应混在一起。

### ChannelRunBinding

平台内部可以用一个临时绑定表达本次 run 的路由关系。

```ts
export type ChannelRunBinding = {
  runId: string;
  sessionId: string;
  endpoint: MessageChannelEndpoint;
  consumer: ChannelReplyConsumer;
  createdAt: Date;
};
```

约束：

- 绑定生命周期随 run 存在。
- 绑定结束后必须释放。
- 绑定只用于定向输出，不作为长期 session storage 的替代。

## message-channel toolkit 定位

`message-channel` 不应该变成新的中心化 runtime。

它应提供的是插件可选使用的工具：

```text
NCP EventStream
-> toolkit helpers
-> channel-specific send/edit/card/reply
```

建议保留或演化的能力：

- `NcpEventStream` 类型别名。
- `MessageChannelEndpoint`。
- NCP event 到 reply action 的默认 translator。
- typing lifecycle helper。
- block aggregation helper。
- final message collector。
- error-to-user-message helper。
- channel capability helper，例如 `edit-message`、`rich-card`、`thread-reply`。

建议避免的能力：

- 以 `runtime` 命名的强制主链。
- 强制所有插件必须经过同一个 delivery service。
- 把路由匹配逻辑交给 toolkit。
- 把平台级 run lifecycle 放进 toolkit。

更准确的定位是：

**toolkit 负责让插件实现更省事；平台负责定向路由；NCP 负责事件协议。**

## 生命周期与装配

### 插件阶段

插件只做一件事：

- 通过 `registerChannel(...)` 把 channel 能力交给平台。

插件不做：

- reply consumer 全局注册
- event bus 订阅
- route table 维护

### 应用装配阶段

平台继续沿用现有装配：

- `plugin registry`
- `extension registry`
- `ChannelManager.createChannel(...)`

此时得到的是一组 long-lived channel instances。

其中一部分只支持旧链，一部分支持新链的 `consumeReply(...)`。

### 运行阶段

运行时才发生新的定向绑定：

```text
channel inbound
-> create endpoint
-> create eventStream
-> resolve channel instance
-> if instance supports consumeReply:
     route eventStream to instance.consumeReply(...)
```

这里最关键的一点是：

**reply consumer 不是一个在插件系统里单独注册的对象，而是 channel instance 的运行时能力。**

## 与 Web UI 的关系

Web UI 也可以被理解为一种 event consumer，但它不是必须实现聊天软件的 `ChannelReplyConsumer`。

Web UI 的输出目标是浏览器状态树和 session realtime，而微信、飞书、Telegram 的输出目标是外部聊天软件。二者共享的应该是：

- 上游真相源：`NcpEndpointEvent`
- run / session 语义
- 事件生命周期

二者不必共享完全相同的 delivery port。

目标态可以是：

```text
Web UI:
NCP EventStream -> session realtime / frontend state

Message Channels:
NCP EventStream -> ChannelReplyConsumer -> external chat system
```

这样既统一了上游协议，又避免为了“统一”把 Web UI 和外部聊天软件强行塞进同一个发送接口。

## 与当前旧链路的关系

目标态应逐步删除或降级这些主链合同：

- `runPromptOverNcp()` 作为 channel 回复主入口。
- `dispatchPrompt(): Promise<string>` 作为插件回复主入口。
- `MessageBus outbound` 作为 Agent 回复主协议。
- `assistant_stream reset/delta` 私有 control message。
- 飞书上游只接最终字符串的 bridge。

这里也包括 `MessageBus outbound` 在 Agent reply 链路中的当前角色。

更准确地说：

- `MessageBus` 本身不是问题
- 问题是“把 Agent reply 重新压成 `OutboundMessage + control metadata` 再发出去”这条主链
- 这条主链才是需要逐步退出的对象

它们可以作为迁移桥，但目标态不应再依赖它们表达 Agent 回复。

旧链路可以被改造成：

```text
旧 channel inbound
-> platform route/binding
-> streamPromptOverNcp()
-> ChannelReplyConsumer.consumeReply()
```

而不是：

```text
旧 channel inbound
-> runPromptOverNcp()
-> final string / control message
-> channel send
```

## 推荐迁移顺序

### Phase 1：协议收口

- 将 `message-channel` 类型调整为 toolkit 定位。
- 明确 `ChannelReplyConsumer` 是插件直接消费 NCP event 的核心接口。
- 删除或避免 `runtime`、`service` 等让人误以为是强制主链的命名。
- 文档和类型中明确“不做全局订阅，只做定向路由”。

### Phase 2：平台路由接入

- 在 NextClaw 应用层建立 `ChannelReplyRouter`。
- 将 channel inbound 触发的 run 改成 `streamPromptOverNcp()`。
- 平台创建 `ChannelRunBinding`，将 event stream 交给对应 consumer。
- 保留旧 `runPromptOverNcp()` 仅用于 CLI/direct fallback 或迁移桥。

### Phase 3：渠道切换

- 先选一个简单渠道切换，例如微信或 Telegram。
- 让该渠道实现 `ChannelReplyConsumer`。
- 使用 toolkit helper 处理 typing、block、final。
- 删除该渠道对 `assistant_stream reset/delta` control message 的主链依赖。

### Phase 4：飞书高级能力对齐

- 飞书保留自己的高级 dispatcher / streaming card 能力。
- 上游从 `dispatchPrompt(): Promise<string>` 改为直接消费 `NcpEventStream`。
- 将 `block`、`final`、tool progress、error 映射到飞书 card / reply / edit 能力。

### Phase 5：清理旧协议

- 移除 channel 回复主链里的 final string contract。
- 移除旧 control message。
- 收敛 `MessageBus outbound` 为非 Agent reply 主协议，或仅保留给明确的系统消息 / legacy bridge。

## 最小目标态示例

微信插件可以极简实现为：

```ts
export class WeixinChannelReplyConsumer implements ChannelReplyConsumer {
  consumeReply = async ({ endpoint, eventStream }: ChannelReplyInput) => {
    for await (const event of eventStream) {
      // 可以直接处理，也可以调用 toolkit helper。
      // 这里只示意插件只面对属于自己的 event stream。
      await this.handleNcpEvent(endpoint, event);
    }
  };
}
```

更常见的实现会用 toolkit：

```ts
export class WeixinChannelReplyConsumer implements ChannelReplyConsumer {
  consumeReply = async (input: ChannelReplyInput) => {
    const actions = this.replyToolkit.translate(input.eventStream);
    for await (const action of actions) {
      await this.deliverAction(input.endpoint, action);
    }
  };
}
```

平台侧则是：

```ts
const eventStream = ncpRunner.streamPromptOverNcp(runInput);
await channelReplyRouter.dispatch({
  route: {
    endpoint,
    consumer,
  },
  eventStream,
});
```

注意：插件没有订阅全局事件，平台也没有广播。

## 非目标

本设计不追求：

- 构建一个全局 event bus。
- 让 channel 插件接收整个系统所有事件。
- 强迫 Web UI 和外部聊天软件使用完全相同的 delivery interface。
- 为了兼容旧链路而长期保留双主链。
- 把 `message-channel` 做成新的大而全 runtime。

## 验收标准

设计落地后，应满足：

- 每个 channel 回复主链都能从 `NcpEventStream` 开始。
- 插件只消费属于自己的 event stream，不做全局过滤。
- 平台内部可以清楚定位一次 channel 输入对应哪个 reply consumer。
- `message-channel` 被理解为 toolkit，而不是强制中间层。
- 新渠道接入时只需要实现 `ChannelReplyConsumer` 和必要的 channel send/edit 能力。
- 删除旧 control message 不会破坏目标态回复能力。

## 最终判断

这套设计比当前旧链路更简单，原因不是“少了一层类”，而是少了多套互相竞争的回复协议。

最终系统只承认三件事：

1. `NCP EventStream` 是回复上游真相。
2. 平台负责把本次 run 定向路由到正确 channel consumer。
3. channel 插件负责把这条属于自己的 event stream 发到自己的聊天世界。

这是更符合 NextClaw “统一入口、能力编排、生态扩展、统一体验”长期愿景的通信输出模型。
