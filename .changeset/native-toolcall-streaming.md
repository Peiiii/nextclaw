---
"@nextclaw/ncp-agent-runtime": patch
"@nextclaw/ncp-agent-runtime-next": patch
---

Fix native agent runtime tool-call streaming so ready tool calls can publish results before the model round finishes while preserving incremental argument deltas and serial tool execution.
