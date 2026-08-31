# Portable Runtime capabilities and security

Portable Runtime has two contracts. The package and Service manifests say what an App requests. The WIT world says how a Component calls the host and exposes Actions. A declaration alone does not grant access: NextClaw resolves each request to an installed-App capability snapshot.

## Package manifest: request only what you use

```json
{
  "schemaVersion": 2,
  "id": "example.reading-log",
  "name": "Reading log",
  "version": "0.1.0",
  "runtime": { "profile": "wasi" },
  "distribution": { "mode": "universal" },
  "storage": { "scope": "global", "schemaVersion": 1 },
  "permissions": {
    "storage": { "namespace": "reading-log" },
    "allowedDomains": ["api.example.com"],
    "documentAccess": [
      { "id": "library", "mode": "read", "description": "Read selected documents." }
    ],
    "secrets": [
      { "id": "api-token", "title": "API token", "description": "Access the configured API.", "required": true }
    ]
  },
  "components": [
    { "kind": "service", "path": "service-components/reading-log" }
  ]
}
```

`documentAccess` is a request for a named folder, not a path embedded in the package. `secrets` declares slot metadata only. The host stores a non-sensitive reference and resolves the value immediately before the runner starts; neither field is a place for credentials.

## Capability matrix

| Request or interface | Guest receives | Boundary and expected failure |
| --- | --- | --- |
| `permissions.storage` | private App data, standard WASI key-value and SQLite stores | isolated per App instance; no other App's data |
| `permissions.documentAccess` | preopened `/documents/<scope>` directory | only a granted canonical directory; writes require `read-write`; missing access becomes `WASI_CAPABILITY_DENIED` |
| packaged assets | read-only `/app` when assets exist | no write access to the package |
| private runtime directories | `/data`, `/cache`, `/tmp` | scoped to the installed App instance |
| `permissions.allowedDomains` | standard WASI outgoing HTTP | destination and redirects are checked; private targets are denied |
| `permissions.secrets` | named values via standard WASI configuration | required unbound slots fail with `SECRET_BINDING_MISSING`; unresolved values fail with `SECRET_RESOLUTION_FAILED` |
| `requires.capabilities` or `resources` | a declared Provider binding or resource readiness | missing or ambiguous dependencies prevent enablement |
| `requires.modelSlots` / `agentSlots` | an installed-host model or Agent binding | slots are non-secret grants; a Guest-facing host-call is only available when the shipped WIT version declares it |
| `provides.capabilities` | a stable Provider contract for consumers | Provider identity, version, and WIT compatibility are checked before binding |

The runner supports standard WASI filesystem, HTTP, key-value, SQLite, clocks, and configuration interfaces when they are included in the guest's WIT workspace. Always use the exact WIT packages copied by `nextclaw app create` or supplied with the target runtime; do not copy imports from a different NextClaw version into a package and assume ABI compatibility.

## Service manifest and Actions

```json
{
  "id": "reading-log",
  "title": "Reading log",
  "protocol": "wasi-component",
  "component": { "entry": "service.wasm" },
  "lifecycle": { "mode": "action" },
  "actions": {
    "entry_save": {
      "title": "Save reading entry",
      "risk": "write",
      "timeoutMs": 7000,
      "inputSchema": { "type": "object", "required": ["title"] }
    }
  }
}
```

An Action's manifest name must agree with the Component's `list-actions` export. The full name used by a Panel is `<service-id>.<action-name>`. Use `read`, `write`, `external`, or `dangerous` accurately: the risk is part of the user and Agent approval decision.

The public `nextclaw:portable-service` WIT package exports `list-actions`, `invoke`, `start`, `handle-event`, and `stop`. The host import includes structured logging, the original host KV and HTTP helpers for compatibility, Provider calls, runtime information, and job progress/cancellation helpers. New durable Residents use the `service-app-v2` world when it is present; legacy `service-app` Components remain supported through the compatibility path.

## Lifecycle and composition

| Mode | Use it for | Contract |
| --- | --- | --- |
| `action` | A request that starts and returns a result | default mode |
| `resident` | A long-lived Component that receives durable events | one ordered delivery lane; the guest acknowledges or asks for retry; events can become dead letters |
| `provider` | A capability used by another declared Component or App | start before consumers and stop after them |

For a capability requirement, name the capability and compatible WIT contract in `requires.capabilities`. For a same-package Provider, set `provider` to the sibling service id. For an external Provider, use the installed dependency binding flow. A Provider may not recursively call another Provider.

## Security and compatibility rules

- Treat every manifest field as a request, not a capability token.
- Use the smallest folder, domain, secret slot, timeout, and input schema that serve the Action.
- Never put a password, token, connection string, host path, or private user data in a manifest, Action result, log, Job chunk, or verification record.
- Do not rely on arbitrary environment variables, sockets, or a current-user filesystem path. They are not a Portable Runtime contract.
- Treat WIT package name, interface, and version as compatibility data. `app check` and `app test` should run before an App is packed.

Related: [Build a Service App](/en/developers/portable-service-apps) · [Jobs, events, and observations](/en/developers/portable-runtime-observability)
