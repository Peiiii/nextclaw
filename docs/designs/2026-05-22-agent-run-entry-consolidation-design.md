# Agent Run 执行入口收敛设计

## 背景

当前系统已经有 `AgentRunRequestManager` 作为 Agent run 的主入口，它负责 materialize 请求、创建 session、生成 runId、维护 active run、调用 runtime、写入 session event、发布 NCP event 和处理 abort。

但实际代码里仍然存在多条绕开主入口语义的执行链路：

- CLI / plugin bridge 通过 `dispatchPromptOverNcp` 间接传入 `resolveNcpAgent` callback。
- gateway inbound loop 内部再通过 `requireNcpAgent` 取出 agent runner。
- cron job handler 自己手写一套 NCP event stream 消费、最终消息提取和错误处理。

这些路径让“谁负责发起 Agent run”变得不清晰，也让同一类运行结果消费逻辑在多个地方重复。

## 目标

本次改造目标不是新增能力，而是收敛职责：

- Agent run 的执行 owner 明确为 `AgentRunRequestManager`。
- 调用方只表达“我要发起一次 Agent run”，不再感知“可能不存在的 NCP agent resolver”。
- 删除 cron 自己的重复 NCP stream 消费逻辑，复用 kernel 里已有的 `runPromptOverNcp`。
- 保留 gateway/channel/outbound delivery 的现有能力，不做协议级重写。

## 非目标

本次不做以下事情：

- 不新增 `AgentRunDispatchManager`、`GatewayAgentRunManager` 等新 manager。
- 不重写 channel reply 协议。
- 不触碰正在并行迁移的 extension/plugin 包。
- 不做旧 `SessionManager` 去除，那属于 session 事实源后续改造。
- 不把 gateway inbound loop 整体迁入 `AgentRunRequestManager`，因为它仍包含 channel routing 和 outbound delivery 职责。

## 职责边界

### AgentRunRequestManager

职责：

- 接收 materialized NCP run request。
- 创建或恢复 live session。
- 维护 active run 状态。
- 调用对应 session runtime。
- 写入并发布 NCP event。
- 支持 abort。

它不负责：

- 判断 channel reply 能力。
- 向具体渠道发送 outbound message。
- 解析 cron job 业务配置。
- 解析 plugin runtime ctx。

### ncp-dispatch utils

职责：

- 把 CLI / gateway / plugin 输入转换为 NCP prompt 执行请求。
- 处理 direct slash command。
- 处理 gateway inbound message 的 route 和 channel outbound 分流。

它不负责：

- 持有 runtime。
- 通过 resolver/fallback 判断 NCP agent 是否 ready。
- 重复实现 NCP event stream 消费。

### cron job handler

职责：

- 从 cron job payload 生成 sessionId、agentId、metadata。
- 调用统一 Agent run 执行工具得到最终文本。
- 按 job 配置决定是否 deliver outbound。

它不负责：

- 自己遍历 NCP event stream。
- 自己识别 `MessageCompleted` / `RunError`。
- 自己提取 assistant message 文本。

## 改造方案

### 1. 删除空心 resolver

把 `dispatchPromptOverNcp` 的参数从：

```ts
resolveNcpAgent?: () => NcpRunnerAgent | null;
```

改成：

```ts
agentRunRequests: NcpRunnerAgent;
```

调用方直接传 `kernel.agentRunRequestManager`。

这样能删除：

- `resolveNcpAgent` 参数。
- `requireNcpAgent` helper。
- “NCP agent is not ready” 这类不属于当前调用层的 fallback。

### 2. 复用 runPromptOverNcp

cron job handler 不再维护自己的 `runJobOverNcp`，改为：

```ts
const response = await runPromptOverNcp({
  agent: params.agentRunRequests,
  sessionId,
  content: job.payload.message,
  metadata,
  missingCompletedMessageError: "...",
  runErrorMessage: "...",
});
```

这样能删除：

- `BackgroundNcpAgent`。
- `buildCronUserMessage`。
- `extractMessageText`。
- `runJobOverNcp`。

### 3. gateway inbound loop 保留，但收窄

gateway inbound loop 仍负责 `MessageBus.consumeInbound()`、route 和 channel outbound。它内部直接使用 `runtime.kernel.agentRunRequestManager`，不再通过 resolver 取 runner。

## 验收标准

- CLI/plugin/gateway/cron 仍能通过统一 runner 发起 Agent run。
- cron handler 测试覆盖：
  - metadata 仍正确传入。
  - deliver outbound 仍工作。
  - sessionId override 仍工作。
  - 缺失最终 assistant message 仍 fail fast。
- TypeScript 编译通过：
  - `pnpm -C packages/nextclaw-kernel tsc`
  - `pnpm -C packages/nextclaw-service tsc`
- 本次作为非功能重构，非测试生产代码净增必须 `<= 0`。
