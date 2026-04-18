# NextClaw Hermes ACP Bridge

This package contains Hermes-specific ACP bridge helpers.

It is intentionally separate from the generic
`@nextclaw/nextclaw-ncp-runtime-stdio-client` package so the stdio runtime stays
protocol-generic while Hermes keeps its own integration layer.

## Boundary

- This package exists to adapt Hermes into NextClaw. It is the primary place
  for NextClaw-side bridge logic, launch-time injection, and compatibility
  handling around Hermes ACP integration.
- Do not directly modify Hermes upstream source code when fixing NextClaw
  integration issues. In this repo, Hermes should be treated as an upstream
  dependency boundary.
- If Hermes behavior needs to be adjusted for NextClaw, prefer one of these
  layers instead:
  - bridge logic inside `packages/nextclaw-hermes-acp-bridge`
  - NextClaw runtime adapter logic
  - startup environment injection / wrapper behavior
  - repo-local documentation and guardrails

## Execution Model

- Hermes ACP execution in NextClaw is request-scoped, not session-agent-scoped.
- The long-lived ACP session keeps conversation history, cwd, selected model
  snapshot, lightweight session metadata, and the current execution agent.
- Each prompt treats `nextclaw_narp.providerRoute` as execution truth. When the
  prompt route changes, NextClaw rebuilds the Hermes execution agent for that
  request and replaces the session's current execution agent with the new one.
- `providerRoute` is the execution truth for Hermes ACP requests. NextClaw does
  not rely on ACP `setSessionModel(modelId)` to perform real cross-provider
  switching for Hermes.
- Request-scoped execution agents must rebuild Hermes's cached system prompt
  from the current route. They must not inherit a previous model/provider
  prompt cache across cross-provider switches.
