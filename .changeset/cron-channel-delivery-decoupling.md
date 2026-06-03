---
"nextclaw": patch
"@nextclaw/core": patch
"@nextclaw/kernel": patch
"@nextclaw/service": patch
"@nextclaw/server": patch
"@nextclaw/ui": patch
"@nextclaw/channel-extension-weixin": patch
---

Decouple cron jobs from channel delivery settings. Scheduled jobs now ask the agent to call the message tool for notifications, while Weixin sends fail honestly when account, channel, API, or context_token delivery state is unavailable.
