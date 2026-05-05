# 迭代完成说明

- 为长会话补上“上下文压缩检查点”能力：当真实模型输入估算超出上下文预算时，系统会生成 `compressed` 检查点，并把它作为一条特殊 timeline item 写入会话消息流；数据结构保留 `compressing` 状态，供后续异步摘要复用。
- 这条条目在前端不渲染成普通消息卡片，而是在消息流中渲染成一条轻量分割线，明确表达“到这里为止，前面的较早上下文已被压缩替代”。
- 存储层继续完整保留原始消息，不做删除式压缩；只有在构建模型输入时，才会用 checkpoint 摘要临时替换更早历史。
- 压缩摘要已从确定性摘录改为 LLM 生成：发送前预检先判断是否达到阈值，只有需要压缩时才调用当前 Agent 模型生成结构化 summary，再把 summary 写入 checkpoint。
- `usedContextTokens` 和 `totalContextTokens` 继续保持为独立字段，压缩检查点没有和上下文窗口统计绑死。上下文占用圆环仍然读 `last_context_window`，消息流分割线则读特殊 timeline item。
- 上下文压缩触发从 `NextclawNcpContextBuilder` 移到发送前预检：`ContextCompactionPreflightService` 负责判断是否压缩、写入 timeline checkpoint、更新 `last_context_window`；builder 只消费已有 checkpoint 来投影模型输入，不再写 session。
- 增加 runtime context ownership：native runtime 属于 `nextclaw` 管理，发送前执行 NextClaw 压缩预检；Codex、Claude Code 这类 runtime-owned 会话不做 NextClaw 外层二次压缩，避免破坏其内部上下文管理与缓存策略。
- 修复上下文占用圆环在继续对话后停留在旧百分比的问题：上下文窗口统计由发送前预检同步写回当前 live session metadata，再由后续会话摘要与持久化沿同一路径读取，避免落盘 session 与 runtime session 各持一份旧状态。
- 根因说明：
  - 根因不是“缺一个压缩提示 UI”，而是系统缺少一种既有顺序位置、又不破坏原始消息存储、还能在模型输入阶段替代旧历史的会话管理结构。
  - 如果只做顶部 metadata 或普通 `system` message，都无法同时满足“消息流可定位”“不原样送给 AI”“原始消息不删”这三件事。
  - 本次修复命中根因的方式，是引入 `service` role 的特殊 timeline message 作为位置载体，再由 builder / bridge 显式过滤它，保证它只参与 UI 顺序和模型输入投影，而不污染普通消息协议。
  - 上下文圆环不更新的根因，是上下文窗口统计只更新了 `SessionManager` 中的会话 metadata，没有同步到 NCP runtime 当前持有的 live session metadata；会话摘要读取 live metadata 时继续拿到旧的 `last_context_window`，因此用户继续追问后仍看到旧百分比。本次修复没有在持久化层增加字段特判或 merge 补丁，而是把写入职责收回到发送前预检主路径：预检计算后立即同步当前 live session metadata。
  - 压缩不自动触发的根因，是触发时机藏在 builder 内部，且 builder 同时承担构建、估算、写 session、插 timeline 多种职责；这让“发送前应该先检查是否需要压缩”的产品语义不清晰。本次把触发 owner 拆到 `ContextCompactionPreflightService`，builder 只保留纯输入投影职责。
  - 本轮又确认一处边界设计问题：不应该额外依赖 `coveredUntilMessageId` 作为第二套边界。真正的边界就是 checkpoint 在消息流里的物理位置；它之前的普通消息由 summary 替代，它之后的普通消息继续原样送入模型输入。修复后 checkpoint ID 仅用于标识和更新记录，不参与模型输入边界判断。
  - 本轮进一步确认“确定性摘录”不是语义压缩，只能算裁剪。根因是压缩 owner 只在本地拼接旧消息，没有调用 LLM 重新总结旧历史；这会保留大量冗余，也无法提炼目标、决策、文件、测试结果和下一步。本次修复把 summary 生成改成真实 LLM 调用，测试验证 provider 会先收到压缩请求，再收到业务请求。
- 相关设计文档：
  - [2026-05-05-context-compaction-checkpoint-design.md](../../designs/2026-05-05-context-compaction-checkpoint-design.md)

## 测试/验证/验收方式

- 已通过：
  - `pnpm -C packages/nextclaw-ui test -- --run src/features/chat/utils/ncp-session-adapter.utils.test.ts src/features/chat/components/conversation/chat-message-list.container.test.tsx src/features/chat/components/conversation/chat-conversation-panel.test.tsx`
  - `pnpm -C packages/nextclaw test -- --run src/cli/commands/ncp/context/nextclaw-ncp-context-builder.test.ts`
  - `pnpm -C packages/nextclaw test -- --run src/cli/commands/ncp/context/nextclaw-ncp-context-builder.test.ts src/cli/commands/ncp/session/nextclaw-agent-session-store.test.ts`
  - `pnpm -C packages/nextclaw test -- --run src/cli/commands/ncp/context/context-compaction-preflight.service.test.ts src/cli/commands/ncp/context/nextclaw-ncp-context-builder.test.ts`
  - `NEXTCLAW_HOME="$(mktemp -d)" pnpm -C packages/nextclaw test -- --run src/cli/commands/ncp/features/runtime/create-ui-ncp-agent-context-compaction.test.ts`
  - `pnpm -C packages/nextclaw-ui test -- --run src/features/chat/components/conversation/chat-message-list.container.test.tsx`
  - `pnpm -C packages/nextclaw tsc -p tsconfig.json --pretty false`
  - `pnpm -C packages/nextclaw-ui tsc -p tsconfig.json --pretty false`
  - `pnpm -C packages/nextclaw exec eslint src/cli/commands/ncp/context/context-compaction-preflight.service.ts src/cli/commands/ncp/context/context-compaction-preflight.service.test.ts src/cli/commands/ncp/context/context-compaction-projection.utils.ts src/cli/commands/ncp/context/context-compaction.service.ts src/cli/commands/ncp/context/context-compaction-timeline-message.utils.ts src/cli/commands/ncp/nextclaw-ncp-context-builder.ts src/cli/commands/ncp/context/nextclaw-ncp-context-builder.test.ts src/cli/commands/ncp/features/runtime/create-ui-ncp-agent.service.ts`
  - `pnpm lint:new-code:governance`
  - `pnpm -C packages/nextclaw exec eslint src/cli/commands/ncp/nextclaw-ncp-context-builder.ts src/cli/commands/ncp/features/runtime/create-ui-ncp-agent.service.ts src/cli/commands/ncp/context/nextclaw-ncp-context-builder.test.ts src/cli/commands/ncp/session/nextclaw-agent-session-store.test.ts`
  - `pnpm lint:new-code:governance`
- 本次流程补正：
  - 初版收尾时漏跑了 `pnpm -C packages/nextclaw tsc -p tsconfig.json --pretty false`，导致两处纯类型错误没有被拦住。
  - 本次已补跑 `tsc` 并修复对应错误，同时把 `/validate` 与 `post-dev-stage-validation` 规则进一步写死为“TypeScript 改动不可用测试 / eslint / governance 替代 `tsc`”。
- 本次定向验证重点：
  - 验证压缩检查点不会替代或删除已存储原始消息
  - 验证压缩条目会以消息流 divider 方式出现在正确物理位置
  - 验证特殊 timeline message 不会被原样送给上游模型输入
  - 验证未触发压缩时，`last_context_window` 也会同步写入当前 live session metadata，避免前端圆环继续展示旧占比
  - 验证 native runtime 发送前预检会创建 checkpoint，runtime-owned 策略会跳过 NextClaw 外层压缩
  - 验证 builder 只消费已有 checkpoint 做模型输入投影，不再写入 session metadata 或新增 timeline message
  - 验证真实 native 发送链路会触发压缩，并确认 provider 收到的模型输入包含 checkpoint summary、不再包含被覆盖的最早历史
  - 验证真实 native 发送链路中 provider 调用顺序为 `chat` 摘要请求在前、`chatStream` 业务请求在后，避免把裁剪冒充压缩
  - 验证前端消息流会按 checkpoint 的物理位置渲染 divider，而不是从 metadata 猜边界
- 上下文圆环不更新修复的补充验证：
  - `pnpm -C packages/nextclaw test -- --run src/cli/commands/ncp/context/nextclaw-ncp-context-builder.test.ts src/cli/commands/ncp/session/nextclaw-agent-session-store.test.ts`
  - `pnpm -C packages/nextclaw tsc -p tsconfig.json --pretty false`
  - `pnpm -C packages/nextclaw exec eslint src/cli/commands/ncp/nextclaw-ncp-context-builder.ts src/cli/commands/ncp/features/runtime/create-ui-ncp-agent.service.ts src/cli/commands/ncp/context/nextclaw-ncp-context-builder.test.ts src/cli/commands/ncp/session/nextclaw-agent-session-store.test.ts`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-context-builder.ts packages/nextclaw/src/cli/commands/ncp/features/runtime/create-ui-ncp-agent.service.ts packages/nextclaw/src/cli/commands/ncp/context/nextclaw-ncp-context-builder.test.ts packages/nextclaw/src/cli/commands/ncp/session/nextclaw-agent-session-store.test.ts docs/logs/v0.17.15-context-compaction-checkpoints/README.md`
  - `pnpm lint:new-code:governance` 本轮受工作区内其它未提交改动阻断，阻断文件为 `packages/nextclaw-core/src/agent/context.ts`、`packages/nextclaw-core/src/agent/tools/sessions.ts`、`packages/nextclaw-core/src/config/schema.help.ts`、`packages/nextclaw-core/src/config/schema.labels.ts`、`packages/nextclaw-core/src/config/schema.ts`、`packages/nextclaw/src/cli/shared/services/gateway/service-startup-support.ts`；这些文件不属于本次上下文圆环修复范围。
- 发送前预检重构的维护性验证：
  - `pnpm lint:new-code:governance` 通过。
  - `pnpm lint:maintainability:guard` 中维护性检查无 error，但命令最终被 `check:governance-backlog-ratchet` 阻断：当前工作区 doc 文件命名历史债务计数为 `13`，超过 baseline `11`。该阻断不来自本次新增的 `context-compaction-preflight.service.ts`、`context-compaction-projection.utils.ts`、`create-ui-ncp-agent-context-compaction.test.ts` 或相关 UI 文件。

## 发布/部署方式

- 本次能力随常规 `nextclaw` / `@nextclaw/ui` 构建产物发布，无需额外部署步骤。
- 若进入发版批次，需要同步发布包含本次 NCP builder 与聊天前端改动的相关包。

## 用户/产品视角的验收步骤

1. 进入一个足够长的聊天会话，持续发送消息，直到上下文占用接近预算。
2. 触发下一轮请求后，观察消息流中是否出现“正在压缩较早上下文”的轻量分割线。
3. 等待该轮构建完成，确认分割线文案变为“较早上下文已自动压缩”。
4. 将鼠标悬停在分割线上，确认可看到覆盖消息数、压缩前估算 token 和压缩后估算 token。
5. 继续查看消息历史，确认旧消息仍然保留在历史列表中，没有被删除或直接替换掉。
6. 再发送一轮消息，确认模型仍能延续长会话语义，而不是突然失去前文。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。
  - 这次没有引入第二套会话存储模型，也没有引入新的 orchestrator；后端主逻辑继续收敛在一个 `ContextCompactionService` owner 内。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。
  - 没有把压缩条目做成额外顶部状态条或第二套渲染面板，而是直接复用现有消息流容器。
  - 没有把压缩结果伪装成普通 `system message`，避免后续协议分支继续膨胀。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：
  - 本次是新增用户能力，非测试代码净增为正，属于必要增长。
  - 本轮发送前预检重构删除了 builder 内的压缩触发和 session 写入分支，`nextclaw-ncp-context-builder.ts` 减少约 67 行；新增代码主要集中在一个 preflight owner、一个纯 projection 工具和对应定向测试。没有并行引入第二套压缩路径。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：
  - 是。触发时机归 `ContextCompactionPreflightService`，压缩策略归 `ContextCompactionService`，builder 只负责模型输入投影，timeline message 与 context window metadata 各自落在小型 utils 中，前端只负责读取与渲染。
  - 这符合“一个 owner class 就够了”的边界，没有因为小功能引入额外 pipeline 或多层编排器。
- 目录结构与文件组织是否满足当前项目治理要求：
  - 满足。新增文件名与角色后缀已按仓库治理规则收敛，`pnpm lint:new-code:governance` 通过。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：
  - 已基于独立复核填写。

可维护性复核结论：通过

本次顺手减债：是

长期目标对齐 / 可维护性推进：
- 这次改动顺着“让 NextClaw 成为连续、统一、可长期依赖的个人操作层”往前推进了一小步。长会话不再只能依赖隐式裁剪，而是开始具备对自身上下文管理动作的可感知能力。
- 在可维护性上，这次也避免了把连续性治理做成隐藏 fallback，而是显式沉淀成可观察、可定位、可扩展的时间线条目。

代码增减报告：
- 新增：705 行
- 删除：184 行
- 净增：521 行

非测试代码增减报告：
- 新增：382 行
- 删除：154 行
- 净增：228 行

可维护性总结：
- 这是新增用户能力，所以非测试代码净增是合理的；但增长已经压缩到“一个 owner class + 少量 utils + 一处消息流渲染扩展”的范围内。
  - 这次最关键的正向动作是职责收敛与必要解耦：builder 不再背负压缩触发和 session 写入，发送前预检成为明确触发 owner，也没有让前端去反推压缩边界；checkpoint 的消息流位置就是唯一边界。
- 剩余观察点是后续若升级到后台异步摘要，需要继续守住这套边界，不要再引入第二套独立状态流。

## NPM 包发布记录

- 本次是否需要发包：待统一发布。
- 需要发布哪些包：
  - `nextclaw`
  - `@nextclaw/ui`
- 每个包当前是否已经发布：
  - `nextclaw`：未发布，待统一发布
  - `@nextclaw/ui`：未发布，待统一发布
- 未发布原因：
  - 当前改动已完成实现与定向验证，但尚未进入统一 release 批次。
- 后续触发条件：
  - 随下一次包含聊天/NCP 相关改动的统一版本一并发布。
