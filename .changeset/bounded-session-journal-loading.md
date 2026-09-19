---
"@nextclaw/kernel": patch
---

Prevent large session histories from exhausting runtime memory by loading current message projections first and streaming journal recovery with bounded memory.
