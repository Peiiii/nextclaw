---
"nextclaw": patch
"@nextclaw/kernel": patch
"@nextclaw/service": patch
"@nextclaw/core": patch
---

Continue eligible sessions after a controlled restart of a NextClaw systemd service, while keeping ordinary supervisor starts and crashes ineligible for automatic recovery.

Expose the version reported by the process serving the local API through `nextclaw status`, so operators can distinguish the running runtime from the CLI or bundle pointer version.
