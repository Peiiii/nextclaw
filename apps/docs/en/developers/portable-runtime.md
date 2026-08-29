# Portable Runtime

Portable Runtime is NextClaw's execution path for WASM Service Apps. Application logic is compiled into a platform-independent WebAssembly Component. An embedded Spin Runtime in a shared native process loads, links, and executes it while NextClaw provides a small set of mediated host capabilities.

It solves Service App execution and capability boundaries; it is not a separate App product. Installation, Panels, Service Actions, user grants, and data lifecycle remain owned by the existing NextClaw App system.

> Portable Runtime is experimental. The official guest path currently covers Rust only, and the runtime is not yet a production security sandbox for untrusted code.

## When to use it

Portable Runtime is a fit when a Service App should:

- use the same business Component across desktop platforms;
- share one native runner instead of keeping a JavaScript process alive per service;
- use host-managed KV, mediated networking, or Component composition;
- run on demand, receive continuing events, or provide a reusable capability;
- expose the same Service Action contract to a Panel, Agent, and CLI.

An existing MCP service does not need to be rewritten. `mcp` and `wasi-component` are parallel Service App protocols.

## Execution path

```text
Panel App ─┐
Agent ─────┼─→ Service Action / grant ─→ NextClaw Kernel ─→ embedded Spin Runtime ─→ WASM Component
CLI ───────┘                                                │
                                                            └─→ KV / HTTP GET / declared Provider
```

The Kernel owns product semantics: it parses App and Service manifests, checks caller grants, selects the data directory and capability boundary, and manages runtime state. The runner owns Component loading, WIT linking, and execution.

## Three runtime roles

| Role | Lifecycle | Good for |
| --- | --- | --- |
| Action | Runs when called; no persistent instance is required | Queries, writes, calculations, transformations, mediated requests |
| Resident | Keeps one instance and receives host events at the declared interval | Timers, polling, and memory state that outlives a Panel |
| Provider | Keeps an independent instance for declared Component consumers | Reusable normalization, query, or domain capabilities |

All roles implement the same `service-app` world. The `lifecycle` entry in `service-app.json` selects the behavior.

## Current host capabilities

The `nextclaw:portable-service@0.1.0` WIT contract currently provides logging, host-managed KV, allowlisted HTTPS GET, calls to declared Providers, and basic runner information.

A Component does not automatically inherit the host file system or native networking. Storage, domains, and Provider dependencies are constrained by the owning schema v2 App manifest.

## Shared runner and recovery

NextClaw executes multiple Components in one shared child process. Inside that process, Spin Runtime Factors connect Components to mediated host capabilities. Factor implementation is internal; the public `.napp`, WIT, and NDJSON contracts remain unchanged. Actions run on demand; Residents and Providers keep instances; Providers start before persistent roles that depend on them.

If the runner exits or a call times out, the Kernel terminates the failed process and recreates persistent Providers and Residents. The failed call is not silently replayed. This recovery path is not a substitute for complete in-process CPU, memory, and concurrency isolation.

## Extensions and external dependencies

Prefer a reusable Portable Component or a trusted Native Provider for an extension. NextClaw does not currently promise that an App can dynamically load any third-party Spin Factor after installation. A host capability must first be supported by a NextClaw Factor or Provider contract.

Apps should be self-contained by default and run after installation. A Service may explicitly declare an external capability or resource, but this is a cautious escape hatch: the App list and details show `needs-capability` or `needs-configuration`, and enablement is blocked until the requirement is satisfied. NextClaw currently identifies, displays, and blocks these requirements; it does not automatically install an external service or complete third-party account authorization.

## Cross-platform model

The WASM Component is platform independent; NextClaw supplies the native runner for each target. The source tree currently maps macOS arm64/x64, Linux x64, and Windows x64 resources.

For NPM installations, the stable launcher checks for a complete Runtime for the current platform on first start. If the runner is missing, it downloads and verifies the signed Runtime before launching it. When the network is temporarily unavailable but an older complete Runtime is installed, NextClaw keeps using that version instead of requiring a manual runner copy.

Stable releases build separately on macOS arm64, Linux x64, and Windows x64, then exercise real HTTP enablement, all five Components, Provider and Resident startup, and an Action call. The Linux x64 runner is statically linked so it does not inherit the build machine's glibc requirement.

## Current boundaries

- The official guest path currently covers Rust only. FastAPI and existing Python dependency trees cannot be compiled into this Component format as-is. Python, Node, and other full ecosystems can still use a `native-process` Service, but that is not the self-contained Portable Component path.
- Secrets, files and blobs, streaming HTTP, long-job progress and cancellation, and Component calls to models or Agents are not public contract capabilities.
- A Resident currently receives host timer events, not a general external event-subscription stream.
- A Provider cannot recursively call another Provider.
- The runtime is not yet a production sandbox for untrusted code.

## Next steps

- [Runtime model and capability contracts](/en/developers/portable-runtime-contracts)
- [Develop a WASM Service App](/en/developers/portable-service-apps)
- [Service Apps](/en/guide/service-apps)
