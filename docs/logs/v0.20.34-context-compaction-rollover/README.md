# v0.20.34 Context Compaction Rollover

## 迭代完成说明

本次修复长会话自动压缩只能触发一次，以及滚动压缩后圆环仍显示超窗的问题。

根因是 `ContextCompactionPreflightService.begin()` 把已有 `last_context_compaction` checkpoint 视为禁止继续压缩的条件：只要 `existingCheckpoint` 存在，即使 `summary + checkpoint 后新增消息` 再次超过上下文窗口，也不会生成新的 compaction plan。

确认方式是检查真实会话 `ncp-mq13gr6k-3ad5aed3`：会话已经在 `2026-06-05T17:12:17.484Z` 生成 `compressed` checkpoint，并插入“较早上下文已自动压缩”时间线消息；但 checkpoint 后又新增了大量 reasoning / tool 过程，当前 `contextWindow.usedContextTokens` 达到约 `260k / 200k`。因此故障不是 UI 圆环误报，而是缺少滚动压缩。

第二层根因来自 timeline marker：滚动压缩复用同一个 `context-compaction:<checkpoint.id>` message id，journal 虽然 append 了新的 checkpoint event，但 replay 时 `upsertMessage()` 会按相同 id 原地替换旧 timeline message。projection 再按 timeline message 的数组位置切上下文时，marker 仍停在旧位置，marker 后的旧大消息会继续被当成“未压缩尾巴”，所以圆环看起来仍没回落。

第三层根因来自旧 journal replay：部分旧的孤儿 streaming message 会在 replay 数组里位于 timeline marker 之后，不能再用数组位置判断“checkpoint 之后”。另外，当 metadata sidecar 停在 `status: compressing` 时，`readCompressedContextCompactionCheckpoint()` 会返回空，preview 会被迫退回未压缩路径，即使 timeline 里仍有上一个稳定的 compressed checkpoint。

修复方式是在 preflight owner 内移除“已有 checkpoint 就不 plan”的短路条件，改为只要当前预算评估再次达到压缩阈值就准备新的压缩计划。已有 checkpoint 场景下，新计划会基于投影后的“旧摘要 + 新增消息”生成新摘要，并保留原 checkpoint id / createdAt，以更新同一个会话压缩标记。滚动压缩的覆盖计数按旧 checkpoint 累计，避免 UI 计数倒退。NCP timeline service message 使用随机唯一 `message.id`，同一次 begin/finish 复用 pending work 中的 id，下一次 rolling checkpoint 生成新的 message id；checkpoint id 只保留在 metadata 中。

projection 不再依赖 replay 数组位置，而是读取最新 compressed checkpoint 的 `updatedAt`，只保留 timestamp 晚于 checkpoint 的消息。preflight 在 metadata 不是 compressed 时会回退到 timeline 中最新的 compressed checkpoint，避免 stuck-compressing metadata 遮蔽稳定基线。旧 journal 中已经落盘的拼接式 context-compaction marker id 只在 replay 时按覆盖计数做只读展开，避免历史压缩记录继续互相覆盖；新写入不再使用拼接 id。设计合同沉淀在 `docs/designs/2026-06-06-context-compaction-message-id-contract.md`。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/kernel test -- src/stores/ncp-agent-session-journal.store.test.ts src/features/context-compaction/services/context-compaction-preflight.service.test.ts`：通过。覆盖已有 compressed checkpoint 后再次越过上下文窗口时仍生成新 compaction plan；确认 replay 顺序错位时按 checkpoint timestamp projection；确认 metadata stuck-compressing 时回退 timeline compressed checkpoint；确认新 timeline marker 使用随机普通 message id，同一轮 begin/finish id 保持一致；确认旧 journal 拼接 id 会在 replay 时展开为多条历史 marker。
- `pnpm --filter @nextclaw/kernel tsc`：通过。
- `pnpm --filter @nextclaw/kernel lint`：通过。
- `pnpm --filter @nextclaw/kernel exec tsx -e <source replay smoke>`：通过。用当前源码读取真实会话 `ncp-mq13gr6k-3ad5aed3` 的 journal 后，replay 得到 `4` 条历史 context-compaction marker，覆盖计数分别为 `176 / 335 / 489 / 647`；projection 后只剩 `8` 条模型输入消息，预算估算为 `4149 / 200000`。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-kernel/src/features/context-compaction/services/context-compaction-preflight.service.ts packages/nextclaw-kernel/src/features/context-compaction/utils/context-compaction-projection.utils.ts packages/nextclaw-kernel/src/features/context-compaction/utils/context-compaction-timeline-message.utils.ts packages/nextclaw-kernel/src/utils/ncp-agent-session-journal.utils.ts packages/nextclaw-kernel/src/features/context-compaction/services/context-compaction-preflight.service.test.ts packages/nextclaw-kernel/src/stores/ncp-agent-session-journal.store.test.ts docs/designs/2026-06-06-context-compaction-message-id-contract.md docs/logs/v0.20.34-context-compaction-rollover/README.md`：通过；非测试代码 `+83 / -87 / net -4`。
- `node scripts/governance/lint-new-code-governance.mjs -- packages/nextclaw-kernel/src/features/context-compaction/services/context-compaction-preflight.service.ts packages/nextclaw-kernel/src/features/context-compaction/utils/context-compaction-projection.utils.ts packages/nextclaw-kernel/src/features/context-compaction/utils/context-compaction-timeline-message.utils.ts packages/nextclaw-kernel/src/utils/ncp-agent-session-journal.utils.ts packages/nextclaw-kernel/src/features/context-compaction/services/context-compaction-preflight.service.test.ts packages/nextclaw-kernel/src/stores/ncp-agent-session-journal.store.test.ts docs/designs/2026-06-06-context-compaction-message-id-contract.md docs/logs/v0.20.34-context-compaction-rollover/README.md`：通过。
- `node scripts/governance/lint-doc-file-names.mjs -- docs/designs/2026-06-06-context-compaction-message-id-contract.md docs/logs/v0.20.34-context-compaction-rollover/README.md`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。

全量 `pnpm lint:new-code:governance` 未作为本次最终通过信号，因为当前工作区同时存在其它未归属本次的 peerId 相关改动，会触发 `packages/ncp-packages/nextclaw-ncp/src/types/session.ts` / `session.types.ts` 附近的治理检查；本次使用路径过滤对 context-compaction 触达文件完成等价治理验收。

## 发布/部署方式

本次未执行发布、部署、NPM release 或运行时重启。改动停留在源码和回归测试层，后续随统一发布流程进入包发布。

## 用户/产品视角的验收步骤

1. 准备一个已经完成首次自动压缩的 NCP native 会话。
2. 在该 checkpoint 后继续产生足够多的 reasoning、工具调用结果或长回复，使 `summary + 新增消息` 再次超过上下文窗口阈值。
3. 发送下一条消息触发 agent run preflight。
4. 预期会话再次生成新的“较早上下文已自动压缩”timeline marker；即使 metadata 短暂停在 `compressing`，`contextWindow.usedContextTokens` 也应基于最近一次 compressed checkpoint 回落，而不是继续停留在超窗状态。

## 可维护性总结汇总

本次是非功能 bugfix。生产代码通过删除 preview 专用预算 helper、收敛 projection checkpoint 扫描、复用 timeline text 生成抵消滚动压缩与 legacy replay 兼容必要逻辑，最终非测试代码 `+83 / -87 / net -4`，满足非功能改动门槛。

正向减债动作：简化。`preview()` 与 `begin()` 中原本只服务三元表达式的 `modelCandidateMessages` 临时变量被内联；preview 专用预算 helper 被删除；projection 改为单一 checkpoint timestamp 边界，避免继续依赖 timeline marker 数组位置。owner 仍集中在 `ContextCompactionPreflightService`、projection、timeline message id 合同与 journal replay 旧数据读取，没有把问题下放到 UI、budgeter 或 session manager 兜底。

`post-edit-maintainability-review` 结论：通过。no maintainability findings。

## NPM 包发布记录

不涉及 NPM 包发布。本次没有添加 changeset；需要随后续统一 patch 发布时再评估 `@nextclaw/kernel` 是否进入发布批次。
