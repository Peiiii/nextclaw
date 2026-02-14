# Nextclaw Package Split Plan

## Goal
Separate CLI entry, runtime core, and UI/API server to improve maintainability, testability, and reuse.

## Target Packages
- `nextclaw-core`
  - Runtime core: agent loop, providers, channels, config, cron/heartbeat, sessions, utils
  - Exposes public APIs used by CLI/server
- `nextclaw-server`
  - UI/API server (Hono) + config API + websocket events
  - Depends on `nextclaw-core`
- `nextclaw` (existing)
  - CLI only, plus re-exports of core (keep current public API stable)
  - Wires `nextclaw-core` + `nextclaw-server`

## Module Moves
From `packages/nextclaw/src` to `packages/nextclaw-core/src`:
- `agent/`, `bus/`, `channels/`, `config/`, `cron/`, `heartbeat/`, `providers/`, `session/`, `utils/`, `index.ts`

From `packages/nextclaw/src` to `packages/nextclaw-server/src`:
- `ui/` (server, router, config, types)

## API Surface
`nextclaw-core` will export:
- Config: `loadConfig`, `saveConfig`, `getConfigPath`, `getDataDir`, `ConfigSchema`, `Config` type
- Runtime: `AgentLoop`, `MessageBus`, `ChannelManager`, `SessionManager`, `CronService`, `HeartbeatService`
- Providers: `PROVIDERS`, `LiteLLMProvider`, registry helpers
- Utilities: `getWorkspacePath`, `getWorkspacePathFromConfig`, `APP_NAME`, `APP_TAGLINE`, etc.
- Channel helpers used by server: `probeFeishu`

`nextclaw-server` will export:
- `startUiServer`
- UI router/config helpers

`nextclaw` will:
- Keep CLI entry
- Re-export core from `src/index.ts`

## Build/Publish
- Add build scripts for `nextclaw-core` and `nextclaw-server` (tsup + dts)
- Update root scripts to build core/server before CLI
- Keep `nextclaw` publishable; new packages can be private initially

## Validation
- `pnpm -C packages/nextclaw-core tsc`
- `pnpm -C packages/nextclaw-server tsc`
- `pnpm -C packages/nextclaw tsc`
- `pnpm -C packages/nextclaw build`
