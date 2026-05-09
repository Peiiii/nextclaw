# Service Runtime Component API

## Goal

`NextclawServiceRuntime` is the composition root for the CLI-facing service runtime. Its API should expose real runtime components directly instead of flattening every command into another wrapper method.

This is a refactor, not a new user feature. The expected result is less forwarding code and a clearer ownership model.

## Shape

Keep lifecycle and orchestration operations at the runtime root:

- `runtime.init(...)`
- `runtime.login(...)`
- `runtime.account.status(...)`
- `runtime.account.setUsername(...)`
- `runtime.agent(...)`
- `runtime.update(...)`
- `runtime.remote`

Expose command components as first-level runtime properties:

- `runtime.gateway.run(...)`
- `runtime.ui.run(...)`
- `runtime.start.run(...)`
- `runtime.restart.run(...)`
- `runtime.serve.run(...)`
- `runtime.stop.run(...)`
- `runtime.companion.start(...)`
- `runtime.service.installSystemd(...)`
- `runtime.plugins.list(...)`
- `runtime.config.get(...)`
- `runtime.mcp.add(...)`
- `runtime.secrets.audit(...)`
- `runtime.channels.status(...)`
- `runtime.cron.list(...)`
- `runtime.agents.list(...)`
- `runtime.skills.install(...)`
- `runtime.diagnostics.status(...)`
- `runtime.logs.tail(...)`
- `runtime.usage.show(...)`

Do not add a `commands` namespace. It would be another wrapper layer and does not add ownership.

## Boundaries

The runtime may keep internal infrastructure private:

- workspace manager
- restart coordinator
- runtime command service
- platform auth command owner
- remote command owner

The runtime should not duplicate public methods that only forward to a component.

## Acceptance

- CLI registration uses first-level runtime components.
- `NextclawServiceRuntime` no longer contains flat wrappers such as `pluginsList`, `configGet`, `mcpAdd`, `cronRun`, `logsTail`, or `usageShow`.
- Component methods use concise names within their own owner, such as `plugins.list()` instead of `plugins.pluginsList()`.
- TypeScript, ESLint, governance checks, and a minimal CLI smoke pass.
