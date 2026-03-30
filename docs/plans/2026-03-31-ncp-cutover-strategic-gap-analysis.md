# NCP Cutover Strategic Gap Analysis

## 这份文档回答什么

这份文档专门回答一个更高层的问题：

> 以最初目标为准，NextClaw 离“由 NCP 彻底接管原有 agent 主体能力”还差哪些事情？

这里的判断原则不是“代码新旧”，而是“职责归属”：

- 如果某项职责，NCP 链路已经拥有等价或更好的承载能力，那么旧链路同职责实现就应进入删除范围。
- 如果某项职责，NCP 还没有真正承接，那么旧模块虽然可能不理想，但它仍是现役模块，不能误删，只能列入迁移清单。

## 最初目标再确认

最初目标不是：

- 让 NCP 只承载 UI 聊天壳层
- 然后底下继续偷偷回到 legacy runtime

最初目标是：

- 让 NCP 成为 NextClaw agent 体系的主执行基座
- 当某项职责被 NCP 接管后，legacy 同职责代码退出
- 最终收敛为单主链，而不是长期双执行内核

这里必须强调一条战略口径：

- `同职责已被 NCP 接管` 和 `整个旧模块马上可删` 不是同一个命题
- 我们删的是“被替代的职责链路”，不是“名字看起来旧的整个文件”

## 当前职责版图

### 1. 已经被 NCP 接管的职责

这些职责从产品主链角度，已经属于 NCP：

#### A. Web Chat 主对话链路

当前主链：

```text
NcpChatPage
  -> /api/ncp/agent
  -> createUiNcpAgent
  -> DefaultNcpAgentBackend
  -> DefaultNcpAgentRuntime
  -> NextclawNcpContextBuilder
  -> NextclawNcpToolRegistry
```

这意味着：

- 前端聊天主流程已经不该依赖 `GatewayAgentRuntimePool.processDirect()`
- 更不该依赖 `AgentLoop.processSystemMessage()`
- 所有“为了让当前 NCP 会话继续工作而回弹到 legacy runtime”的旁支，原则上都应删除

#### B. NCP 会话模型

当前 NCP 已经有：

- session API
- session summary
- session messages
- realtime session sync
- stream provider
- abort

所以凡是“当前 NCP 会话自己的状态更新”这类职责，都不应再依赖 legacy 会话唤醒逻辑。

#### C. NCP Native Runtime 主执行

当前主链已经不是 `runtimePool.processDirect()` bridge runtime，而是 `DefaultNcpAgentRuntime`。

这说明：

- NCP runtime 已经接过了“主执行引擎”职责
- legacy runtime 不应再承担 NCP 主链内部的二次执行或补偿执行

### 2. 还没有被 NCP 接管的职责

这些职责今天仍由 legacy runtime 承担，不能凭主观愿望直接删除：

#### A. CLI Agent

当前：

- `nextclaw agent`
- `nextclaw agent -m`

仍直接使用 `AgentLoop.processDirect()`

#### B. Gateway / Channel Inbound

当前：

- channel inbound message
- gateway message routing

仍通过：

```text
MessageBus
  -> GatewayAgentRuntimePool.run()
  -> NativeAgentEngine
  -> AgentLoop
```

#### C. Cron / Heartbeat

当前：

- cron job handler
- heartbeat

仍通过 `GatewayAgentRuntimePool.processDirect()`

#### D. Plugin Runtime Direct Bridge

当前插件 runtime bridge 仍然把请求送到 `runtimePool.processDirect()`。

这说明这些职责今天并没有被 NCP 替代。

## 战略判断：现在真正的问题不在 NCP 主链，而在“职责边界没有收干净”

当前最大的偏差不是“我们还没有 NCP runtime”。

因为这一点已经基本成立了。

真正的问题是：

- NCP 主链已经建立
- 但部分旁支职责仍然偷偷绕回 legacy runtime
- 同时另外一些非 NCP 入口职责尚未迁移
- 这两类问题混在一起，导致我们很容易误判“到底什么该删”

所以必须把问题拆成两类：

### 类别 1：已经被替代，但遗留桥还没删

这类必须删。

最典型就是：

- NCP 子 agent 完成后，不应再通过 `MessageBus.publishInbound(system message)` 回弹 legacy runtime，再试图唤醒主 agent

因为这件事的职责本质是：

- “当前 NCP 会话内部的任务完成状态回写”

而这项职责，NCP 已经有自己的 session/runtime/event 模型，属于已被替代职责。

### 类别 2：还没迁移，所以旧模块还在顶岗

这类暂时不能删，但必须进迁移清单。

例如：

- CLI agent
- gateway inbound
- cron
- heartbeat
- plugin runtime direct bridge

这些职责是否最终也应该进入 NCP，取决于我们的最终战略口径。

## 如果按“最终只保留一个基于 NCP 的主执行内核”推进，还差什么

我的判断是，还差 5 件大事。

### 1. 把所有“已被 NCP 替代的旁支回弹”清干净

这是第一优先级。

要做的不是继续补 bridge，而是删除：

- NCP 子 agent completion -> legacy system message relay
- NCP session update -> legacy wakeup 依赖
- NCP 主链内部任何为了“补结果”再次调用 legacy runtime 的逻辑

如果这一步不做干净，后面永远会出现：

- 行为不稳定
- 难以持久化
- UI 看不到
- 刷新后丢状态

### 2. 把 NCP 目前缺失的“产品级职责”补完整

这一步很关键。

不是所有 legacy 还在做的事，都代表 NCP 不成熟；但凡 legacy 还在承接的职责，都要问一句：

> 这是产品主链必须长期存在的职责吗？如果是，NCP 是否已经有等价承载方式？

目前明确还需要补强的产品级职责包括：

- subagent lifecycle 作为一等对象
- service/proactive/system event 的标准化表达
- 非用户输入触发的 run 编排模型
- 更清晰的 task / workflow / handoff 事件模型

换句话说，NCP 现在已经能跑 chat agent，但还没把 “product-grade orchestration” 做完整。

### 3. 为非 UI 入口提供 NCP-native 触发方式

如果最终要收敛到单内核，那么 CLI、cron、plugin bridge、gateway inbound 这些非 UI 入口，不能永远依赖 `AgentLoop/processDirect`。

未来需要一个明确判断：

- 是让这些入口统一调用 NCP backend/runtime
- 还是让 NCP 抽出一个更通用的 runtime trigger API，被这些入口消费

不管哪条路，本质上都需要：

- 非 UI 入口也有 NCP-native 的触发方式
- 而不是只给 UI 一条 NCP 主链，其他入口继续走 legacy

### 4. 做一份严格的职责 parity checklist

这件事不是文书工作，而是删除前提。

至少要按职责核对：

- context / prompt assembly
- tool / skill / extension
- session / memory
- model / thinking / policy
- proactive / system / service event
- subagent / handoff / task orchestration
- CLI entry
- cron / heartbeat entry
- channel inbound entry
- plugin runtime bridge entry

没有这份 checklist，就会不断陷入两种错误：

- 误删还没迁移的现役职责
- 放过已经被替代却还残留的 legacy 桥

### 5. 形成明确的“删旧顺序”

最佳删旧顺序不是按文件名删，而是按职责删：

1. 删 NCP 主链内部所有 legacy 回弹桥
2. 补 NCP 缺失的产品级职责
3. 迁移非 UI 入口到 NCP-native trigger
4. 下线 `GatewayAgentRuntimePool` 对这些职责的承接
5. 最后下线 `NativeAgentEngine / AgentLoop`

这才是可闭环的路线。

## 我对当前阶段的明确判断

### 结论 1

NCP 主链已经不是主要问题。

它已经足够承担 Web Chat 主流程。

### 结论 2

现在最应该立刻处理的，不是“全面删除 AgentLoop”，而是：

先删掉那些在 NCP 主链内部已经没有存在正当性的 legacy 回弹桥。

这一步是完全合理且必要的。

### 结论 3

`AgentLoop` 作为整体是否可删，今天答案还是：

- 不能立刻整体删

但它不应该再为 NCP 主链提供任何补偿性职责。

### 结论 4

如果我们的最终战略口径是“只有一个基于 NCP 的执行内核”，那么未来必须再补一阶段：

- 把 CLI / cron / plugin bridge / gateway inbound 这些非 UI 入口也迁到 NCP-native trigger 上

否则最后只能得到：

- Web Chat 是 NCP
- 其他入口还是 legacy
- 内核仍然是双套

这不符合最初目标。

## 建议的战略分期

### Phase A：清桥

目标：

- 删除所有 NCP 主链内部的 legacy 回弹桥

代表任务：

- subagent completion 改为直接写回当前 NCP session
- 去掉对 `MessageBus + AgentLoop.processSystemMessage` 的依赖

### Phase B：补职责

目标：

- 把 NCP 还没补齐但产品主链需要的职责补完整

代表任务：

- subagent task object
- service/proactive/task event model
- visible task card

### Phase C：迁入口

目标：

- 让 CLI / cron / plugin bridge / gateway inbound 逐步改用 NCP-native trigger

代表任务：

- 设计统一 non-UI NCP trigger
- 逐个替换旧入口

### Phase D：删内核

目标：

- 删除 `GatewayAgentRuntimePool`
- 删除 `NativeAgentEngine`
- 删除 `AgentLoop`

前提：

- 上述职责已全部迁移

## 最后的口径

如果只用一句话来概括现在离最初目标还差什么，我的判断是：

> 我们不是还缺一个 NCP 主链，而是还缺“把所有应归 NCP 的职责真正收回 NCP，并把非 UI 入口也迁到同一执行内核”的最后两步。

也就是说：

- 第一缺口：职责边界没收干净
- 第二缺口：非 UI 入口还没完成内核统一

这两件事做完，legacy 才能真正退出。

