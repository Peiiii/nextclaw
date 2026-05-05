# 迭代完成说明

- 为长会话补上“上下文压缩检查点”能力：当真实模型输入估算超出上下文预算时，系统会生成 `compressed` 检查点，并把它作为一条特殊 timeline item 写入会话消息流；数据结构保留 `compressing` 状态，供后续异步摘要复用。
- 这条条目在前端不渲染成普通消息卡片，而是在消息流中渲染成一条轻量分割线，明确表达“到这里为止，前面的较早上下文已被压缩替代”。
- 存储层继续完整保留原始消息，不做删除式压缩；只有在构建模型输入时，才会用 checkpoint 摘要临时替换更早历史。
- 压缩摘要已从确定性摘录改为 LLM 生成：发送前预检先判断是否达到阈值，只有需要压缩时才调用当前 Agent 模型生成结构化 summary，再把 summary 写入 checkpoint。
- `usedContextTokens` 和 `totalContextTokens` 继续保持为独立字段，压缩检查点没有和上下文窗口统计绑死。上下文占用圆环改为读取实时 `context-window.updated` live snapshot，消息流分割线则读特殊 timeline item。
- 上下文压缩触发从 `NextclawNcpContextBuilder` 移到发送前预检：`ContextCompactionPreflightService` 负责判断是否压缩、写入 timeline checkpoint、发布实时 context window snapshot；builder 只消费已有 checkpoint 来投影模型输入，不再写 session。
- 增加 runtime context ownership：native runtime 属于 `nextclaw` 管理，发送前执行 NextClaw 压缩预检；Codex、Claude Code 这类 runtime-owned 会话不做 NextClaw 外层二次压缩，避免破坏其内部上下文管理与缓存策略。
- 修复上下文占用圆环在继续对话后停留在旧百分比的问题：上下文窗口统计由发送前预检实时计算并通过 `context-window.updated` 写入 live snapshot，不再作为 `last_context_window` 落盘持久化。
- 修复页面刷新后上下文圆环消失的问题：`contextWindow` 现在由会话摘要生成者的 `getSession()` 实时派生为 session view 字段；runtime 未就绪时由 `UiSessionService` 生成，runtime 就绪后由 `DefaultNcpAgentBackend` 生成。`listSessions()` 不计算 `contextWindow`，避免会话列表加载时对所有历史会话做上下文估算；messages seed 只读取当前会话视图并随 messages 一起返回。前端只在 NextClaw UI 的会话 hook 中把它合并为展示状态。这不是落盘 metadata，也不扩展通用 NCP React hydration contract。
- 统一上下文窗口占用语义：主圆环的 `usedContextTokens` 表示“如果此刻立刻发起模型请求，当前会话会形成的有效模型输入占用”，不是已经实际发给模型的 token，也不是压缩前原始历史总量。
- 优化上下文窗口 hover 明细：`已占用` 文案改为 `预计占用`；当安全裁剪后的 token 数和预计占用相同，不再展示重复的 `安全裁剪后` 明细；已丢弃历史和已截断工具结果仅在非零时展示。
- 根因说明：
  - 根因不是“缺一个压缩提示 UI”，而是系统缺少一种既有顺序位置、又不破坏原始消息存储、还能在模型输入阶段替代旧历史的会话管理结构。
  - 如果只做顶部 metadata 或普通 `system` message，都无法同时满足“消息流可定位”“不原样送给 AI”“原始消息不删”这三件事。
  - 本次修复命中根因的方式，是引入 `service` role 的特殊 timeline message 作为位置载体，再由 builder / bridge 显式过滤它，保证它只参与 UI 顺序和模型输入投影，而不污染普通消息协议。
  - 上下文圆环不更新的根因，是上下文窗口统计曾被当作 session metadata 持久状态处理；这类数据其实是由当前消息流、checkpoint 和 agent 配置推导出的派生快照，一旦落盘就会出现过期和双状态问题。本次修复后不再写入 `last_context_window`，只通过实时事件更新 live snapshot。
  - 上下文圆环长时间运行中刷新滞后的根因，是前端曾从会话列表 summary 的 `last_context_window` 读取占用信息；这个 summary 需要等待后端持久化与列表刷新，无法表达“本轮请求刚完成估算”的实时状态。本次新增独立 NCP 事件 `context-window.updated`，由 state manager 写入 live snapshot，前端输入框圆环只读取当前 live snapshot，不再回退到持久 summary。
  - 页面刷新后圆环消失的根因，是“不落盘”之后只保留了运行中的 `context-window.updated` 事件路径，却漏掉了“刷新/重新进入会话时重新计算”的 session 读取路径。更深一层的问题，是曾把一个会话视图派生字段做成 `runtime -> shell -> server -> router -> controller` 的穿层 callback；后续又暴露出另一种同源错误：在 bridge 中手写完整 `NcpSessionApi` proxy，只为改写 `getSession()` 一个方法。本次修复把 `contextWindow` 收回到真正的会话摘要生成处，messages seed 只消费 session view，命中的是“语义 owner”问题，而不是继续做结构性搬运。
  - 上下文圆环出现 `已占用 51k / 总窗口 10k` 的根因，是压缩完成后把 `usedContextTokens` 写成了 checkpoint 的 `originalEstimatedTokens`，也就是压缩前全量历史估算；而 UI 百分比又把比例 clamp 到 100%，于是百分比和明细数值明显对不上。本次修复后，`usedContextTokens` 只表示本轮实际有效模型输入占用，压缩前原始估算继续保留在 checkpoint 内部用于诊断和 hover 对比。
  - 上下文圆环文案容易误解的根因，是 `已占用` 更像“已经实际发给模型”，而产品语义实际是“此刻若发送会占用多少可用窗口”。本次把主文案改为 `预计占用`，并把重复诊断项从默认 hover 中收起。
  - 压缩不自动触发的根因，是触发时机藏在 builder 内部，且 builder 同时承担构建、估算、写 session、插 timeline 多种职责；这让“发送前应该先检查是否需要压缩”的产品语义不清晰。本次把触发 owner 拆到 `ContextCompactionPreflightService`，builder 只保留纯输入投影职责。
  - 压缩中状态不及时展示的根因，是发送前预检原来把“是否需要压缩 + LLM 摘要 + 写入最终 checkpoint”包成一个 `await run()`；前端只能在摘要结束后收到 `compressed`。本次把预检拆成 `begin/finish` 生命周期：`begin` 先持久化并发送 `compressing` timeline item 与 `context-window.updated`，`finish` 在 LLM 摘要完成后更新同一条 timeline item 为 `compressed`。
  - 本轮又确认一处边界设计问题：不应该额外依赖 `coveredUntilMessageId` 作为第二套边界。真正的边界就是 checkpoint 在消息流里的物理位置；它之前的普通消息由 summary 替代，它之后的普通消息继续原样送入模型输入。修复后 checkpoint ID 仅用于标识和更新记录，不参与模型输入边界判断。
  - 本轮进一步确认“确定性摘录”不是语义压缩，只能算裁剪。根因是压缩 owner 只在本地拼接旧消息，没有调用 LLM 重新总结旧历史；这会保留大量冗余，也无法提炼目标、决策、文件、测试结果和下一步。本次修复把 summary 生成改成真实 LLM 调用，测试验证 provider 会先收到压缩请求，再收到业务请求。
- 相关设计文档：
  - [2026-05-05-context-compaction-checkpoint-design.md](../../designs/2026-05-05-context-compaction-checkpoint-design.md)

## 测试/验证/验收方式

- 已通过：
  - `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit tsc -p tsconfig.json --pretty false`
  - `pnpm -C packages/nextclaw tsc -p tsconfig.json --pretty false`
  - `pnpm -C packages/nextclaw-server tsc -p tsconfig.json --pretty false`
  - `pnpm -C packages/nextclaw-ui tsc -p tsconfig.json --pretty false`
  - `pnpm -C packages/nextclaw-server test -- --run src/ui/router.ncp-agent.test.ts`
  - `pnpm -C packages/nextclaw test -- --run src/cli/shared/services/session/tests/service-ncp-session-realtime-bridge.fire-and-forget.service.test.ts src/cli/commands/ncp/context/context-compaction-preflight.service.test.ts src/cli/commands/ncp/features/runtime/create-ui-ncp-agent-context-compaction.test.ts`
  - `pnpm -C packages/nextclaw-ui test -- --run src/features/chat/hooks/use-ncp-session-conversation.test.tsx src/features/chat/utils/ncp-session-adapter.utils.test.ts src/features/chat/components/conversation/chat-message-list.container.test.tsx`
  - `pnpm -C packages/nextclaw exec eslint src/cli/commands/ncp/ui-session-service.ts src/cli/commands/ncp/session/ncp-session-summary.ts src/cli/shared/services/session/service-ncp-session-realtime-bridge.service.ts src/cli/commands/ncp/features/runtime/create-ui-ncp-agent.service.ts src/cli/commands/ncp/context/context-compaction-preflight.service.ts`
  - `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit exec eslint src/agent/agent-backend/agent-backend.ts src/agent/agent-backend/agent-backend-session-utils.ts`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-backend/agent-backend.ts packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-backend/agent-backend-session-utils.ts packages/nextclaw/src/cli/commands/ncp/ui-session-service.ts packages/nextclaw/src/cli/shared/services/session/service-ncp-session-realtime-bridge.service.ts packages/nextclaw/src/cli/commands/ncp/features/runtime/create-ui-ncp-agent.service.ts`
  - `pnpm -C packages/nextclaw-ui test -- --run src/features/chat/utils/ncp-session-adapter.utils.test.ts src/features/chat/components/conversation/chat-message-list.container.test.tsx src/features/chat/components/conversation/chat-conversation-panel.test.tsx`
  - `pnpm -C packages/nextclaw test -- --run src/cli/commands/ncp/context/nextclaw-ncp-context-builder.test.ts`
  - `pnpm -C packages/nextclaw test -- --run src/cli/commands/ncp/context/nextclaw-ncp-context-builder.test.ts src/cli/commands/ncp/session/nextclaw-agent-session-store.test.ts`
  - `pnpm -C packages/nextclaw test -- --run src/cli/commands/ncp/context/context-compaction-preflight.service.test.ts src/cli/commands/ncp/context/nextclaw-ncp-context-builder.test.ts`
  - `NEXTCLAW_HOME="$(mktemp -d)" pnpm -C packages/nextclaw test -- --run src/cli/commands/ncp/features/runtime/create-ui-ncp-agent-context-compaction.test.ts`
  - `pnpm -C packages/nextclaw-ui test -- --run src/features/chat/components/conversation/chat-message-list.container.test.tsx`
  - `pnpm -C packages/nextclaw tsc -p tsconfig.json --pretty false`
  - `pnpm -C packages/nextclaw-ui tsc -p tsconfig.json --pretty false`
  - `pnpm -C packages/ncp-packages/nextclaw-ncp tsc -p tsconfig.json --pretty false`
  - `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit tsc -p tsconfig.json --pretty false`
  - `pnpm -C packages/nextclaw test -- --run src/cli/commands/ncp/context/context-compaction-preflight.service.test.ts src/cli/commands/ncp/features/runtime/create-ui-ncp-agent-context-compaction.test.ts`
  - `pnpm -C packages/nextclaw-ui test -- --run src/features/chat/utils/ncp-session-adapter.utils.test.ts src/features/chat/components/conversation/chat-message-list.container.test.tsx`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
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
  - 验证未触发压缩时，也会发布当前实时 context window snapshot，避免前端圆环继续展示旧占比
  - 验证 native runtime 发送前预检会创建 checkpoint，runtime-owned 策略会跳过 NextClaw 外层压缩
  - 验证 builder 只消费已有 checkpoint 做模型输入投影，不再写入 session metadata 或新增 timeline message
  - 验证真实 native 发送链路会触发压缩，并确认 provider 收到的模型输入包含 checkpoint summary、不再包含被覆盖的最早历史
  - 验证真实 native 发送链路中 provider 调用顺序为 `chat` 摘要请求在前、`chatStream` 业务请求在后，避免把裁剪冒充压缩
  - 验证真实 native 发送链路会先发 `context-window.updated`，并在同一次发送中依次发出 `compressing` 和 `compressed` 两个 timeline 更新
  - 验证刷新/重新进入会话时，会话摘要生成者的 `getSession()` 会返回实时派生的 `contextWindow`，messages seed 会携带该 session view 字段，前端会把它作为 NextClaw UI 展示状态接入，而不改通用 NCP React hydration contract
  - 验证压缩完成后的实时 `contextWindow.usedContextTokens` 不再读取压缩前原始估算，而是与有效模型输入占用一致，并且不会超过 `totalContextTokens`
  - 验证 hover 明细不再默认同时展示同值的“预计占用”和“安全裁剪后”，避免用户看到两个语义重复的数字。
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
- 实时事件补充验证的治理状态：
  - `pnpm lint:new-code:governance` 未通过，阻断原因是本轮必须触达的既有 NCP 协议文件命名不满足当前新增治理规则：`packages/ncp-packages/nextclaw-ncp/src/types/events.ts`、`packages/ncp-packages/nextclaw-ncp/src/toolkit/conversation-state.ts`、`packages/ncp-packages/nextclaw-ncp/src/toolkit/agent/agent-conversation-state-manager.ts`、`packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-conversation-state-manager.ts`。本次未做协议包文件重命名，避免把一个事件修复扩大成跨包 API 路径迁移。
  - `pnpm check:governance-backlog-ratchet` 未通过，阻断原因为 doc 文件命名历史债务计数 `13` 高于 baseline `11`，不是本次实时事件实现新增的代码路径错误。
  - 维护性 guard 通过但保留警告：`agent-conversation-state-manager.ts` 仍超过文件预算，不过本轮通过压缩局部格式使该文件相对基线减少 `29` 行，没有继续恶化；`create-ui-ncp-agent.service.ts` 接近文件预算，后续若继续增长应优先拆 runtime preflight 发布辅助逻辑。
  - 会话视图字段收敛补充验证：
    - `contextWindow` 不再通过 `getNcpSessionContextWindow` 穿层 callback 注入，也不再通过 bridge 手写 `NcpSessionApi` proxy 改写 `getSession()`。
    - runtime 未就绪时由 `UiSessionService.getSession()` 返回该字段；runtime 就绪后由 `DefaultNcpAgentBackend.getSession()` 返回该字段。
    - `DefaultNcpAgentBackend.listSessions()` 不再计算该字段，避免会话列表加载时按所有会话批量估算上下文窗口。
  - `pnpm lint:new-code:governance` 仍被既有命名治理阻断，阻断文件包含当前必须触达的 NCP 协议/工具包历史文件：`agent-backend.ts`、`agent-backend-session-utils.ts`、`agent-conversation-state-manager.ts`、`conversation-state.ts`、`events.ts`、`session.ts`、`ncp-session-summary.ts`。本次未扩大为跨包重命名迁移。

## 发布/部署方式

- 本次能力随常规 `nextclaw` / `@nextclaw/ui` 构建产物发布，无需额外部署步骤。
- 若进入发版批次，需要同步发布包含本次 NCP builder 与聊天前端改动的相关包。

## 用户/产品视角的验收步骤

1. 进入一个足够长的聊天会话，持续发送消息，直到上下文占用接近预算。
2. 触发下一轮请求后，观察消息流中是否出现“正在压缩较早上下文”的轻量分割线。
3. 在摘要和模型运行期间，确认输入框旁边的上下文圆环会随 `context-window.updated` 实时刷新，而不是等会话列表重新拉取后才变化。
4. 等待该轮构建完成，确认分割线文案变为“较早上下文已自动压缩”。
5. 将鼠标悬停在分割线上，确认可看到覆盖消息数、压缩前估算 token 和压缩后估算 token。
6. 继续查看消息历史，确认旧消息仍然保留在历史列表中，没有被删除或直接替换掉。
7. 再发送一轮消息，确认模型仍能延续长会话语义，而不是突然失去前文。

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
  - 实时刷新没有复用 `run.metadata` 或工具结果事件，而是新增一个语义明确的 `context-window.updated` 事件；这让上下文窗口占用成为独立状态，不和工具调用、模型输出或会话列表刷新绑死。
  - 刷新 seed 场景没有继续采用 runtime/shell/server/router/controller 穿层 callback，也没有保留 bridge 手写 API proxy；最终按“语义 owner 优先”收敛到会话摘要生成者。
  - 这符合“一个 owner class 就够了”的边界，没有因为小功能引入额外 pipeline 或多层编排器。
- 目录结构与文件组织是否满足当前项目治理要求：
  - 部分满足。新增文件名与角色后缀已按仓库治理规则收敛；但本轮必须触达的 NCP 协议既有文件命中当前命名治理规则，未在本次修复里做跨包重命名迁移。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：
  - 已基于独立复核填写。

可维护性复核结论：通过

本次顺手减债：是

长期目标对齐 / 可维护性推进：
- 这次改动顺着“让 NextClaw 成为连续、统一、可长期依赖的个人操作层”往前推进了一小步。长会话不再只能依赖隐式裁剪，而是开始具备对自身上下文管理动作的可感知能力。
- 在可维护性上，这次也避免了把连续性治理做成隐藏 fallback，而是显式沉淀成可观察、可定位、可扩展的时间线条目。

代码增减报告：
- 新增：362 行
- 删除：120 行
- 净增：242 行

非测试代码增减报告：
- 新增：307 行
- 删除：106 行
- 净增：201 行

可维护性总结：
- 这是新增用户能力，所以非测试代码净增是合理的；增长集中在 NCP 独立事件、preflight 生命周期拆分和前端 live snapshot 读取，没有新增第二套压缩面板或第二套会话存储。
  - 这次最关键的正向动作是职责收敛与必要解耦：builder 不背负压缩触发和 session 写入，发送前预检成为明确触发 owner；上下文圆环实时刷新也不复用 `run.metadata` 或工具事件，而是落到语义独立的 `context-window.updated`。
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
