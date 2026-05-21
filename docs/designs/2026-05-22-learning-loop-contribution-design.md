# Learning Loop Contribution 化设计

## 背景

`learning loop` 是一个后台自学习增强能力：当主会话累计足够多 tool call 后，它触发一个后台 review session，提炼可复用经验。它不参与核心 Agent run、session run、runtime 创建、工具调用或 MCP 主链路。

当前实现把它作为 `NextclawKernel.learningLoop` 顶层 manager 持有，并通过 `NcpLifecycleEventBridge` 把 NCP 事件转换为 `agent.run.finished` 后再触发。这导致两个问题：

- 核心 kernel 对一个附加能力有固定字段和固定生命周期调用。
- NCP 主事件之外存在一条 lifecycle 影子事件链，且这条链还从旧 `SessionManager` 拼上下文。

## 目标

- learning loop 成为可插拔 contribution。
- 删除 `NcpLifecycleEventBridge` 和 lifecycle 影子事件 contract。
- `SessionRunManager` 只负责发布 NCP 主事件，不知道 learning loop 或 lifecycle bridge。
- kernel 只在 `contributions` 数组中装配 learning loop；移除后不影响核心能力。

## 非目标

- 不调整 `agents.learningLoop` 配置 schema。配置仍由统一 config 系统管理。
- 不迁移插件/extension 机制。
- 不重写 learning loop 的业务策略、prompt 内容或触发阈值语义。

## 方案

新增 `packages/nextclaw-kernel/src/contributions/learning-loop/`：

- `index.ts`：实现 `LearningLoopContribution implements KernelContribution`，监听 `eventKeys.ncpEvent`。
- `config.ts`：保留 learning loop metadata key、默认阈值和配置读取函数。
- `utils/learning-loop-prompt.utils.ts`：保留 prompt 构造。

触发链路调整为：

```text
SessionRunManager.publishSessionEvent
  -> eventBus.emit(eventKeys.ncpEvent, event)
  -> LearningLoopContribution 过滤 NcpEventType.RunFinished
  -> 读取 legacy SessionManager 中的 session 统计 tool call
  -> 满足阈值后通过 SessionRequestManager 发起后台 review session
```

这里仍读取 legacy `SessionManager`，因为 learning loop 当前判断 tool call 数、写回 review metadata 仍基于 legacy session 数据结构。这是该附加能力自己的内部依赖，不再通过 lifecycle bridge 扩散到核心 session run 主链路。

## 删除点

- 删除 `services/ncp-lifecycle-event-bridge.service.ts`
- 删除 `configs/ncp-lifecycle-event.config.ts`
- 删除 `types/ncp-lifecycle-event.types.ts`
- 删除 `managers/learning-loop.manager.ts`
- 删除顶层 `configs/learning-loop.config.ts` 和 `utils/learning-loop-prompt.utils.ts`，移动到 contribution 内部
- 删除 `NextclawKernel.learningLoop` 字段以及 start/dispose 特殊调用
- 删除 `SessionRunManager.handleNcpEvent` 注入点

## 验收

- `LearningLoopContribution` 可通过 `contributions` 数组插拔。
- `SessionRunManager` constructor 不再接收 `handleNcpEvent`。
- 全仓不再引用 lifecycle event key/type/bridge。
- TypeScript 编译通过。
- Agent run request 相关测试仍通过。
