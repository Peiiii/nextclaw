---
name: nextclaw-app-runtime
description: Use when the user wants to create, preview, publish, install, run, or troubleshoot NextClaw Apps without needing to understand napp, WASI, Wasmtime, JCO, npm, registry, or marketplace details.
---

# NextClaw App Runtime

## Product Promise

Use this skill when the user wants to make, share, install, or run a NextClaw App.

The user should not need to know:

- what WASI, Wasmtime, JCO, WIT, wkg, or ComponentizeJS are,
- which build commands live inside `main/package.json`,
- where the registry URL is,
- where app data lives,
- or how `.napp` bundles are packed.

The skill owns the user journey. `@nextclaw/app-runtime` and `napp` own execution.

## What Counts As Success

For a non-technical user, success means one of these:

- "帮我做一个小应用" produces a working local preview link.
- "发布这个应用" publishes the app to the NextClaw Apps marketplace and returns the detail page plus install command.
- "安装并运行这个应用" installs from the official registry, starts it locally, and returns a preview link.

Do not stop after generating files. The first usable link or publish/install result is the bar.

## Readiness First

Before creating, building, publishing, installing, or running apps, run:

```bash
napp doctor --json
```

If `napp` itself is missing, install the runtime package first:

```bash
npm install -g @nextclaw/app-runtime
```

Then rerun:

```bash
napp --version
napp doctor --json
```

If `doctor` reports missing tools, explain the exact missing tool and the install hint from the JSON output. Do not continue to build/run until the required toolchain is ready.

## Create A New App

When the user wants to create their own small app, choose the template explicitly:

- Prefer `ts-http` for the normal path when the user wants an ordinary full-stack app and did not ask about size.
- Prefer `ts-http-lite` when the user explicitly cares about package size, a thinner backend, or asks for the lightest official path.
- If the user does not care, default to `ts-http`.

Normal full-stack path:

```bash
napp create <app-dir> --template ts-http
napp build <app-dir> --install
napp inspect <app-dir> --json
napp run <app-dir> --data <app-dir>/.napp/data --port 0 --json
```

Size-first path:

```bash
napp create <app-dir> --template ts-http-lite
napp build <app-dir> --install
napp inspect <app-dir> --json
napp run <app-dir> --data <app-dir>/.napp/data --port 0 --json
```

Then return:

- the local URL,
- the app directory,
- the data directory,
- the chosen template,
- and one short sentence explaining that the backend is sandboxed and data is stored in the chosen data directory.

If the user asks for a custom app idea, edit the generated `ui/` and `main/src/component.ts`, then run `napp build <app-dir> --install` again before previewing.

## Publish To Apps Marketplace

When the user wants to distribute their app:

```bash
napp build <app-dir> --install
napp inspect <app-dir> --json
napp validate-publish <app-dir> --mode source --json
napp publish <app-dir> --mode source
```

Rules:

- Do not publish before build, inspect, and validate-publish all pass.
- Default to `--mode source` unless the user explicitly asks for a prebuilt deterministic bundle.
- If `validate-publish` returns warnings, surface them in plain language before continuing. Do not silently ignore size warnings.
- If publishing fails because login is missing, tell the user to run `nextclaw login`; do not ask them to manage raw tokens unless they explicitly want that.
- Personal publish requires a platform username and a non-official app id scope.
- Official `nextclaw.*` publish requires admin permission.
- After success, return the marketplace detail URL and install command from `napp publish`.

## Install And Run A Marketplace App

When the user wants to use an app from the store:

```bash
napp install <app-id>
napp run <app-id> --port 0 --json
```

Installed apps use their private data directory under `~/.nextclaw/apps/data/<app-id>`, so the user does not need to choose `--data`.

Return:

- the local URL,
- app id and version,
- and where its private data directory is if available.

## Pack Or Share A Local Bundle

When the user wants a file they can send directly:

```bash
napp build <app-dir> --install
napp validate-publish <app-dir> --mode source --json
napp pack <app-dir> --mode source
```

The output `.napp` file can be installed with:

```bash
napp install <bundle.napp>
```

## Permission And Data Rules

- For local development of `ts-http`, use `<app-dir>/.napp/data` unless the user asks for another location.
- For installed apps, rely on the install-time app data directory.
- If an app requests document permissions, inspect first and show the requested scope ids before running.
- Do not silently grant arbitrary host directories.
- For write-sensitive paths, ask the user before mapping a real personal directory.

## Troubleshooting

If something fails:

1. Run `napp doctor --json`.
2. Run `napp inspect <app-dir> --json` for local apps.
3. Run `napp build <app-dir> --install` for `wasi-http-component` apps.
4. Surface the first concrete error and the next single action.

How to explain failures:

- Use ordinary user language first. Mention WASI/JCO/WIT only if the user asks or the tool output makes it necessary.
- Say what is blocked now, what single action unblocks it, and whether the app files are still usable.
- If publishing is blocked by login, say the app itself is fine and only the publish step is blocked.
- If `validate-publish` warns that the backend is large, explain that the app can still work and publish, but download/install may be heavier.
- If the user explicitly wants a prebuilt artifact, switch to `--mode bundle` and explain that it will usually be larger than the default `source` mode.

Common outcomes:

- Missing `wasmtime`: the app cannot run WASI HTTP backends yet.
- Missing `wkg`: TypeScript WASI HTTP app builds cannot fetch WIT dependencies yet.
- Missing `npm`: TypeScript template dependencies cannot install.
- Missing platform login: publishing cannot continue; run `nextclaw login`.

## Boundaries

Do not claim NApp is a full Docker replacement. The current user-ready path supports:

- TypeScript WASI HTTP apps (`ts-http` and `ts-http-lite`),
- same-origin frontend `fetch("/api/...")`,
- app data mounted as guest `/data`,
- marketplace publish/install,
- and local preview links.

The following remain future work:

- generic `--mount host:guest[:ro|rw]`,
- `--publish` port exposure,
- a full desktop Apps management UI,
- and bundled Wasmtime/wkg in every distribution.
