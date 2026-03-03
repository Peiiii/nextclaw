# v0.0.3 Chat Skill Engine Closure

## 迭代完成说明

- 修复“技能已选择但 AI 无感知”的闭环缺口。
- 根因：`requested_skills` 仅在 native agent loop 注入，扩展引擎（`codex-sdk` / `claude-agent-sdk`）未消费该字段。
- 变更：
  - 在 `@nextclaw/nextclaw-engine-codex-sdk` 中解析 `metadata.requested_skills/requestedSkills`，加载对应 SKILL 内容并注入本轮 prompt。
  - 在 `@nextclaw/nextclaw-engine-claude-agent-sdk` 中执行同样注入策略。
  - 会话用户事件 extra 中附带 `requested_skills`，便于后续调试/追踪。

## 影响范围

- `packages/extensions/nextclaw-engine-plugin-codex-sdk/src/index.ts`
- `packages/extensions/nextclaw-engine-plugin-claude-agent-sdk/src/index.ts`
