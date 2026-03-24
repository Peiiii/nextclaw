# @nextclaw/feishu-core

Feishu platform core for NextClaw.

This package owns the reusable Feishu-specific foundation that should not live
inside the message channel runtime:

- config schema
- account resolution
- SDK client lifecycle
- bot probe
- inbound content conversion

It is intended to be reused by `@nextclaw/core`, `@nextclaw/channel-runtime`,
and future Feishu work-surface capabilities.
