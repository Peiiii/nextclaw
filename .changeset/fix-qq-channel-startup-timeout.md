---
"@nextclaw/channel-runtime": patch
"@nextclaw/channel-plugin-qq": patch
"@nextclaw/openclaw-compat": patch
"nextclaw": patch
---

Fix QQ channel startup readiness so non-development services wait for the QQ bot connection, surface SDK start timeouts, and retry instead of reporting a ready channel before the bot is connected.
