# v0.26.72 默认聊天消息身份精简

## 迭代完成说明

- Main Agent 使用 Native runtime 时，平铺助手消息不再重复展示头像与名称；其他 Agent 或非 Native runtime 仍保留身份行，便于用户识别消息来源。
- 身份行只做视觉隐藏并保持稳定 DOM 结构，运行时条件变化不会重挂载消息正文、编辑器或其他状态型内容。
- 新会话发送第一条消息后，在 assistant draft 尚无可见内容时持续显示无头像的“Agent 正在思考...”；正文、推理或工具过程一开始就隐藏该文字状态，避免提前消失或贯穿整段回复。
- 新会话尚未 materialize 或正式 session 元数据尚未进入缓存时，消息容器沿用草稿期已选择的 Agent；默认 Main Agent 不会因为短暂缺少 session summary 而闪现头像。
- “已处理”保留文本、耗时和展开入口，移除没有独立操作含义的前置列表图标。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/agent-chat-ui exec vitest run src/components/chat/ui/chat-message-list/__tests__/chat-message-layout.test.tsx src/components/chat/ui/chat-message-list/__tests__/chat-message-process-collapse.test.tsx`：2 个测试文件、9 个测试通过；覆盖身份行隐藏、正文 DOM 连续性、空 draft 思考状态连续、可见回复开始后隐藏思考文字与处理摘要无前置图标。
- `pnpm --filter @nextclaw/ui exec vitest run src/features/chat/features/message/components/__tests__/chat-message-assistant-header.container.test.tsx`：5 个测试通过；覆盖 main + native 隐藏、其他 Agent + native 保留、main + Codex runtime 保留、materialize 前复用草稿 Agent，以及新会话第一条消息的空 assistant draft 继续处于等待输出状态。
- `pnpm --filter @nextclaw/ui exec vitest run src/features/chat/features/ncp/hooks/__tests__/use-hydrated-ncp-agent.test.tsx -t "starts the live stream when a draft manager already contains the materialized session"`：1 个 materialization 连续性测试通过，证明草稿会话绑定正式 session 时会复用已有 conversation state，排除 session 路由切换作为本轮首个错误 hop。
- `pnpm --filter @nextclaw/agent-chat-ui tsc` 与 `pnpm --filter @nextclaw/ui tsc`：通过。
- 定向 ESLint：本轮 4 个共享聊天 UI 文件与测试通过。
- `pnpm --filter @nextclaw/agent-chat-ui lint`：0 个错误；保留 1 个与本轮无关的既有测试文件长度警告。`pnpm --filter @nextclaw/ui lint`：0 个错误；保留 3 个与本轮无关的既有测试文件长度警告。
- 在 `http://127.0.0.1:5174` 的现有本地源码实例中打开真实 Native 会话验收：5 条助手身份行均同时满足 `hidden=true` 与计算样式 `display: none`；5 个“已处理”摘要均无前置图标，耗时和展开入口保留。没有代发新的真实 Agent 消息，以免额外触发运行和资源消耗；新会话空 draft 到可见回复的状态交接由容器与共享组件的连续失败样本测试验收。
- maintainability guard 检查 6 个源码与测试文件：0 个错误、3 个既有预算警告；总代码新增 284 行、删除 16 行、净增 268 行，排除测试后新增 47 行、删除 13 行、净增 34 行。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、`pnpm check:generated-clean` 与 `git diff --check`：全部通过。
- `pnpm release:summary -- --json`：识别 `default-chat-message-header` patch changeset，素材错误为 0。

## 发布/部署方式

- 本轮改动尚未提交、推送、发布或部署。
- 不涉及数据库迁移、服务端部署、宿主重启或 runtime 更新；本地源码实例通过 Vite 热更新完成界面验收。
- 后续随 `@nextclaw/agent-chat-ui` 与 `@nextclaw/ui` 的 patch 版本统一发布进入产品。

## 用户/产品视角的验收步骤

1. 打开 Main Agent 的 Native 会话，确认已完成的助手回复直接展示内容，不再重复出现机器人头像与“助手”名称。
2. 在新会话发送第一条消息，确认真正回复前持续显示“Agent 正在思考...”且旁边没有头像；正文、推理或工具过程出现后，该文字状态立即消失。
3. 切换到其他 Agent 的 Native 会话，确认头像与 Agent 名称仍显示。
4. 切换 Main Agent 到 Codex 等非 Native runtime，确认身份行仍显示。
5. 查看带过程记录的回复，确认“已处理”前方没有列表图标，文本、耗时与展开/收起仍正常。

## 可维护性总结汇总

- 条件判断由掌握会话 `agentId` 与 `sessionType` 的宿主容器负责，共享消息列表只接收展示布尔值，没有反向依赖 NextClaw 业务语义。
- 复用已有 `typingLabel`、`ChatTypingIndicator` 与轻量流式圆点：真正回复前显示文字，出现可见内容后只保留原有轻量流式反馈；没有新增动画、状态源、React effect 或兼容分支。
- 身份行保留稳定节点并通过 `hidden` 属性与 `hidden` 样式共同隐藏：前者让 `space-y-*` 正确忽略该行，后者避免 `.flex` 覆盖浏览器默认隐藏规则。
- 三种宿主条件放入新的聚焦测试文件，没有继续增加已超过文件预算的历史容器测试；直接组件目录文件数没有增长。
- maintainability guard 结果为 0 个错误、3 个警告：消息目录为已有例外且文件数无增长；`chat-message.tsx` 从 475 行降至 472 行；容器从 453 行增至 466 行。
- 已按 `post-edit-maintainability-review` 复核：owner、数据流和 DOM 生命周期边界清晰，没有发现需要阻断交付的可维护性问题。生产代码净增 34 行用于身份条件、草稿 Agent fallback、等待态连续性与稳定隐藏结构，属于本次新增用户可见行为，不适用非功能改动净增不大于 0 的门槛。

## NPM 包发布记录

- `@nextclaw/agent-chat-ui`：需要 patch 发布，changeset 已添加，当前待后续统一发布。
- `@nextclaw/ui`：需要 patch 发布，changeset 已添加，当前待后续统一发布。
