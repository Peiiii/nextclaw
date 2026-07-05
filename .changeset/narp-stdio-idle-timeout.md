---
"@nextclaw/nextclaw-ncp-runtime-stdio-client": patch
---

Treat NARP stdio prompt timeouts as idle timeouts so actively streaming agent runs are not failed just because total runtime exceeds the configured request timeout.
