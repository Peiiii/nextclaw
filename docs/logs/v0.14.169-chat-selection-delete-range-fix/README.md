# v0.14.169-chat-selection-delete-range-fix

## 迭代完成说明

- 修复聊天输入框在 `contenteditable` 场景下“全选后按删除键只删除最后一个字符”的问题。
- 根因是删除键触发时使用了旧的 composer selection，导致范围删除被误判成末尾单字符删除。
- 现在在 `keyDown` 删除路径前会先同步当前 DOM 选区，再执行删除逻辑。
- 新增独立回归测试，覆盖“全选整个 draft 后按 `Backspace` 应清空整段文本”的场景。

## 测试/验证/验收方式

- `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui test -- src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx src/components/chat/ui/chat-input-bar/chat-input-bar-selection.test.tsx`
- `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui tsc`
- `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui lint`
- `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/chat-composer-runtime.ts packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/chat-input-bar-selection.test.tsx`
- 验证结果：
  - 测试通过，`9/9` 通过。
  - `tsc` 通过。
  - maintainability guard 通过。
  - `lint` 仅存在未触及的既有 warning：`packages/nextclaw-agent-chat-ui/src/components/chat/utils/copy-text.ts`

## 发布/部署方式

- 本次仅为前端输入交互修复，未执行发布。
- 后续如需进入正式版本，按既有前端/UI 发版流程构建并发布即可。

## 用户/产品视角的验收步骤

1. 打开聊天页面，在输入框中输入一段普通文本。
2. 使用鼠标拖选全文，或使用系统快捷键全选输入框内容。
3. 按下 `Delete` 或 `Backspace`。
4. 确认输入框内容被整段清空，而不是只删除最后一个字符。
