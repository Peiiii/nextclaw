# Cross-Session Request And Child Session Design

## 这份文档回答什么

这份文档沉淀本轮关于以下主题的统一设计结论：

1. 旧 `spawn` 应如何从“内部 worker 机制”演进成长期正确的会话创建能力。
2. `sessions_spawn`、`sessions_request`、`sessions_send` 三者应如何分工。
3. 为什么“完成后通知回当前会话”不应继续以隐藏消息作为核心抽象。
4. 子会话、已有会话、未来 external runtime 会话，如何共享同一套请求-回执协议。
5. 当前实现中哪些路径只是过渡方案，长期应如何迁移。

这不是一份立刻进入实现的任务拆解，而是一份协议与模型收敛文档。目标是先把长期语义边界、核心对象和通知机制讲清楚，避免后续继续以补丁方式叠加。

## 背景

本轮讨论的起点有两个：

- 我们希望 NextClaw 具备真正的 multi-agent 协作能力，而不只是“当前会话里起一个后台小任务”。
- 我们希望一个会话可以向另一个会话发起一轮任务，并在目标会话那一轮真正结束时，收到标准化回执。

在这个目标下，旧 `spawn` 已经不应再停留在“内部子代理特例”。

如果系统长期要支持：

- 当前会话创建一个 child session
- 当前会话向已有 peer session 发起请求
- 当前会话向 future external runtime session 发起请求
- 目标会话完成后，以统一方式通知源会话

那就必须把“会话容器”和“单轮请求”拆开，把“完成事件”和“源会话恢复策略”拆开。

## 当前现状观察

从现有代码可以看到，仓库里已经有多条相关链路，但语义尚未统一：

- [spawn.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/tools/spawn.ts)
  - 当前 `spawn` 更像“起一个后台 subagent run”。
- [subagent.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/subagent.ts)
  - 子任务完成后，通过 `completionSink` 或发布带 metadata 的入站消息，把结果送回源会话。
- [sessions.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/tools/sessions.ts)
  - 当前已有 `sessions_send`，但它是 fire-and-forget，不负责等待最终回复。
- [ncp-subagent-completion-follow-up.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/ncp/ncp-subagent-completion-follow-up.ts)
  - NCP 链路里，子任务完成后会更新原 tool call 结果，并向父会话注入一条 hidden follow-up。
- [ncp-subagent-completion-message.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/ncp/ncp-subagent-completion-message.ts)
  - 这条 hidden follow-up 目前以内部 `user` message 形式承载。
- [events.ts](/Users/peiwang/Projects/nextbot/packages/ncp-packages/nextclaw-ncp/src/types/events.ts)
  - NCP 底层已经有 `message.completed`、`message.failed`、live session stream 等基础事件。
- [agent-backend.ts](/Users/peiwang/Projects/nextbot/packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-backend/agent-backend.ts)
  - 运行态已经具备 session 级别的 live stream 和 terminal event 发布基础。

一句话总结当前状态：

- 系统已经有会话。
- 系统已经有请求流。
- 系统已经有完成事件。
- 但“跨会话请求”还不是一等对象。
- “完成通知”仍主要以 subagent 专用 follow-up 形式存在。

## 本轮讨论形成的核心结论

### 结论 1：旧 `spawn` 应演进为“创建子会话”的能力

旧 `spawn` 不应继续代表“神秘的内部 worker run”。

长期正确方向是：

- `sessions_spawn` 负责创建一个新会话
- 这个新会话是否为 child，不靠单独的 `relation` 字段表达，而是由 `parentSessionId` 是否存在来表达
- 旧 `spawn` 退化为 `sessions_spawn + sessions_request` 的兼容快捷语法

也就是说，旧 `spawn(task)` 的长期语义应为：

1. 创建一个 child session
2. 向该 child session 发起一轮 request
3. 等待该 request 的最终回复
4. 按既定策略将回执投递回源会话

### 结论 2：必须把“会话”和“请求”拆开

系统里必须存在两个不同层级的一等对象：

- `Session`
  - 表示一个会话容器
  - 有自己的身份、关系、生命周期、可见性、绑定信息
- `SessionRequest`
  - 表示一次从源会话发往目标会话的单轮请求
  - 有自己的状态、完成时间、结果、回执策略

否则系统会长期把以下概念揉在一起：

- 目标会话是谁
- 目标会话中的哪一轮是本次任务
- 什么时候算完成
- 完成后是否要恢复源会话

### 结论 3：`sessions_spawn`、`sessions_request`、`sessions_send` 必须正交分工

推荐的长期分工是：

- `sessions_spawn`
  - 只负责创建会话
- `sessions_request`
  - 只负责“一轮请求-回执”
- `sessions_send`
  - 只负责 fire-and-forget 投递

这三者不应混名，不应让单个工具同时承担“建目标、找目标、发请求、等回执、恢复源会话”五种职责。

### 结论 4：完成通知不应以“隐藏消息”作为协议本体

“目标会话完成了”是领域事实。

“要不要向源会话注入一条 hidden follow-up 并继续推理”只是其中一种投递策略。

因此，长期正确模型必须是：

- 完成通知的本体是标准化事件
- hidden message 只是某个 delivery adapter 的具体实现

### 结论 5：完成事件和源会话恢复必须解耦

下面两件事不是一回事：

- 目标 request 完成了
- 源会话应立即继续运行

前者是事实。
后者是策略。

child session 默认可能选择自动恢复源会话。
peer session 默认可能只追加一个内部事件或卡片，不自动恢复。
future external runtime session 可能只能回写结果，不支持自动 resume。

如果不把这两层拆开，系统很快就会重新长出一堆 runtime-specific 特判。

## 推荐的统一抽象

## 1. Session

`Session` 是会话容器，是用户、UI、runtime、持久化都需要理解的一等对象。

推荐最小字段：

```ts
type SessionLifecycle = "persistent" | "ephemeral";

type SessionRecord = {
  sessionId: string;
  sessionType: string;
  runtimeFamily: "native" | "external";
  backendId?: string;
  backendTargetId?: string;
  backendSessionId?: string;
  parentSessionId?: string;
  spawnedByRequestId?: string;
  lifecycle?: SessionLifecycle;
  title?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};
```

关键点：

- `parentSessionId` 是第一阶段唯一需要拍板的“父子关系”字段
- 有 `parentSessionId`，就表示它是 child session
- 没有 `parentSessionId`，就表示它不是 child session
- `spawnedByRequestId` 定义它是由哪次请求创建出来的
- `lifecycle` 保留，但 Phase 1 默认值必须明确为 `persistent`
- `visibility` 在 Phase 1 先不进入协议字段，先默认所有 session 都是可见的

这里要明确一个收敛原则：

- 第一阶段不引入 `relation`
- 第一阶段不引入 `visibility`
- 第一阶段只用 `parentSessionId` 表达“是否是 child session”

这样做的原因不是否认未来可能需要更丰富的关系模型，而是避免在语义尚未被真实实现压过一轮之前，先发明一套过宽但不稳定的枚举。

## 2. SessionRequest

`SessionRequest` 是跨会话协议的核心对象。

它不是消息，也不是事件，而是一条有生命周期的请求记录。

推荐最小字段：

```ts
type SessionRequestStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

type SessionRequestAwaitMode = "none" | "final_reply";

type SessionRequestDeliveryMode =
  | "none"
  | "resume_source";

type SessionRequestRecord = {
  requestId: string;
  sourceSessionId: string;
  targetSessionId: string;
  sourceToolCallId?: string;
  sourceMessageId?: string;
  targetMessageId?: string;
  rootRequestId: string;
  parentRequestId?: string;
  handoffDepth: number;
  awaitMode: SessionRequestAwaitMode;
  deliveryMode: SessionRequestDeliveryMode;
  status: SessionRequestStatus;
  finalResponseMessageId?: string;
  finalResponseText?: string;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  metadata?: Record<string, unknown>;
};
```

关键点：

- `SessionRequest` 才是“我要等你这一轮跑完”的承载体
- `targetMessageId` 用于关联目标会话里真正被处理的那一轮
- `rootRequestId` 和 `parentRequestId` 为未来多级 delegation 保留最小链路
- `handoffDepth` 与现有 ping-pong 约束天然兼容
- `SessionRequest` 第一阶段不携带额外 `relation` 字段
- 这次 request 是否面向 child session，可由目标 `SessionRecord.parentSessionId` 推断

## 3. SessionRequestEvent

完成通知的协议本体应是 `SessionRequestEvent`，而不是 hidden message。

推荐事件集合：

```ts
type SessionRequestEvent =
  | {
      type: "session.request.accepted";
      requestId: string;
      sourceSessionId: string;
      targetSessionId: string;
      targetMessageId?: string;
      timestamp: string;
    }
  | {
      type: "session.request.completed";
      requestId: string;
      sourceSessionId: string;
      targetSessionId: string;
      finalResponseMessageId?: string;
      finalResponseText?: string;
      timestamp: string;
    }
  | {
      type: "session.request.failed";
      requestId: string;
      sourceSessionId: string;
      targetSessionId: string;
      error: string;
      timestamp: string;
    }
  | {
      type: "session.request.cancelled";
      requestId: string;
      sourceSessionId: string;
      targetSessionId: string;
      timestamp: string;
    };
```

关键点：

- 这是系统事实层
- 它不要求 UI 如何展示
- 它也不要求源会话必须恢复
- 它只负责明确表达“这次 request 的状态变化”

## 4. Delivery Adapter

源会话如何收到完成通知，不应写死在 request event 本体里，而应交给 delivery adapter。

推荐 Phase 1 先只支持两种：

- `none`
  - 只更新 request 状态，不主动投递到源会话
- `resume_source`
  - 将完成结果转成源会话可消费的内部输入，驱动其继续运行

这里最关键的一条原则是：

- `append_event` 这类“看起来以后可能会需要”的 delivery 语义，Phase 1 不先保留成协议枚举，避免留下伪语义
- `resume_source` 可以内部使用 hidden follow-up message
- 但 hidden follow-up message 不再是唯一真相源
- 真相源应始终是 `SessionRequestRecord + SessionRequestEvent`

## 推荐的工具与 API 语义

## 1. `sessions_spawn`

长期语义：只创建会话，不隐含请求。

推荐形态：

```ts
sessions_spawn({
  session_type: "native" | "codex" | "claude",
  runtime_family?: "native" | "external",
  backend_id?: string,
  backend_target_id?: string,
  parent_session_id?: string,
  lifecycle?: "persistent" | "ephemeral",
  title?: string,
  metadata?: Record<string, unknown>,
})
```

返回：

```ts
{
  sessionId: string;
  parentSessionId?: string;
  lifecycle: "persistent";
}
```

第一阶段的硬约束建议直接写死：

- 若传入 `parent_session_id`，则创建 child session
- 若不传入 `parent_session_id`，则创建非 child session
- Phase 1 不支持单独配置 `visibility`
- Phase 1 默认所有 session 都视为可见
- Phase 1 默认 `lifecycle = persistent`
- 只有显式要求兼容旧 `spawn` 语义时，才允许调用方把 `lifecycle` 设为 `ephemeral`
- Phase 1 若收到 `relation`、`visibility` 等未纳入协议的字段，应直接报错，不做静默兼容

## 2. `sessions_request`

长期语义：向某个会话发起一轮请求，并按策略等待最终回复。

推荐形态：

```ts
sessions_request({
  target: { session_id: "..." },
  message: "...",
  await: "none" | "final_reply",
  delivery: "none" | "resume_source",
  source_tool_call_id?: string,
  metadata?: Record<string, unknown>,
})
```

第一阶段的硬约束建议同样写死：

- Phase 1 只支持 `target.session_id`
- Phase 1 不支持在 `sessions_request` 里 inline spawn 新 session
- `await` 必须显式传入，不做隐式默认
- `delivery` 必须显式传入，不做隐式默认
- 若 `delivery = resume_source`，实现层才允许注入 hidden follow-up
- 若收到未定义组合，优先直接报错，而不是悄悄降级或猜测调用方意图

返回：

```ts
{
  requestId: string;
  sourceSessionId: string;
  targetSessionId: string;
  status: "queued";
}
```

## 3. `sessions_send`

长期语义：fire-and-forget。

它继续保留，但不再承担“监听目标最终回复”的职责。

## 4. 旧 `spawn`

旧 `spawn` 不应直接删除，但应逐步退化为兼容快捷语法。

推荐兼容映射：

```ts
spawn({
  task,
  model,
  label,
})
```

等价于：

```ts
const child = sessions_spawn({
  session_type: "native",
  parent_session_id: current_session_id,
  lifecycle: "ephemeral",
  title: label,
});

sessions_request({
  target: { session_id: child.sessionId },
  message: task,
  await: "final_reply",
  delivery: "resume_source",
});
```

这样旧 `spawn` 就不再代表独立体系，而只是统一协议上的一层便捷包装。

## 通知机制的标准化设计

## 1. 为什么“隐藏消息即通知本体”不够好

若把通知机制继续设计成“目标完成后，直接塞一条 hidden message 回源会话”，会有四个长期问题：

- 完成事实和源会话恢复策略被耦合
- 不同 runtime 很难共享同一模型
- UI、持久化、回放、调试都只能绕消息层做推断
- 现有 `subagent completion` 特例会不断复制出新的 follow-up 特例

因此，hidden message 可以保留，但只能作为 adapter，不应继续当协议本体。

## 2. 推荐的标准链路

推荐将一次“跨会话请求并等待完成”的完整链路定义为：

1. 创建 `SessionRequestRecord`
2. 向目标 session 发送目标 message
3. 记录 `targetMessageId`
4. 订阅目标 session 的 live stream
5. 识别该目标 message 对应的 terminal event
6. 写回 `SessionRequestRecord.status`
7. 发布标准 `SessionRequestEvent`
8. 调用对应 `DeliveryAdapter`

这里真正的协议顺序是：

- request state
- terminal event
- delivery

而不是：

- 直接发一条特殊 follow-up message
- 再让系统猜这是不是一个完成通知

## 3. 建议新增的后端组件

建议新增一个后端组件：

- `SessionRequestBroker`

职责应严格限定为：

- 创建与持久化 `SessionRequest`
- 订阅目标 session stream
- 识别 terminal event
- 产出标准 completion event
- 调用 delivery adapter

它不负责：

- 定义 UI 卡片长什么样
- 定义 child session 在产品层如何展示
- 直接实现某个 runtime 的业务逻辑

它只是协议编排层。

## 状态机建议

## 1. SessionRequest 状态机

最小状态机建议如下：

```text
queued
  -> running
  -> completed
  -> failed
  -> cancelled
```

说明：

- `queued`
  - request 已创建，尚未确认目标开始处理
- `running`
  - 已收到目标的 accepted 或 run.started
- `completed`
  - 已收到目标该轮的最终 assistant completion
- `failed`
  - 已收到明确 failure 或目标 session 处理失败
- `cancelled`
  - 源请求被取消，或目标执行被显式中断

## 2. Delivery 策略状态机

delivery 不应改写 request 本体状态。

推荐单独作为投递结果记录：

```text
pending
  -> delivered
  -> skipped
  -> delivery_failed
```

这样系统可以明确区分：

- request 已完成
- 但回执投递失败

而不是把两件事模糊成一个“失败”。

## 与现有 NCP 事件体系的关系

这套模型不是要重写 NCP，而是要站在现有 NCP live session 能力之上新增“跨会话 request 层”。

推荐关系如下：

- `message.completed` / `message.failed`
  - 继续作为目标 session 的底层 terminal event
- `SessionRequestBroker`
  - 使用这些底层 terminal event 驱动 request 状态迁移
- `session.request.*`
  - 作为更高层的跨会话协议事件

也就是说：

- NCP 底层事件负责描述“该 session 内发生了什么”
- request 协议事件负责描述“这次跨会话委托发生了什么”

这两层不是替代关系，而是上下层关系。

## 与 UI 的关系

第一阶段不应让 UI 反向驱动协议。

协议层先只保证以下事实：

- child session 可被创建
- request 有独立 identity
- completion event 有统一结构
- delivery mode 可切换

UI 之后可以按自身节奏逐步支持：

- child session inline card
- request status badge
- source session completion notification card
- child session / parent session 跳转关系

但 UI 展示不应决定协议本体结构。

## Child Session 产品交互方案

本轮讨论已经收敛出一个明确推荐方案：

- child session 在模型上是真实 session
- child session 在默认产品表面上不直接等同于“普通新会话”
- 默认体验应优先服务“父会话中的子任务协作”，而不是“侧边栏里新增一条会话”

这意味着：

- 非 child session
  - 继续沿用当前普通新会话体验
  - 像现在一样直接出现在会话列表
- child session
  - 不在默认侧边栏中平铺成普通会话
  - 默认通过父会话中的 `Child Session Card` 暴露

### Phase 1 的默认产品规则

第一阶段的默认交互必须直接写死：

- 父会话中插入一张 `Child Session Card`
- 卡片最少展示：
  - 标题
  - 当前状态
  - 最近进展
  - 最终结果摘要
- child session 是真实 session，拥有独立 `sessionId` 与历史记录
- 侧边栏默认不把 child session 当普通会话平铺出来
- 桌面端点击卡片时，打开右侧详情面板
- 移动端点击卡片时，打开全屏子页面
- 子会话详情视图必须提供明确的 `Back to parent`
- 子会话详情视图必须展示父会话 breadcrumb 或等价父链路提示
- child session 完成后，父会话中的卡片状态必须同步更新
- 若该 request 的 `delivery = resume_source`，则父会话继续往下运行
- 若该 request 不是 `resume_source`，则父会话只显示“已完成”的静态结果，不自动继续
- 只有当用户明确执行“提升为独立会话”动作后，child session 才进入普通会话导航体系

### 为什么不默认进入侧边栏

这条规则必须明确，因为它直接决定产品气质。

若 child session 一创建就像普通会话一样平铺进侧边栏，会立刻产生三个问题：

- 用户会觉得“系统忽然多了一堆会话”，而不是“主任务下多了一个子任务”
- 父子关系在导航层会被冲淡，session tree 心智变弱
- 后续一旦 child session 数量变多，顶层会话导航会快速膨胀

因此，第一阶段应把 child session 的默认可见表面放在父会话内部，而不是顶层导航。

### 为什么不是纯内联 fake task

虽然 child session 默认表现为父会话中的卡片，但它在模型上必须是真实 session，而不是伪装成一段内联消息。

原因是：

- 它未来可能有自己的完整历史
- 它需要独立承载 request、completion、resume、debug 信息
- 它将来可能被提升为独立会话
- 它未来可能承接 external runtime session

所以推荐方案不是“纯内联卡片”，而是：

- 模型上：真实 child session
- 产品上：默认卡片化暴露，按需钻取

### 推荐的交互分层

#### 1. 父会话主流

父会话是默认工作面。

用户在主流里看到的是：

- 一张 child session 卡片
- 该子会话的状态变化
- 最终结果摘要
- 必要时继续由父会话往下推进的主任务结果

这保证用户不会因为子任务存在而失去主线。

#### 2. 子会话详情面

子会话详情面是按需进入的次级工作面。

它负责承接：

- 子会话完整历史
- 更细的执行过程
- 更完整的结果内容
- 与父会话的回跳关系

第一阶段不要求它具备和普通会话完全一样的所有能力，但必须是一个真实可进入的 session 视图。

#### 3. 提升为独立会话

这是显式动作，不是默认行为。

提升后才允许：

- 出现在普通会话导航
- 在新标签打开
- 被固定到侧边栏

这一步的产品意义是：

- 默认保持“子任务”心智
- 只有用户明确升级时，才切换到“独立会话”心智

### Phase 1 明确不做什么

为了避免第一阶段前端表面过度设计，以下内容不进入默认方案：

- child session 默认直接进入顶层侧边栏
- 多层 session tree 常驻导航
- 子会话默认内联展开完整 transcript
- 桌面端多栏常驻父子并排工作区
- 复杂的拖拽、分组、排序和批量管理

第一阶段只做：

- 父会话卡片
- 按需钻取详情
- 明确返回父会话
- 明确提升为独立会话

### 对实现的直接要求

为了避免后续实现漂移，这里补充几条硬约束：

- child session 创建后，默认不得自动写入普通会话列表数据源的顶层展示集合
- 会话列表若需要持有 child session 数据，也只能先以“非顶层可见”方式存在
- `Child Session Card` 必须以 session identity 驱动，而不是以临时 tool result 文本拼接驱动
- 详情面打开逻辑必须依赖真实 `sessionId`
- `Back to parent` 必须始终可用，不能依赖浏览器历史刚好存在
- “提升为独立会话”必须是显式用户动作，不能在某些状态下自动发生
- `resume_source` 与否必须只影响父会话后续是否继续运行，不得影响 child session 是否可见、是否可进入详情

## 迁移建议

## Phase 0：协议收敛

先引入以下对象与组件定义：

- `SessionRecord` 的 parent/child 字段
- `SessionRequestRecord`
- `SessionRequestEvent`
- `SessionRequestBroker`

这一步不要求立刻删除旧路径，但要求新模型先存在。

并且需要明确限制：

- 不新增 `relation` 字段
- 不新增 `visibility` 字段
- `lifecycle` 虽保留，但默认值必须在协议和实现里同时固定为 `persistent`
- Phase 1 的 child 判定只认 `parentSessionId`
- `sessions_spawn` 和 `sessions_request` 对未定义字段或未定义组合必须 fail fast
- 禁止用“自动兜底成旧行为”的方式掩盖协议不明确问题

## Phase 1：把旧 `spawn` 映射为 child session + request

将旧 `spawn` 的核心执行路径从“内部 subagent run”逐步迁移到：

- 创建 child session
- 对 child session 发起 request
- 等待 request terminal event

这样旧 `spawn` 就能自然服务于长期 session tree 模型。

## Phase 2：把 completion follow-up 从“本体”降级为 adapter

把当前 NCP subagent completion follow-up 调整为：

- request completion 的 delivery adapter

不再把 hidden follow-up 当作协议真相源。

## Phase 3：统一已有会话与子会话的 request 路径

确保以下两条路径共享同一个 broker：

- 向 child session 发 request
- 向已有 peer session 发 request

这样系统才真正完成“跨会话请求”收敛。

## Phase 4：把 external runtime session 纳入同一模型

在 child session 和 peer session 模型稳定后，再将：

- SDK runtime session
- ACP/backend session

接入同一 request 协议层。

这一步应复用现有 external runtime framework 设计方向，而不是另起炉灶。

## 明确不做什么

为了避免这轮设计过度膨胀，以下内容不应进入本轮最小模型：

- 可视化 orchestration DAG
- 多级 delegation 的复杂策略 UI
- 全量 approval/permission 协议统一
- 所有 runtime 的 thread binding 细节一次做完
- 所有 adapter 的 capability matrix 一次铺满

本轮设计的目标只应是：

- 统一 child session 语义
- 统一跨会话 request 语义
- 统一 completion notification 语义

## 最终结论

本轮讨论的最终收敛如下：

1. 旧 `spawn` 应升级为“child session 创建 + request 发起”的快捷语法，而不是继续维持为内部特例机制。
2. 系统必须同时拥有 `Session` 和 `SessionRequest` 两种一等对象，不能把它们混为一体。
3. `sessions_spawn`、`sessions_request`、`sessions_send` 应正交分工，不应继续混名和混责。
4. “目标完成后通知回源会话”的协议本体应是标准化 request completion event，而不是 hidden follow-up message。
5. hidden follow-up message 可以保留，但只能降级为 `resume_source` delivery adapter 的一种实现。
6. 完成事实与源会话恢复策略必须解耦，否则 multi-agent、child session、peer session、external runtime session 都会再次长出并行特例。
7. Phase 1 的 `Session` 模型必须收敛到最小必要集合：只用 `parentSessionId` 表达 child 关系，不提前引入 `relation` 和 `visibility` 两套过宽字段。

## 相关参考

- [external-agent-runtime-framework-design.md](/Users/peiwang/Projects/nextbot/docs/plans/2026-03-31-external-agent-runtime-framework-design.md)
- [external-agent-session-framework-v1-plan.md](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-01-external-agent-session-framework-v1-plan.md)
- [subagent-completion-and-visibility-plan.md](/Users/peiwang/Projects/nextbot/docs/plans/2026-03-31-subagent-completion-and-visibility-plan.md)
- [spawn.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/tools/spawn.ts)
- [subagent.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/subagent.ts)
- [sessions.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/tools/sessions.ts)
- [ncp-subagent-completion-follow-up.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/ncp/ncp-subagent-completion-follow-up.ts)
- [ncp-subagent-completion-message.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/ncp/ncp-subagent-completion-message.ts)
- [events.ts](/Users/peiwang/Projects/nextbot/packages/ncp-packages/nextclaw-ncp/src/types/events.ts)
- [agent-backend.ts](/Users/peiwang/Projects/nextbot/packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-backend/agent-backend.ts)
