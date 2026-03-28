# v0.14.255-chat-attachment-card-upgrade

## 迭代完成说明

- 优化聊天消息中的附件卡片展示，图片附件升级为带预览区、尺寸标签、类型角标和说明区的富卡片。
- 普通文件附件升级为更完整的文件卡片，补齐文件类型、尺寸、MIME 信息和更清晰的打开入口。
- 扩充聊天附件 view-model，保留 `sizeBytes`，让前端展示不再丢失关键附件元信息。
- 同步更新附件适配层与前端测试，覆盖图片附件、普通文件附件和 asset tool 结果场景。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-agent-chat-ui exec vitest run src/components/chat/ui/chat-message-list/chat-message-list.test.tsx`
- `pnpm -C packages/nextclaw-ui exec vitest run src/components/chat/adapters/chat-message.adapter.test.ts`
- `pnpm -C packages/nextclaw-agent-chat-ui tsc`
- `pnpm -C packages/nextclaw-ui tsc`
- `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-file/index.tsx packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-file/meta.ts packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message.tsx packages/nextclaw-agent-chat-ui/src/components/chat/view-models/chat-ui.types.ts packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-list.test.tsx packages/nextclaw-ui/src/components/chat/adapters/chat-message.adapter.ts packages/nextclaw-ui/src/components/chat/adapters/chat-message.adapter.test.ts`

## 发布/部署方式

- 本次未执行发布。
- 若需要上线前端变更，按项目既有前端发布流程执行对应构建与发布命令，并以上述附件卡片场景做发布后冒烟。

## 用户/产品视角的验收步骤

- 在聊天输入区选择一张图片并发送，确认消息中的图片附件以完整预览卡片展示，能看到文件名、尺寸、类型信息。
- 发送一个非图片文件（如 `pdf` 或 `json`），确认消息中展示为文件卡片而不是简单文字块，并且能直接点击打开。
- 分别观察 user bubble 与 assistant bubble 中的附件视觉层级，确认对比度、信息密度和交互提示都明显优于旧版。
