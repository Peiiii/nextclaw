# v0.14.198-ncp-image-caret-and-vision-fix

## 迭代完成说明

- 修复 NCP 聊天输入框的图片 token 插入行为，附件不再通过 state 同步时默认 append 回 composer，而是通过 composer imperative API 按当前光标原位插入。
- 修复图片插入后的光标恢复逻辑：保留最近一次有效选区，插入后自动把焦点与选区恢复到 token 右侧，行为与 skill token 保持一致。
- 优化输入区图片 token 的视觉样式，提升附件 chip 的层级、可辨识性与选中态表现。
- 调整附件去重与同步策略：附件 state 负责数据源，composer token 负责展示顺序；同步时仅清理已删除附件对应 token，避免破坏选区与顺序。
- 强化自动化验证：
  - 新增输入框测试，覆盖图片 token 原位插入。
  - 新增 DOM selection round-trip 测试，覆盖 token 右侧选区恢复。
  - 更新 `apps/ncp-demo/scripts/smoke-ui.mjs`，要求 assistant 在真实 UI smoke 中对图片给出 `image-received` 确认回复。

## 测试/验证/验收方式

- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`
- 单元测试：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui test`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui test`
- Lint：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui lint`
  - 结果：通过；仓库中已有 `copy-text.ts` 的历史 warning 仍存在，但本次无新增 lint error。
- 构建：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/ncp-demo/frontend build`
- 冒烟：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C apps/ncp-demo exec node scripts/smoke-ui.mjs`
  - 观察点：
    - 图片可以通过文件输入进入会话。
    - 会话 seed 中存在 `file` part。
    - assistant 返回包含 `image-received` 的确认回复，证明模型链路实际感知到图片。
- 可维护性守卫：
  - `PATH=/opt/homebrew/bin:$PATH node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
  - 结果：`Errors: 0`、`Warnings: 0`。

## 发布/部署方式

- 本轮为代码修复与验证闭环，尚未执行发包或正式发布。
- 若需要发布，按受影响包重新执行版本提升与发布闭环，并至少包含：
  - 重新构建 `@nextclaw/agent-chat-ui` 与 `@nextclaw/ui`
  - 重新执行上述类型检查、测试、构建与 `smoke-ui.mjs`
  - 发布后再次验证图片粘贴、token 光标位置与 assistant 图片识别

## 用户/产品视角的验收步骤

1. 打开 NCP 聊天页，把光标放到一段文本中间。
2. 直接粘贴一张图片，确认图片 token 出现在当前光标位置，而不是跑到最左或末尾。
3. 继续输入文字，确认输入从图片 token 右侧自然继续。
4. 发送消息，确认消息中包含图片预览。
5. 观察 assistant 回复，确认其能识别到图片并按提示返回 `image-received` 或等价图片确认结果。
6. 重载页面并回到该会话，确认历史图片消息仍可正常展示。
