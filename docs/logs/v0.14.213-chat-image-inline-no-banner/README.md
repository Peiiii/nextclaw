# v0.14.213-chat-image-inline-no-banner

## 迭代完成说明

- 修正主聊天消息列表里图片附件的渲染方式，命中真实组件 `@nextclaw/agent-chat-ui`。
- 图片附件不再使用 `figure + figcaption` 卡片样式，去掉底部“图片附件”横幅。
- 图片附件不再包在圆角裁切容器里，避免圆角导致图片内容边缘被遮挡。
- 保留非图片文件附件的现有文件卡片展示，不影响普通附件信息。
- 更新对应消息列表测试，明确约束图片附件不再渲染 `figure/figcaption`。

## 测试/验证/验收方式

- 单测：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui exec vitest run src/components/chat/ui/chat-message-list/chat-message-list.test.tsx`
- 构建验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui build`
- 类型验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui tsc`
- Lint 验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui lint`
  - 结果：通过；存在仓库既有 warning，位于 `packages/nextclaw-agent-chat-ui/src/components/chat/utils/copy-text.ts:22`，与本次改动无关。
- 可维护性自检：
  - `PATH=/opt/homebrew/bin:$PATH node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-file.tsx packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-list.test.tsx`

## 发布/部署方式

- 本次未执行正式发布。
- 若要让依赖该组件库的前端界面立即体现改动，需要重新构建并使用最新的 `@nextclaw/agent-chat-ui` 产物；若当前正在运行前端开发服务，需等待热更新或重启前端进程。

## 用户/产品视角的验收步骤

1. 打开主聊天页面，发送一条包含图片的消息。
2. 确认消息中的图片下方不再出现“图片附件”横幅。
3. 确认图片四角不再被圆角裁切，边缘内容完整可见。
4. 再发送一个非图片文件附件，确认文件名与 MIME 信息仍按原卡片样式展示。
