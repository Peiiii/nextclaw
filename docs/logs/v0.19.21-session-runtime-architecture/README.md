# v0.19.21 Session Runtime Architecture

## 迭代完成说明

本迭代当前用于承接会话运行态与持久化架构渐进式落地讨论，并已开始落地第一批不接管旧链路的 agent run 核心运行态骨架。

关联大方案：[会话运行态与持久化架构设计草案](../../designs/2026-05-23-session-runtime-architecture-design.md)。

临时小方案：

- [session-summary-context-window-plan.md](work/session-summary-context-window-plan.md)
- [2026-05-24-agent-run-core-skeleton-plan.md](work/2026-05-24-agent-run-core-skeleton-plan.md)

## 测试/验证/验收方式

本批次新增 `packages/nextclaw-kernel/src/features/agent-run/` 隔离骨架，覆盖 `SessionRun`、`MessageInbox`、provider managers、runtime manager 与 request manager 初始形状。

验证方式：

- `pnpm lint:new-code:doc-file-names`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-kernel lint -- src/features/agent-run`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`

说明：agent-run 核心骨架仍在设计讨论期，本批次不保留细粒度行为测试，避免过早固化未稳定 API。

## 发布/部署方式

不涉及发布或部署。

## 用户/产品视角的验收步骤

用户可 review 两个临时方案。当前已优先推进 agent run 核心骨架：新增代码不替换旧运行链路，验收重点是新骨架的职责边界是否符合目标终态。

## 可维护性总结汇总

本批次新增的是隔离骨架，暂不从 kernel 根入口导出，避免和旧 manager 公共入口冲突。后续迁移必须以删除旧 `liveSession / activeExecution` 混合职责为闭环目标，避免新旧路径长期并行。

## NPM 包发布记录

不涉及 NPM 包发布。
