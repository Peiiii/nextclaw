---
"@nextclaw/kernel": patch
---

Start automatic conversation-title generation as soon as a user message is durably received, using that turn's selected model in parallel with the main reply. Preserve manual names and discard stale title results when a newer user input arrives.
