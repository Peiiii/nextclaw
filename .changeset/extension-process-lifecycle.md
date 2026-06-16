---
"@nextclaw/extension-sdk": patch
"@nextclaw/kernel": patch
"@nextclaw/service": patch
---

Stop extension processes from surviving their service runtime by passing the parent service PID to extension children, shutting down extensions during service signal cleanup, and exiting SDK processes when their parent disappears.
