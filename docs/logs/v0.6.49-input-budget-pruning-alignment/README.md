# v0.6.49-input-budget-pruning-alignment

## 迭代完成说明（改了什么）

本次将 NextClaw 的输入上下文控制从“字符/条数驱动”为主，升级为更接近 OpenClaw 的“统一 token-budget 裁剪器”，并保持低耦合实现。

- 新增统一输入预算裁剪器：[`packages/nextclaw-core/src/agent/input-budget-pruner.ts`](../../../packages/nextclaw-core/src/agent/input-budget-pruner.ts)
- 在主 Agent 循环每次调用模型前启用裁剪：[`packages/nextclaw-core/src/agent/loop.ts`](../../../packages/nextclaw-core/src/agent/loop.ts)
- 在 Subagent 循环同样启用裁剪，保持行为一致：[`packages/nextclaw-core/src/agent/subagent.ts`](../../../packages/nextclaw-core/src/agent/subagent.ts)
- 新增配置项 `agents.defaults.contextTokens` 与 `agents.list[*].contextTokens`：[`packages/nextclaw-core/src/config/schema.ts`](../../../packages/nextclaw-core/src/config/schema.ts)
- 增加热更新规则与 UI Hint 文案：
  - [`packages/nextclaw-core/src/config/reload.ts`](../../../packages/nextclaw-core/src/config/reload.ts)
  - [`packages/nextclaw-core/src/config/schema.help.ts`](../../../packages/nextclaw-core/src/config/schema.help.ts)
  - [`packages/nextclaw-core/src/config/schema.labels.ts`](../../../packages/nextclaw-core/src/config/schema.labels.ts)
- 更新使用文档与架构文档：
  - [`docs/USAGE.md`](../../../docs/USAGE.md)
  - [`docs/guides/multi-agent-architecture.md`](../../../docs/guides/multi-agent-architecture.md)

## 测试 / 验证 / 验收方式

- 工程校验（需通过）：
  - `pnpm build`
  - `pnpm lint`
  - `pnpm tsc`
  - 结果：全部通过（`lint` 仅有仓库既有告警，无新增 error）
- 冒烟测试（不写入仓库目录）：
  - 命令（示例）：
    - `NEXTCLAW_HOME=/tmp/nextclaw-smoke-v0649 pnpm -C packages/nextclaw-core exec tsx -e "import { InputBudgetPruner } from './src/agent/input-budget-pruner.ts'; const p=new InputBudgetPruner(); const long='x'.repeat(1200000); const r=p.prune({messages:[{role:'system',content:'sys'},{role:'user',content:long},{role:'tool',content:long}] as any, contextTokens:200000}); console.log(JSON.stringify({budget:r.budgetTokens, estimated:r.estimatedTokens, tool:r.truncatedToolResultCount, dropped:r.droppedHistoryCount, user:r.truncatedUserMessage}));"`
  - 观察点：
    - 输出中 `tool` 或 `dropped` 至少一个大于 `0`
    - `estimated` 不再无限增长并被压回预算附近
  - 本次实测输出：`{"budget":176000,"estimated":60009,"toolTruncated":1,"dropped":1,"userTruncated":false,"totalMessages":2,"toolLen":240000}`

### 用户/产品视角验收步骤

1. 在配置中设置 `agents.defaults.contextTokens`（例如 `200000`），并为某个角色设置更小的 `contextTokens`（例如 `160000`）。
2. 在该角色所在渠道连续发送长上下文消息（含工具输出的场景更佳），确认仍能稳定回复，不出现因输入超长导致的直接失败。
3. 验证多角色场景：不同角色按各自预算运行，低预算角色更早触发上下文裁剪，高预算角色保留更多上下文。
4. 验证热更新：运行中修改 `agents.defaults.contextTokens` 后无需重启即可生效。
5. 产品验收通过标准：
   - 长上下文稳定性提升；
   - 不破坏既有路由/会话能力；
   - 配置入口清晰，行为可解释。

## 发布 / 部署方式

- 发布流程文档：[`docs/workflows/npm-release-process.md`](../../../docs/workflows/npm-release-process.md)
- 发布闭环：
  1. `pnpm release:version`
  2. `pnpm release:publish`
- 本次已发布：
  - `@nextclaw/core@0.6.24`
  - `@nextclaw/channel-runtime@0.1.10`
  - `@nextclaw/openclaw-compat@0.1.17`
  - `@nextclaw/server@0.4.10`
  - `nextclaw@0.6.27`
- 远程 migration：不适用（本次为 npm 包运行时与配置能力变更，不涉及后端数据库结构）。
