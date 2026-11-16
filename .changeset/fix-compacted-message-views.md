---
"@nextclaw/kernel": patch
"nextclaw": patch
---

Fix valid compacted sessions being rejected when bounded previews omit original message parts. Preserve typed preview parts and source coordinates, rebuild old derived indexes, and prevent derived summary failures from locking a successfully written journal.
