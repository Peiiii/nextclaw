# v0.19.24 Mobile Draft Route Fix

## 迭代完成说明

- 根因：`createSession()` 只建立未物化 draft 并导航到 `/chat`。桌面 split 布局下 `/chat` 右侧就是 draft 详情，所以问题不明显；窄屏/mobile shell 下 `/chat` 是会话列表页，导致点击新建后仍停在列表。
- 确认方式：检查 `ChatSessionListManager.createSession()`、`ChatMobileShell` 的 `/chat` / `/chat/:sessionId` 分流，以及新会话物化后的 route replace 逻辑。
- 修复：新增 `/chat/draft` 作为未物化 draft 的显式详情路由；`createSession()` 统一导航到该路由，真实 session id 出现后继续 replace 到正式会话路由。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui test -- src/features/chat/managers/chat-session-list.manager.test.ts src/features/chat/components/layout/chat-sidebar.test.tsx src/features/chat/components/conversation/chat-conversation-panel.test.tsx src/features/chat/utils/chat-session-route.utils.test.ts`
- `pnpm --filter @nextclaw/ui exec eslint src/features/chat/managers/chat-session-list.manager.ts src/features/chat/managers/chat-ui.manager.ts src/features/chat/components/layout/chat-sidebar.tsx src/features/chat/components/conversation/chat-conversation-panel.tsx src/features/chat/utils/chat-session-route.utils.ts src/features/chat/managers/chat-session-list.manager.test.ts src/features/chat/components/layout/chat-sidebar.test.tsx src/features/chat/components/conversation/chat-conversation-panel.test.tsx src/features/chat/utils/chat-session-route.utils.test.ts`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
- Playwright 窄宽冒烟：`420x700` 下点击移动端 New Task，确认路径进入 `/chat/draft`，列表底部导航隐藏，draft 欢迎页与 `Message NextClaw...` 输入框出现。
- 已知无关阻塞：`pnpm --filter @nextclaw/ui lint` 仍被既有无关错误阻塞，包括未使用 import、历史 `import()` type annotation 与既有 React refs 规则问题；本次触达文件 targeted ESLint 已通过。

## 发布/部署方式

- 未执行发布或部署。
- 本次为 UI bugfix，需随下一次 UI / desktop 版本发布进入用户可用版本。

## 用户/产品视角的验收步骤

- 在任意窄屏/mobile UI 下进入聊天列表。
- 点击新建会话按钮，选择任意 session type。
- 应进入新会话 draft 详情页，而不是停留在列表页。
- 发送第一条消息后，地址应从 `/chat/draft` 自动替换为真实会话地址。

## 可维护性总结汇总

- 已使用 `post-edit-maintainability-guard` 与主观复核。
- 非测试代码净减 `3` 行；通过删除 mobile 组件里的重复 `goToChatRoot()` 补丁式跳转、移除未使用参数，并把 draft 详情语义收敛到 route/utils 与 `ChatSessionListManager`。
- owner 边界更清晰：新建 draft 的路由跳转由 session list owner 统一负责，mobile sidebar / conversation welcome 不再各自补导航。

## NPM 包发布记录

不涉及 NPM 包发布。
