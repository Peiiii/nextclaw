---
"@nextclaw/agent-chat-ui": patch
"@nextclaw/core": patch
"@nextclaw/kernel": patch
"@nextclaw/server": patch
"@nextclaw/ui": patch
"nextclaw": patch
---

聊天框斜杠选择器、底部技能选择器和 Agent 上下文现在会区分项目、NextClaw、全局与内建技能来源；项目技能从项目 `.agents/skills` 加载，项目 `AGENTS.md` 也会随会话上下文生效。
