---
"nextclaw": patch
"@nextclaw/app-runtime": patch
---

Prevent Portable WASI Apps that use standard key-value storage from crashing the native runner, generate new Rust/WASI Apps against the standard interface, and keep legacy host KV data on Spin's public store contract.
