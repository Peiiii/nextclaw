# v0.19.35 Agent Run Legacy Removal

## 迭代完成说明

本次彻底删除 agent run 旧 direct execution 链路，只保留 `AgentRunClient / agentRun.send -> ingress -> KernelBranch -> eventBus` 单一路径。

根因：旧链路虽然已不作为主链路使用，但仍在 `NextclawKernel` 中被构造，并通过 legacy contribution、旧 root manager、旧 native runtime factory、旧测试和 public export 留在 live code 中。这会让后续排查和重构继续面对两套 agent-run owner。

确认方式：先用代码搜索确认旧链路入口、旧 owner、旧 contribution、旧 factory 的引用边界，再删除并用残留扫描、TypeScript、定向测试、lint、build 验证新链路仍然闭合。

Review 修正：删除 `SessionRepository.bindRunStatusSource` 二次绑定，让 `KernelBranch.isSessionRunning()` 直接读取 `SessionRunManager`，避免 repository 感知 live run 状态。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-server tsc`
- `pnpm -C packages/nextclaw-service tsc`
- `pnpm -C packages/nextclaw-kernel exec vitest run src/features/agent-run/managers/agent-run-request.manager.test.ts src/features/agent-run/services/agent-run-client.service.test.ts src/features/session-request/utils/agent-runtime-session-request-dispatcher.utils.test.ts`
- `pnpm -C packages/nextclaw-server exec vitest run src/app/router.ncp-agent.test.ts src/app/router.ncp-agent-stream.test.ts`
- `pnpm -C packages/nextclaw-service exec vitest run src/cli/commands/agent/services/cli-agent-runner.service.test.ts src/shared/services/gateway/utils/cron-job-handler.utils.test.ts`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/nextclaw-server lint`
- `pnpm -C packages/nextclaw-service lint`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- `pnpm -C packages/nextclaw-kernel build`
- `pnpm -C packages/nextclaw-server build`
- `pnpm -C packages/nextclaw-service build`
- Review 修正补充验证：`pnpm -C packages/nextclaw-kernel tsc`
- Review 修正补充验证：`pnpm -C packages/nextclaw-kernel exec vitest run src/features/agent-run/managers/agent-run-request.manager.test.ts src/features/agent-run/services/agent-run-client.service.test.ts`
- Review 修正补充验证：`pnpm -C packages/nextclaw-kernel lint`

## 发布/部署方式

未执行发布或部署。本次是源码链路删除，后续跟随统一 NPM/runtime 发布批次。

## 用户/产品视角的验收步骤

- 前端、微信、cron、CLI 等用户消息发送入口仍应统一进入当前 agent run ingress。
- UI 侧 stream 接收仍应通过 event bus 返回 NCP 事件。
- 代码搜索不应再能找到 legacy agent-run direct entrypoint 或旧 root manager public import。

## 可维护性总结汇总

- 已删除旧链路代码、旧测试和旧 public export。
- Review 修正继续删除 repository 对 live run status 的反向绑定。
- 非测试代码净变化为 `+22 / -1387 / net -1365`。
- 全量变更净变化为 `+22 / -2751 / net -2729`，不含本迭代记录与方案文档。
- `post-edit-maintainability-guard` 结果：Errors 0，Warnings 0。
- `legacy-agent-direct-entrypoints` 治理扫描通过，live code 中没有旧 direct entrypoint。

## NPM 包发布记录

不涉及 NPM 包发布。
