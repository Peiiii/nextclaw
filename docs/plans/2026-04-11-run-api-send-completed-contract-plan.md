# Run API Send Completed Contract Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `runApi.send()` 的成功契约统一为“成功时一定向调用方暴露最终 assistant message”，消除 heartbeat / cron / session-request 对分散收尾逻辑的依赖。

**Architecture:** 保持现有 `run.*` 生命周期事件不变，但在 `DefaultNcpAgentBackend.send()` 中收敛 `MessageCompleted` 暴露语义：若 runtime 已产出则直接透传，若 runtime 只产出流式内容与 `RunFinished`，则在 backend 成功收尾点基于当前 session state 组装唯一的 completed 事件并在 `RunFinished` 之前发出。调用方继续只消费 `MessageCompleted` 作为最终回复，不再自己从 session 里兜底捞消息。

**Tech Stack:** TypeScript, Vitest, NCP toolkit backend, NextClaw CLI runtime gateway

---

### Task 1: 写计划并锁定边界

**Files:**
- Create: `docs/plans/2026-04-11-run-api-send-completed-contract-plan.md`
- Read: `packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-backend/agent-backend.ts`
- Read: `packages/nextclaw/src/cli/commands/service-support/gateway/service-cron-job-handler.ts`
- Read: `packages/nextclaw/src/cli/commands/ncp/session-request/session-request-broker.ts`

**Step 1: 明确 primary contract**

约束：
- `runApi.send()` 对调用方的成功语义统一为：必须可观察到 `MessageCompleted`
- 不在 heartbeat / cron / session-request 增加 fallback
- 不重写整个 NCP 事件模型
- 不移除 `RunFinished`

**Step 2: 记录非目标**

非目标：
- 不修改 `stream()` 的流式 API 语义
- 不把 state manager 的 finalize 逻辑整体迁移到 `MessageCompleted`
- 不做 runtime 全量重构

### Task 2: 在 backend 中收敛 send 成功契约

**Files:**
- Modify: `packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-backend/agent-backend.ts`
- Test: `packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/in-memory-agent-backend.test.ts`

**Step 1: 为 send() 增加 completed 事件规范化**

实现要点：
- 在 `send()` 的事件转发循环里跟踪：
  - 当前 run 是否已收到 `MessageCompleted`
  - 当前 run 的最后一个 `RunFinished`
- 若 runtime 自己发出 `MessageCompleted`，直接透传并标记“已完成”
- 若遇到 `RunFinished` 且尚未完成，则从当前 live session snapshot 中读取与本次 `messageId` 对应的 assistant message，先发 `MessageCompleted` 再发 `RunFinished`
- 若 `RunFinished` 到来但找不到对应最终 assistant message，直接抛出协议错误，视为 runtime 违约，不做 silent recovery

**Step 2: 保持职责边界清晰**

约束：
- backend 只做 send contract normalization，不去修改 runtime 行为
- 不从持久化 session 兜底，不做跨 session 查找
- 只允许读取当前 live session state

**Step 3: 为 backend 补测试**

新增/修改测试覆盖：
- runtime 只发流式内容 + `RunFinished` 时，`send()` 会对外补出 `MessageCompleted`
- `MessageCompleted` 出现在 `RunFinished` 之前
- runtime 已自行发出 `MessageCompleted` 时，不重复补发
- runtime `RunFinished` 但没有最终 assistant message 时，`send()` 直接失败

### Task 3: 删除 session-request 的冗余 fallback

**Files:**
- Modify: `packages/nextclaw/src/cli/commands/ncp/session-request/session-request-broker.ts`
- Optionally Modify: `packages/nextclaw/src/cli/commands/ncp/session-request/session-request-result.ts`

**Step 1: 删除 completed message 的 session-level fallback**

变更：
- 删除 `resolveCompletedMessage()` 中对 `backend.listSessionMessages()` 的 fallback 查找
- 保留单一路径：等待 `backend.send()` 流中的 `MessageCompleted`

**Step 2: 收敛错误语义**

若 `backend.send()` 成功结束但没有 `MessageCompleted`，视为 backend contract bug，由 backend 侧直接抛错；session-request 不再自己修补。

### Task 4: 让测试契约从“只看 RunFinished”升级为“看 completed + finished 顺序”

**Files:**
- Modify: `packages/nextclaw/src/cli/commands/ncp/runtime/create-ui-ncp-agent.test.ts`
- Modify: `packages/nextclaw/src/cli/commands/ncp/runtime/create-ui-ncp-agent.claude.test.ts`
- Modify: `packages/nextclaw/src/cli/commands/ncp/runtime/create-ui-ncp-agent.reasoning-normalization.test.ts`
- Modify: `packages/nextclaw/src/cli/commands/ncp/runtime/create-ui-ncp-agent.child-session-request.test.ts`
- Modify: `packages/nextclaw/src/cli/commands/service-support/gateway/tests/service-cron-job-handler.test.ts`

**Step 1: 更新成功路径断言**

成功路径统一断言：
- 事件流包含 `MessageCompleted`
- `MessageCompleted` 在 `RunFinished` 之前
- 对 heartbeat / cron / direct runner 的最终回复提取继续只通过 `MessageCompleted`

**Step 2: 修正不真实的 fake runtime**

若某些 fake runtime 只发 `RunFinished` 却从不形成 assistant message，需要改成最小真实行为：
- 要么发 `MessageCompleted`
- 要么至少发出足以让 backend 组装最终 assistant message 的流式事件

### Task 5: 验证与收尾

**Files:**
- Read: `packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/in-memory-agent-backend.test.ts`
- Read: `packages/nextclaw/src/cli/commands/service-support/gateway/tests/service-cron-job-handler.test.ts`
- Read: `packages/nextclaw/src/cli/commands/ncp/runtime/create-ui-ncp-agent.test.ts`

**Step 1: 运行最小充分测试**

建议命令：
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit test -- run src/agent/in-memory-agent-backend.test.ts`
- `pnpm -C packages/nextclaw test -- run src/cli/commands/service-support/gateway/tests/service-cron-job-handler.test.ts`
- `pnpm -C packages/nextclaw test -- run src/cli/commands/ncp/runtime/create-ui-ncp-agent.test.ts`
- `pnpm -C packages/nextclaw test -- run src/cli/commands/ncp/runtime/create-ui-ncp-agent.claude.test.ts`
- `pnpm -C packages/nextclaw test -- run src/cli/commands/ncp/runtime/create-ui-ncp-agent.reasoning-normalization.test.ts`
- `pnpm -C packages/nextclaw test -- run src/cli/commands/ncp/runtime/create-ui-ncp-agent.child-session-request.test.ts`

**Step 2: 运行治理与可维护性检查**

命令：
- `pnpm lint:maintainability:guard`

**Step 3: 文档留痕**

本次触达代码，收尾时需要根据 `docs/logs` 最近相关迭代判断：
- 若仍属最近一次相关迭代的同批次续改，则更新该迭代目录 `README.md`
- 若已跨出原批次，则新建更高版本迭代目录

**长期目标对齐 / 可维护性推进**

- 这次改动顺着“统一体验优先、可预测行为优先”推进：调用方不再各自猜测最终消息，统一依赖 backend 暴露的 send contract。
- 这次优先删减的是消费者侧 fallback 与分散收尾逻辑，而不是新增更多兼容分支。
- 如果最终出现少量代码净增长，其必要性仅限于 backend 中心化 contract normalization；对应偿还的维护性债务是 heartbeat / cron / session-request 的分散成功语义。
