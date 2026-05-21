# v0.19.4 Agent Run 执行入口收敛

## 迭代完成说明

本次是非功能重构，目标是把 CLI、plugin bridge、cron 和 gateway inbound 中发起 Agent run 的入口收敛到已有 `AgentRunRequestManager` 主链路。

完成内容：

- 新增设计文档：`docs/designs/2026-05-22-agent-run-entry-consolidation-design.md`。
- `dispatchPromptOverNcp` 不再接收 `resolveNcpAgent` 空心 callback，改为直接接收 `agentRunRequests`。
- `runGatewayInboundLoop` 直接使用 `runtime.kernel.agentRunRequestManager`。
- `cron-job-handler` 删除自有 NCP event stream 消费逻辑，复用 `runPromptOverNcp`。
- 清理 `ncp-dispatch` / `ncp-runner` 中遗留的临时 channel debug 日志代码。
- 补齐 bootstrap status 路由测试里已经必填的 `kernel` test stub。
- 新增 `GatewayInboundProcessor`，让 gateway inbound loop 只负责消费队列，单条消息的 route、channel reply、legacy outbound 和错误回复统一归到明确 owner。
- 抽出 `ncp-run-metadata.utils.ts`，让 direct prompt 和 gateway inbound 共用同一套 run metadata 生成逻辑。

## 测试/验证/验收方式

已执行：

- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-service tsc`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/nextclaw-service lint`
- `pnpm -C packages/nextclaw-kernel test`
- `pnpm -C packages/nextclaw-service exec vitest run src/shared/services/gateway/utils/cron-job-handler.utils.test.ts`
- `pnpm -C packages/nextclaw-service exec vitest run src/shared/services/plugin/tests/service-plugin-runtime-bridge.service.test.ts`
- `pnpm -C packages/nextclaw-service exec vitest run src/cli/commands/agent/agent-commands.test.ts src/shared/services/gateway/tests/service-bootstrap-status.service.test.ts`
- `pnpm -C packages/nextclaw-kernel exec eslint src/features/ncp-dispatch`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-kernel/src/features/ncp-dispatch/services/gateway-inbound-processor.service.ts packages/nextclaw-kernel/src/features/ncp-dispatch/utils/ncp-run-metadata.utils.ts packages/nextclaw-kernel/src/features/ncp-dispatch/utils/nextclaw-ncp-dispatch.utils.ts packages/nextclaw-kernel/src/features/ncp-dispatch/index.ts`
- `pnpm lint:new-code:governance --paths packages/nextclaw-kernel/src/features/ncp-dispatch/services/gateway-inbound-processor.service.ts packages/nextclaw-kernel/src/features/ncp-dispatch/utils/ncp-run-metadata.utils.ts packages/nextclaw-kernel/src/features/ncp-dispatch/utils/nextclaw-ncp-dispatch.utils.ts packages/nextclaw-kernel/src/features/ncp-dispatch/index.ts`
- `pnpm check:governance-backlog-ratchet`

结果：

- TypeScript 编译通过。
- 定向测试通过。
- lint 无 error；`kernel` 和 `service` 仍有既有 warning，未新增本次触达文件 warning。

## 发布/部署方式

本次未执行发布或部署。

原因：这是源码重构与职责收敛，未发布 NPM 包，未改线上部署配置。

## 用户/产品视角的验收步骤

建议验收：

- 使用 CLI agent 发起一次普通消息，确认仍能得到 Agent 回复。
- 通过 UI / HTTP send 发起一次 NCP agent 请求，确认 run handle 和 stream 仍正常。
- 创建或手动触发一个 cron agent job，确认最终文本仍返回；若配置 deliver，确认 outbound 仍发送。
- 通过插件 bridge 触发一次带文本或附件的 agent 请求，确认 request 仍进入统一 Agent run 链路。

## 可维护性总结汇总

本次遵守 deletion-first / single-domain-owner / request-bus-decoupling：

- 删除 cron 自有 NCP event stream collector，避免重复实现 `MessageCompleted` / `RunError` 消费。
- 删除 `resolveNcpAgent` / `requireNcpAgent` 空心 ready fallback。
- 删除临时 channel debug 日志代码，减少运行链路噪音。
- Agent run 执行 owner 更清晰：调用方直接依赖 `AgentRunRequestManager` 这个 owner，而不是传 resolver。
- `ncp-dispatch.utils.ts` 不再混入 gateway inbound loop 和 outbound delivery；gateway 入口处理收敛到 `GatewayInboundProcessor`。

本次是非功能改动，生产代码为净减少，符合非测试生产代码净增 `<= 0` 的要求。

## NPM 包发布记录

不涉及 NPM 包发布。
