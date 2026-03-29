---
"@nextclaw/agent-chat-ui": patch
"@nextclaw/channel-plugin-dingtalk": patch
"@nextclaw/channel-plugin-discord": patch
"@nextclaw/channel-plugin-email": patch
"@nextclaw/channel-plugin-mochat": patch
"@nextclaw/channel-plugin-qq": patch
"@nextclaw/channel-plugin-slack": patch
"@nextclaw/channel-plugin-telegram": patch
"@nextclaw/channel-plugin-wecom": patch
"@nextclaw/channel-plugin-weixin": patch
"@nextclaw/channel-plugin-whatsapp": patch
"@nextclaw/channel-runtime": patch
"@nextclaw/core": patch
"@nextclaw/mcp": patch
"@nextclaw/ncp-mcp": patch
"@nextclaw/ncp-react": patch
"@nextclaw/ncp-toolkit": patch
"@nextclaw/nextclaw-engine-claude-agent-sdk": patch
"@nextclaw/nextclaw-engine-codex-sdk": patch
"@nextclaw/nextclaw-ncp-runtime-codex-sdk": patch
"@nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk": patch
"@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk": patch
"@nextclaw/openclaw-compat": patch
"@nextclaw/remote": patch
"@nextclaw/runtime": patch
"@nextclaw/server": patch
"@nextclaw/ui": patch
"nextclaw": patch
---

Publish the pending NCP realtime sync batch together with the new built-in cross-channel messaging skill and Weixin self-notify route hints.

This release keeps the product lightweight: the AI reuses the existing reply, `sessions_send`, and `message` primitives, and a fresh UI or NCP session can proactively notify the saved Weixin route without adding a separate notification abstraction.
