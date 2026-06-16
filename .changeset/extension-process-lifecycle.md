---
"@nextclaw/extension-sdk": patch
"@nextclaw/kernel": patch
"@nextclaw/service": patch
"@nextclaw/channel-extension-qq": patch
---

Stop extension processes from surviving their service runtime by passing the parent service PID to extension children, shutting down extensions during service signal cleanup, exiting SDK processes when their parent disappears, sweeping legacy orphan channel extension processes on startup, preflighting QQ gateway session quota, waiting for the quota reset before retrying, and surfacing QQ gateway close errors before the startup timeout.
