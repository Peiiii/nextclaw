# @nextclaw/ncp-toolkit

Toolkit implementations built on top of `@nextclaw/ncp` protocol contracts.

## Build

```bash
pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit build
```

## Scope

- Reference conversation-state manager implementations
- Protocol-level helper logic that depends on `@nextclaw/ncp` contracts
- In-memory agent backend building block: `DefaultNcpInMemoryAgentBackend`
- In-process adapter helper: `createAgentClientFromServer`
- Runtime throwable helper: `NcpErrorException`
