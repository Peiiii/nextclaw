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

Expose command adapters under `runtime.commands`:

- `runtime.commands.gateway.run(...)`
- `runtime.commands.ui.run(...)`
- `runtime.commands.start.run(...)`
- `runtime.commands.restart.run(...)`
- `runtime.commands.serve.run(...)`
- `runtime.commands.stop.run(...)`
- `runtime.commands.companion.start(...)`
- `runtime.commands.service.installSystemd(...)`
- `runtime.commands.plugins.list(...)`
- `runtime.commands.config.get(...)`
- `runtime.commands.mcp.add(...)`
- `runtime.commands.secrets.audit(...)`
- `runtime.commands.channels.status(...)`
- `runtime.commands.cron.list(...)`
- `runtime.commands.agents.list(...)`
- `runtime.commands.agents.create(...)`
- `runtime.commands.agents.update(...)`
- `runtime.commands.agents.remove(...)`
- `runtime.commands.skills.install(...)`
- `runtime.commands.diagnostics.status(...)`
- `runtime.commands.logs.tail(...)`
- `runtime.commands.usage.show(...)`

Gateway runtime capabilities are not part of `NextclawServiceRuntime`. They only exist during a concrete gateway startup. `startGatewayUiShell` builds one complete `NextclawGatewayRuntime` for that startup and passes it to `startUiServer`.

The gateway runtime includes:

- `gateway.configPath`
- `gateway.applyLiveConfigReload(...)`
- `gateway.cronService`
- `gateway.ncpAgent`
- `gateway.ncpSessionService`
- `gateway.remoteAccess`
- `gateway.runtimeControl`
- `gateway.runtimeUpdate`
- `gateway.webhook`
- `gateway.getBootstrapStatus(...)`
- `gateway.getPluginChannelBindings(...)`
- `gateway.getPluginUiMetadata(...)`

Do not hang gateway runtime state on `NextclawServiceRuntime` during construction. That creates a partially initialized object and couples consumers to startup order. Cross-module CLI registration boundaries should pass `nextclaw` itself; UI server startup should pass the concrete gateway runtime for that startup.

`commands` is the adapter boundary for CLI registration and user command handlers. It is not a wrapper layer around gateway capabilities.

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
- CLI registration helpers receive the whole `runtime` object and read from `runtime.commands` internally.
- Component methods use concise names within their own owner, such as `commands.plugins.list()` instead of `plugins.pluginsList()`.
- TypeScript, ESLint, governance checks, and a minimal CLI smoke pass.
