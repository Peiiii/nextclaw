# 全局 Typed Event Bus 与 Learning Review 设计方案

日期：2026-04-15

相关文档：

1. [Hermes 自动复盘与学习机制实现梳理](./2026-04-15-hermes-learning-review-mechanism-analysis.md)
2. [Session Search Feature Design](../plans/2026-04-15-session-search-feature-design.md)
3. [Session Search Implementation Plan](../plans/2026-04-15-session-search-implementation-plan.md)

## 1. 这份文档解决什么问题

这份文档要解决的是下一阶段的基础架构问题：

**我们如何在 NextClaw 内部，以尽可能轻量、优雅、可插拔、可删除的方式，做出 Hermes 风格的自动复盘 / 自动沉淀 skill 能力。**

这里的关键不是先写一个“learning review 功能”，而是先把它赖以成立的系统底座设计对：

1. 需要一个真正独立的、系统级的、全局的事件总线。
2. 这个事件总线应当放在 `core` 内核模块中，作为底座机制存在。
3. 这个事件总线必须是 typed 的，但不应当做成庞杂的“万能总线框架”。
4. learning review 不应当侵入现有 agent 主链路，而应当作为一个订阅者挂载到这个总线上。
5. 当前已有的 NCP runtime/backend 事件不是这个总线本身，但可以被桥接进来，作为这个总线的输入源之一。

一句话概括：

**先做一条干净的系统级事件骨架，再把 Hermes 风格的后台 review agent 作为第一个订阅型 feature 接上去。**

## 2. 结论先写在前面

我的最终设计判断如下：

1. 不复用现有 `MessageBus`，也不把 learning review 直接挂在已有 callback 拼接链上。
2. 在 `@nextclaw/core` 中单独引入一个新的全局 typed event bus 机制。
3. 这个 bus 只负责事件发布与订阅，不承担 message queue、state bus、service bus、resource bus 等额外职责。
4. NCP runtime/backend 通过一个很薄的 bridge，把已有生命周期事件映射到这个新 bus。
5. learning review 以独立 feature 的形式订阅 `agent.run.finished` 等事件，执行 root session 过滤、阈值判断、后台 review 子会话触发。
6. session search 不是这个 bus 的一部分，但会成为 review agent 的重要增强输入。

这意味着我们最终会得到三层清晰边界：

```text
core 全局 typed event bus
  -> NCP lifecycle bridge
    -> learning review subscriber
```

这个结构的价值是：

1. bus 是底座，可长期复用。
2. bridge 是接缝，可替换。
3. learning review 是 feature，可单独删除。

## 3. 设计目标

### 3.1 必须满足的目标

1. **独立性**：新 bus 不复用旧 bus 的实现、职责和命名。
2. **全局性**：在系统内逻辑上只有一个事件总线实例。
3. **typed**：事件 key 自带 payload 类型绑定。
4. **轻量化**：bus 本体只做最小职责，不堆框架感。
5. **可插拔**：learning review 只是 subscriber，不应污染 agent 主链路。
6. **可删除**：未来删掉 learning review 时，不应反向伤害 bus 与主链路。
7. **可演进**：未来别的系统级 feature 也能挂上这个 bus。

### 3.2 明确不做的事

1. 不在这次设计里引入全家桶式 environment bus。
2. 不在这次设计里把所有历史 callback 统一替换成 bus。
3. 不在这次设计里做事件持久化、事件回放、事件 sourcing。
4. 不在这次设计里强行抽象出复杂 middleware 体系。
5. 不在这次设计里把 bus 做成跨进程协议。

这次只做：

**单进程内、逻辑全局唯一、typed、可订阅、面向生命周期事件的系统底座。**

## 4. 为什么必须新建一个 bus

当前仓库里已经有 [`queue.ts`](../../packages/nextclaw-core/src/bus/queue.ts)，但它的职责是 message queue，不是系统级 lifecycle event hub。

它的问题不在于“代码不好”，而在于“语义不是为这个场景设计的”：

1. 它面向 inbound/outbound queue。
2. 它偏消费队列语义，不是 typed lifecycle signal。
3. 它没有基于 typed key 的事件模型。
4. 它不是以“系统全局事件中枢”为边界设计的。

如果强行复用，后续会出现的问题不是“不能工作”，而是：

1. 语义混乱。
2. 事件模型会被 message queue 模型拖歪。
3. learning review 这种系统 feature 会被挂在错误的基础设施上。
4. 未来再接第二个、第三个 subscriber 时，代码会变脏。

所以这里更好的做法不是“兼容复用”，而是：

**单独建立一个正确语义的新底座，再把已有事件桥接过来。**

## 5. 总体架构

### 5.1 模块分层

建议分成三个模块层次：

```text
packages/nextclaw-core/src/typed-event-bus/
  - 纯底座

packages/nextclaw/src/cli/commands/ncp/lifecycle-events/
  - NCP 领域事件 key、payload、bridge

packages/nextclaw/src/cli/commands/ncp/learning-review/
  - Hermes 风格后台复盘 feature
```

### 5.2 为什么这样拆

这样拆是为了同时满足“全局底座”与“领域解耦”：

1. `core` 里只放机制，不放 NCP 业务语义。
2. NCP 生命周期事件定义放在 NCP 侧，避免把领域耦合灌进 core。
3. learning review 作为 feature 单独存在，不直接写进 bus 或 bridge。

这样以后如果我们想删 learning review：

1. 删掉 `learning-review/`
2. 去掉一处注册
3. bus 和 bridge 都不用大改

这正是你希望的“可插拔、可轻松删除”的结构。

## 6. Core 层：全局 Typed Event Bus 设计

### 6.1 建议目录

建议在 `@nextclaw/core` 中新增：

```text
packages/nextclaw-core/src/typed-event-bus/
  typed-event-key.ts
  typed-event-bus.ts
  global-typed-event-bus.ts
  index.ts
```

### 6.2 核心对象

核心上只保留两个概念：

1. `TypedEventKey<T>`
2. `GlobalTypedEventBus`

建议接口如下：

```ts
export type TypedEventKey<T> = {
  readonly id: string;
  readonly _type?: T;
};

export class GlobalTypedEventBus {
  emit = <T>(key: TypedEventKey<T>, payload: T): void => {};
  on = <T>(key: TypedEventKey<T>, handler: (payload: T) => void): (() => void) => {};
  off = <T>(key: TypedEventKey<T>, handler: (payload: T) => void): void => {};
  once = <T>(key: TypedEventKey<T>, handler: (payload: T) => void): (() => void) => {};
  subscribeAll = (handler: (event: { key: string; payload: unknown }) => void): (() => void) => {};
}
```

### 6.3 为什么 bus 要保持这么薄

这里不能一开始就做重。原因很简单：

1. 我们当前要解决的是系统级信号分发，不是工作流引擎。
2. bus 的价值在于“稳定边界”，不是“功能很多”。
3. 一旦在 bus 里提前堆 middleware、状态、资源、能力调用，后面只会反过来拖累所有 feature。

所以 bus 只做：

1. 注册监听器
2. 分发事件
3. 调试观察

仅此而已。

### 6.4 “全局”不等于“隐藏单例”

这里的“全局”建议理解为：

**逻辑上系统唯一，由应用 composition root 创建并向下传递。**

不建议做成 import 即得的隐式模块级单例。原因是：

1. 测试更难隔离。
2. 生命周期更难管理。
3. 隐式依赖更容易扩散。

更稳妥的做法是：

1. 在系统装配根部创建一个 `GlobalTypedEventBus`
2. 把它注入到 `createUiNcpAgent` 以及后续需要的 feature
3. 整个进程只创建这一份实例

这样既满足“全局唯一”，也保留测试性与可控性。

### 6.5 dispatch 语义

建议 `emit()` 保持同步分发语义，bus 本身不等待异步 handler。

原因：

1. 这样最简单、最可预测。
2. bus 不负责任务调度，只负责信号通知。
3. learning review 这类后台任务应当由 subscriber 自己显式异步化。

因此推荐约束是：

1. bus listener 默认必须快速返回。
2. 长任务 listener 内部自行 `void this.handleInBackground(...)`。
3. bus 负责捕获 listener 异常并路由到统一日志，不允许一个 listener 影响其他 listener。

## 7. NCP 层：Lifecycle Event Bridge 设计

### 7.1 这个 bridge 的职责

bridge 的职责只有一个：

**把已有 NCP runtime/backend 的事件，映射成系统级 typed events，并发布到全局 bus。**

它不是 bus 的一部分，也不是 learning review 的一部分。

### 7.2 为什么需要 bridge

当前 NCP 层已经有自己的事件结构：

1. [`events.ts`](../../packages/ncp-packages/nextclaw-ncp/src/types/events.ts) 定义了 `RunFinished`、`MessageSent` 等事件。
2. [`runtime.ts`](../../packages/ncp-packages/nextclaw-ncp-agent-runtime/src/runtime.ts) 会发出这些运行时事件。
3. backend 也已经有 event publisher 能把事件暴露出来。

这些事件已经够好，但它们仍然是 **NCP 事件**，不是 **系统全局事件总线事件**。

bridge 的价值就是保持两件事同时成立：

1. NCP 自己的事件模型继续保持原样。
2. 系统级 feature 可以在统一总线上观察这些信号。

### 7.3 建议目录

```text
packages/nextclaw/src/cli/commands/ncp/lifecycle-events/
  ncp-lifecycle-event.keys.ts
  ncp-lifecycle-event.types.ts
  ncp-lifecycle-event-bridge.ts
  index.ts
```

### 7.4 初始事件目录

第一版不宜一次铺太多。建议先只桥接对当前和近期 feature 真有价值的事件：

1. `agent.run.started`
2. `agent.run.finished`
3. `agent.run.failed`
4. `agent.message.sent`
5. `agent.session.updated`

其中真正对 learning review 必需的是：

1. `agent.run.finished`
2. `agent.session.updated`

### 7.5 payload 设计原则

payload 不能只把 NCP 原始 payload 原封不动塞进去。更好的方式是：

1. 保留稳定字段。
2. 补足 feature 真需要的上下文。
3. 不预埋过多业务推断。

例如 `agent.run.finished` 建议至少包含：

```ts
type AgentRunFinishedEvent = {
  sessionId: string;
  runId?: string;
  messageId?: string;
  sessionType?: string;
  parentSessionId?: string;
  isChildSession: boolean;
  emittedAt: string;
};
```

这里面最重要的是：

1. `sessionId`
2. `parentSessionId`
3. `isChildSession`

这样 subscriber 无需再自己到处拼字段，就能直接做 root session 过滤。

### 7.6 bridge 接入点

建议通过 [`create-ui-ncp-agent.ts`](../../packages/nextclaw/src/cli/commands/ncp/create-ui-ncp-agent.ts) 做接入装配。

原因：

1. 它已经是当前 NCP agent 的组合根。
2. 当前 `backend`、`session store`、`session update` 钩子都在这里汇聚。
3. 把 bridge 放在这里，侵入性最小。

推荐做法是：

1. `createUiNcpAgent()` 接收 `globalEventBus`
2. 在内部创建一个 `NcpLifecycleEventBridge`
3. 让它订阅 backend 事件
4. 同时把 `onSessionUpdated` 这类 session mutation 也转发到 bridge

这样无需大改 backend 核心逻辑。

## 8. Learning Review 设计

### 8.1 核心思想

learning review 的实现思想，直接借鉴 Hermes，但不硬抄其线程细节：

1. 主回复先完成
2. 收到 `agent.run.finished`
3. 后台异步判断是否要复盘
4. 如需复盘，则 fork 一个专用 review 子会话
5. review 子会话自行判断是否沉淀 skill / 总结经验

我们抄的是机制思想：

**post-response background review**

不是具体实现形式：

**Python thread**

在 NextClaw 中，更适合的承载体是现有 child session / multi-agent 能力。

### 8.2 建议目录

```text
packages/nextclaw/src/cli/commands/ncp/learning-review/
  learning-review-feature.ts
  learning-review.types.ts
  learning-review.constants.ts
  learning-review-prompt.ts
  index.ts
```

### 8.3 owner class

建议只保留一个 owner class：

`LearningReviewFeature`

它负责：

1. 启动时向 bus 注册订阅
2. 处理 `agent.run.finished`
3. root session 过滤
4. 阈值判断
5. 后台 review 子会话触发
6. watermark 更新

不要再拆出一堆 `service / coordinator / manager / orchestrator / dispatcher`。

当前最好的做法是：

**一个 owner class 收敛 feature 主逻辑，少量 types/constants 做辅助。**

### 8.4 为什么只监听 `agent.run.finished`

因为 Hermes 的精髓不是“每个中间事件都反应”，而是：

**在一次主回复完成之后，再决定是否做后台复盘。**

这有三个好处：

1. 不影响主响应体验。
2. 语义最稳定。
3. 不容易把 subscriber 变成业务编排器。

### 8.5 root session 过滤

learning review 第一版只处理 root session，不处理 child session。

原因：

1. child session 往往是工具性、阶段性、局部任务线程。
2. 如果 child session 也参与 learning review，极易形成噪声和套娃。
3. Hermes 也有明确的防递归思想，我们这里应更保守。

当前仓库里已经有 `parent_session_id` 元数据基础，因此判断逻辑可以很简单：

1. `parentSessionId` 存在 -> child session -> 跳过
2. `parentSessionId` 不存在 -> root session -> 继续

### 8.6 触发阈值

第一版建议按“自上次 review 以来累计的工具调用数”触发，而不是按 turn 数触发。

原因：

1. 我们当前要沉淀的是 procedural skill。
2. procedural skill 更接近“多轮工具使用经验”而不是“聊天轮数”。
3. 用户也已经明确提出希望按工具调用量来判断。

建议默认阈值先从：

`15`

开始。

后续可配置，但第一版不要先做复杂配置界面。

### 8.7 watermark 设计

需要一个非常轻量的 watermark 机制，防止每次 `run.finished` 都触发 review。

建议放在 root session metadata 中，使用明确的前缀键：

1. `learning_review_last_tool_call_count`
2. `learning_review_last_requested_at`
3. `learning_review_last_review_session_id`

这样做的优点：

1. 不需要再引入独立数据库。
2. 数据跟 session 天然关联。
3. 调试与观察都比较直观。

第一版建议语义如下：

1. 成功创建 review 子会话后，立即推进 watermark。
2. 如果 review 子会话创建失败，则不推进 watermark。
3. review 本身失败不回滚 watermark，等待下一个阈值窗口。

这比“做一套 inflight 状态机”更轻，也更符合 Hermes 的 best-effort 精神。

### 8.8 review 子会话如何触发

review 子会话优先复用现有 child session 机制。

推荐行为：

1. 以当前 root session 为 parent 创建 child session
2. 给 child session 打上专用 metadata
3. 自动投递 review prompt

建议至少写入这些 metadata：

1. `learning_review_disabled = true`
2. `learning_review_source_session_id = <rootSessionId>`
3. 现有 `parent_session_id = <rootSessionId>`

其中最关键的是：

`learning_review_disabled = true`

它的作用和 Hermes 里关闭 review nudge 的思路一致：

**防止 review 子会话自己再次触发 learning review。**

### 8.9 review prompt 原则

prompt 不应当直接强迫“必须产出 skill”，而应当让 review agent 自主判断：

1. 是否值得沉淀
2. 是否只是噪声
3. 是否应该写 skill
4. 是否只是更新已有 skill

换句话说，我们要的是：

`review -> decide -> maybe write`

而不是：

`review -> must write`

这样更接近 Hermes 的真实精神，也更符合“自动学习”而不是“自动制造垃圾”的目标。

## 9. Session Search 在这套架构里的位置

session search 不是 bus，也不是 learning review 的一部分，但它会成为一个非常重要的增强件。

它的作用不是“触发 review”，而是：

1. 帮 review agent 找历史相似 session
2. 帮 review agent 判断某种模式是否已反复出现
3. 帮未来的 recall feature 提供跨 session 搜索能力

所以它在架构里的位置应是：

```text
global event bus
  -> learning review subscriber
    -> review child session
      -> session_search tool
      -> skill writeback
```

因此 session search 更像：

**review agent 的上下文增强器**

而不是：

**review trigger 本身**

## 10. 为什么这个方案是优雅的

我认为这个方案优雅，主要是因为它控制住了三种常见失控点。

### 10.1 没有把 feature 写进底座

bus 只是底座，不知道 learning review 的存在。

### 10.2 没有把底座写进 feature 语义

learning review 只消费事件，不要求 bus 为它增加专属 API。

### 10.3 没有把桥接和业务揉成一团

NCP bridge 只做事件投影，不做阈值判断，不做 review 触发，不做 skill 写回。

这三层分开之后，代码维护会舒服很多。

## 11. 实施顺序建议

虽然这份文档是设计，不是详细实施计划，但为了避免后续落地时变形，建议顺序明确如下：

### Phase 1：先铺底座

1. 在 `core` 新增全局 typed event bus
2. 增加最小事件 key 与基础测试

### Phase 2：再做 NCP bridge

1. 在 `create-ui-ncp-agent.ts` 接入 bus
2. 把 `RunFinished`、`MessageSent`、`SessionUpdated` 投影成 typed events
3. 增加 bridge 测试

### Phase 3：最后接 learning review

1. 实现 `LearningReviewFeature`
2. 订阅 `agent.run.finished`
3. 做 root session 过滤与阈值判断
4. 触发 review 子会话
5. 增加递归防护与冒烟验证

### Phase 4：把 session search 接给 review agent

1. 让 review prompt 可使用 session search
2. 观察 review 质量
3. 再决定是否扩展更多 recall 能力

这个顺序的好处是：

1. 每一步都能独立验证
2. 每一步都可以停
3. 每一步都不需要重写前一步

## 12. 验收标准

如果将来按这个方案落地，我认为至少要满足以下验收条件，才算设计没有走偏。

### 12.1 bus 层验收

1. 存在独立的 `core` typed event bus 模块
2. 不复用旧 `MessageBus`
3. 事件 key 与 payload 有静态类型绑定
4. listener 失败不会影响其他 listener

### 12.2 bridge 层验收

1. `RunFinished` 能稳定映射成系统事件
2. child/root session 信息能被正确投影
3. bridge 不承载 learning review 业务判断

### 12.3 learning review 层验收

1. 只在 root session 触发
2. 达到阈值时能自动创建 review 子会话
3. review 子会话不会再递归触发 review
4. 主回复路径不会被 review 阻塞

## 13. 最终建议

最终建议可以压缩成一句话：

**在 `core` 里建立一个全新的、逻辑全局唯一的 typed event bus，把 NCP 生命周期事件通过 bridge 投影进来，再把 learning review 作为第一个订阅型 feature 挂上去；session search 保持独立，但作为 review agent 的增强输入接入。**

这是我目前认为最符合以下四个目标的方案：

1. 向 Hermes 学习机制，而不是照搬实现细节
2. 保持架构优雅，不堆 service 山
3. 保持可插拔，可删除
4. 为未来更多系统级 feature 预留干净底座
