# @nextclaw/ncp-http-agent-server

HTTP/SSE transport adapter for exposing an `NcpAgentClientEndpoint` over Hono routes.

## Build

```bash
pnpm -C packages/ncp-packages/nextclaw-ncp-http-agent-server build
```

## API

- `createNcpHttpAgentRouter(options)` — options require `agentClientEndpoint: NcpAgentClientEndpoint`
- `mountNcpHttpAgentRoutes(app, options)`

**Options:**
- `agentClientEndpoint` — client endpoint to forward requests to (in-process adapter or remote HTTP client)
- `streamProvider` (optional) — When set, `/stream` serves stored events instead of forwarding to the agent. Scenario: user reconnects after network drop and wants to continue watching the previous reply; with `streamProvider` we stream from persistence, without it we forward to the agent.
- `basePath`, `requestTimeoutMs` — path and timeout

For in-process agent (`NcpAgentServerEndpoint`), use `createAgentClientFromServer` from `@nextclaw/ncp-toolkit` to wrap it.
