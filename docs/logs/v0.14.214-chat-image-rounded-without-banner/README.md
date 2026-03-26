# v0.14.214-chat-image-rounded-without-banner

## 迭代完成说明

- 在主聊天消息列表的图片附件渲染中，保留“去掉底部图片附件横幅”的改动。
- 将图片附件的圆角样式恢复为 `rounded-2xl`，让图片视觉上继续贴合聊天卡片风格。
- 更新消息列表测试，明确约束图片附件既没有 `figure/figcaption` 横幅结构，也保留圆角类名。

## 测试/验证/验收方式

- 单测：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui exec vitest run src/components/chat/ui/chat-message-list/chat-message-list.test.tsx`
- 类型验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui tsc`
- 构建验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui build`
- 可维护性自检：
  - `PATH=/opt/homebrew/bin:$PATH node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-file.tsx packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-list.test.tsx`

## 发布/部署方式

- 本次未执行正式发布。
- 若当前前端页面已在运行，需要等待热更新或重启前端进程后，界面才会体现恢复圆角后的效果。

## 用户/产品视角的验收步骤

1. 打开主聊天页面并发送一条图片消息。
2. 确认图片下方不再出现“图片附件”横幅。
3. 确认图片本体恢复圆角显示。
4. 确认普通非图片文件附件仍保持原有文件卡片样式。
