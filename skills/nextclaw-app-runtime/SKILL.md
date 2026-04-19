---
name: nextclaw-app-runtime
description: Use when the user wants to create, inspect, publish, install, run, or share NextClaw Apps through the local napp CLI, including registry workflows, readiness checks, starter scaffolding, and explicit permission-aware execution.
---

# NextClaw App Runtime

## Overview

Use this skill when the user wants to build, publish, install, or run a local NextClaw App through the standalone `napp` runtime.

This skill is intentionally decoupled:

- The skill owns explanation, onboarding, readiness checks, app scaffolding guidance, safe execution boundaries, and first-run troubleshooting.
- The `@nextclaw/app-runtime` package and its `napp` CLI own actual execution.

From the user's point of view, the experience should feel complete:

- install `napp` if missing,
- verify the runtime is really ready,
- create or inspect an app directory,
- publish the app to the official registry when needed,
- discover or install an app from the official store when needed,
- map the needed local permissions explicitly,
- then run the micro app for real.

Do not pretend the environment is ready when it is not.

## Install Boundary: Skill vs Runtime Package vs App Folder

Always distinguish these three things:

- the NextClaw marketplace skill:
  installed into the active workspace as `skills/nextclaw-app-runtime/SKILL.md`
- the runtime package:
  installed locally as `@nextclaw/app-runtime`
- the app itself:
  a normal directory containing `manifest.json`, `main/`, `ui/`, and `assets/`

Installing the marketplace skill does not install `napp` by itself.
Installing `napp` does not create an app automatically.
Running an app still requires either a concrete app directory or an installed app id, plus any needed permission mappings.

## What This Skill Covers

- install or update `@nextclaw/app-runtime`
- verify `napp` readiness
- inspect an existing app directory
- scaffold a first app directory with `napp create`
- publish an app with `napp publish`
- install or update an app from the official registry
- explain the official Apps store and registry entry points
- explain and apply `--document scope=/path` permission mappings
- run a local app safely
- help the user share an app directory with another user

## What This Skill Does Not Cover

- pretending that arbitrary Node or Python backends can be dropped in directly
- claiming container-grade isolation that the current MVP does not provide
- silently granting file access without an explicit user path
- inventing app capabilities that `manifest.json` and `napp` do not actually support
- claiming this is already a full Docker replacement, a general backend platform, or a finished in-product app center

## Official Entry Points

Current official entry points:

- Apps store: `https://apps.nextclaw.io`
- Apps registry/API: `https://apps-registry.nextclaw.io`
- Default registry base used by `napp`: `https://apps-registry.nextclaw.io/api/v1/apps/registry/`

Use these entry points when the user asks how to discover apps, publish apps, or install an app by id.

## Deterministic First-Use Workflow

When the user asks to create, publish, install, or use a NextClaw App, follow this exact order.

### 1. Check whether `napp` exists

Run:

```bash
command -v napp
```

If it is missing, install the runtime package:

```bash
npm install -g @nextclaw/app-runtime
```

Then verify:

```bash
napp --version
napp --help
```

Do not continue to app execution until these two checks succeed.

### 2. Classify the user intent

Classify the request into one of these:

- use an existing app directory
- create a new app directory
- publish an app directory
- install an app from the official registry
- inspect an app somebody else shared
- troubleshoot a runtime or permission failure

If the user does not yet have an app directory, do not tell them to “come back later”.
This skill should use `napp create` to scaffold the folder in the workspace when needed.

### 3. For an existing app, inspect before running

Run:

```bash
napp inspect <app-dir> --json
```

Use this as the main readiness gate for the app itself.

Confirm at least:

- the manifest parses,
- `main.entry` exists,
- `ui.entry` exists,
- declared permissions are visible.

Do not jump straight to `run` before `inspect` succeeds.

### 4. For a new app, scaffold it with `napp create`

Run:

```bash
napp create <app-dir>
```

Current MVP recommendation:

- keep the first app extremely small,
- keep `main` to one Wasm module,
- keep `ui` as a plain web front-end,
- keep permissions minimal.

After scaffolding, always run:

```bash
napp inspect <app-dir> --json
```

### 5. For a published or remote app, install before running

Run:

```bash
napp install <app-id>
```

Useful checks:

```bash
napp list
napp info <app-id>
napp permissions <app-id>
```

If the user is choosing an app from the official store, prefer using the app id shown there, for example:

```bash
napp install nextclaw.hello-notes
```

### 6. Publish an app when the user is acting as a developer

Run:

```bash
napp inspect <app-dir> --json
napp publish <app-dir>
```

Publish rules:

- do not publish before `inspect` succeeds,
- confirm the app contains `marketplace.json`,
- prefer the default official API unless the user explicitly asks for another registry,
- auth priority is fixed as:
  - explicit `--token`
  - current `nextclaw login` session
  - `NEXTCLAW_MARKETPLACE_ADMIN_TOKEN`
- personal publish requires a platform username and an app id in the form `<username>.<app-name>`,
- official publish uses `nextclaw.<app-name>` and requires admin permission,
- do not treat `marketplace.json.publisher` as the source of truth for real publish ownership,
- surface the returned app id, detail page, and install command after publish succeeds.

### 7. Apply file access explicitly

If the app declares `documentAccess`, the user must provide an explicit mapping at runtime, for example:

```bash
napp run <app-dir> --document notes=/absolute/path/to/notes
```

Rules:

- the skill must surface what scope ids the app requested,
- the user must know exactly which local path is being granted,
- the skill must not silently choose a path on the user's behalf for write-sensitive cases.

### 8. Run the app for real

Run:

```bash
napp run <app-dir|app-id> [--document scope=/path ...]
```

Then open the printed local URL in a browser.

Success means:

- the local host starts,
- the app UI loads,
- the app can call the host bridge successfully,
- and the declared action actually completes.

## Mental Model

Always explain the runtime in this order:

1. `ui/` is still a normal web front-end.
2. `main/` is the constrained app logic module.
3. `napp` is the local host.
4. the host bridge is the controlled path from the web UI to local capabilities.
5. local file access only happens through explicit permission mappings.

Do not describe the current product as:

- a full Docker replacement,
- a general backend platform,
- or an in-product embedded app center that is already fully integrated everywhere.

Describe it truthfully as:

- a lightweight local micro-app runtime,
- with an official apps registry and store,
- with a web UI,
- a constrained main module,
- and explicit host-mediated permissions.

## Safe Execution Rules

- Prefer `inspect` before `run`.
- Keep permissions minimal.
- Surface requested scope ids before asking for paths.
- For any write-oriented future app, ask for explicit confirmation before granting a writable path.
- If the app is shared by someone else, inspect the manifest before running it.
- Do not claim a capability exists unless it is declared in the manifest and supported by the current runtime.

## Sharing And Reuse Workflow

When one user wants to share an app with another user, use this order:

1. share the app directory itself
2. the receiver runs `napp inspect <app-dir>`
3. the receiver reviews requested permissions
4. the receiver starts it with explicit `--document` mappings
5. the receiver opens the local URL and verifies behavior

If the app has already been published, the reuse workflow can also be:

1. share the app id or detail page
2. the receiver runs `napp install <app-id>`
3. the receiver checks `napp permissions <app-id>`
4. the receiver grants explicit local paths
5. the receiver runs `napp run <app-id>`

The key product point is:

- the app is portable as a folder,
- but permissions stay local and explicit.

## Troubleshooting

### `napp` not found

- install `@nextclaw/app-runtime`
- re-check `command -v napp`
- verify `napp --version`

### `inspect` fails

- fix the folder structure first
- confirm `manifest.json`, `main.entry`, and `ui.entry`
- do not continue to `run`

### `install` fails

- check `napp registry get`
- confirm the app id exists in the official registry
- retry with the default registry unless the user explicitly changed it

### `publish` fails

- inspect the app again
- confirm `marketplace.json` exists and is valid
- confirm publish auth is available if the target registry requires it
- confirm the current platform account already has a username
- confirm `manifest.json` uses the correct app id scope for the current publisher
- do not claim the app is available until the publish result returns a real app id

### `run` says a document scope is missing

- inspect the app again
- identify the missing scope id
- restart with `--document <scopeId>=/path`

### UI opens but actions fail

- verify the host actually started
- verify the bridge endpoint is reachable
- verify the granted local path exists
- verify the app action name matches the manifest

## Success Criteria

This skill is working correctly when:

- `napp` is installed and observable,
- `napp --version` and `napp --help` both work,
- a real app directory can be inspected,
- a real app can be published or installed when that is the user's goal,
- required permissions are surfaced before execution,
- and the app can be run through the local host with a real successful action.
