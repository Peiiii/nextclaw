# @nextclaw/nextclaw-ncp-runtime-plugin-claude-code-sdk

Plugin package that registers the `claude` NCP session type for NextClaw.

It composes the pure runtime library from `@nextclaw/nextclaw-ncp-runtime-claude-code-sdk` and exposes it through the standard plugin system.

## Build

```bash
pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk build
```

## Request timeout

`requestTimeoutMs` is optional and disabled by default for real Claude chat turns.
Set it explicitly only when you need a hard per-request timeout.
