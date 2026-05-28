# v0.19.49 Kernel Session Manager Consolidation

## 迭代完成说明

本次把 kernel session 主链路收敛到新的 `SessionManager`：

- `SessionRepository` 与 `NcpSessionManager` 的有效职责合并到 `packages/nextclaw-kernel/src/managers/session.manager.ts`。
- `NextclawKernel` 主对象图只保留 `sessionManager`，不再暴露 `sessions`、`ncpSessionManager`、`sessionRepository`。
- slash command 的 session 读写迁到 kernel `CommandRegistry`，并依赖新的 kernel `SessionManager`。
- 删除旧 core `CommandRegistry` feature。
- 删除旧 core `SessionManager` class；仍需共享的 session 创建类型与 child-session metadata key 迁到 core session types。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-core tsc`
- `pnpm -C packages/nextclaw-kernel tsc --pretty false`
- `pnpm -C packages/nextclaw-server tsc --pretty false`
- `pnpm -C packages/nextclaw-service tsc`
- `pnpm -C packages/nextclaw-kernel test -- src/services/command-registry.service.test.ts src/managers/__tests__/session.manager.test.ts src/features/session-request/managers/session-request.manager.test.ts src/managers/__tests__/agent-run-request.manager.test.ts src/services/extension-runtime.service.test.ts`
- `pnpm -C packages/nextclaw-service test -- src/shared/controllers/gateway.controller.test.ts src/shared/services/gateway/tests/service-bootstrap-status.service.test.ts`
- `pnpm -C packages/nextclaw-core test -- src/features/session/services/project-root.test.ts`
- `pnpm -C packages/nextclaw-core lint`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/nextclaw-server lint`
- `pnpm -C packages/nextclaw-service lint`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- 定向 `post-edit-maintainability-guard --non-feature --paths ...`

## 发布/部署方式

本次未执行发布或部署。该改动需要随下一次统一 beta / runtime 发布批次进入包产物。

## 用户/产品视角的验收步骤

- 启动服务后，通过 chat / ingress 创建会话，确认 session 由 kernel `sessionManager` 创建和读取。
- 在支持 slash command 的入口执行 `/status`、`/model`、`/thinking`、`/reset`，确认 metadata 与消息清理落在 NCP journal。
- 打开会话列表和会话消息，确认 server/session API 仍能读取新 session。

## 可维护性总结汇总

本次属于非功能架构收敛。核心减债动作是删除旧 owner、合并重复链路、迁移 command owner，并把仍有价值的 core session 类型降级为纯类型合同。

定向可维护性检查结果：总行数 `+640 / -875 / net -235`，非测试代码 `+488 / -721 / net -233`。正向减债动作是删除与职责收敛，不是压缩代码。剩余 watchpoint：新的 kernel `session.manager.ts` 接近文件预算，后续若继续扩 session 能力，应优先拆 projection / summary / command helper，而不是继续堆到该 manager。

全工作区 `--non-feature` 检查仍会把当前已存在的 panel-app 未提交改动一起计入，因无关改动导致整体净增长；本次 session 改造按定向 touched scope 验证通过。

## NPM 包发布记录

不涉及 NPM 包发布。本次只完成源码与结构迁移，包发布等待后续统一发布批次。
