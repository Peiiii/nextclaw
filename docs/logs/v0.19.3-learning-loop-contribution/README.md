# v0.19.3 Learning Loop Contribution

## 迭代完成说明

本次将 learning loop 从 kernel 顶层 manager 调整为 `LearningLoopContribution`，并将配置读取、prompt 构造和运行判断收拢到 `packages/nextclaw-kernel/src/contributions/learning-loop/`。

同时删除 `NcpLifecycleEventBridge`、lifecycle event key/type，以及 `SessionRunManager` 到 kernel 的 `handleNcpEvent` 回调。现在 learning loop 直接监听 `eventKeys.ncpEvent`，只响应 `NcpEventType.RunFinished`。

根因：learning loop 是附加能力，不属于核心 Agent run/session run 管理职责；旧实现通过 lifecycle bridge 制造了 NCP 主事件之外的影子事件链，并把旧 `SessionManager` 上下文拼接扩散进 kernel 核心对象图。通过搜索确认 lifecycle event 的有效消费者只有 learning loop，因此删除桥接链路是针对结构根因，而不是只改触发点。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-shared tsc`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-kernel test -- src/managers/agent-run-request.manager.test.ts`
- `pnpm -C packages/nextclaw-server test -- src/app/tests/router.ncp-agent-runtime-manager.test.ts`
- `pnpm -C packages/nextclaw-kernel exec eslint src/app/nextclaw-kernel.ts src/managers/session-run.manager.ts src/managers/agent-run-request.manager.ts src/managers/agent-run-request.manager.test.ts src/contributions/learning-loop/index.ts src/contributions/learning-loop/config.ts src/contributions/learning-loop/utils/learning-loop-prompt.utils.ts`
- `pnpm -C packages/nextclaw-shared exec eslint src/index.ts`
- `pnpm -C packages/nextclaw-server exec eslint src/app/tests/router.ncp-agent-runtime-manager.test.ts`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`

## 发布/部署方式

未发布。此次为内核职责收敛和附加能力 contribution 化，等待统一发布流程。

## 用户/产品视角的验收步骤

1. 启动 NextClaw 后正常发送 Agent 消息，核心会话运行链路不依赖 learning loop。
2. 配置启用 learning loop 且主会话 tool call 数达到阈值后，后台 review session 仍可由 `RunFinished` 触发。
3. 如果从 kernel contributions 数组移除 `LearningLoopContribution`，核心 Agent run、session messages、stream 和 runtime 创建能力不受影响。

## 可维护性总结汇总

本次遵守 `deletion-first` 和 `single-domain-owner`：删除 lifecycle bridge 和无有效消费者的 lifecycle event contract，移除 kernel 顶层 learning loop 字段，把附加能力收敛到 contribution 目录。

针对本次路径的 maintainability guard 结果：总行数 `+163/-258/net -95`，非测试代码 `+76/-246/net -170`，无错误或警告。全量 guard 因当前工作区存在并行插件/extension 改动而看到 24 个 changed files，并被非本次范围的净增挡住；本次路径已单独通过。

## NPM 包发布记录

不涉及 NPM 包发布。
