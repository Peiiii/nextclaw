# Runtime model and capability contracts

Portable Runtime has two public boundaries. WIT defines communication between a Component and the host. App and Service manifests define available capabilities, runtime role, and caller-facing Actions. The implementation uses embedded Spin Runtime Factors for host linking; this does not change the public `.napp`, WIT, or NDJSON contracts.

## WIT world

The current package is `nextclaw:portable-service@0.1.0`, with the `service-app` world.

### Component exports

| Export | Purpose |
| --- | --- |
| `list-actions()` | Return runtime Action names, titles, and descriptions |
| `invoke(action, input-json)` | Call one Action and return a JSON string or error |
| `start(config-json)` | Start the Component lifecycle |
| `handle-event(event-json)` | Handle an event delivered to a Resident |
| `stop(reason-json)` | Stop the current instance |

NextClaw compares `list-actions()` with `service-app.json`. An Action is `matched` when both sides agree, `missing` when only the manifest declares it, and `undeclared` when only the runtime exposes it.

### Host imports

| Import | Purpose | Boundary |
| --- | --- | --- |
| `log(level, message)` | Write a debug, info, warn, or error log | Structured log level |
| `kv-get(key)` | Read a host-managed string | The owning App must declare storage |
| `kv-set(key, value)` | Write a host-managed string | Stored in the managed App instance |
| `http-get(url)` | Return HTTP status and text body | HTTPS only; destination must match `allowedDomains` |
| `component-call(provider-id, action, input-json)` | Call a Provider Action | The consumer must declare the Provider id |
| `get-runtime-info()` | Return runner pid, loaded count, and Component id | Runtime diagnostics |

The WIT contract does not currently expose files, secrets, arbitrary sockets, model calls, or Agent calls.

## Service manifest

Each WASM Service directory contains `service-app.json` and the referenced `.wasm` file:

```json
{
  "id": "notes-state",
  "title": "Notes state",
  "description": "Stores and retrieves notes.",
  "protocol": "wasi-component",
  "component": { "entry": "service.wasm" },
  "lifecycle": { "mode": "action" },
  "actions": {
    "notes_list": {
      "title": "List notes",
      "description": "Returns saved notes.",
      "risk": "read"
    },
    "note_save": {
      "title": "Save note",
      "description": "Creates or updates one note.",
      "risk": "write",
      "inputSchema": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "text": { "type": "string" }
        },
        "required": ["id", "text"],
        "additionalProperties": false
      },
      "timeoutMs": 7000
    }
  }
}
```

Key constraints:

- `id` is kebab-case and matches the Service directory name;
- `protocol` is `wasi-component`;
- `component.entry` is a package-relative `.wasm` path;
- `actions` is non-empty and each Action should declare `risk`;
- `timeoutMs` accepts an integer from 100 to 300000 milliseconds; the current default is 7000;
- the full Action id is `<service-id>.<action-name>`.

## Lifecycle declarations

Action is the default role:

```json
{ "lifecycle": { "mode": "action" } }
```

A Resident keeps its instance and receives host events. `eventIntervalMs` must be an integer from 250 to 60000:

```json
{ "lifecycle": { "mode": "resident", "eventIntervalMs": 1000 } }
```

A Provider keeps an independent instance:

```json
{ "lifecycle": { "mode": "provider" } }
```

A consumer must declare kebab-case Provider service ids:

```json
{ "providers": ["contact-provider"] }
```

Providers cannot currently call another Provider recursively.

An independent Provider App can also declare a stable capability contract. `provides` is valid only on a Service with `lifecycle.mode: "provider"`:

```json
{
  "lifecycle": { "mode": "provider" },
  "provides": {
    "capabilities": [
      {
        "id": "contacts.normalize",
        "version": "1",
        "resourceTypes": ["contacts"]
      }
    ]
  }
}
```

The runtime binding identity is still the Provider Service id. A replacement implementation must expose the same stable Service id; dynamic capability aliases that route to arbitrary implementations are not yet public.

## Declaring external requirements

A Service should not depend on services outside its package by default. When it must, it can explicitly declare an external capability or resource. These declarations describe the dependency only; they never carry credentials, connection strings, or installation commands:

```json
{
  "requires": {
    "capabilities": [
      {
        "id": "redis",
        "title": "Redis capability",
        "description": "Requires a trusted Redis capability provider."
      }
    ],
    "resources": [
      {
        "binding": "primary-database",
        "type": "redis",
        "title": "Primary Redis",
        "description": "A Redis resource must be configured before enablement."
      }
    ]
  }
}
```

An App with required external dependencies is shown as `needs-capability` or `needs-configuration` in the App list and details, and cannot be enabled until the requirement is satisfied. NextClaw matches capability versions and resource types against installed, enabled, and running Providers. A unique candidate can be bound automatically; multiple candidates require an explicit choice:

```bash
nextclaw app dependencies inspect <app-id> --json
nextclaw app dependencies setup <app-id> --json
nextclaw app dependencies bind <app-id> \
  --component <service-id> \
  --kind capability \
  --requirement contacts.normalize@1 \
  --provider <provider-service-id> \
  --json
nextclaw app dependencies verify <app-id> --json
```

Bindings live in the Consumer instance's managed configuration directory and contain only the Component, requirement, and Provider Service id. The file mode is `0600`; passwords, tokens, connection strings, and install commands are never stored there. Disable the Consumer before changing bindings so its live allowlist cannot diverge from disk. A Provider used by an enabled Consumer cannot be disabled or uninstalled.

Agents use the same Kernel owner as the CLI and HTTP API for inspect, setup, bind, verify, and unbind. Mutation tools require the caller to declare that the user has already authorized the change. NextClaw does not invent an unknown external-service installation or complete login, payment, or third-party authorization on the user's behalf. A Provider backed by Redis or another heavy external resource should expose setup through its own Service Actions and the existing Secret owner, leaving only non-delegable steps to the user. App authors should still provide a self-contained path whenever possible.

## Owning App manifest

A Portable Service belongs to a schema v2 NextClaw App and is listed in `components`:

```json
{
  "schemaVersion": 2,
  "id": "example.notes",
  "name": "Notes",
  "version": "0.1.0",
  "engines": { "nextclaw": ">=0.43.0" },
  "runtime": { "profile": "wasi" },
  "distribution": { "mode": "universal" },
  "storage": { "scope": "global", "schemaVersion": 1 },
  "permissions": {
    "storage": { "namespace": "notes" },
    "allowedDomains": ["api.example.com"]
  },
  "components": [
    { "kind": "service", "path": "services/notes-state" }
  ]
}
```

The runner currently consumes `permissions.storage` and `permissions.allowedDomains`. Do not infer Component APIs for other App permissions.

## Calls and failures

`invoke` input and successful output are JSON strings. The Service Action layer validates structure against `inputSchema` and projects Component errors as call failures.

If a call exceeds `timeoutMs`, the Kernel terminates the shared runner, fails unfinished calls, and restores persistent Providers and Residents. Because a timeout cannot prove whether a write already happened, the Kernel does not automatically replay the failed call.

Continue with [Develop a WASM Service App](/en/developers/portable-service-apps).
