# v0.14.36 Chat Inline Skill Backspace Remove

## 迭代完成说明

- 为聊天输入框中的内联 skill chip 补充键盘删除体验。
- 当输入框正文为空时，按 `Backspace` 会像删除文本一样，移除最后一个已选 skill。
- 该行为只在空输入、非组合输入场景触发，不会影响正常文本输入、slash 菜单或发送逻辑。
- 补充回归测试，覆盖“空输入框退格删除最后一个 skill”的行为。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-agent-chat-ui test -- --run src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx`
- `pnpm -C packages/nextclaw-agent-chat-ui lint`
- `pnpm -C packages/nextclaw-ui build`
- `python3 .codex/skills/post-edit-maintainability-guard/scripts/check_maintainability.py --paths packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/chat-input-bar-textarea.tsx packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx`
- 观察点：
  - 输入框为空时，按一次退格删除最后一个 skill chip。
  - 输入框存在正文时，退格仍按普通文本删除工作。

## 发布/部署方式

- 本次修改尚未单独发布。
- 后续按既有前端发布流程一并发布即可；发布前建议在真实聊天页补一次手工冒烟，确认多 skill 场景下的退格体验符合预期。

## 用户/产品视角的验收步骤

1. 打开聊天页，选择两个以上 skill，让它们以内联 chip 形式出现在输入框中。
2. 保持输入框正文为空，按一次 `Backspace`，确认最后一个 skill 被移除。
3. 再按一次 `Backspace`，确认继续移除新的最后一个 skill。
4. 重新选择 skill 并输入一段正文，确认此时 `Backspace` 会删除正文字符，而不是直接移除 skill。
