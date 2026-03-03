# v0.0.2 Validation

## 执行命令

- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui exec eslint src/components/chat/ChatInputBar.tsx src/components/chat/SkillsPicker.tsx src/components/chat/ChatPage.tsx src/components/chat/ChatConversationPanel.tsx src/components/chat/useChatStreamController.ts src/components/chat/ChatThread.tsx src/lib/i18n.ts`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core exec eslint src/agent/loop.ts`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui build`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core build`

## 结果

- `tsc`：通过（UI/Core）。
- `eslint`：无 error；Core 仍有既有 `max-lines` warning（本次未新增该规则问题）。
- `build`：通过（UI/Core）。

## 冒烟说明

- 本轮已完成构建级验证；未在本地启动 UI 进行人工点击冒烟。
- 建议发布前执行一次 UI 冒烟（见 [ACCEPTANCE](./ACCEPTANCE.md)）。
