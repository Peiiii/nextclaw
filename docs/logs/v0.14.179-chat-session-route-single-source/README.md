# v0.14.179-chat-session-route-single-source

## 迭代完成说明

- 修复主界面切换会话时的闪烁/回弹问题。
- 根因是聊天页同时把 `selectedSessionKey` 存在 store 和路由里：点击切换会话时先手动写 store，但此时 URL 还是旧会话，随后同步逻辑又把旧路由写回 store，导致旧会话界面短暂回弹。
- 本次将“当前选中会话”的主事实源收敛为路由：
  - `ChatSessionListManager.createSession` 不再在导航前手动清空 `selectedSessionKey`
  - `ChatSessionListManager.selectSession` 不再在导航前手动写入新 `selectedSessionKey`
  - 删除当前会话时，legacy / NCP 两条链路都不再在导航前直接改写 `selectedSessionKey`
- 这样会话切换只由路由落地后统一同步，避免旧会话被中途写回。

## 测试/验证/验收方式

- 运行测试：
  - `pnpm -C packages/nextclaw-ui exec vitest run src/components/chat/managers/chat-session-list.manager.test.ts src/components/chat/ChatConversationPanel.test.tsx`
- 运行类型检查：
  - `pnpm -C packages/nextclaw-ui tsc`
- 运行 lint：
  - `pnpm -C packages/nextclaw-ui exec eslint src/components/chat/managers/chat-session-list.manager.ts src/components/chat/managers/chat-session-list.manager.test.ts src/components/chat/managers/chat-thread.manager.ts src/components/chat/ncp/ncp-chat-thread.manager.ts`
- 运行可维护性检查：
  - `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/components/chat/managers/chat-session-list.manager.ts packages/nextclaw-ui/src/components/chat/managers/chat-session-list.manager.test.ts packages/nextclaw-ui/src/components/chat/managers/chat-thread.manager.ts packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-thread.manager.ts`

## 发布/部署方式

- 本次仅涉及 `@nextclaw/ui` 前端源码，按常规前端发布流程重新构建并发布包含该 UI 的产物即可。
- 若走本仓库标准流程，可在后续发布批次中按既有 release 流程执行，不需要额外 migration。

## 用户/产品视角的验收步骤

1. 打开主聊天界面，确保左侧已有至少两个会话。
2. 在会话 A 与会话 B 之间来回快速切换。
3. 确认界面不会出现“旧会话先消失/回弹一次，再切到新会话”的闪烁。
4. 点击“新建会话”，确认不会先短暂回到旧会话再进入新会话草稿态。
5. 删除当前会话，确认不会先短暂显示已删除会话再回到聊天首页。
