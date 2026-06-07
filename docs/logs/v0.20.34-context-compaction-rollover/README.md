# v0.20.34 Context Compaction Rollover

## 迭代完成说明

本次修复长会话自动压缩只能触发一次，以及滚动压缩后圆环仍显示超窗的问题。

根因是 `ContextCompactionPreflightService.begin()` 把已有 `last_context_compaction` checkpoint 视为禁止继续压缩的条件：只要 `existingCheckpoint` 存在，即使 `summary + checkpoint 后新增消息` 再次超过上下文窗口，也不会生成新的 compaction plan。

后续追查又暴露出 retained-tail 方案本身过复杂：如果压缩后还要保留最近几条原始消息，就会继续引入 retained ids、marker 前后顺序、tool 协议组切分、固定条数过大等问题。最终设计改为真实压缩：压缩服务把当前上下文整体压成一条 working context summary，模型输入只保留 `system + compressed working context + checkpoint 后新增消息`。

本次落地后，checkpoint 不再包含 retained-tail 字段；kernel 侧也不再有 projection/boundary/timeline materialization 多文件链路，`context-compaction` feature 下只保留单个 `context-compaction.utils.ts` 承载压缩相关纯函数和极薄辅助。

设计沉淀在 `docs/designs/2026-06-07-real-context-compaction-design.md`。

## 测试/验证/验收方式

已通过验证：

- `pnpm --filter @nextclaw/core test -- src/features/runtime-context/services/context-compaction.service.test.ts`：通过，1 file / 2 tests。
- `pnpm --filter @nextclaw/kernel test -- src/stores/ncp-agent-session-journal.store.test.ts src/features/context-compaction/services/context-compaction-preflight.service.test.ts`：通过，2 files / 16 tests。
- `pnpm --filter @nextclaw/core tsc`：通过。
- `pnpm --filter @nextclaw/kernel tsc`：通过。
- `pnpm --filter @nextclaw/core lint`：通过，保留 29 个既有 warning。
- `pnpm --filter @nextclaw/kernel lint`：通过。
- `node scripts/governance/lint-new-code-governance.mjs -- ...`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `git diff --check -- ...`：通过。
- 旧 retained/projection/boundary 代码符号定向搜索：无残留。
- 非单测真实边界 smoke：直接加载 kernel 源码执行 `AgentRunContextCompactionManager -> ContextCompactionPreflightService -> AgentRunMessageProjector`，验证 rolling compaction 输入包含旧 summary 和 checkpoint 后最新消息、不包含 pre-checkpoint raw 消息，final checkpoint 无 retained-tail 字段，压缩后当前轮 projector 只输出 working summary，下一轮输出 summary + checkpoint 后新消息。
- 当前源码构建产品级 smoke：用 `pnpm local:source-runtime -- start --port 18889 --instance context-compaction-smoke --home-mode clone-config` 启动隔离源码实例，先跑普通 `pnpm smoke:ncp-chat -- --session-type native --port 18889` 通过；再把隔离 config 的 `agents.defaults.contextTokens` 调到 `1000`、`reservedContextTokens` 调到 `100`，同一 session 连续发 5 轮 HTTP/SSE 消息，真实观察到 `context_compaction` marker 从 `compressing` 更新为 `compressed`，checkpoint keys 只有 `version/id/status/summary/coveredMessageCount/coveredSessionMessageCount/originalEstimatedTokens/projectedEstimatedTokens/createdAt/updatedAt`，无 retained-tail 字段；随后同 session 再发一条消息，真实返回 `REAL_COMPACTION_AFTER_MARKER_OK`。
- 源码实例验证后已停止隔离实例，并运行 `pnpm clean:generated` 清理构建生成的 `packages/nextclaw/ui-dist` churn。

功能验收重点：

- 首次压缩后 model input 不再包含 raw retained tail，只包含 compressed working context。
- rolling compaction 会把旧 summary 和 checkpoint 后新增消息一起重新压缩。
- summary prompt 明确要求写入 `Recent High-Fidelity Context`，用 summary 质量承接最近上下文，而不是靠保留原始消息兜底。

## 发布/部署方式

本次未执行发布、部署、NPM release 或运行时重启。改动停留在源码和回归测试层，后续随统一发布流程进入包发布。

## 用户/产品视角的验收步骤

1. 准备一个已完成首次自动压缩的 NCP native 会话。
2. 在 checkpoint 后继续产生足够多的新消息，使 `compressed summary + 新增消息` 再次超过上下文窗口阈值。
3. 发送下一条消息触发 agent run preflight。
4. 预期会话再次生成新的“较早上下文已自动压缩”timeline marker，并且下一轮模型输入使用新的 compressed working context，而不是 raw retained tail。

## 可维护性总结汇总

本次是非功能 bugfix。最终方向是删掉 retained-tail 方案引入的多余复杂度，让上下文压缩回到一个简单模型：完整历史不改写，checkpoint summary 代表已压缩上下文，model input 从 summary 和 checkpoint 后新增消息构造。

maintainability guard 完整口径通过：

- 总改动：`+297 / -260 / net +37`。
- 非测试代码：`+176 / -254 / net -78`。
- 正向减债动作：删除 boundary planner、retained-tail utils、timeline marker materialization、retained ids fallback，以及对应测试。
- 剩余 warning：`ncp-agent-session-journal.utils.ts` 接近文件预算，本次未继续拆分，因为压缩 marker materialization 已从该文件删除，继续拆分会扩大本轮范围。

## NPM 包发布记录

本次不执行 NPM 发布，但添加 `.changeset/context-compaction-working-context.md`，标记 `@nextclaw/core` 与 `@nextclaw/kernel` patch。原因是用户可见 bugfix：长会话自动压缩后，模型输入应使用单条 compressed working context，避免旧 retained-tail 逻辑导致上下文丢失或超窗。
