---
name: integrating-http-agent-runtime
description: Use when connecting Hermes or another external HTTP-backed agent runtime into NextClaw, especially when the AI must wire plugin config, expose a selectable session type, validate end-to-end runtime behavior, and debug readiness, streaming, or adapter issues.
---

# Integrating HTTP Agent Runtime

## Overview

Use this skill to connect an external agent runtime into NextClaw through the generic `http-runtime` path.

Default architecture:

- Keep NextClaw core generic.
- Reuse the existing `http-runtime` plugin and client.
- Treat Hermes or any other backend as an external runtime behind an HTTP adapter.
- End with a real selectable session type in NextClaw, not just a design note.

Read these first when the task is non-trivial:

- `docs/VISION.md`
- `docs/plans/2026-04-15-http-backed-agent-runtime-design.md`
- `docs/logs/v0.16.28-http-backed-agent-runtime-mvp/README.md`

## When To Use

Use this skill when any of these are true:

- The user wants Hermes to appear as a NextClaw session type.
- The user wants to connect an external agent runtime by HTTP address.
- The user wants “just configure it” runtime onboarding instead of hard-coding a new runtime.
- The user wants the AI to debug why an HTTP runtime is not ready, not visible, not streaming, or returning errors.

Do not use this skill for:

- MCP server integration
- ordinary tool/plugin integration that does not create an agent runtime
- adding a brand-new non-HTTP runtime family

## Core Rule

Prefer this split unless the user explicitly asks for something else:

- NextClaw owns the generic `http-runtime` registration and session-type experience.
- The external runtime owns its private protocol.
- An adapter server translates the private protocol into the shared HTTP/SSE contract.

Do not create a Hermes-specific runtime kind if `http-runtime` can solve it.

## First Decision

Classify the task into exactly one path:

### Path A: Existing HTTP runtime is already ready

Choose this when the target already exposes the expected endpoints:

- `POST /send`
- `GET /stream?sessionId=...`
- `POST /abort`
- optional `GET /health`

In this path, the AI should mostly do configuration and verification.

### Path B: Adapter server is still required

Choose this when the target runtime only exposes:

- private SDK calls
- OpenAI-compatible APIs
- CLI commands
- ACP or another private wire protocol

In this path, the AI should first add or update an adapter server, then wire NextClaw to the adapter URL.

## Files To Reuse

Start from the existing implementation before inventing new structure:

- `packages/extensions/nextclaw-ncp-runtime-http-client`
- `packages/extensions/nextclaw-ncp-runtime-plugin-http-client`
- `packages/extensions/nextclaw-ncp-runtime-adapter-hermes-http`
- `packages/nextclaw/src/cli/commands/ncp/runtime/create-ui-ncp-agent.http-runtime.test.ts`
- `packages/nextclaw/src/cli/commands/ncp/runtime/create-ui-ncp-agent.hermes-http-runtime.test.ts`

Important current boundary:

- `http-runtime` is already the generic runtime kind.
- Hermes is already implemented as an external adapter, not as a core runtime kind.
- Current MVP is configuration-driven for one plugin entry, not yet a full multi-instance runtime catalog.

## Path A Workflow

When the external runtime already serves the HTTP contract:

1. Enable `nextclaw-ncp-runtime-plugin-http-client`.
2. Point `config.baseUrl` at the external runtime or adapter.
3. Set `label` to the user-facing runtime name, for example `Hermes`.
4. Optionally set:
   - `basePath`
   - `healthcheckUrl`
   - `recommendedModel`
   - `supportedModels`
   - `headers`
5. Verify that the session type becomes visible and ready.
6. Run a real message smoke, not only static config inspection.

Example config:

```json
{
  "plugins": {
    "entries": {
      "nextclaw-ncp-runtime-plugin-http-client": {
        "enabled": true,
        "config": {
          "label": "Hermes",
          "baseUrl": "http://127.0.0.1:18765",
          "basePath": "/ncp/agent",
          "healthcheckUrl": "http://127.0.0.1:18765/health",
          "recommendedModel": "hermes-agent"
        }
      }
    }
  }
}
```

## Path B Workflow

When an adapter is needed:

1. Keep NextClaw side generic.
2. Add or update a standalone adapter package under `packages/extensions/`.
3. Make the adapter expose the shared HTTP/SSE contract.
4. Keep target-runtime-specific translation inside the adapter package.
5. Only after the adapter is runnable, point `http-runtime` config at its `baseUrl`.

For Hermes, prefer the existing adapter package instead of rebuilding another integration path.

## Debugging Checklist

If the runtime does not appear in session type selection:

- check plugin load path and `enabled: true`
- check `baseUrl`
- if using readiness probing, check `healthcheckUrl`
- run a direct `curl` against `/health`

If the runtime appears but is not ready:

- inspect healthcheck response
- verify adapter process is actually listening
- verify required auth headers or API keys are present

If the runtime is selectable but sending fails:

- test `POST /send` directly
- test `GET /stream?sessionId=...` directly
- check whether the adapter emits `run.error` or only hangs
- inspect whether the upstream provider rejected credentials

If the run finishes but text is empty:

- inspect upstream provider logs first
- confirm the adapter is parsing the upstream stream format correctly
- for Hermes, check whether the upstream provider returned `401` or `403`

## Validation

Do not stop after editing files. Run the smallest sufficient end-to-end checks.

Prefer these validations when relevant:

```bash
pnpm -C packages/extensions/nextclaw-ncp-runtime-http-client test
pnpm -C packages/extensions/nextclaw-ncp-runtime-plugin-http-client test
pnpm -C packages/extensions/nextclaw-ncp-runtime-adapter-hermes-http test
pnpm -C packages/extensions/nextclaw-ncp-runtime-adapter-hermes-http lint
pnpm -C packages/extensions/nextclaw-ncp-runtime-adapter-hermes-http tsc
pnpm -C packages/extensions/nextclaw-ncp-runtime-adapter-hermes-http build
pnpm -C packages/nextclaw test -- create-ui-ncp-agent.http-runtime.test.ts
pnpm -C packages/nextclaw test -- create-ui-ncp-agent.hermes-http-runtime.test.ts
```

When the user asks for real verification, use an isolated temp home instead of writing smoke data into the repo.

## Real Hermes Smoke

When Hermes local source is available, the AI may use this pattern:

1. start Hermes API server with isolated `HERMES_HOME`
2. confirm `/health` and `/v1/models`
3. start `packages/extensions/nextclaw-ncp-runtime-adapter-hermes-http/dist/cli.js`
4. point NextClaw `http-runtime` config at the adapter URL
5. send a real message and inspect returned event types and text deltas

If the bridge works but the provider rejects the call, report that explicitly as an upstream credential or permission issue, not as a broken NextClaw integration.

## Output Contract

When finishing this task, the AI should report:

- which path it used: Path A or Path B
- which URL NextClaw should point to
- whether the session type is visible and ready
- whether automated tests passed
- whether real smoke passed
- if real smoke failed, whether the failure is in NextClaw, adapter, or upstream provider

## Common Mistakes

- creating a Hermes-specific core runtime instead of reusing `http-runtime`
- treating a skill as if it can replace the runtime contract
- wiring config but skipping real send/stream verification
- reporting “integration complete” when only `/health` works
- blaming NextClaw for upstream provider auth failures
