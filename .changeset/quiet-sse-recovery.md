---
"@nextclaw/ncp-react": patch
"@nextclaw/kernel": patch
"@nextclaw/server": patch
"@nextclaw/ui": patch
"nextclaw": patch
---

改善 Web Chat 长连接的稳定性：空闲 SSE 现在会主动保活，短暂断流可在后台补齐会话并重连，不再立即展示无意义的网络错误；持续连接失败仍会明确提示。启动恢复同时改为逐会话、逐行扫描历史日志，降低大 journal 场景的峰值内存和 OOM 风险。
