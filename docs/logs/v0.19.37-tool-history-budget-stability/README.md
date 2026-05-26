# v0.19.37 Tool History Budget Stability

## 迭代完成说明

- 根因：`InputBudgetPruner.prepareForBudget` 在预算评估阶段无条件执行历史 tool 协议清理，历史 `tool` message 被删除，历史 assistant 的 `tool_calls` / `reasoning_content` 被剥离，导致上下文圆环展示的 token 从真实约 56K 降到约 1.1K。
- 确认方式：对 `ncp-mpmq8j2f-86d06c5c` 的 journal 回放并调用预算链路，定位到并非超预算裁剪，而是预算准备阶段的协议清理造成 51 条 tool result 消失。
- 修复方式：默认保留历史 tool call/result 协议；只对单条过大的 tool result 做内容 truncate；只有整体输入超出硬预算时才按完整 tool pair 裁剪；最后做协议归一化，移除孤儿 tool result，并为缺失 result 的 tool call 补明确 interrupted 结果，避免半截协议进入 provider。
- 同步沉淀：新增 `docs/designs/2026-05-27-tool-history-pruning-policy-design.md`，并完善 maintainability skill，明确禁止为了非功能 line gate 做无收益压缩，确需增长时走显式豁免协议。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-core test src/features/agent/services/input-budget-pruner.service.test.ts -- --run`：通过，5 个用例覆盖保留历史 tool 协议、单条 tool result truncate、超预算完整 pair 裁剪、孤儿 result 删除、缺失 result 补齐。
- `pnpm -C packages/nextclaw-core tsc`：通过。
- `pnpm -C packages/nextclaw-core exec eslint src/features/agent/services/input-budget-pruner.service.ts src/features/agent/services/input-budget-pruner.service.test.ts`：通过。
- `pnpm -C packages/nextclaw-core lint`：0 error，32 个既有 warning。
- 真实 session 回放：`ncp-mpmq8j2f-86d06c5c` 得到 `modelMessages=63`、`estimatedTokens=56477`、`droppedHistoryCount=0`、`toolMessages=51`、`assistantToolCalls=5`。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`：通过，非测试代码 `+89 / -91 / net -2`。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm lint:new-code:governance`：失败在无关工作区改动 `packages/ncp-packages/nextclaw-ncp/src/agent-runtime/round-buffer.ts` 文件角色后缀规则，非本迭代触达文件。

## 发布/部署方式

- 本次未执行发布。
- 变更位于 core 预算裁剪服务与项目 skill/设计文档；需要随下一次常规 beta 或桌面构建一并发布。

## 用户/产品视角的验收步骤

1. 打开原问题会话 `ncp-mpmq8j2f-86d06c5c`。
2. 观察上下文圆环应接近真实历史规模，不应回落到约 1.1K。
3. 继续发送消息时，模型输入应保留历史 tool call/result 关系；如果触发极端超预算，裁剪应按完整关联 pair 进行，不出现只留 call 或只留 result。

## 可维护性总结汇总

- 本次是 bugfix/稳定性改动，生产代码非测试净增为负：`+89 / -91 / net -2`。
- 正向减债动作：删除旧的无条件历史 tool 协议清理链路，收敛为“truncate 单条结果、必要时完整 pair 裁剪、最终协议归一化”的单一路径。
- 未通过压缩语句、削弱类型/协议保护或转移复杂度来满足 line gate；补充的缺失 result 保护是协议安全所必需。
- `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 已用于可维护性收尾；全局 governance 阻塞来自无关 dirty worktree。

## NPM 包发布记录

- 不涉及 NPM 包发布。
