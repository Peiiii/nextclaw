---
name: nextclaw-app-runtime
description: Use when the user wants to create, inspect, run, or share NextClaw micro apps through the local napp CLI, including install, readiness checks, starter app scaffolding, and safe permission-aware execution.
---

# NextClaw App Runtime

## Overview

Use this skill when the user wants to build or run a local NextClaw micro app through the standalone `napp` runtime.

This skill is intentionally decoupled:

- The skill owns explanation, onboarding, readiness checks, app scaffolding guidance, safe execution boundaries, and first-run troubleshooting.
- The `@nextclaw/app-runtime` package and its `napp` CLI own actual execution.

From the user's point of view, the experience should feel complete:

- install `napp` if missing,
- verify the runtime is really ready,
- create or inspect an app directory,
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
Running an app still requires a concrete app directory and any needed permission mappings.

## What This Skill Covers

- install or update `@nextclaw/app-runtime`
- verify `napp` readiness
- inspect an existing app directory
- scaffold a first app directory with `napp create`
- explain and apply `--document scope=/path` permission mappings
- run a local app safely
- help the user share an app directory with another user

## What This Skill Does Not Cover

- pretending that arbitrary Node or Python backends can be dropped in directly
- claiming container-grade isolation that the current MVP does not provide
- silently granting file access without an explicit user path
- inventing app capabilities that `manifest.json` and `napp` do not actually support
- claiming there is already an app store, installer UX, or one-click packaging when that path is not ready yet

## Deterministic First-Use Workflow

When the user asks to create or use a NextClaw micro app, follow this exact order.

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

### 5. Apply file access explicitly

If the app declares `documentAccess`, the user must provide an explicit mapping at runtime, for example:

```bash
napp run <app-dir> --document notes=/absolute/path/to/notes
```

Rules:

- the skill must surface what scope ids the app requested,
- the user must know exactly which local path is being granted,
- the skill must not silently choose a path on the user's behalf for write-sensitive cases.

### 6. Run the app for real

Run:

```bash
napp run <app-dir> [--document scope=/path ...]
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

Do not describe the current MVP as:

- a full Docker replacement,
- a general backend platform,
- or an already-finished app marketplace.

Describe it truthfully as:

- a lightweight local micro-app runtime,
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
- required permissions are surfaced before execution,
- and the app can be run through the local host with a real successful action.
