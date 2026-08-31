# Package and distribute Portable Service Apps

Portable Runtime separates the portable App from the native runner. An App author builds one WebAssembly Component and packages it in a `.napp`; NextClaw supplies the platform runner. That is why a pure WASI App can use a universal artifact instead of separate Windows, Linux, and macOS App builds.

## Package a universal App

```bash
nextclaw app check . --json
nextclaw app test . --json
nextclaw app pack . --out reading-log.napp --json
nextclaw app validate-publish . --json
```

Use `distribution.mode: "universal"` when the package contains only portable resources. The current native runner distribution covers macOS arm64, Linux x64, and Windows x64. The App package does not include a copy of the runner and does not require an end user to install Rust, Cargo, Wasmtime, or a system Node.js runtime.

Choose a targeted distribution only when the App really includes platform-native resources. A native-process Service may need one artifact per supported target; that is a different trade-off from a portable Component.

## Install and update safely

```bash
nextclaw app install ./reading-log.napp --json
nextclaw app enable <app-id> --json
nextclaw app update <app-id> --version <version> --json
nextclaw app rollback <app-id> --version <installed-version> --json
```

The installed host owns the active version, managed data, grants, and lifecycle operations. Update or rollback does not authorize new files, domains, secrets, Providers, models, or Agents by implication. If a new version changes a request, the host re-evaluates the relevant grant and readiness state.

## Keep the default self-contained

Use the portable package as the default installation path. It should include the Component, Panel, manifests, test fixture, and any normal packaged assets.

Sometimes an App needs a service outside the package, for example a managed Redis instance or a proprietary API. In that case:

1. Declare it in `requires.capabilities` or `requires.resources`; never hide it in code or a connection string.
2. Show a clear `needs-capability` or `needs-configuration` state at installation.
3. Offer a safe setup Action that an authorized Agent can perform where possible.
4. Leave login, payment, account ownership, or irreversible third-party authorization to the user.
5. Keep credentials in the NextClaw secret owner, never in the artifact or manifest.

An external dependency is not a reason to weaken the package boundary. It is a documented exception with an explicit setup path and an enablement block until it is ready.

## Marketplace and release checks

Run `validate-publish` before Marketplace submission. It validates the App and declared artifact shape; it does not replace your own `app test` cases. The release path also verifies the portable runtime and reference App across the supported platform matrix before a stable runtime channel is accepted.

For a real pattern that remains self-contained for public repositories, see [GitHub Issue Watcher](/en/guide/service-apps-github-issue-watcher).
