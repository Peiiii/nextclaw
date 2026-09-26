---
"@nextclaw/ui": patch
---

Fix chat sends failing with `crypto.randomUUID is not a function` when accessing NextClaw over plain HTTP, including keyboard sends and preset messages. Preserve distinct message identities and idempotent retries.
