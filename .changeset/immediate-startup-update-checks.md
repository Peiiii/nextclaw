---
"@nextclaw/service": patch
"nextclaw": patch
---

修复重启后可能因最近一次检查记录而跳过更新检查的问题。NextClaw 现在会在每次启动时立即检查一次，运行期间继续每两小时检查；检查只更新可用版本状态，不会自动下载或应用更新。
