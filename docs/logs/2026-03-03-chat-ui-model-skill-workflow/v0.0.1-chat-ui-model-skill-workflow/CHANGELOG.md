# v0.0.1-chat-ui-model-skill-workflow

## 迭代完成说明

完成时间：2026-03-03

本次主要完成聊天前端体验升级，覆盖 4 个核心方向：

1. 底部切换从 `Agent` 改为 `Model`
- 聊天输入区新增模型选择器，替换原有 Agent 下拉。
- 模型列表仅展示“已配置 Provider”的模型（未配置 Provider 不可选）。
- 发送消息时将所选 `model` 透传到 `/api/chat/turn/stream`。
- 当前选中模型（触发器显示）改为单行 `Provider/model` 风格，避免与下拉列表同样的双行展示。

2. Skill 展示增强
- `skills` 面板支持搜索。
- 每个 skill 展示名称 + 描述 + 官方标记 + 启用开关。
- 描述支持按当前界面语言显示：
  - 优先使用对应语言描述（中文优先 `descriptionZh`）。
  - 无对应语言时回退默认描述。

3. Tool Call 工作流视觉升级
- 工具调用卡片支持“串联工作流”视觉（步骤编号 + 垂直连线）。
- 多工具调用时形成连续流程感，结果展示逻辑保留（输出折叠/展开）。

4. 对话区域宽度优化
- 对话消息区和输入区由 `max-w-3xl` 提升为更宽布局（`max-w-[min(1120px,100%)]`）。
- 保持移动端自适应。

## 关键实现文件

- `packages/nextclaw-ui/src/components/chat/ChatInputBar.tsx`
- `packages/nextclaw-ui/src/components/chat/ChatPage.tsx`
- `packages/nextclaw-ui/src/components/chat/ChatConversationPanel.tsx`
- `packages/nextclaw-ui/src/components/chat/useChatStreamController.ts`
- `packages/nextclaw-ui/src/components/chat/SkillsPicker.tsx`
- `packages/nextclaw-ui/src/components/chat/ChatThread.tsx`
- `packages/nextclaw-ui/src/lib/provider-models.ts`
- `packages/nextclaw-ui/src/lib/i18n.ts`
- `packages/nextclaw-ui/src/api/types.ts`
- `packages/nextclaw-server/src/ui/router.ts`
- `packages/nextclaw-server/src/ui/types.ts`
- `packages/nextclaw-ui/src/components/config/ModelConfig.tsx`（复用 provider/model 解析逻辑，避免重复实现）
