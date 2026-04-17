# NextClaw Hermes HTTP Adapter

This package exposes a standalone NCP-over-HTTP adapter for Hermes API Server.

It is intentionally not a Hermes-specific NextClaw runtime. NextClaw keeps using the generic `http-runtime` kind, while this server translates that runtime contract into Hermes' OpenAI-compatible `/v1/chat/completions` streaming API.

## Start

```bash
pnpm -C packages/nextclaw-ncp-runtime-adapter-hermes-http build
nextclaw-hermes-http-adapter \
  --port 8765 \
  --hermes-base-url http://127.0.0.1:8642 \
  --api-key change-me-local-dev
```

Environment variables are also supported:

```bash
NEXTCLAW_HERMES_ADAPTER_PORT=8765
HERMES_API_BASE_URL=http://127.0.0.1:8642
HERMES_API_KEY=change-me-local-dev
HERMES_MODEL=hermes-agent
```

## NextClaw Runtime Entry

Point a `type: "narp-http"` runtime entry at this adapter:

```json
{
  "label": "Hermes",
  "type": "narp-http",
  "config": {
    "baseUrl": "http://127.0.0.1:8765",
    "basePath": "/ncp/agent",
    "healthcheckUrl": "http://127.0.0.1:8765/health",
    "recommendedModel": "hermes-agent",
    "supportedModels": ["hermes-agent"]
  }
}
```

## Contract

The adapter exposes:

- `GET /health`
- `POST /ncp/agent/send`
- `GET /ncp/agent/stream?sessionId=...`
- `POST /ncp/agent/abort`

Hermes conversation continuity is preserved through `X-Hermes-Session-Id`, stored per NextClaw `sessionId`.
