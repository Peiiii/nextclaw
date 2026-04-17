# Directed NCP Event Channel Cutover Plan

## 目标

将当前多套并存的 channel 回复链，收敛到统一目标态：

- 上游唯一真相源：`NcpEventStream`
- 平台负责定向路由
- channel 插件直接消费属于自己的 reply event stream
- `message-channel` 只作为 toolkit

本计划不追求“兼容所有旧路径很久”，而追求尽快建立单主链，并逐步删除旧协议。

## 非目标

本计划不做：

- 开放式全局事件订阅
- 为所有历史渠道长期保留双轨主链
- 把 Web UI 和外部聊天软件强行塞进同一 delivery interface
- 在 `nextclaw` CLI 包里继续堆积机制性协议定义
- 把 `MessageBus` 直接升级成新的 Agent reply 主协议

## 现状问题

当前回复输出存在三套主链：

1. Web UI
   - `ncpAgent HTTP + streamProvider + session realtime`
2. 传统渠道
   - `MessageBus inbound/outbound + control message + final string`
3. 飞书插件
   - `dispatchPrompt(): Promise<string> + reply dispatcher`

问题在于：

- 同一次回复被表达为 event、string、control message 三种合同。
- 渠道快发和工具过程展示能力无法自然复用。
- 新 channel 接入心智模型复杂。
- 迁移时容易继续叠加而不是删减。

补充一点：

- `MessageBus` 当前已经在承担 inbound/outbound transport。
- 真正的问题不是“系统里有 MessageBus”。
- 真正的问题是“当前 Agent reply 需要先被压成 `OutboundMessage`，并靠 control metadata 补 streaming 语义”。

## 删除总原则

这次改造不是“在旧链旁边再搭一条新链”，而是“先搭新主链，再逐段删除旧主链”。

判断标准只有一个：

**凡是把同一次 Agent 回复再次压扁、私有化、重复表达的中间合同，最终都应该删。**

尤其要避免这几种坏结果：

- 新链搭好了，但旧 `assistant_stream` 还继续作为主路径存在。
- 微信切完了，但微信同时还保留旧 control message 逻辑。
- 飞书接入新 event stream 后，`dispatchPrompt(): Promise<string>` 还继续作为默认入口。
- `message-channel` 做成了新中间层，但旧中间层一个没删。

原则上：

- 能在微信首切时删除的，就不要拖到全量 cutover。
- 不能立即删除的，必须明确它只是 temporary bridge。
- 所有 temporary bridge 都要有最终删除阶段，不允许无限期保留。

## 删除矩阵

### A. 微信首切时必须删除的旧链依赖

这些对象一旦微信切到新主链，就不应该再继续作为微信回复主链的一部分：

1. `packages/nextclaw/src/cli/commands/ncp/runtime/nextclaw-ncp-dispatch.ts`
   - 微信回复路径里对 `createAssistantStreamResetControlMessage(...)`
   - 微信回复路径里对 `createAssistantStreamDeltaControlMessage(...)`
   - 微信回复路径里对 `createTypingStopControlMessage(...)`
   - 微信回复路径里通过 `runPromptOverNcp()` 把 stream 压成 `result.text`

2. `packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-channel.ts`
   - 微信回复路径对 `isTypingStopControlMessage(...)` 的主链依赖
   - 微信不应再通过旧 outbound control message 来驱动 typing stop

3. 微信相关测试
   - 任何以“旧 control message 驱动微信回复”为核心断言的测试，都应改写或删除

### B. 首个简单渠道验证完成后应删除的共享旧协议

这些对象在首个渠道新链稳定后就应进入删除窗口，不应再被视为长期共享协议：

1. `packages/nextclaw-core/src/bus/control.ts`
   - `assistant_stream` control message 定义
   - `createAssistantStreamResetControlMessage(...)`
   - `createAssistantStreamDeltaControlMessage(...)`
   - `isAssistantStreamResetControlMessage(...)`
   - `readAssistantStreamDelta(...)`

2. 对应测试
   - `packages/nextclaw-core/src/bus/control.test.ts`
   - `packages/nextclaw-core/src/channels/manager.typing-control.test.ts`

说明：

- `typing-stop` 是否保留，需要单独判断。
- 如果 typing stop 只是历史 bus 控制消息语义的一部分，也应一起删除。
- 如果 typing stop 还能作为非回复链的极小系统控制协议存在，需要明确改名和缩小作用域，不能继续混在 reply control 里。

### C. 飞书切换时必须删除的旧桥

这些对象在飞书切到直接消费 `NcpEventStream` 后，不应继续作为飞书 reply 主入口：

1. `packages/nextclaw/src/cli/commands/service-support/plugin/service-plugin-runtime-bridge.ts`
   - `dispatchPrompt: (...) => Promise<string>` reply 主入口
   - `const response = await dispatchPrompt(request)`
   - `replyText = typeof response === "string" ? response : ...`
   - `dispatcherOptions.deliver({ text: replyText }, { kind: "final" })`

2. 飞书 reply 主链中的“最终字符串”假设
   - 飞书 dispatcher 上游不应再只收到 final text
   - 应改为直接接 block/final/tool/error 等事件或 toolkit action

### D. 全量 cutover 完成后必须总删除的旧主链

以下对象在所有聊天渠道都切换完成后，应彻底删除，不再保留为兼容主链：

1. `packages/nextclaw/src/cli/commands/ncp/runtime/nextclaw-ncp-dispatch.ts`
   - channel reply 主链里的旧 `bus.publishOutbound(...)` 路径
   - 依赖 `runPromptOverNcp()` 的传统 channel reply 逻辑

2. `packages/nextclaw-core/src/channels/manager.ts`
   - 作为 Agent reply 主链的 `consumeOutbound() -> deliver()` 模式
   - 如果 `ChannelManager` 仍有必要存在，也应只保留 channel lifecycle / legacy system message 等非 reply 主职责

3. `packages/nextclaw-core/src/bus/queue.ts`
   - `publishOutbound/consumeOutbound` 不再作为 Agent 回复主协议
   - `MessageBus` 若保留，也必须降级为 transport / system message / temporary bridge
   - 不再承载 `NcpEventStream -> final string/control message -> channel` 这条 reply 主链

4. 所有聊天渠道里对旧 control message 的处理分支
   - Telegram
   - Weixin
   - Discord
   - 其它仍依赖 `isTypingStopControlMessage` / `assistant_stream` 的实现

### E. 明确允许暂时保留但必须标记的桥

在迁移期间，以下对象可以短期保留，但必须被清楚标记为 temporary bridge：

1. `runPromptOverNcp()`
   - 仅作为 CLI/direct request 或迁移桥
   - 不得继续扩展为 channel reply 主入口

2. `dispatchPromptOverNcp()`
   - 仅作为旧插件或旧 direct dispatch 的迁移桥
   - 不得作为目标态插件回复主协议

3. `MessageBus outbound`
   - 只允许用于明确非 Agent reply 的系统消息、遗留通道、短期桥接
   - 不得继续承载新 channel reply 主链

## 实施原则

### 1. 先立协议，再切链路

先把类型和接口收敛为最终共识，再开始实际 cutover。否则边改边讨论，容易再次引入中间合同。

### 2. 先接入定向路由，再替换渠道

平台内部必须先具备“为一次 run 绑定一个 reply consumer”的能力。没有这个基础设施，后面每个渠道都会各自发明桥接方式。

这里的关键不是替换掉所有 bus，而是替换掉“reply 必须重新编码为 bus outbound”的主链。

### 3. 先选一个简单渠道切通

先用微信或 Telegram 切一条最小闭环，验证：

- event stream 定向路由
- typing
- block/final
- abort / cleanup

飞书放在后面，因为它有更复杂的 card / thread / reply dispatcher。

### 4. 迁移完成后就删旧链

一旦某个渠道切到新主链，就不再允许它继续依赖：

- `assistant_stream reset/delta`
- 该渠道的 final string 主链
- 旧 bus outbound reply contract

### 5. 不新增第二套插件注册生命周期

实现新链时，必须复用现有：

- `register(api)`
- `registerChannel(...)`
- `createChannel(...)`

禁止新增：

- `registerReplyConsumer(...)`
- `registerChannelReply(...)`
- `registerReplyRuntime(...)`

之类的平行注册机制。

新链的 reply consumer 能力必须直接挂在 channel instance 上。

## Phase 1：协议收口

### 目标

把当前 `message-channel` 从“看起来像强制 runtime”收成“明确的 toolkit + 插件直接消费协议”。

### 任务

- 收敛 `message-channel.types.ts`
- 明确 `ChannelReplyConsumer` 或等价命名是插件核心接口
- 明确 `MessageChannelEndpoint`
- 明确“平台负责路由，不做广播”
- 删除或重命名误导性的 `runtime` 风格词汇
- 明确哪些类型属于 toolkit，哪些类型属于平台协议
- 明确 `ReplyCapableChannel = BaseChannel & Partial<ChannelReplyConsumer>`
- 明确插件不需要新增注册入口，只扩展 channel instance 能力

### 产出

- 最终类型文件
- 设计文档与类型表达一致

### 完成标准

- 读类型文件即可理解：
  - 哪部分是平台协议
  - 哪部分是插件接口
  - 哪部分是 toolkit helper
- 读计划文档即可知道后续会删哪些旧桥

## Phase 2：平台定向路由接入

### 目标

在应用层建立“channel 输入 -> run -> reply consumer”的一对一绑定。

### 任务

- 增加平台内部 `ChannelReplyRouter`
- 增加临时 `ChannelRunBinding`
- 在 channel inbound 触发 run 时，不再直接走最终字符串链，而是创建 `eventStream`
- 将 `eventStream` 定向交给 route 对应的 consumer
- 为 abort / failure / cleanup 建立统一处理
- 保持旧链仅作为 temporary bridge，不新增旧合同使用点
- 扩展 `ExtensionChannel.nextclaw.createChannel(...)` 的实例返回值类型，使其可承载 `consumeReply(...)`
- 扩展 `ChannelManager`，使其可以从现有 channel instances 中解析 reply-capable channel

### 建议落点

- `nextclaw` 应用层负责 route / binding / lifecycle
- `@nextclaw/ncp-toolkit` 不负责应用级路由状态
- 插件系统继续只负责注册 channel，不负责 reply routing

### 完成标准

- 平台内部能够回答：
  - 这次 channel 输入对应哪个 consumer
  - 这条 event stream 只会发给谁
  - run 结束后如何清理
- 整个实现没有引入新的插件注册 API
- 新 reply 主链不再要求先构造 `OutboundMessage` 才能把回复送到 channel

## Phase 3：首个简单渠道切换

### 目标

选择一个简单渠道切换到新主链，验证协议是否够用。

### 推荐渠道

- 微信
- 或 Telegram

推荐先做微信，原因是：

- 场景直接
- 线程和卡片复杂度低于飞书
- 与用户最初提出的“快发体验”场景高度相关

### 任务

- 为该渠道实现 `ChannelReplyConsumer`
- 将渠道当前 reply 主链从 final string / control message 改为 NCP event stream
- 通过 toolkit 或自定义逻辑处理：
  - typing-start
  - block flush
  - final
  - error
- 删除该渠道对旧 control message 的主链依赖
- 删除该渠道在旧 dispatch/bus 路径上的 reply 主分支
- 保持该渠道原有 `start/stop` 生命周期不变
- 将 `consumeReply(...)` 直接落在该 channel class 上，而不是拆成单独注册对象

### 完成标准

- 用户可在该渠道中看到边说边做
- 不再需要 `assistant_stream reset/delta`
- 该渠道回复主链从 `streamPromptOverNcp()` 开始
- 该渠道代码里不再出现“旧 control message 才能工作”的主逻辑
- 该渠道插件注册代码仍然只使用 `registerChannel(...)`

## Phase 4：飞书高级链路切换

### 目标

保留飞书高阶交互能力，但把上游切换为 NCP event stream。

### 任务

- 保留现有 reply dispatcher / streaming card / thread reply 能力
- 将上游输入从 `dispatchPrompt(): Promise<string>` 改为 `NcpEventStream`
- 让飞书 dispatcher 直接消费 block/final/tool/error 等事件或 toolkit 动作
- 不再把 final string 作为飞书主输入合同
- 删除飞书 reply 主链里的 final string bridge
- 飞书仍然通过既有 channel plugin 生命周期注册，不额外新增 reply consumer 注册点

### 风险

- 飞书对 reply / edit / card / topic 的语义比其他渠道复杂
- 需要避免把“飞书的高级实现”反向污染通用协议

### 完成标准

- 飞书仍保留 card / thread / typing 等高级体验
- 但上游已切到统一 `NcpEventStream`

## Phase 5：旧协议删除

### 目标

移除旧回复主链，避免长期双轨并存。

### 删除对象

- `assistant_stream reset/delta` reply 主链
- channel reply 依赖的 final string contract
- `dispatchPrompt(): Promise<string>` 作为插件 reply 主入口
- 旧 bus outbound reply 协议
- 旧 reply control message tests
- 各 channel 中只为旧 reply control 而存在的分支代码

### 可以保留的桥

- 仅用于极短迁移窗口的 adapter
- 明确标注为 temporary bridge

### 完成标准

- 新增 channel 不再允许走旧链
- 老 channel 切换完成后对应旧桥立即删除

## 推荐改造顺序

1. 类型和文档收口
2. 平台内部 reply router 落地
3. 微信或 Telegram 首个 cutover
4. 飞书高级链切换
5. 删除旧 control message 和 final string 主链

## 需要改的类型和类

### 类型

第一阶段需要收敛的核心类型：

- `MessageChannelEndpoint`
- `ChannelReplyInput`
- `ChannelReplyConsumer`
- `ReplyCapableChannel`
- `ChannelReplyDispatchInput`
- `ChannelRunBinding`

这些类型应优先落在 `@nextclaw/ncp-toolkit/message-channel` 与应用层 glue code 中，不再散落在 CLI runtime 各处。

### 平台类

第一阶段只建议新增一个核心平台类：

- `ChannelReplyRouterService`

职责：

- 运行时根据 `endpoint.channelType` 找到已创建的 channel instance
- 检查该 instance 是否支持 `consumeReply(...)`
- 将定向 `eventStream` 交给它
- 管理 abort / cleanup / error

### 渠道类

第一阶段不建议新增“独立 reply consumer 注册类”。

渠道直接扩展现有 channel class：

- `WeixinChannel` 新增 `consumeReply(...)`

如果后续某个渠道复杂度很高，再考虑拆出：

- `FeishuChannelReplyConsumer`
- `TelegramChannelReplyConsumer`

但默认不这么做。

优先原则是：

**一个 channel 插件继续只拥有一个主要 channel class。**

## 分阶段删减清单

### Phase 1 完成时

必须完成：

- 旧命名和误导性协议词汇收敛
- 类型真相源中不再暗示存在强制 runtime layer

暂不删除：

- 旧 bus/control 代码
- `dispatchPrompt(): Promise<string>` bridge

### Phase 2 完成时

必须完成：

- 新 reply router 可运行
- 新链路已能承接一次定向 event stream 消费

暂不删除：

- 各渠道旧路径

禁止新增：

- 任何新的 final string / control message 主合同

### Phase 3 完成时

必须删除：

- 微信 reply 主链上的旧 control message 依赖
- 微信 reply 主链上的 final string 压扁路径

可以暂留：

- 其它未迁移渠道的旧桥

### Phase 4 完成时

必须删除：

- 飞书 reply 主链上的 final string bridge
- 飞书通过 `dispatchPrompt(): Promise<string>` 获取回复的默认路径

### Phase 5 完成时

必须删除：

- `assistant_stream` reply control 协议
- final string reply 主合同
- `MessageBus outbound` reply 主链
- 各渠道中依赖这些协议的历史分支

## 验证方式

### 协议级验证

- 类型文件是否能独立表达最终协议
- 设计文档与实际类型是否一致

### 行为级验证

- 指定渠道中是否能看到逐块快发
- tool 执行过程是否能提前展示
- abort 是否能正确停止该次回复流
- run 结束后是否正确清理 binding

### 回归级验证

- Web UI 现有 session realtime 不退化
- 非切换渠道在迁移期间可继续工作
- 切换完成的渠道不再依赖旧 control message

## 风险与约束

### 1. 短期桥接会诱导继续保留旧链

必须在每一阶段结束时判断：

- 哪些 bridge 还能存在
- 哪些 bridge 已经应该删除

### 2. 飞书可能诱导协议过度复杂

通用协议只保留普适语义。飞书 card、topic、reply-thread 等复杂度应留在插件内部或 toolkit 扩展里，不要反向污染平台协议。

### 3. Web UI 不应被错误地拉进聊天软件抽象

Web UI 共享上游 event truth，但不要求与外部聊天软件共享同一 delivery interface。

## 最终验收标准

当以下条件同时成立时，认为 cutover 完成：

- channel 回复主链已统一以 `NcpEventStream` 为上游
- 平台只做定向路由，不做全局广播
- channel 插件只消费属于自己的 reply stream
- `message-channel` 被稳定理解为 toolkit
- 旧 `assistant_stream` / final string reply 主链已删除
- 新 channel 接入只需实现 channel consumer 和自身发送能力

## 与长期目标的关系

这次 cutover 并不是单纯为了“微信快发”。

它推进的是更长期的一步：

- 统一入口下的统一回复主链
- 更清晰的插件生态边界
- 更少的中间协议和历史包袱
- 更容易把新渠道、新输出面纳入同一套 Agent 回复模型

这更符合 NextClaw 作为“AI 时代个人操作层”的长期方向。
