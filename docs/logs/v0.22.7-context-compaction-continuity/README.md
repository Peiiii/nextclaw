# v0.22.7 Context Compaction Continuity

## 迭代完成说明

本次修复 NCP/native 会话在上下文压缩前后失去连续性的问题。用户反馈的关键不是单一“没有压缩”，而是“刚压缩完就像新会话一样回复”。因此本轮按两阶段排查：

- 第一阶段先打穿不依赖真实 AI 的确定性链路：预算、压缩计划、summary source、projection、model input builder、InputBudgetPruner、bootstrap context。
- 第二阶段再用真实 AI 做端到端 smoke，验证用户可见回复是否真的接上上下文。

最终修复包括：

- 移除压缩的最小消息数门槛，短过载会话也能进入压缩。
- 压缩计划只保留当前最新用户输入 raw，旧上下文进入 summary，并写入 `coveredUntil`。
- preflight 预算计入 runtime `contextBlocks`，避免最终 pruner 才发现超预算。
- summary source 去掉 `ncp_parts` 重复结构，过长时保留 head + tail，并剥离 `<think>`。
- compressed projection 改为带元数据的 `service` message，最终进入 leading system。
- `AgentRunModelInputBuilder` 将 compressed context 放在普通 context blocks 前，避免 system tail truncation 优先裁掉摘要。
- compacted session 中剥离 `BOOT.md`、`BOOTSTRAP.md`、空模板 `IDENTITY.md`、空模板 `USER.md`，避免初始化指令压过压缩摘要。

设计文档已落盘：`docs/designs/2026-07-05-context-compaction-continuity.design.md`。

## 测试/验证/验收方式

已完成的确定性验证：

- `pnpm --filter @nextclaw/core test -- context-compaction.service.test.ts`：通过，3 tests。
- `pnpm --filter @nextclaw/kernel test -- context-compaction-preflight.service.test.ts agent-run-model-input-builder.service.test.ts agent-bootstrap-context.provider.test.ts`：通过，12 tests。

已完成的真实 AI smoke：

- 会话：`debug-context-continuity-smoke-1783271269504`
- 输入：720 段《天脊书》上下文压力文本，然后发送 `你好`。
- 压缩结果：`contextWindow.compacted=true`，`checkpointId=ctx-1783271280609`，`usedContextTokens=704/10000`，`droppedHistoryCount=0`，`truncatedSystemPrompt=false`。
- checkpoint：`originalEstimatedTokens=31648`，`projectedEstimatedTokens=10303`，`coveredMessageCount=2`，summary 含《天脊书》，无 `<think>`。
- 用户可见最终回复：接上“姜离封印祸斗王后”，并询问继续第九章或开始第二卷；未出现“刚醒来”“有什么可以帮你”“我是谁”等初始化话术。

收尾验证结果：

- `pnpm --filter @nextclaw/ncp-agent-runtime-next test -- agent-runtime.service.test.ts`：通过，7 tests。
- `pnpm --filter @nextclaw/core tsc`：通过。
- `pnpm --filter @nextclaw/kernel tsc`：通过，且在最后一次 import 调整后复跑通过。
- `pnpm --filter @nextclaw/ncp-agent-runtime-next tsc`：通过。
- `pnpm exec eslint <本次触达 TS 文件>`：通过，无 warnings。
- `git diff --check -- <本次触达文件>`：通过。
- `pnpm lint:new-code:governance -- <本次触达 TS 文件>`：通过；仅报告已在 `providers/README.md` 备案的 flat-directory warning。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --no-fail --paths <本次触达 TS 文件>`：生成报告，见“可维护性总结汇总”的 line-growth exception。

## 发布/部署方式

无需单独部署。该修复随下一次统一 NPM/桌面发布带出。

## 用户/产品视角的验收步骤

1. 将测试 agent 的上下文窗口调小，例如 `contextTokens=10000`。
2. 在新 debug NCP/native 会话里发送足够长、带明确可回忆事实的上下文。
3. 下一轮只发送 `你好`。
4. 期望看到 context window 显示 `compacted=true`。
5. 期望最终用户可见回复继续原上下文，而不是新会话初始化。

## 可维护性总结汇总

本次正向减债点是把“压缩摘要是否真的进入最终模型输入”变成可测合同，而不是只检查是否插入了 `context_compaction` marker。核心 owner 更清晰：

- core 负责压缩覆盖边界和 raw current message。
- kernel preflight 负责统一预算面和摘要质量。
- model input builder 负责 compressed context 的 system 优先级。
- bootstrap provider 负责 compacted session 的初始化模板抑制。

maintainability guard 量化结果：

- inspected files：13
- total line changes：`+915 / -34 / net +881`
- non-test line changes：`+271 / -26 / net +245`
- warning：`agent-runtime.service.ts` 当前 558 行，接近 600 行预算；本次仅新增 1 行传递 `contextBlocks`。
- warning：`context-provider/providers` 目录超过直接文件数预算，但已有 role contract exception；本次新增测试覆盖 provider 行为时触达该目录。
- warning：`context-compaction-preflight.service.test.ts` 增长明显，增长来自新增预算、tail source、rolling compaction 与 continuation prompt 回归用例。

line-growth exception：严格按非功能门槛，本次不能算 maintainability guard “通过”，因为非测试净增为 `+245`。我没有通过删除可观测合同或改无关代码抵数来伪造通过；保留增长的理由是这次真实根因跨越压缩计划、preflight 预算、summary source、projection、model input builder 和 onboarding context，新增生产代码都落在对应 owner 上，并且已有定向测试锁住每条合同。继续为了行数删除这些合同，会重新回到“只有 marker，没有最终输入证据”的不可观测状态。

## NPM 包发布记录

- 涉及包：`@nextclaw/core`、`@nextclaw/kernel`、`@nextclaw/ncp-agent-runtime-next`
- 发布状态：待下一次统一 NPM/桌面发布带出
- Changeset：`.changeset/context-compaction-continuity.md`
