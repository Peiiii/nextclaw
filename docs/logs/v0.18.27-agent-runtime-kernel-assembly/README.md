# v0.18.27 Agent Runtime Kernel Assembly

## 迭代完成说明

- 将 agent runtime、learning-loop、LLM telemetry、NCP session/runtime 相关 owner 收敛到 `@nextclaw/kernel`。
- `NextclawKernel` 现在持有 `extensions`、`agentRuntimeManager` 与 `learningLoop`，并通过幂等 `start()` 统一启动整体生命周期。
- `learning-loop` 已从 `AgentRuntimeManager` 剥离，只在自身生命周期订阅 kernel `EventBus` 上的语义 lifecycle event；`AgentRuntimeManager` 只负责生产 raw NCP event 与语义 event。
- 合并 `LearningLoopRuntimeService` 与 `LearningLoopFeature` 为 `LearningLoopManager`，放入 kernel `managers` 层，删除 runtime 壳与 feature 重复职责。
- 删除 `learning-loop/` 假 feature 目录：配置进入 `configs/`，纯 prompt builder 进入 `utils/`，manager 私有类型收回 `LearningLoopManager`。
- 将 `telemetry/` 下分散的 LLM usage 文件收敛为 `LlmUsageManager`、`LlmUsageStore` 与 `llm-usage.types` 三件套，删除 observer/recorder/history/snapshot/factory 平行小文件。
- 删除 LLM usage 模块顶层 singleton 实例化，`LlmUsageManager` 由 `NextclawKernel` 持有并传给 runtime owner。
- 删除 service 内旧的 `commands/ncp`、`commands/learning-loop`、telemetry/store 副本，避免 runtime 职责双 owner。
- 删除 kernel 内重复的 `events/` 转出口与 core `typed-event-bus`，事件契约直接来自 `@nextclaw/shared`。
- 保留 `agentRuntimeManager` 完整命名，删除旧 `createAgentRuntime` / `createUiNcpAgent` 风格入口。
- 将 unused import 清理接入 ESLint autofix：根 ESLint 现在使用 `eslint-plugin-unused-imports`，`unused-imports/no-unused-imports` 负责自动删除陈旧 import；验证 workflow 明确 `ts(6133)` 类问题先跑 ESLint autofix，再跑 unused 诊断验证。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/kernel tsc`
- `pnpm --filter @nextclaw/core tsc`
- `pnpm --filter @nextclaw/service tsc`
- `pnpm --filter @nextclaw/server tsc`
- `pnpm --filter @nextclaw/kernel lint`
- `pnpm --filter @nextclaw/core lint`
- `pnpm --filter @nextclaw/service lint`
- `pnpm --filter @nextclaw/server lint`
- `pnpm exec eslint --fix eslint.config.mjs packages/nextclaw-service/src/service-runtime.service.ts packages/nextclaw-kernel/src/agent-runtime/provider/provider-manager-ncp-llm-api.service.ts packages/nextclaw-kernel/src/agent-runtime/nextclaw-ncp-tool-registry.service.ts packages/nextclaw-kernel/src/agent-runtime/context/context-compaction-preflight.service.ts packages/nextclaw-kernel/src/managers/llm-usage.manager.ts packages/nextclaw-kernel/src/stores/llm-usage.store.ts packages/nextclaw-kernel/src/types/llm-usage.types.ts`
- `pnpm --filter @nextclaw/service exec tsc -p tsconfig.json --noEmit --noUnusedLocals --noUnusedParameters false`（本次目标 `LlmProviderRuntime` 已不再报错；package-wide strict unused 仍被既有旧文件阻塞：`mochat.ts`、`memory-store.ts`、`manager.ts`、HTTP/STDIO runtime service、`plugin-capability-registration.ts`）
- `pnpm --filter @nextclaw/service test -- src/cli/commands/usage/services/llm-usage-command.service.test.ts src/shared/services/gateway/tests/gateway-plugin-manager.service.test.ts src/shared/services/gateway/tests/nextclaw-app.service.test.ts src/shared/services/plugin/tests/service-plugin-runtime-bridge.service.test.ts src/shared/services/session/tests/service-deferred-ncp-agent.service.test.ts src/shared/services/session/tests/service-ncp-session-realtime-bridge.fire-and-forget.service.test.ts src/cli/commands/agent/agent-commands.test.ts`
- `pnpm --filter @nextclaw/service test -- src/shared/services/gateway/tests/nextclaw-app.service.test.ts`
- `pnpm dev start`（验证 backend、UI NCP agent、Vite frontend 启动成功；验证后已停止本次启动的 `18792/5174` 进程）
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`

## 发布/部署方式

本轮未执行发布/部署。改动涉及 workspace 包源码与依赖图，后续如进入发布批次，需要按 NPM beta/release 流程统一发布受影响包。

## 用户/产品视角的验收步骤

- 启动 service 后，应只调用 kernel 顶层 `start()` 一次，由 kernel 内部完成 agent runtime bootstrap 与 learning-loop 启动。
- 插件 runtime bridge、agent runtime list、session realtime bridge 仍应保持原有可用行为。
- service 代码中不应再存在旧 NCP runtime 装配 owner。
- `learning-loop` 不应再直接依赖 backend，也不应由 `AgentRuntimeManager` 持有。

## 可维护性总结汇总

- 本轮使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 视角复核。
- 总代码净增为 `-10307` 行，非测试代码净增为 `-258` 行，满足非功能改动门槛。
- 正向减债动作：删除 + 职责收敛。删除 service 旧 runtime/learning-loop/telemetry 副本、core 重复 typed bus、kernel events 转出口，把生命周期与装配收敛到 kernel owner。
- 仍需关注的后续拆分缝：`agentRuntimeManager` 与新迁入的 runtime 文件接近预算，后续如继续增长，应优先拆出更窄的子 owner。

## NPM 包发布记录

不涉及 NPM 包发布。
