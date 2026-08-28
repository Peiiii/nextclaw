# Service Apps

Service Apps let applications in NextClaw do more than display an interface. They can run local logic, persist application data, access approved network services, continue in the background, or expose a capability to both a Panel App and a selected Agent.

You still manage these capabilities through NextClaw. An App declares what it can do; NextClaw starts the runtime, shows risk information, handles grants, and manages App data.

## What Service Apps can do

The exact capabilities depend on the App. Service Apps currently support common patterns such as:

- **Persisting and changing App data**, such as tasks, notes, form records, and runtime state.
- **Running one operation**, such as a calculation, transformation, query, or update.
- **Accessing approved network services** declared by the App.
- **Remaining active in the background** for timers, polling, or host timer events.
- **Reusing another Service App capability** through an explicitly declared Provider.
- **Providing an Action to an Agent** after you grant that specific Action.

Each capability exposed by a Service App is an **Action**. A notes App might expose “list notes,” “save note,” and “delete note” instead of receiving unrestricted system access.

## How Service Apps work with Panel Apps

A Panel App owns the interface you see and use. A Service App owns the runtime logic behind that interface. Together they can form one complete App:

```text
You use a Panel App → the Panel requests an Action → NextClaw checks the grant → the Service App returns a result
```

A Panel is not the only caller. After a separate grant, an Agent can discover and call the same Action and work with the same App data.

## Where to manage them

Open **Service Apps** in NextClaw to see discovered services, their Actions, runtime status, and the declared risk for each Action.

| Status | Meaning |
| --- | --- |
| Not connected | The runtime has not started or Actions have not been discovered |
| Connecting | NextClaw is connecting to the Service App |
| Connected | Discovered Actions are available |
| Connection failed | Startup or runtime failed; inspect the error and retry |
| Stopped | The runtime is disconnected and can be connected again |

For a Service App installed as part of a NextClaw App, the page links back to App management. A workspace-source Service App can be removed directly.

## Get started

1. Find the service in **Service Apps**.
2. Select **Connect and discover actions**, then wait for the Connected state.
3. Use its Panel App. On the first Action call, review the source, purpose, input, and risk, then allow or reject it.
4. To make one capability available to an Agent, grant only that Action to the intended Agent.

NextClaw stores Panel and Agent grants separately. Allowing a Panel to call an Action does not grant it to every Agent.

## Supported runtime types

NextClaw currently supports two Service App protocols:

- **MCP**, which connects an MCP service and projects its tools as Service Actions.
- **WASM Component**, which uses Portable Runtime to execute Rust/WASM Components in a shared native runner.

Both appear in Service Apps and use the same Action, status, and grant experience.

## Next steps

- [Use Service Apps](/en/guide/service-apps-usage)
- [Service App permissions and data](/en/guide/service-app-permissions-data)
- [Portable Runtime](/en/developers/portable-runtime)
