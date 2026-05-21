# v0.19.0 Session Store Owner Cleanup

## 迭代完成说明

本次是非功能性重构，目标是继续收敛 Agent run / session run 责任边界。

- `NcpSessionApiService` 不再直接读写 legacy `SessionManager` fallback，会话读写统一交给 `ncpAgentSessionStore`。
- `NcpAgentSessionStoreAdapter` 的 `journalStore` 改为必填，adapter 内部继续负责 journal 与 legacy session 的兼容读取和首次导入。
- 删除 `features/agent-run-request` 这个只做转导的假 feature root，将 session/run 内部支撑工具收敛到 `utils/session-run.utils.ts`。

这次没有触碰插件/extension 入站迁移链路，避免与并行迁移工作冲突。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-kernel test -- src/services/ncp-session-api.service.test.ts src/services/ncp-agent-session-store-adapter.service.test.ts src/managers/agent-run-request.manager.test.ts`
- `pnpm -C packages/nextclaw-server test -- src/app/tests/router.ncp-agent-runtime-manager.test.ts`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-kernel lint`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
- `pnpm check:governance-backlog-ratchet`

`pnpm lint:new-code:governance` 运行后仍被当前工作区里并行改动的文件角色问题阻塞，不是本次触达文件：

- `packages/nextclaw-core/src/features/config/configs/schema.help.ts`
- `packages/nextclaw-core/src/features/config/configs/schema.labels.ts`
- `packages/nextclaw-runtime/src/channels/builtin.ts`

## 发布/部署方式

未发布。该变更属于本地源码重构，等待后续统一发布流程。

## 用户/产品视角的验收步骤

用户侧预期不变：

1. UI NCP agent send 路由仍能创建 session、返回 run handle，并持久化 assistant 回复。
2. session list / messages API 仍能从统一 session store 读取会话摘要和消息。
3. live session 仍能正确覆盖 `running` 状态。

## 可维护性总结汇总

本次使用 `post-edit-maintainability-guard` 和主观可维护性复核。

- 总行数：新增 552 行，删除 745 行，净减 193 行。
- 非测试代码：新增 398 行，删除 518 行，净减 120 行。
- 正向减债动作：删除 + 职责收敛。
- `NcpSessionApiService` 的 source of truth 更单一，`NcpAgentSessionStoreAdapter` 成为 journal/legacy 兼容 owner。
- 删除了假 feature root，减少下一轮理解 Agent run / session run 边界时的误导。

## NPM 包发布记录

不涉及 NPM 包发布。
