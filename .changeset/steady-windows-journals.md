---
"@nextclaw/kernel": patch
"nextclaw": patch
---

Fix Windows session snapshot imports failing with EPERM during directory fsync. Keep source and recovery-intent file flushing, use writable handles when flushing copied files, and apply directory flushing only on platforms that support it.
