---
"@nextclaw/ncp-agent-runtime": patch
"@nextclaw/core": patch
---

Avoid replaying final historical visual tool payloads into later model input so short native sessions do not lose prior conversation context after image-heavy tool results.
Bound high-detail `view_image` payloads by size, dimensions, and visual patch budget, and estimate image payloads as visual inputs instead of raw base64 text so active image observations do not evict normal conversation history.
