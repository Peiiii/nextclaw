# v0.0.1-qq-url-guard-skill

## 迭代完成说明（改了什么）

- 新增内置 skill：`packages/nextclaw-core/src/agent/skills/qq-url-guard/SKILL.md`。
- skill 明确 QQ 文本发送风险：`xx.xx`、`USER.md`、markdown 链接、`http(s)` URL 可能触发 `40034028` 被拦截。
- 更新 skills 索引：`packages/nextclaw-core/src/agent/skills/README.md`。
- QQ 渠道发送策略调整为纯文本（不再使用 markdown payload）：`packages/extensions/nextclaw-channel-runtime/src/channels/qq.ts`。

## 交付结果

- AI 在 QQ 场景会主动规避 URL-like 文本风险，且发送层默认纯文本，降低被拦截概率。
