---
"nextclaw": patch
"@nextclaw/kernel": patch
"@nextclaw/ui": patch
"@nextclaw/ncp-agent-runtime": patch
---

Keep recent tool results readable by the model instead of replacing them with history previews. Restore populated tool cards carrying older deferred flags, and fix invalid model round boundaries after history cropping or full compaction, including older empty leading rounds.
