---
"@nextclaw/app-runtime": patch
"@nextclaw/kernel": patch
"@nextclaw/server": patch
"@nextclaw/service": patch
"@nextclaw/ui": patch
---

修复会话历史可靠性问题：保留历史 replay、projection 恢复和压缩消息视图的修复，不再用 journal 目录级 writer ownership 阻止同一 `NEXTCLAW_HOME` 下的第二个 runtime 或新会话启动。
