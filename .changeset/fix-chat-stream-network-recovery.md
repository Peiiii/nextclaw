---
"@nextclaw/ncp": patch
"@nextclaw/ncp-http-agent-client": patch
"@nextclaw/ncp-toolkit": patch
"@nextclaw/ncp-react": patch
"@nextclaw/ui": patch
---

提升 Web Chat 在普通网络抖动后的恢复稳定性：SSE 半开或长时间无数据时会主动判定失活并重连，连接恢复后重新补齐会话历史，同时保留更晚到达的实时完成事件，无需刷新页面即可继续看到最终回复。
