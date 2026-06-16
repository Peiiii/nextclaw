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
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
- 本地 dev UI 冒烟：`http://127.0.0.1:5176/chat`，验证欢迎页居中、project 历史 popover、session type popover、agent 名称展示、项目选择后 popover 关闭。

## 发布/部署方式

暂未发布。本轮是源码与 UI 体验改造，完成后需要判断是否添加 `.changeset` 并进入后续统一 NPM beta 发布。

## 用户/产品视角的验收步骤

1. 打开新会话或空白 draft，会看到居中的欢迎页和输入框，而不是只在底部出现输入栏。
2. 欢迎页输入框下方可看到项目目录选择入口，默认指向 NextClaw workspace。
3. 选择项目后发送第一条消息，创建的新会话应绑定该 project root。
4. 已有会话、有消息、正在发送或 draft 发送失败后，不应错误重新打开欢迎页。

## 可维护性总结汇总

当前方向遵循“子 feature owner 收敛”和“复用输入主链路”：

- welcome 展示、业务容器、显示规则和测试已从父级 conversation/components 中迁出。
- conversation panel 只负责装配，不持有 welcome 业务规则。
- input bar 只新增 presentation surface，不承载 project 选择业务。
- `ChatInputManager` 继续是发送 projectRoot 的 owner，避免 UI 组件直传运行时细节。
- `chat-conversation-panel.test.tsx` 继续瘦身，welcome create draft 等内部行为已迁到 welcome 容器测试覆盖。
- path-scoped maintainability guard 通过，已改 tracked 文件统计为 total `+114/-239/net -125`，非测试 `+59/-158/net -99`。
- guard 剩余 3 个 warning 都是既有预算风险或持续治理项：agent-chat-ui input-bar 目录文件数、conversation panel 测试接近预算、chat-input-bar container 接近预算。

## NPM 包发布记录

已添加 `.changeset/chat-welcome-context-entry.md`。当前至少触达 `@nextclaw/ui` 和 `@nextclaw/agent-chat-ui`，若进入发布批次，需要随统一 NPM beta 发布。
