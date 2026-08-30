# Build a Portable Service App

The supported authoring path is Rust plus a WASI Component. Start from the generated package instead of assembling a runner command or WIT files by hand.

## Create and prepare the project

```bash
nextclaw app doctor --profile wasi
nextclaw app create ./reading-log --template rust-wasi
cd ./reading-log
nextclaw app build . --json
```

`doctor` checks `cargo`, `rustc`, and the `wasm32-wasip2` target. The Rust target is the only additional target required for the generated Component flow; guest dependencies are pinned in `guest/Cargo.lock`.

The template contains a schema v2 package, a small Panel, `service-components/<id>/service-app.json`, `guest/` Rust source, copied WIT packages, and `tests/service-smoke.json`. Treat the copied WIT directory as part of the package's versioned contract.

## Implement Actions

Each Action is declared in `service-app.json` and returned by `list-actions` in the Rust guest. `invoke` receives the Action name and a JSON object. Return a JSON string on success and a concise code-prefixed error on failure.

```rust
fn invoke(action: String, input_json: String) -> Result<String, String> {
    match action.as_str() {
        "entry_save" => {
            let input: serde_json::Value = serde_json::from_str(&input_json)
                .map_err(|_| "INVALID_INPUT: expected an object".to_string())?;
            // Validate the business fields, use only declared capabilities,
            // and return a JSON result.
            Ok(serde_json::json!({ "saved": true }).to_string())
        }
        _ => Err(format!("UNKNOWN_ACTION: {action}")),
    }
}
```

Do not use an Action as an untyped RPC tunnel. Give each Action a narrow `inputSchema`, an accurate `risk`, and a timeout appropriate to the real operation. The Panel should declare only the full Action ids it calls.

## Build, check, test, and call

```bash
nextclaw app build . --json
nextclaw app check . --json
nextclaw app test . --json
nextclaw app dev . --json
nextclaw app call . entry_save --input '{"title":"A title"}' --json
```

`build` compiles the guest and writes the declared `service.wasm`. `check` validates the complete package: root manifest, sibling Components, Panel Action references, and the Component/manifest Action contract. `test` runs the smoke fixture through the real runtime. `dev` starts an isolated development instance; `call` invokes one Guest Action through that instance.

For a package with more than one Service, select it explicitly:

```bash
nextclaw app call . entry_save --component reading-log --input '{"title":"A title"}' --json
```

To reset only the development instance, not every installed App:

```bash
nextclaw app dev . --reset-data --confirm <app-id> --json
```

## Choose a lifecycle deliberately

- **Action**: use for ordinary request/response work.
- **Resident**: use when the Component must receive durable events. Implement event handling to acknowledge a completed event or request retry; repeated delivery must be safe.
- **Provider**: use when another declared Component depends on a stable capability you offer.

Use the matching WIT world supplied with the package. A legacy Action Component must remain compatible with `service-app`; a new durable Resident uses `service-app-v2` only when that world is supplied by the target runtime. Run `app check` and `app test` against the target product version rather than guessing from a source checkout.

## Add a Panel, Agent, or external dependency

A Panel invokes an Action through the injected bridge:

```js
const entry = await window.nextclaw.serviceActions.invoke(
  "reading-log.entry_save",
  { title: "A title" },
);
```

Panels run inside an isolated iframe. Do not call `fetch("/api/...")` directly from a Panel. Use the injected read-only bridge for runtime evidence and acceptance status as well:

```js
const records = await window.nextclaw.verificationRecords.list({ appId: "reading-log", limit: 20 });
const status = await window.nextclaw.portableRuntimeAcceptance.status({ locale: "en" });
```

This preserves opaque-origin iframe isolation while the host validates the active Panel session. A Panel does not need, and must not request, `allow-same-origin`.

Granting a declared Action to an Agent exposes the same input and output contract. Keep Agent-appropriate Actions small and explicit.

For another Component, declare a Provider requirement and compatible WIT contract. For a model or Agent, declare a named slot under `requires.modelSlots` or `requires.agentSlots`; the installed host binds it separately. For a service such as Redis, declare an external resource as a visible requirement and provide an Agent-operable setup Action where possible. Do not hide an external dependency behind a successful package install.

## Package only after the real loop passes

```bash
nextclaw app pack . --out reading-log.napp --json
nextclaw app validate-publish . --json
```

Continue with [Capabilities and security](/en/developers/portable-runtime-contracts) and [Package and distribute](/en/developers/portable-runtime-distribution).
