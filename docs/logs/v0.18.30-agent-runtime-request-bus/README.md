# v0.18.30 Agent Runtime Request Bus

## 迭代完成说明

本次把 session request 到 agent runtime 的链路从直接持有 runtime/backend 改为总线式协作：请求通过 kernel 持有的 `Ingress` 进入，输出复用已有 `eventKeys.ncpEvent`，用 `requestId/correlationId` 和 accepted messageId 关联结果。随后补齐 shared typed key 原语，让 `EventBus` 与 `Ingress` 都支持 `TypedKey<T> | string`。

根因：旧实现让 `AgentRuntimeRequestManager` 通过 `connectAgentRuntimeManager` 后补依赖，并读取 runtime/backend 执行请求，形成反向控制和生命周期耦合。确认方式是排查 `AgentRuntimeRequestManager`、`AgentRuntimeManager`、`NextclawKernel` 的依赖链，发现请求 manager 实际拥有了 runtime 执行细节。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-shared tsc`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-shared lint`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/nextclaw-shared test -- ingress`
- `pnpm -C packages/nextclaw-shared test -- ingress event-bus typed-key`
- `pnpm check:governance-backlog-ratchet`
- `git diff --check -- <touched paths>`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths <touched code paths>`

`pnpm lint:new-code:governance` 已运行，但被当前工作区里无关 NARP test fixture 的 class-methods-arrow 违规阻塞，和本次 touched paths 无关。

## 发布/部署方式

不涉及发布或部署。

## 用户/产品视角的验收步骤

1. 通过 session request / spawn session request 触发一次跨 session 请求。
2. 确认请求不再依赖 `AgentRuntimeRequestManager` 直接持有 runtime/backend。
3. 确认目标 session 的 NCP accepted/completed/failed 事件仍正常进入现有 app event bus，并能回填 tool result。

## 可维护性总结汇总

本次遵守删除和收敛优先：删除 `connectAgentRuntimeManager`、`start`、内部 pending request/listener 和 `currentBackend` 暴露，改为复用已有 `Ingress` 与 `eventKeys.ncpEvent`。typed key 复用 EventBus 已有 key 思想，并向 Ingress 扩展，不新增平行总线。非测试代码保持净减少，正向动作是职责解耦与复用既有总线。

保留债务：`packages/nextclaw-kernel/src/managers/agent-runtime.manager.ts` 接近 600 行预算，后续应继续拆出稳定子职责。

## NPM 包发布记录

不涉及 NPM 包发布。
