# v0.20.78 Chat Welcome Entry Optimization

## 迭代完成说明

阶段完成。本迭代目标是把新会话入口从底部输入栏升级为居中的意图入口，同时把 welcome 相关逻辑收敛为 chat 内部子 feature，并完成至少 30 项代码可维护性、清晰度、解耦可插拔和克制 UI 优化。

当前已完成的第一批方向：

- welcome UI 已迁入 `features/chat/features/welcome/` 子 feature。
- welcome 显示规则已从 conversation panel 抽到 welcome util。
- 新会话 welcome 使用嵌入式 input surface，复用原输入链路，不复制 composer。
- 新会话 project 选择使用已有 session project dialog，并默认使用配置里的 workspace。
- welcome 左下方已支持 project、agent、session type 三类上下文选择。
- project 选择升级为历史项目 popover，列表区可滚动，底部固定“打开文件夹”操作。
- agent 选择入口展示头像与名称。
- welcome 引导卡片点击后填入示例 prompt，并把光标定位到 prompt 末尾。
- 模型选择器支持搜索、收藏/取消收藏，收藏模型置顶展示。
- 新增 kernel 通用偏好 KV manager/store，并通过 server preferences route 与 UI API 持久化模型收藏。
- chat 输入相关浮层统一增加可用高度约束和边界 padding，覆盖模型搜索、普通选择、技能选择、slash 菜单、welcome 项目、Agent 和会话类型面板。
- 相关规范已补充到 `collapsible-feature-root-architecture` skill。

详细进展见 [work/working-notes.md](work/working-notes.md) 与 [work/goal-progress.md](work/goal-progress.md)。

## 测试/验证/验收方式

已执行：

- `pnpm --filter @nextclaw/ui test -- src/features/chat/features/welcome/components/__tests__/chat-welcome.test.tsx src/features/chat/features/welcome/components/__tests__/chat-conversation-welcome.test.tsx src/features/chat/features/welcome/utils/__tests__/chat-welcome-draft.utils.test.ts src/features/chat/features/welcome/utils/__tests__/chat-welcome-project-options.utils.test.ts src/features/chat/features/welcome/utils/__tests__/chat-welcome-visibility.utils.test.ts src/features/chat/components/conversation/__tests__/chat-conversation-panel.test.tsx src/features/chat/managers/__tests__/chat-input.manager.test.ts src/features/chat/features/input/utils/__tests__/ncp-chat-input-availability.utils.test.ts`
- `pnpm --filter @nextclaw/agent-chat-ui test -- src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/agent-chat-ui tsc`
- `pnpm --filter @nextclaw/ui lint`
- `pnpm --filter @nextclaw/agent-chat-ui lint`
- `pnpm --filter @nextclaw/ui build`
- `pnpm --filter @nextclaw/agent-chat-ui build`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `pnpm check:generated-clean`
- `pnpm --filter @nextclaw/ui test -- src/features/chat/components/conversation/__tests__/chat-conversation-panel.test.tsx src/features/chat/features/welcome/components/__tests__/chat-conversation-welcome.test.tsx`
- `pnpm --filter @nextclaw/ui test -- src/features/chat/features/welcome/components/__tests__/chat-welcome.test.tsx src/features/chat/features/welcome/components/__tests__/chat-conversation-welcome.test.tsx src/features/chat/features/welcome/utils/__tests__/chat-welcome-selection.utils.test.ts src/features/chat/managers/__tests__/chat-input.manager.test.ts src/features/chat/features/input/utils/__tests__/chat-input-bar.utils.test.ts`
- `pnpm --filter @nextclaw/agent-chat-ui test -- src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx src/components/chat/ui/chat-input-bar/chat-input-bar-toolbar.test.tsx src/components/chat/ui/chat-input-bar/chat-slash-menu.test.tsx`
- `pnpm --filter @nextclaw/kernel test -- src/managers/__tests__/preference.manager.test.ts`
- `pnpm --filter @nextclaw/server test -- src/features/preferences/controllers/preferences.controller.test.ts`
- `pnpm --filter @nextclaw/kernel tsc`
- `pnpm --filter @nextclaw/server tsc`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/agent-chat-ui tsc`
- `pnpm --filter @nextclaw/kernel lint`
- `pnpm --filter @nextclaw/server lint`
- `pnpm --filter @nextclaw/ui lint`
- `pnpm --filter @nextclaw/agent-chat-ui lint`
- `pnpm --filter @nextclaw/ui build`
- `pnpm --filter @nextclaw/agent-chat-ui build`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `pnpm check:generated-clean`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
- 本地 dev UI 冒烟：`http://127.0.0.1:5176/chat/draft`，在 `1200x560` 小高度视口验证 welcome 输入栏、模型搜索面板、技能面板、slash 菜单、project 面板、Agent 面板、session type 面板不贴边/不越界；最新 DOM 边界为 model `24-337`、skill `24-337`、slash `275-536`、project `200-395`、agent `114-402`、session type `178-395`；点击“智能对话”卡片后输入框填入 prompt，selection anchor/focus 都等于文本长度。

## 发布/部署方式

暂未发布。本轮是源码与 UI 体验改造，已添加 changeset，进入后续统一 NPM beta 发布时需要包含受影响包。

## 用户/产品视角的验收步骤

1. 打开新会话或空白 draft，会看到居中的欢迎页和输入框，而不是只在底部出现输入栏。
2. 欢迎页输入框下方可看到项目目录选择入口，默认指向 NextClaw workspace。
3. 选择项目后发送第一条消息，创建的新会话应绑定该 project root。
4. 点击 welcome 引导卡片，示例 prompt 应填入输入框，光标应位于文本末尾。
5. 打开模型选择器，可搜索模型；收藏模型后应置顶到收藏分组。
6. 在小高度视口打开模型、技能、slash、项目、Agent 和会话类型面板，面板不应贴到视口边界，也不应超出可见区域。
7. 已有会话、有消息、正在发送或 draft 发送失败后，不应错误重新打开欢迎页。

## 可维护性总结汇总

当前方向遵循“子 feature owner 收敛”和“复用输入主链路”：

- welcome 展示、业务容器、显示规则和测试已从父级 conversation/components 中迁出。
- conversation panel 只负责装配，不持有 welcome 业务规则。
- input bar 只新增 presentation surface，不承载 project 选择业务。
- `ChatInputManager` 继续是发送 projectRoot 的 owner，避免 UI 组件直传运行时细节。
- 模型收藏的持久化事实归 kernel `PreferenceManager`，UI 只通过 API/query 使用偏好，不用 localStorage 特例承载长期偏好。
- welcome 卡片只触发 prompt suggestion，发送/建会话仍走原输入主链路。
- 浮层高度修复收敛在基础输入/欢迎子 feature 面板上，使用 Radix 可用空间和设计上限，不写屏幕尺寸特判。
- `chat-conversation-panel.test.tsx` 继续瘦身，welcome create draft 等内部行为已迁到 welcome 容器测试覆盖。
- path-scoped maintainability guard 通过，已改 tracked 文件统计为 total `+114/-239/net -125`，非测试 `+59/-158/net -99`。
- guard 剩余 3 个 warning 都是既有预算风险或持续治理项：agent-chat-ui input-bar 目录文件数、conversation panel 测试接近预算、chat-input-bar container 接近预算。
- 后续批次 maintainability guard 通过，剩余 warning 为既有目录预算例外或 `shared/lib/api/types.ts` 接近预算；preference endpoint helper 已放入 `shared/lib/api/preferences/` 子目录，未继续增加 API 根目录文件数。

## NPM 包发布记录

已添加 `.changeset/chat-welcome-context-entry.md` 与 `.changeset/chat-model-favorites-preferences.md`。当前触达 `@nextclaw/ui`、`@nextclaw/agent-chat-ui`、`@nextclaw/kernel`、`@nextclaw/server`，若进入发布批次，需要随统一 NPM beta 发布。
