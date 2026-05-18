# v0.18.80 Chat Conversation MVP Cohesion

## 迭代完成说明

- 背景：`ChatConversationPanel` 同时承担布局、会话派生、子业务区数据装配和 presenter action 透传，形成宽 props 与 prop drilling，增加理解成本。
- 调整方式：将 parent banner、header、content、workspace panel 的业务取数和 action 连接收敛到各自最近的业务组件/container；顶层 conversation panel 只保留 provider resolved 判断、整体布局和区域挂载。
- Workspace panel 的选择、关闭、回父会话、工具 action 和文件预览改为直接使用 `presenter.chatThreadManager`，删除调用方传入的动作 props。
- 同步更新 `mvp-view-logic-decoupling` skill，沉淀“业务组件内聚取数/取动作，布局组件不做参数装配站”的规则。

## 测试/验证/验收方式

- `pnpm exec prettier --write packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-panel.tsx packages/nextclaw-ui/src/features/chat/components/chat-session-workspace-panel.tsx packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-panel.test.tsx`：通过。
- `pnpm --filter @nextclaw/ui tsc`：通过。
- `pnpm --filter @nextclaw/ui test -- src/features/chat/components/conversation/chat-conversation-panel.test.tsx src/features/chat/components/conversation/chat-conversation-header.test.tsx`：通过，2 个测试文件、21 个测试通过。
- `pnpm --filter @nextclaw/ui exec eslint src/features/chat/components/conversation/chat-conversation-panel.tsx src/features/chat/components/chat-session-workspace-panel.tsx src/features/chat/components/conversation/chat-conversation-panel.test.tsx`：通过。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-panel.tsx packages/nextclaw-ui/src/features/chat/components/chat-session-workspace-panel.tsx packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-panel.test.tsx`：通过；非测试代码净减 9 行，提示 `chat-conversation-panel.tsx` 接近文件预算。
- `pnpm --filter @nextclaw/ui lint`：未通过，阻塞来自既有无关 lint 债务；触达文件 targeted ESLint 已通过。

## 发布/部署方式

- 未发布。
- 未部署。
- 本次为前端源码重构与规则沉淀，等待后续统一发布批次。

## 用户/产品视角的验收步骤

- 打开 chat 会话页，确认 provider resolved 后仍正常显示父会话入口、会话 header、告警条、消息内容区和输入栏。
- 在移动端布局点击 header 返回按钮，确认仍触发回列表。
- 在欢迎态创建 draft session / 切换 draft agent，确认 session type 仍按 agent runtime 派生。
- 打开有 child session、workspace file 或 session cron job 的会话，确认 workspace panel 仍可显示对应 tab 与内容。

## 可维护性总结汇总

- 已使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 规则进行收尾判断。
- 代码增减报告：新增 290 行，删除 296 行，净减 6 行。
- 非测试代码增减报告：新增 200 行，删除 209 行，净减 9 行。
- 正向减债动作：职责收敛与简化。顶层布局组件不再装配大包业务 props；workspace 业务组件直接连接 presenter，删除重复 action plumbing。
- 没有新增文件、store、manager 或平行实现；保留的注意点是 `chat-conversation-panel.tsx` 已接近文件预算，后续继续拆分时应优先按业务区域迁移到独立 container 文件。

## NPM 包发布记录

不涉及 NPM 包发布。
