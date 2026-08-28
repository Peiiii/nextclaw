# Develop a WASM Service App

The official Portable Runtime path currently uses Rust and WebAssembly Components. This guide follows a NextClaw source checkout: implement a Rust guest, declare it as a Service Component in a schema v2 App, and use the NextClaw CLI against the real runtime.

## Prerequisites

Install the Rust toolchain, `cargo-component`, the `wasm32-wasip2` target, and the Node.js and pnpm dependencies for the NextClaw source tree.

The repository's WIT contract and Rust guests live under:

```text
apps/nextclaw-wasmtime-runner/
├── wit/portable-service.wit
└── guests/
```

## App layout

An App with a Panel and Portable Service can use this layout:

```text
my-app/
├── manifest.json
├── panels/
│   └── notes.panel/
│       ├── panel-app.json
│       └── index.html
└── services/
    └── notes-state/
        ├── service-app.json
        └── service.wasm
```

Use `runtime.profile: "wasi"` in `manifest.json` and list each Panel and Service under `components`. See [Runtime model and capability contracts](/en/developers/portable-runtime-contracts#owning-app-manifest).

## Implement the Rust guest

The Rust crate emits a `cdylib`, and `cargo-component` targets the repository's `service-app` world:

```toml
[package]
name = "my-notes-service"
version = "0.1.0"
edition = "2024"
publish = false

[dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
wit-bindgen-rt = { version = "0.44.0", features = ["bitflags"] }

[lib]
crate-type = ["cdylib"]

[package.metadata.component]
package = "nextclaw:portable-service"
target = { path = "../../wit", world = "service-app" }
```

Implement the generated `Guest` trait with the Action list, invocation entry point, and lifecycle methods:

```rust
impl Guest for NotesService {
    fn list_actions() -> Vec<Action> {
        vec![Action {
            name: "notes_list".into(),
            title: "List notes".into(),
            description: "Returns saved notes".into(),
        }]
    }

    fn invoke(action: String, _input_json: String) -> Result<String, String> {
        match action.as_str() {
            "notes_list" => Ok(host::kv_get("notes")?.unwrap_or_else(|| "[]".into())),
            _ => Err(format!("unknown action: {action}")),
        }
    }

    fn start(_config_json: String) -> Result<String, String> { Ok("{}".into()) }
    fn handle_event(_event_json: String) -> Result<String, String> {
        Err("this Action Component does not handle events".into())
    }
    fn stop(_reason_json: String) -> Result<String, String> { Ok("{}".into()) }
}
```

The in-repository `state-lab`, `resident-lab`, `provider-lab`, and `composition-lab` guests provide complete KV, Resident, Provider, and composition examples.

## Build Components and the runner

From the NextClaw repository root:

```bash
pnpm portable-runtime:build
```

This builds the five repository guests and the native runner for the current platform, then syncs artifacts into NextClaw's standard resource locations. It is a source-development command, not a separately published third-party SDK command.

For a guest developed inside the runner workspace, you can also use `cargo component build --release` and copy the artifact to the path referenced by `component.entry`.

## Declare Panel Actions

A Panel's `panel-app.json` lists full Action ids in `actions`:

```json
{
  "id": "notes-panel",
  "title": "Notes",
  "entry": "index.html",
  "actions": [
    "notes-state.notes_list",
    "notes-state.note_save"
  ]
}
```

Use the host-injected bridge to retain the first-call grant prompt and automatic retry behavior:

```js
const notes = await window.nextclaw.serviceActions.invoke(
  "notes-state.notes_list",
  {},
);
```

`invoke()` returns the business payload directly, not a `{ result }` wrapper.

## Check and run

Run the static check, start through the real runtime, and call one selected Action:

```bash
nextclaw app check <service-app-dir>
nextclaw app dev <service-app-dir>
nextclaw app call <service-app-dir> notes_list --input '{}' --json
```

`app dev` and `app call` use an isolated development instance tied to the source location and read storage, domain, and Provider declarations from the owning schema v2 App. To reset only that development instance before starting:

```bash
nextclaw app dev <service-app-dir> \
  --reset-data \
  --confirm <app-id> \
  --json
```

If the Service is already live in the NextClaw UI, restart that App's live runtime before testing the Panel path:

```bash
nextclaw app restart <app-id> --json
```

Normal Service source or manifest changes do not require restarting the NextClaw host.

## Development checklist

- The Service id matches its directory, and the Component path stays inside the package.
- Manifest Actions exactly match `list-actions()`.
- Every Action has an accurate risk, purpose, and minimal `inputSchema`.
- The App declares only the required storage, domains, and Providers.
- `app check` and `app dev` pass, and at least one safe or explicitly selected critical Action is called.
- The Panel declares only the full Action ids it actually calls.
- Persistent, Resident, or Provider behavior is tested through one real stop-and-recovery cycle.

The complete in-repository reference is `packages/nextclaw/resources/apps/nextclaw-portable-runtime-lab`. It is a development validation App, not the product definition of Portable Runtime.
