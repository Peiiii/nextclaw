# 上下文压缩连续性修复设计

## 背景

NextClaw 的会话压缩必须服务“连续工作上下文”，不能让用户刚触发压缩就获得一个像新会话一样的回复。用户反馈的体感不是单纯“没有 context_compaction marker”，而是两类问题叠加：

- 超过上下文窗口后，有些会话没有及时触发压缩。
- 即使压缩已经发生，后续 bare greeting 仍可能回复初始化话术，表现为“压缩完立刻丢上下文”。

本轮修复是非功能改动，目标是让 NCP/native 会话在上下文压缩前后保持同一语义主线，并让排查方式分成确定性链路验证和真实 AI 端到端验证两阶段。

## 现状依据

真实用户会话只用于读取证据，不再继续发送消息：

- 原会话：`ncp-mr7xv00k-3fb7dd19`
- 现象：压缩后存在 `last_context_compaction`，summary 里包含《天脊书》、姜离、祸斗王、章节进度，但下一轮 bare greeting 仍回复“刚醒来/起名字/我是谁”式初始化内容。
- 判断：这说明 marker 和 summary 本身不等于最终模型输入有效；问题必须追到 preflight、projection、model input builder、pruner 和 context provider 的完整链路。

确定性排查发现的关键事实：

- `ContextCompactionService` 曾有最小消息数门槛，短会话即使单条大输入超过预算也可能不压缩。
- preflight 曾未把 runtime `contextBlocks` 算进预算，导致压缩判断和最终 `InputBudgetPruner` 不在同一压力面。
- 压缩 source 曾同时包含 `content` 与 `ncp_parts`，重复放大摘要输入，并提升截断风险。
- 压缩摘要曾作为普通投影消息进入最终输入，权重弱于 system context。
- 压缩摘要曾追加在 context blocks 后面；`InputBudgetPruner.truncateSystemPrompt()` 保头截尾时，可能优先截掉压缩摘要。
- `BOOTSTRAP.md`、空模板 `IDENTITY.md`、空模板 `USER.md` 在压缩后仍进入 system context，容易覆盖“继续旧会话”的摘要合同。
- 摘要模型可能输出 `<think>`，如果不剥离，会污染压缩上下文。

## 核心判断

根因不是“刚压缩完仍然超过 120K 所以又被裁剪”这一条异常假设。更真实的问题是压缩合同没有成为最终模型输入里的最高优先级事实：

1. 该压缩时可能没压缩：预算口径不一致，且短过载会话被最小消息数门槛挡住。
2. 压缩了也可能弱化：summary 只是普通历史投影，没有被折叠进 leading system。
3. 折叠进 system 后仍可能被裁掉：摘要放在 context blocks 后，system prompt 保头截尾会让摘要处在危险位置。
4. 摘要存在仍可能被初始化模板抢走：BOOTSTRAP/空身份模板告诉模型“你刚醒来”，与压缩摘要冲突。

所以修复原则是让压缩摘要成为“本轮最终模型输入的第一优先级连续性合同”，并让当前用户消息保持 raw，而不是只依赖 summary 覆盖当前轮。

## 推荐方案

采用结构性修复：

1. 压缩触发层：移除最小消息数门槛；压缩计划只保留当前最新输入作为 raw message，其余可覆盖旧上下文进入 summary。
2. 预算层：`AgentRunPreflight` 传入 `contextBlocks`，preflight 预算与最终 model input 预算使用同一上下文前缀。
3. 摘要输入层：压缩 source 只保留 `{ role, content, timestamp, ncp_message_id }`，避免 `ncp_parts` 重复放大；过长时保 head + tail。
4. 摘要清洗层：剥离 summary 中的 reasoning / `<think>` 标签。
5. 投影层：压缩 summary 以 synthetic `service` message 投影，并带 `nextclaw_context_projection=compressed_context` 元数据。
6. 模型输入层：`AgentRunModelInputBuilder` 识别 compressed projection，把它折叠进 leading system，并放在普通 context blocks 前面。
7. 初始化上下文层：有 compressed projection 时，剥离 `BOOT.md`、`BOOTSTRAP.md`、未初始化模板 `IDENTITY.md`、`USER.md`；后续已 compacted session 的 bootstrap provider 也复用同一判断。

不推荐方案：

- 不只调大上下文窗口。它会掩盖问题，不能解释 10K 窗口和短会话场景。
- 不只调 summary prompt。真实故障发生在预算、投影和 system ordering 里，prompt 只能改善摘要质量。
- 不让最终 pruner 背语义责任。pruner 只负责硬预算裁剪，不能判断“压缩摘要比 BOOTSTRAP 更重要”。

## Owner 与数据流

Owner 划分：

- `ContextCompactionService`：决定是否压缩、覆盖到哪里、当前 raw tail 是什么。
- `ContextCompactionPreflightService`：合成 session messages、context blocks 和 agent profile，生成摘要与 compaction events。
- `context-compaction.utils`：定义 compressed projection 的 message 形态与识别元数据。
- `AgentRunModelInputBuilder`：把 compressed projection 折叠成 leading system priority context，并执行最终预算。
- `AgentBootstrapContextProvider` / `agent-onboarding-context.utils`：在已压缩上下文里抑制初始化模板。
- `InputBudgetPruner`：只做最终硬预算，保持纯粹。

目标数据流：

```text
current user message
  -> sessionRun.inbox.drain
  -> preflight(session snapshot + contextBlocks)
  -> compaction plan(summary source + current raw message)
  -> service marker + compressed projection metadata
  -> model input(compressed context first, then sanitized contextBlocks, then raw current message)
  -> InputBudgetPruner final safety gate
  -> LLM continues old task instead of onboarding
```

## 目录组织

触达文件：

- `packages/ncp-packages/nextclaw-ncp-agent-runtime-next/src/runtime/agent-runtime.service.ts`
- `packages/nextclaw-kernel/src/contributions/agent-run-runtime/index.ts`
- `packages/nextclaw-kernel/src/managers/agent-run-context-compaction.manager.ts`
- `packages/nextclaw-kernel/src/features/context-compaction/services/context-compaction-preflight.service.ts`
- `packages/nextclaw-kernel/src/features/context-compaction/utils/context-compaction.utils.ts`
- `packages/nextclaw-kernel/src/services/agent-run-model-input-builder.service.ts`
- `packages/nextclaw-kernel/src/contributions/context-provider/providers/agent-bootstrap-context.provider.ts`
- `packages/nextclaw-kernel/src/utils/agent-onboarding-context.utils.ts`
- `packages/nextclaw-core/src/features/runtime-context/services/context-compaction.service.ts`
- 对应单测文件

不新增新的 manager/service。新增的 onboarding utility 是跨 builder 与 provider 的小型共享规则 owner，避免重复写模板识别逻辑。

## 验收策略

第一阶段：不依赖真实 AI 的确定性验证。

- core：短过载会话也会触发压缩；压缩计划只保留当前输入 raw。
- preflight：预算计入 context blocks；summary source 保 tail；rolling compaction 使用 `coveredUntil`；summary 清洗 `<think>`；continuation prompt 锁定继续合同。
- input builder：compressed projection 折叠进 leading system；摘要在 oversized system prompt 下不会被 pruner 截掉；BOOTSTRAP/空 IDENTITY/空 USER 在压缩后被剥离。
- bootstrap provider：已 compacted session 后续构建上下文时不再注入初始化模板。

第二阶段：真实 AI 端到端验证。

- 使用新 debug 会话，不继续污染用户原会话。
- 先发送大输入建立《天脊书》上下文，再发送 bare greeting `你好`。
- 成功条件：
  - `contextWindow.compacted=true`
  - `last_context_compaction.summary` 含《天脊书》且无 `<think>`
  - 用户可见 `text` part 接上姜离/祸斗王，并询问第九章或第二卷
  - 不出现“刚醒来”“有什么可以帮你”“我是谁”等初始化话术

最新真实 smoke 证据：

- 会话：`debug-context-continuity-smoke-1783271269504`
- 窗口：`usedContextTokens=704/10000`，`compacted=true`，`checkpointId=ctx-1783271280609`，`compactedMessageCount=2`，`truncatedSystemPrompt=false`，`droppedHistoryCount=0`
- 压缩：`originalEstimatedTokens=31648`，`projectedEstimatedTokens=10303`，summary 含《天脊书》，无 `<think>`
- 最终用户可见回复：`姜离封印祸斗王后...继续第九章...直接开第二卷...`

## 非目标

- 不重做整套上下文管理策略。
- 不改变 provider 摘要模型选择。
- 不解决所有长上下文语义压缩质量问题。
- 不调整 UI context window indicator。
- 不提交本地构建产生的 `ui-dist` hash 产物。

## 后续实现顺序

1. 先补确定性测试，把预算、投影、pruner、onboarding 冲突锁住。
2. 再修改压缩 plan、preflight、projection、model input builder 和 bootstrap provider。
3. 再用新 debug 会话做真实 AI smoke，不复用用户原会话。
4. 最后跑类型、lint、治理与可维护性收尾，并更新迭代记录。
