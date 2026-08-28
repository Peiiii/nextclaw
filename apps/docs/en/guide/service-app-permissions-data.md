# Service App permissions and data

NextClaw separates a Service App's host capabilities, caller grants, and managed data. Enabling an App does not automatically grant every Action to every Panel or Agent.

## Three boundaries

| Boundary | What it controls | Where it is declared or approved |
| --- | --- | --- |
| App permissions | Which primitive host capabilities the App may request | The App manifest, such as storage and allowed domains |
| Panel grants | Whether one Panel may call a declared Action | Approved by the user on first call |
| Agent grants | Whether one Agent can discover and call one Action | Granted per Action in Service Apps |

These boundaries do not replace each other. Declaring storage allows the runtime to offer storage to the App; a Panel or Agent can still call only an Action it is allowed to use.

## Action risk types

Each Action declares a risk type that NextClaw displays in the Action list and grant prompt.

| Type | What it communicates |
| --- | --- |
| `read` | Primarily reads or queries data |
| `write` | Creates, changes, or deletes data |
| `external` | Interacts with an external service |
| `dangerous` | May have higher impact and deserves extra review |

The type is the developer's classification. Always review the Action's source, purpose, and input as well.

## Network access

A WASM Service App does not receive direct host networking. Its owning App declares `allowedDomains`, and the Component makes requests through the host-mediated HTTPS GET capability. Non-HTTPS URLs and undeclared destinations are rejected.

Portable Runtime currently exposes only mediated HTTPS GET, not the host's general native network access.

## Managed data

When the owning App declares storage, a WASM Component can use host-provided key-value storage. The data lives in a NextClaw-managed App instance, separate from replaceable App code.

As a result:

- closing a Panel does not delete data;
- updating App code continues with the existing managed instance;
- disabling an App stops its runtime capabilities without clearing data;
- uninstalling or removing an App can keep its data;
- managed data is permanently deleted only after an explicit delete choice.

The current App manifest supports global storage scope, allowing an App's Panels and authorized Agents to work with the same data through Service Actions.

## Uninstall and retained data

NextClaw offers two explicit removal choices:

- **Keep data** removes App code and retains its managed instance for a later reinstall.
- **Delete app and data** removes both after destructive confirmation.

Before confirmation, NextClaw shows the managed path and usage for data, config, state, cache, temporary files, and logs. A retained instance remains visible in App management for later cleanup.

Files or folders granted to an App outside its managed instance are outside this cleanup flow and are not deleted with App data.

## Inspect and delete with the CLI

List App data through the running NextClaw host:

```bash
nextclaw app data list --json
```

Permanently delete an instance that is already `retained`:

```bash
nextclaw app data delete <data-id> --confirm <app-id> --json
```

Copy the opaque `data-id` from the latest list and make `--confirm` exactly match the App id. Active instances cannot be deleted with this command. Do not remove managed storage directories by hand.

## Current security boundary

Portable Runtime uses host-mediated capabilities to limit what a Component can request, but it is not yet a production security sandbox for untrusted code. CPU, memory, and concurrency isolation remain incomplete, and secrets, files, and blobs are not part of the public Component contract.

Continue with [Use Service Apps](/en/guide/service-apps-usage) and [Runtime model and capability contracts](/en/developers/portable-runtime-contracts).
