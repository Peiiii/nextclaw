# v0.20.67 NextClaw Service Manager Architecture

## 迭代完成说明

本次将 `packages/nextclaw-service` 从旧的 `cli/commands`、`commands`、`shared` 混合形态收敛为按角色落位的 `app`、`controllers`、`managers`、`services`、`stores`、`types`、`utils` 结构。`NextclawServiceRuntime` 保留 public facade，但只负责顶层装配；命令构造下沉到 `ServiceCommandManager`，托管服务运行下沉到 `ManagedServiceManager`，gateway 生命周期下沉到 `ServiceGatewayManager`，restart/self-relaunch 下沉到 `ServiceRestartManager`。

用户补充指出 `NextclawServiceRuntime` new class 时的耗时测量没有必要。本次已去除 runtime constructor 和 command manager 内围绕 class instantiation 的 `measureStartupSync` 包装，仅保留 constructor begin/end trace。

本次没有处理产品功能根因或线上事故；主要根因是服务包 runtime 既承担 app facade、CLI command graph、restart coordination，又承载 shared/commands/cli 多套历史目录，导致 owner 不清、路径迁移成本高、测试命名和真实 owner 不一致。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/service build`：通过。
- `pnpm --filter @nextclaw/service test -- src/managers/service-restart.manager.test.ts src/controllers/commands/gateway-manual-restart-contract.controller.test.ts src/controllers/commands/agent-command.controller.test.ts`：通过。
- `find packages/nextclaw-service/src -name '*.test.ts' ! -path '*/cron-dev-service.service.test.ts' | sort | sed 's#packages/nextclaw-service/##' | xargs pnpm --filter @nextclaw/service test --`：通过，覆盖 44 个测试文件、138 个测试。
- `node --test scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`：通过。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`：通过，非测试净增为 0。

未完全闭合项：

- `pnpm --filter @nextclaw/service test` 的全量测试仍被 `src/services/cron/cron-dev-service.service.test.ts` 阻塞：dev service 等待端口 19100/19101 超时，并出现过 spawn 当前 Node 路径 ENOENT。排除该既有集成测试后，其余 service 测试通过。
- `pnpm --filter @nextclaw/service tsc` 当前被无关依赖产物/未完成重命名状态阻塞：`@nextclaw/server` dist 在依赖闭包 build 失败后为空；失败点来自 `nextclaw-core/src/features/session-request/index.ts` 仍导出旧的 `session-request-manager.types.js`，而工作区已有无关 WIP 将该文件重命名为 `session-request-dispatch.types.ts`。本次未改动该无关 WIP。

## 发布/部署方式

不涉及发布或部署。未执行 NPM publish、runtime update channel、桌面端发布或线上部署。

## 用户/产品视角的验收步骤

- 从源码结构检查 `packages/nextclaw-service/src/app/nextclaw-service-runtime.ts`：应只看到顶层 facade、init/login/agent/update 入口和 manager 装配。
- 检查 `packages/nextclaw-service/src/managers/service-command.manager.ts`：命令对象构造集中在 command manager，不再散落在 runtime facade。
- 检查 `packages/nextclaw-service/src/managers/service-restart.manager.ts`：restart request、pending restart、background service restart、self relaunch 和 restart sentinel 由 restart manager 统一负责。
- 搜索 `measureStartupSync`：`NextclawServiceRuntime` constructor 与 command manager 的 class instantiation 不再使用耗时包装。

## 可维护性总结汇总

已使用 `post-edit-maintainability-guard` 和主观可维护性复核。结构上删除旧 nested module config，移除 `src/cli/commands`、`src/commands`、`src/shared` 作为长期主结构，把 owner 落到 manager/controller/service/store/utils。正向减债动作为职责收敛与简化：runtime facade 大幅缩小，restart 和 command graph 有明确 owner，非测试代码净增按 guard 口径为 0。

守卫仍提示若干历史 warning：`controllers/commands`、`services/runtime`、`utils` 目录仍超过直接文件数预算，且 autostart/platform-auth/cli utils 等文件接近预算。这些属于后续分域治理入口，本次没有继续扩大范围处理。

## NPM 包发布记录

不涉及 NPM 包发布。
