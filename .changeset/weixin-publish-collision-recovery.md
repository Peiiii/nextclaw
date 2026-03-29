---
"@nextclaw/channel-plugin-weixin": patch
"@nextclaw/openclaw-compat": patch
"@nextclaw/server": patch
"nextclaw": patch
---

Recover the Weixin self-notify release path after a published version collision on `@nextclaw/channel-plugin-weixin`.

The previous batch released the main packages successfully, but `@nextclaw/channel-plugin-weixin@0.1.12` already existed on npm and was skipped. This recovery release publishes the actual Weixin route-hint changes under a new version and realigns `@nextclaw/openclaw-compat`, `@nextclaw/server`, and `nextclaw` onto that published dependency.
