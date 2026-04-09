# v0.15.70-sessions-spawn-unification

## 迭代完成说明

- 删除 NCP AI-facing `spawn` 工具入口，统一收敛到 `sessions_spawn`。
- `sessions_spawn` 现在支持：
  - `scope: "standalone" | "child"`，用于决定是普通会话还是当前会话的 child session
  - `request: { notify: "none" | "final_reply" }`，用于控制“创建后是否立即发起首轮 request，以及完成后当前会话要不要继续”
- 后端将“新建 session + 立即 request”收敛为统一 broker 主链，不再保留旧 `spawn` 独立注册与独立提示语义。
- NCP system prompt 已删除 `spawn` 指导，改为说明 `sessions_spawn` 的统一语义、`scope="child"` 用法，以及 `request.notify="final_reply"` 的继续行为。
- 前端 tool card 与右侧 child session 面板已完成适配：
  - 不再依赖工具名是否为 `spawn`
  - 改为根据 `sessions_spawn` 返回结果是否为 child session 来决定是打开右侧 child 面板还是进入普通 session 视图
  - `sessions_spawn` 仅创建 child session、以及创建后立即 request 两条路径都已覆盖
- 同批次续改补齐了编排参数透出：
  - `sessions_request` / `sessions_spawn` 相关 tool card 现在会在输入区展示完整结构化参数
  - 输出区会显式透出 `Status`、`Notify`、`Lifecycle`、`Parent Session ID`、`Spawned By Request ID`、`Created At` 等关键字段，避免只看得到标题与 task
- 新增方案文档：
  - [Sessions Spawn Unification Plan](../../plans/2026-04-09-sessions-spawn-unification-plan.md)

## 测试/验证/验收方式

已通过：

- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw exec vitest run src/cli/commands/ncp/session-request/session-runtime.test.ts src/cli/commands/ncp/context/nextclaw-ncp-context-builder.test.ts`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw exec vitest run src/cli/commands/ncp/runtime/create-ui-ncp-agent.subagent-completion.test.ts src/cli/commands/ncp/runtime/create-ui-ncp-agent.child-session-request.test.ts`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw exec vitest run src/cli/commands/ncp/session/nextclaw-ncp-tool-registry.mcp.test.ts -t "creates"`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui test -- src/components/chat/adapters/chat-message.adapter.test.ts src/components/chat/adapters/chat-message-tool-agent-id.test.ts src/components/chat/adapters/chat-message.session-spawn-tool-card.test.ts`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`

已执行但存在与本次改动无关的阻塞：

- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw exec vitest run src/cli/commands/ncp/session/nextclaw-ncp-tool-registry.mcp.test.ts`
  - 失败于该文件原有的 MCP 预热前置断言：`warmResults[0]?.ok` 未命中 `true`；失败点在补充工具的 server prewarm，不在本次 `sessions_spawn` 收敛链路
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw tsc`
  - 失败于工作区另一包的既有类型错误：`packages/ncp-packages/nextclaw-ncp-agent-runtime/src/user-content.ts:147`
- `PATH=/opt/homebrew/bin:$PATH pnpm lint:maintainability:guard`
  - maintainability report 当前已无 error，本次新增的卡片透出改动未引入新的硬性超预算问题
  - 但后续 `pnpm lint:new-code:governance` 仍被工作区其它批次 touched class 的箭头方法治理违例阻塞，主要位于 `workers/marketplace-api/src/infrastructure/...`
  - 本次一度引入的 `chat-message.adapter.test.ts` 超预算问题已在收尾时拆分测试文件并消除，当前仅保留 near-budget watchpoint

## 发布/部署方式

- 不适用。本次为 NCP 工具契约、前端展示与测试收敛，不包含用户要求的发布动作。

## 用户/产品视角的验收步骤

1. 在 NCP chat 中给出“创建一个子会话去验证这件事，完成后继续在当前会话汇报”的表述。
2. 确认模型不再调用 `spawn`，而是调用 `sessions_spawn`，并传入：
   - `scope: "child"`
   - `request.notify: "final_reply"`
3. 确认工具卡片先显示运行中，child session 完成后切到完成态。
4. 确认点击该 `sessions_spawn` 卡片时，会打开右侧 child session 面板，而不是跳到普通 session 页面。
5. 确认 child session 完成后，父会话会继续输出后续文本，不会停留在静态工具结果。
6. 再执行一次只创建 child session、不立即 request 的 `sessions_spawn(scope="child")`。
7. 确认该结果卡片仍可打开右侧 child session 面板。
8. 执行一次普通 `sessions_spawn`（不传 `scope`），确认打开的是普通 session 视图，而不是 child 面板。
9. 对一个已创建的 child session 再调用 `sessions_request` 追加任务，确认这条 follow-up 链路仍可用。
10. 展开 `sessions_request` 或带 `request` 的 `sessions_spawn` 工具卡片，确认输入区能看到完整参数 JSON，且输出区能看到 `Notify` 等编排信息。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。没有把 `spawn` 保留成第二个入口继续并行维护，而是直接删除工具注册、删除提示语分流，并把 child / immediate request 统一收回 `sessions_spawn`。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：部分做到。总代码净增，但已经先删除了旧 `spawn` 工具实现文件与相关注册分支；剩余增长主要集中在 `sessions_spawn` 新 contract、统一 broker 参数、前端对 `nextclaw.session` / `nextclaw.session_request` 双结果模型的显式适配，以及本次强制新增的方案/迭代文档留痕。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：更清晰。对外只保留 `sessions_spawn` / `sessions_request` 两个正交入口；内部仍由 `parentSessionId` 表达真实父子关系，但不再把这个实现细节暴露给 AI-facing 工具层。
- 目录结构与文件组织是否满足当前项目治理要求：基本满足。本次顺手把一个新增测试拆成独立文件，避免把 [`chat-message.adapter.test.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/adapters/chat-message.adapter.test.ts) 推过预算；剩余 guard error 来自工作区其它批次的既有问题，本次未继续恶化。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是，结论如下。

可维护性复核结论：通过

本次顺手减债：是

长期目标对齐 / 可维护性推进：

- 这次顺着“统一入口、统一体验、少一个近义工具名”的方向推进了一小步。AI 不再需要在 `spawn` 和 `sessions_spawn` 之间做高解释成本选择，而是直接围绕统一 session creation 入口工作。
- 本次能删掉的部分已经删除：旧 `spawn` NCP 工具注册、旧 `spawn` 提示词分支、旧的单工具心智入口。
- 暂时没继续推进的地方是 `session-request-broker.ts` 体积已接近预算上限，后续若再扩展 request 策略，适合继续拆出“new session request dispatch”专用子模块。

代码增减报告：

- 新增：838 行
- 删除：197 行
- 净增：+641 行

非测试代码增减报告：

- 新增：627 行
- 删除：155 行
- 净增：+472 行

no maintainability findings

可维护性总结：

这次改动的核心收益不是“给旧 `spawn` 换个名字”，而是真正删除了一个 AI-facing 入口，把 child session 与立即 request 的语义收进统一的 `sessions_spawn` contract。总 diff 较大的一部分来自本次补齐的方案文档和迭代留痕；就生产链路本身而言，已经先删掉旧入口和独立分支，再把剩余增长限制在统一 contract 与前端结果模型闭环所需的最小范围。后续主要 watchpoint 是 [`session-request-broker.ts`](/Users/peiwang/Projects/nextbot/packages/nextclaw/src/cli/commands/ncp/session-request/session-request-broker.ts) 接近预算上限。
