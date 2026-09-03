---
"@nextclaw/shared": patch
"@nextclaw/core": patch
"@nextclaw/kernel": patch
"@nextclaw/ui": patch
---

修复正常 AI 回复在说明 `<noreply/>` 静默标记时被整条隐藏的问题。现在只有完整可见正文严格匹配该标记时才会静默，消息列表、回复策略与继续运行锚点使用一致语义。
