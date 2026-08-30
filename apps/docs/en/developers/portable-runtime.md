# Portable Runtime

Portable Runtime is the WebAssembly Component path for a NextClaw Service App. You package a Rust/WASI guest, a Service manifest, and optionally a Panel in one schema v2 `.napp`. NextClaw runs the Component through its bundled native runner and mediates every host resource at the App boundary.

This is not a general-purpose container. A Component receives only the storage, folders, domains, secret slots, Providers, and AI slots declared by its package and bound by the installed host. That boundary is what lets one App artifact run on supported platforms without giving the guest the current user's full environment.

## Choose the right Service type

| Use Portable Runtime when | Use a native-process Service when |
| --- | --- |
| The Service can run as a Rust/WASI Component | It must launch a platform program or reuse a Node, Python, or other full runtime directly |
| You want a universal `.napp` with a host-mediated capability boundary | The integration genuinely needs an external daemon, SDK, driver, or system command |
| KV, SQLite, approved HTTP, files granted by the user, configuration values, or declared Providers cover the task | The deployment must manage an external dependency such as Redis; declare it explicitly and make setup visible |

Portable Runtime is preferred for self-contained Apps. An external dependency is supported only as an explicit, visible exception: it must not make a user guess what to install or place credentials in a manifest.

## Architecture

```text
Panel / Agent / nextclaw CLI
            │ declared Action
            ▼
  NextClaw Kernel: grants, bindings, lifecycle, evidence
            │ resolved capability snapshot
            ▼
 bundled Spin-based runner ── WIT ── Rust/WASI Component
```

The same Kernel owner handles calls from a Panel, Agent, and CLI. It validates the Action schema, resolves grants at call time, starts or reuses the appropriate runtime lane, and writes a redacted verification record. The guest never receives host configuration files, arbitrary process environment, or a direct route around those checks.

## What you build

A minimal package contains:

```text
my-app/
├── manifest.json
├── panels/<panel-id>.panel/       # optional user interface
├── service-components/<service-id>/
│   ├── service-app.json
│   └── service.wasm
├── guest/                         # Rust source, Cargo.lock, copied WIT packages
└── tests/service-smoke.json
```

Create one with `nextclaw app create ./my-app --template rust-wasi`. Then use the package root for `build`, `check`, `test`, `dev`, `call`, and `pack`. This keeps the Panel, Service, permissions, and sibling Components in one product boundary.

## Start here

1. [Capabilities and security](/en/developers/portable-runtime-contracts): manifest requests, WIT, mounts, and error boundaries.
2. [Build a Service App](/en/developers/portable-service-apps): the Rust development loop.
3. [Jobs, events, and observations](/en/developers/portable-runtime-observability): long work, Resident delivery, and diagnostic facts.
4. [Package and distribute](/en/developers/portable-runtime-distribution): universal artifacts and external-dependency rules.
