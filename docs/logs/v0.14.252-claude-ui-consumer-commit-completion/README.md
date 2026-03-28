# 迭代完成说明

- 补齐上一轮 Claude bootstrap-aware prompt / chat card 改动遗漏的 `@nextclaw/ui` consumer 侧提交。
- `packages/nextclaw-ui` 同步移除已废弃的 tool input / call id 文案与映射字段，确保适配层与 `@nextclaw/agent-chat-ui@0.2.8` 的新卡片契约一致。
- 补入 `@nextclaw/ui@0.11.4` 的版本与 changelog 变更，保证本地 git 历史与已发布版本状态一致。

# 测试/验证/验收方式

- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui exec vitest run src/components/chat/adapters/chat-message.adapter.test.ts`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui build`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui lint`
  - 当前失败原因为包内既有无关错误：`src/App.test.tsx` 存在未使用的 `userEvent` 导入；本次触达文件未新增 lint error。
- `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/components/chat/adapters/chat-message.adapter.ts packages/nextclaw-ui/src/components/chat/adapters/chat-message.adapter.test.ts packages/nextclaw-ui/src/components/chat/containers/chat-message-list.container.tsx packages/nextclaw-ui/src/lib/i18n.chat.ts`

# 发布/部署方式

- 无需再次执行 npm 发布。
- 已核对 registry 当前版本：`@nextclaw/ui@0.11.4` 已存在，且与本地这批 consumer 对齐变更对应。
- 本轮目标是补齐 git 提交闭环，而不是重复发布同版本包。

# 用户/产品视角的验收步骤

1. 打开 NextClaw 聊天页，进入包含工具调用消息的会话。
2. 确认工具卡片仍正常显示状态、摘要与输出，不再展示旧的 `Input Summary` / `Call ID` 文案。
3. 确认消息列表没有因为 adapter 契约收缩而出现空白卡片、类型错误或 i18n 缺失。
4. 确认升级到已发布的 `@nextclaw/ui@0.11.4` 后，consumer 侧表现与共享 `@nextclaw/agent-chat-ui` 一致。
