# v0.0.2 Chat Skill Message Selection

## 迭代完成说明

- 将聊天区技能交互从全局开关改为“本条消息多选”。
- 技能选择器改为可搜索多选，不再调用 `skill manage enable/disable`。
- 在输入框区域展示已选技能标签，支持单个移除。
- 发送消息时透传 `metadata.requested_skills`，发送后清空本次已选技能。
- Core Agent Loop 新增 `requested_skills/requestedSkills` 解析，并注入到 `context.buildMessages({ skillNames })`。
- 工具调用展示升级：连续多工具段以 `Tool1 → Tool2 → Tool3` 工作流样式展示，默认折叠，展开后查看参数与结果。
- 模型下拉保留“仅已配置 provider 模型”，未新增 Auto。

## 影响范围

- UI: `ChatInputBar`、`SkillsPicker`、`ChatPage`、`ChatConversationPanel`、`ChatThread`。
- Runtime/Core: `AgentLoop` 的 skillNames 注入。
