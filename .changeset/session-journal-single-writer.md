---
"@nextclaw/app-runtime": patch
"@nextclaw/kernel": patch
"@nextclaw/server": patch
"@nextclaw/service": patch
"@nextclaw/ui": patch
---

修复同一 `NEXTCLAW_HOME` 被多个 NextClaw runtime 同时打开时的会话历史可靠性问题：journal 现在由单一可写 runtime 持有生命周期租约，第二个实例会在写入前明确冲突退出；历史 replay、projection 恢复和压缩消息视图也不会再让已确认的消息被晚到事件覆盖或被大摘要挤出页面。
