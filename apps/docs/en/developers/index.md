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
| [Portable Runtime](./portable-runtime) | Execution model, roles, host capabilities, and current boundaries |
| [Runtime model and capability contracts](./portable-runtime-contracts) | WIT, manifests, lifecycle, timeout, and recovery semantics |
| [Develop a WASM Service App](./portable-service-apps) | Rust guest, App layout, Panel calls, and CLI development |

[Start with Portable Runtime](./portable-runtime)
