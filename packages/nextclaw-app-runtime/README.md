# NextClaw App Runtime

`@nextclaw/app-runtime` is the independently published runtime package that powers NextClaw Mini Apps. It owns artifact validation, package formats, local package state, and the runtime contracts used by the NextClaw host.

## Install Mini Apps

Use the NextClaw CLI for every user or AI-facing Mini App action:

```bash
nextclaw app install <app-id|local-app-directory|bundle.napp>
nextclaw app list
nextclaw app info <app-id>
nextclaw app enable <app-id>
nextclaw app disable <app-id>
nextclaw app update <app-id>
nextclaw app rollback <app-id> --version <version>
nextclaw app uninstall <app-id> --confirm <app-id>
```

The install source may be an App Marketplace identifier, a local app directory, or a local `.napp` bundle. The host records an operation receipt; use `nextclaw app operations --json` to inspect its progress and result.

## For Runtime Integrators

The package remains independently published so the NextClaw host and build tooling can consume its stable runtime contracts. Its package and registry implementation are not a second public product surface. Use the `nextclaw app` CLI and the NextClaw documentation for supported operations.

## Package Formats

Mini Apps use a `.napp` container. A package may be distributed as either:

- `source`: source, UI assets, and manifest are materialized locally at install time.
- `bundle`: a ready-to-run `main/app.wasm` is included for deterministic or offline delivery.

Both variants carry a manifest and checksums. The runtime installs package code separately from each managed App instance, so uninstalling a package can retain the instance data unless the caller explicitly requests data removal.

## Registry Metadata

The registry stores package metadata, versions, publisher identity, distribution location, and integrity data. It does not store a per-App install command: clients derive the single supported command from the app identifier.
