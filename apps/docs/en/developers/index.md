# NextClaw developers

NextClaw currently provides two developer surfaces. Harness SDK integrates Agents, Sessions, and Runs into programs or scripts. Portable Runtime builds WASM Service Apps managed by NextClaw.

## Harness SDK

Use Harness SDK to run NextClaw tasks from a Node.js process or the CLI with shared Session, event, and result semantics.

| Entry point | Use it for |
| --- | --- |
| [Harness API](./harness) | Node.js applications, services, and long-lived processes |
| [`nextclaw exec`](./exec) | Shell, CI, scheduled jobs, and pipelines |
| [Platform capabilities](./platform-capabilities) | Register tools, context, models, runtimes, and MCP |

[Get started with Harness SDK](./harness)

## Portable Runtime

Implement a Service App business Component in Rust and run it in NextClaw's shared native runner. Panels, Agents, and the CLI can use the same Service Actions.

| Document | What it covers |
| --- | --- |
| [Portable Runtime](./portable-runtime) | When to use a portable Component and how the host-mediated runtime is structured |
| [Capabilities and security](./portable-runtime-contracts) | Manifest requests, WIT, files, storage, network, secrets, AI slots, and Providers |
| [Build a Service App](./portable-service-apps) | Rust guest, package layout, and the create/build/check/test loop |
| [Jobs, events, and observations](./portable-runtime-observability) | Long work, Resident delivery, redacted runtime facts, and recovery |
| [Package and distribute](./portable-runtime-distribution) | Universal `.napp` packages, supported platforms, updates, and explicit external dependencies |

[Start with Portable Runtime](./portable-runtime)
