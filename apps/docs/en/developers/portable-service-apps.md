# Develop a WASM Service App

The official Portable Runtime path uses Rust and WebAssembly Components. NextClaw can generate a standalone project with the WIT contract, Rust guest, Panel, and Service manifests; ordinary App development does not require a NextClaw source checkout. Components run through the embedded Spin Runtime, while App authors use only the public `.napp`, WIT, and NDJSON contracts.

A Portable Service should be self-contained by default: include its Components, manifests, and build outputs in the `.napp` so it runs after installation. If it needs an external service such as Redis, declare it explicitly with `requires` in the Service manifest. The App is then shown as `needs-capability` or `needs-configuration` and enablement is blocked until it is bound to a compatible running Provider. A user or Agent can create that binding through the shared dependency commands, but NextClaw does not invent an unknown external-service installation or complete third-party authorization on the user's behalf. Never put credentials or connection strings in either the manifest or binding.

## Start from a runnable template

```bash
nextclaw app doctor --profile wasi
nextclaw app create ./my-counter --template rust-wasi
cd my-counter
nextclaw app build .
```

Use the App root for the whole development loop:

```bash
nextclaw app check .
nextclaw app test . --json
nextclaw app dev .
nextclaw app call . counter_increment --input '{"step":3}' --json
nextclaw app call . counter_read --json
```

The template computes the counter in Rust/WASM and persists it through host KV. The Panel and CLI call the same Actions.

## Prerequisites

Run `nextclaw app doctor --profile wasi` first. It checks for `cargo` and `rustc`, validates the supported Rust version, and confirms that the `wasm32-wasip2` target is installed. If the target is missing, the report includes the exact `rustup target add wasm32-wasip2` command.

Guest builds do not require separate `wasmtime`, `wkg`, `cargo-component`, or `wit-bindgen` CLI installations. The generated project pins `wit-bindgen` as a Rust dependency.

`app create` copies the current WIT contract into `guest/wit/portable-service.wit` and generates a locked `Cargo.lock`. A source checkout is only needed when maintaining the NextClaw Runtime or its built-in validation Apps.

The maintainer-side WIT contract and Rust guests live under:

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
└── service-components/
    └── notes-state/
        ├── service-app.json
        └── service.wasm
```

Use `runtime.profile: "wasi"` in `manifest.json` and list each Panel and Service under `components`. See [Runtime model and capability contracts](/en/developers/portable-runtime-contracts#owning-app-manifest). `app check` validates the package manifest, Panel references, and sibling Service Actions together.

## Implement the Rust guest

The Rust crate emits a `cdylib` and uses the pinned project-local `wit-bindgen` dependency for the `service-app` world:

```toml
[package]
name = "my-notes-service"
version = "0.1.0"
edition = "2024"
publish = false

[dependencies]
serde_json = "1.0"
wit-bindgen = "0.44.0"

[lib]
crate-type = ["cdylib"]

```

Generate bindings from the project-local WIT contract and implement the `Guest` trait with the Action list, invocation entry point, and lifecycle methods:

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

## Build the Component

Build from the App root:

```bash
nextclaw app build .
```

The command runs `cargo build --locked --release --target wasm32-wasip2` and copies the Component to `service-components/<service-id>/service.wasm`. Its report names the output file, which is immediately ready for `app check` and `app test`.

NextClaw provides the native runner for the current platform. App developers build one portable `.wasm` Component instead of building separate runners for Windows, Linux, and macOS.

Runtime maintainers use `pnpm portable-runtime:build` from the NextClaw source root to build platform runtimes and built-in validation Components. App authors cannot dynamically load arbitrary third-party Spin Factors through the public API. For an additional host capability, use a supported Factor or Native Provider, or choose a `native-process` Service.

## Declare Panel Actions

A Panel's `panel-app.json` lists full Action ids in `actions`:

```json
{
  "id": "notes-panel",
  "title": "Notes",
  "entry": "index.html",
  "actions": ["notes-state.notes_list", "notes-state.note_save"]
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

Run the static check, start through the real runtime, and call one selected Action from the complete App root:

```bash
nextclaw app check <app-dir>
nextclaw app test <app-dir> --json
nextclaw app dev <app-dir>
nextclaw app call <app-dir> notes_list --input '{}' --json
```

`app test` executes the real Action sequence declared in the generated `tests/service-smoke.json`. Each step can define input and output assertions, so persistence behavior can be verified without writing runner-protocol JSON by hand.

A package with one Service is selected automatically; use `--component <service-id>` when it contains multiple Services. The second positional argument to `app call` is the Guest Action name, not the full Action id, and input must be a JSON object. `app dev` and `app call` use an isolated development instance tied to the source location and read storage, domain, and Provider declarations from that schema v2 App. To reset only that development instance before starting:

```bash
nextclaw app dev <app-dir> \
  --reset-data \
  --confirm <app-id> \
  --json
```

If the Service is already live in the NextClaw UI, restart that App's live runtime before testing the Panel path:

```bash
nextclaw app restart <app-id> --json
```

Normal Service source or manifest changes do not require restarting the NextClaw host.

## Package, install, and enable

```bash
nextclaw app pack . --out my-counter.napp
nextclaw app install ./my-counter.napp --json
nextclaw app enable nextclaw.my-counter --json
```

Local directories and `.napp` bundles accept relative paths. Installation and enablement run through the active NextClaw host; on failure the CLI preserves the server error code and reason.

Rust/WASI Apps without platform-native files produce a `universal` artifact by default, so `--target` is unnecessary. Select a target explicitly only when the package really contains platform-specific resources.

If an App declares a capability or resource, inspect and bind its Provider before enablement:

```bash
nextclaw app dependencies inspect nextclaw.my-counter --json
nextclaw app dependencies setup nextclaw.my-counter --json
nextclaw app dependencies verify nextclaw.my-counter --json
nextclaw app enable nextclaw.my-counter --json
```

`setup` selects a Provider only when exactly one compatible candidate exists. Use `dependencies bind` to make an explicit choice when several are available. Bindings cannot change while the Consumer is running, and a Provider used by an enabled Consumer cannot be disabled or uninstalled.

## Errors and runtime observations

WASI failures retain stable error codes across the Panel, CLI, and HTTP API:

| Code                         | Meaning                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| `WASI_CAPABILITY_DENIED`     | The Guest requested storage, network, or host capabilities not granted by the manifest |
| `WASI_INPUT_SCHEMA_MISMATCH` | The Action input does not match its contract                                           |
| `WASI_GUEST_EXPORT_MISSING`  | An Action declared in the manifest is not exported by the Guest                        |
| `WASI_ABI_VERSION_MISMATCH`  | The Guest is incompatible with the current WIT/ABI contract                            |
| `WASI_COMPONENT_TRAP`        | Guest execution trapped                                                                |
| `WASI_COMPONENT_FAILED`      | Another Component runtime failure occurred                                             |

`nextclaw app call ... --json` also returns an `observation` with the operation, App id, Action duration, runner PID, memory sampling when available, and a bounded Service log tail. Capability denials and traps therefore retain actionable diagnostics instead of collapsing into an unexplained generic 409/502.

## Development checklist

- The Service id matches its directory, and the Component path stays inside the package.
- Manifest Actions exactly match `list-actions()`.
- Every Action has an accurate risk, purpose, and minimal `inputSchema`.
- The App declares only the required storage, domains, and Providers.
- `app build`, `app check`, `app test`, and `app dev` pass from the App root, and at least one safe or explicitly selected critical Action is called.
- The Panel declares only the full Action ids it actually calls.
- Persistent, Resident, or Provider behavior is tested through one real stop-and-recovery cycle.

The complete in-repository reference is `packages/nextclaw/resources/apps/nextclaw-portable-runtime-lab`. It is a development validation App, not the product definition of Portable Runtime.
