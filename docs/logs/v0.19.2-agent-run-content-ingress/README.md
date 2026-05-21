# v0.19.2 Agent Run Content Ingress

## 迭代完成说明

本次为 `/api/ncp/agent/send` 与 `agent-run.send` ingress 增加轻量 `content` 输入形态。外部调用方可以继续传完整 `message`，也可以传 `content: NcpMessagePart[]`，由 `AgentRunRequestManager` 在内部生成 `id`、`role`、`status`、`timestamp` 并 materialize 为标准 `NcpMessage`。

本次没有修改公共 NCP transport adapter，也没有新增 prompt/input 平行协议。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/kernel test -- agent-run-request.manager.test.ts`
- `pnpm --filter @nextclaw/server test -- router.ncp-agent.test.ts router.ncp-agent-runtime-manager.test.ts`
- `pnpm --filter @nextclaw/shared tsc`
- `pnpm --filter @nextclaw/kernel tsc`
- `pnpm --filter @nextclaw/server tsc`
- `pnpm --filter @nextclaw/shared lint`
- `pnpm --filter @nextclaw/kernel lint`
- `pnpm --filter @nextclaw/server lint`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-shared/src/configs/ingress-keys.config.ts packages/nextclaw-server/src/app/router.ts packages/nextclaw-kernel/src/managers/agent-run-request.manager.ts packages/nextclaw-kernel/src/managers/agent-run-request.manager.test.ts packages/nextclaw-server/src/app/tests/router.ncp-agent-runtime-manager.test.ts`

## 发布/部署方式

未执行发布或部署。本次触达 `@nextclaw/shared`、`@nextclaw/kernel`、`@nextclaw/server` 源码，后续应随常规 NPM/桌面发布批次一起发布。

## 用户/产品视角的验收步骤

1. 向 `/api/ncp/agent/send` 发送仅包含 `content` 与可选 `metadata/sessionId` 的请求。
2. 确认接口返回 run handle。
3. 确认 agent runtime 收到由系统生成的 user message，且 `content` 中的 text/file 等多模态 part 被保留。
4. 同时传 `message` 与 `content` 时，应返回 `INVALID_BODY`。

## 可维护性总结汇总

本次复用既有 `NcpMessagePart[]` 与 `AgentRunRequestManager` owner，避免新增独立 prompt/input 协议或平行 DTO 体系。新增代码主要集中在边界校验、owner 内 materialize 和定向测试；维护性检查存在一个既有目录预算 warning，未新增直接文件导致目录继续膨胀。

## NPM 包发布记录

待统一发布：`@nextclaw/shared`、`@nextclaw/kernel`、`@nextclaw/server`。
