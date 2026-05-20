# v0.18.92 LLM Usage Kernel Query

## 迭代完成说明

本轮继续推进 service 到 kernel 的低冲突重构，完成 `LLM Usage 查询能力归属收敛`：

- 将 `getSnapshot`、`getHistory`、`getStats` 和 history limit 解析规则移入 `@nextclaw/kernel` 的 `LlmUsageManager`。
- `LlmUsageStats` 类型由 kernel 导出，供 CLI、UI、诊断或未来 self-manage 复用。
- 删除 service CLI 内部的 `llm-usage-query.service.ts`，避免 service 独占 usage 统计语义。
- `LlmUsageCommandService` 只保留 usage 命令模式分派、JSON/text 输出和 `process.exitCode` 处理。
- 新增 kernel 侧 `llm-usage.manager.test.ts`，直接覆盖 usage 读取、历史顺序和聚合统计规则。

根因：LLM usage 是 NextClaw 自感知状态，记录 owner 已在 kernel，但查询和统计规则仍留在 service CLI，导致领域读模型和展示层耦合。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-kernel build`
- `pnpm -C packages/nextclaw-service tsc`
- `pnpm -C packages/nextclaw-kernel test -- src/managers/llm-usage.manager.test.ts`
- `pnpm -C packages/nextclaw-service test -- --run src/cli/commands/usage/services/llm-usage-command.service.test.ts`
- `pnpm -C packages/nextclaw-kernel exec eslint src/managers/llm-usage.manager.ts src/managers/llm-usage.manager.test.ts`
- `pnpm -C packages/nextclaw-service exec eslint src/cli/commands/usage/services/llm-usage-command.service.ts src/cli/commands/usage/services/llm-usage-command.service.test.ts`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/nextclaw-service lint`：通过，有 24 个既有 warning。
- `pnpm lint:new-code:governance`：通过，有 2 条 legacy module-structure warning，均来自已存在的 `packages/nextclaw-service/src/cli/commands/usage/services/*` 位于 legacy `cli/` 根下。
- `pnpm check:governance-backlog-ratchet`

## 发布/部署方式

未执行发布或部署。本轮是 kernel/service 内部职责收敛，需随项目后续统一发布闭环进入 NPM/桌面交付。

## 用户/产品视角的验收步骤

- `nextclaw usage` 应继续展示最新 LLM usage snapshot。
- `nextclaw usage --history --limit <n>` 应继续按最新记录优先展示历史。
- `nextclaw usage --stats` 应继续输出记录数、token 汇总、cache hit 和 cache token rate。
- `--json` 输出的 `mode/path/records/stats` 结构保持可读。

## 可维护性总结汇总

- 使用了 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review`。
- 代码增减：总计 `+226 / -177 / net +49`；非测试代码 `+138 / -169 / net -31`。
- 正向减债动作：删除、职责收敛、复用。
- 维护性收益：删除 service 内的 usage query owner，把 usage 读模型与统计规则收敛到 kernel `LlmUsageManager`；service CLI 只做展示与命令控制。
- 非新增用户能力，非测试代码净减 31 行，满足门槛；总行数净增来自新增 kernel 侧直接测试。

## NPM 包发布记录

不涉及 NPM 包发布。
