# v0.14.166-chat-slash-escape-dismissal

## 迭代完成说明

- 修复聊天输入框 slash 技能浮层的 `ESC` 关闭行为：当用户输入 `/` 触发技能选择后，按下 `ESC` 会真正 dismiss 当前这次 slash 触发，不会在同一段 slash 输入继续存在时立刻重新弹出。
- 将 slash dismiss 状态从“临时 query 值”改为绑定到“当前 slash trigger 的起点”，避免 `ESC` 关闭后因为 selection 同步或后续继续输入而自动复活。
- 新增组件级回归测试，覆盖 `/` -> `ESC` -> 继续输入 `/a` 仍保持关闭，退出 slash 模式后重新输入 `/b` 才重新打开的场景。

## 测试/验证/验收方式

- `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui test -- src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx`
- `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui tsc`
- `PATH=/opt/homebrew/bin:/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/chat-input-bar.tsx packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/chat-input-bar-tokenized-composer.tsx packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/chat-composer-runtime.ts packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx`
- 验证结果：上述命令全部通过；回归测试确认 `ESC` 后同一段 slash 输入不会重新弹出浮层。

## 发布/部署方式

- 本次仅为前端输入交互修复，未执行发布。
- 后续如需带入正式版本，按常规前端/UI 发布流程执行对应构建与发布即可。

## 用户/产品视角的验收步骤

1. 打开聊天页面，把光标放到输入框中。
2. 输入 `/`，确认技能选择浮层出现。
3. 按下键盘左上角 `ESC`，确认浮层关闭。
4. 在不删除这段 slash 输入的前提下继续输入字符，例如把 `/` 继续输入成 `/a`，确认浮层保持关闭。
5. 删除这段 slash 输入或移出该 slash 触发态后，再重新输入新的 `/`，确认浮层可以正常再次打开。
