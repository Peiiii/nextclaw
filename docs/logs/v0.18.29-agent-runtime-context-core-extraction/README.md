# v0.18.29 Agent Runtime Context Core Extraction

## 迭代完成说明

本轮完成 `packages/nextclaw-kernel/src/agent-runtime` 的第一阶段结构梳理，先抽离纯上下文窗口与压缩逻辑，保留 kernel 侧的 NCP/session/provider 编排。

- 将 `ContextCompactionService` 移到 `@nextclaw/core` 的 `runtime-context/services`。
- 将 `ContextWindowBudgetService` 移到 `@nextclaw/core` 的 `runtime-context/services`。
- 将 `ContextWindowSnapshot` 构建逻辑移到 `@nextclaw/core` 的 `runtime-context/utils`。
- `ContextCompactionPreflightService` 继续留在 kernel，因为它负责 session metadata、timeline message、provider summary generation 与 NCP 消息适配。
- 删除未使用的 `buildPersistedCompactionCheckpoint` 与 `compactForModelInput` convenience method，避免把旧的内部辅助面变成新的 core 公共面。

## 测试/验证/验收方式

已执行并通过：

- `pnpm -C packages/nextclaw-core tsc`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-core lint`，通过，仍有既有 warning。
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm lint:new-code:governance -- packages/nextclaw-core/src/features/runtime-context packages/nextclaw-kernel/src/agent-runtime/context packages/nextclaw-kernel/src/agent-runtime/nextclaw-ncp-context-builder.service.ts packages/nextclaw-kernel/src/managers/agent-runtime.manager.ts`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths <runtime-context and agent-runtime context extraction files>`

已知未通过项：

- 全量 `pnpm lint:new-code:governance` 被当前工作区中已有的 NARP wrapper 测试类普通方法阻断，失败文件不属于本轮结构抽离。

## 发布/部署方式

本轮未执行发布、部署、远程 migration 或线上冒烟。

这是 kernel/core 内部结构重构，未改变用户可见行为；后续若继续拆 runtime registry、provider bridge 或 NCP dispatch，需要按各自链路补充更贴近真实运行时的冒烟。

## 用户/产品视角的验收步骤

- 启动或运行 NCP agent session 时，上下文窗口统计与压缩行为保持不变。
- kernel 的 `agent-runtime/context` 目录只保留 NextClaw/NCP/session 编排相关文件，不再承载纯预算和 checkpoint 算法。
- core 的 `runtime-context` 提供可复用的上下文窗口预算、压缩计划和 snapshot 能力，服务 NextClaw 统一入口的长期上下文连续性。

## 可维护性总结汇总

本轮是非功能结构减债，遵循 deletion-first 与 owner 收敛原则。

- maintainability guard：Errors 0，Warnings 1。
- 行数：total +374 / -399 / net -25；non-test +374 / -399 / net -25。
- 正向减债动作：删除、职责收敛、必要解耦抽象。
- 抽离后 core 拥有纯 runtime-context 算法，kernel 只负责 NCP/session/provider 编排。
- 已删除两个未使用内部辅助入口，避免 core 公共面膨胀。
- 剩余观察点：`packages/nextclaw-kernel/src/managers/agent-runtime.manager.ts` 已接近文件预算，下一阶段应优先抽出 runtime provider registration / native runtime factory / tool registry wiring。

## NPM 包发布记录

不涉及 NPM 包发布。
