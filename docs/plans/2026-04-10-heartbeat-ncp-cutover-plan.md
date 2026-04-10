# Heartbeat NCP Cutover Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 service heartbeat 的执行入口从 legacy `runtimePool.processDirect(...)` 收敛到 NCP `runApi.send(...)`，删除旧直驱装配并保持现有 heartbeat 行为语义。

**Architecture:** 保留 `HeartbeatService` 作为调度器，只替换它的执行 handler。新增与 cron 同风格的 heartbeat NCP handler，固定使用 `sessionId = heartbeat` 和 heartbeat metadata，通过 live `UiNcpAgentHandle.runApi.send(...)` 执行；NCP agent 未 ready 时显式失败，不保留 legacy fallback。

**Tech Stack:** TypeScript, Vitest, NextClaw service gateway runtime, NCP agent run API.

---

### Task 1: 固化切换边界与定向测试

**Files:**
- Modify: `packages/nextclaw/src/cli/commands/service-support/gateway/tests/service-cron-job-handler.test.ts`
- Modify: `packages/nextclaw/src/cli/commands/service-support/gateway/tests/service-gateway-startup.test.ts`

**Step 1: 写 heartbeat NCP handler 测试**

- 覆盖 heartbeat 通过 NCP run api 执行并返回最终 assistant message
- 覆盖 NCP agent 未 ready 时显式失败
- 覆盖 run stream 没有最终 assistant message 时显式失败

**Step 2: 运行定向测试确认当前缺口**

Run: `pnpm -C packages/nextclaw test -- --run src/cli/commands/service-support/gateway/tests/service-cron-job-handler.test.ts`

Expected: FAIL，因为 handler 尚未实现。

### Task 2: 切换 heartbeat 执行入口到 NCP

**Files:**
- Modify: `packages/nextclaw/src/cli/commands/service-support/gateway/service-cron-job-handler.ts`
- Modify: `packages/nextclaw/src/cli/commands/service-support/gateway/service-gateway-context.ts`

**Step 1: 实现最小 heartbeat NCP handler**

- 复用与 cron 一致的 NCP event 处理策略
- 固定 `sessionId = "heartbeat"`
- 写入 `session_origin = "heartbeat"` 等最小必要 metadata
- 只接受本次 run 流中的最终 assistant message

**Step 2: 用新 handler 替换 `createGatewayHeartbeat` 中的 legacy direct path**

- `HeartbeatService` 继续存在
- 删除 heartbeat 对 `runtimePool.processDirect(...)` 的依赖
- 不引入 fallback

### Task 3: 回归验证与删债确认

**Files:**
- Modify: `packages/nextclaw/src/cli/commands/service-support/gateway/tests/service-gateway-startup.test.ts`

**Step 1: 补 service-only 场景断言**

- 确认 deferred startup 继续在无 UI 场景下初始化 NCP agent
- 让 heartbeat 也能复用同一 live NCP handle

**Step 2: 运行最小充分验证**

Run:

- `pnpm -C packages/nextclaw test -- --run src/cli/commands/service-support/gateway/tests/service-cron-job-handler.test.ts src/cli/commands/service-support/gateway/tests/service-gateway-startup.test.ts`
- `pnpm lint:new-code:governance -- packages/nextclaw/src/cli/commands/service-support/gateway/service-cron-job-handler.ts packages/nextclaw/src/cli/commands/service-support/gateway/service-gateway-context.ts packages/nextclaw/src/cli/commands/service-support/gateway/tests/service-cron-job-handler.test.ts packages/nextclaw/src/cli/commands/service-support/gateway/tests/service-gateway-startup.test.ts`

**Step 3: 补留痕与维护性复核**

- 根据是否跨出上一轮 cron 切换批次，决定更新最近相关迭代 README 还是新建更高版本迭代目录
- 执行独立的 maintainability review，明确这次删掉了哪段 legacy 装配以及是否还残留双轨
