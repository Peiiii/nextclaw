---
name: lark-cli
description: Use when the user wants to operate Lark or Feishu via the local lark-cli (@larksuite/cli), including install, app credentials, OAuth, readiness checks, and safe read/write boundaries.
---

# Lark CLI (larksuite/cli)

## Overview

Use this skill to help the user work through a local [`lark-cli`](https://github.com/larksuite/cli) installation from inside NextClaw.

This skill is intentionally decoupled:

- The skill owns explanation, onboarding, readiness checks, workflow choice, risk handling, and permission clarity.
- The `lark-cli` binary owns actual execution against the Lark/Feishu Open Platform APIs.

From the user’s point of view, the experience should feel complete:

- install the CLI (and optionally upstream skill assets when needed),
- configure app credentials and complete OAuth,
- verify readiness with observable commands,
- then run the real task.

Do not pretend the environment is ready when it is not.
Treat browser completion, terminal success text, and real readiness as three separate things. Only observable CLI checks count as success.

## Install Boundary: Upstream CLI vs NextClaw Skill

Always distinguish these three things before taking action:

- `@larksuite/cli` / `lark-cli` binary install:
  `npm install -g @larksuite/cli`
- NextClaw runtime skill install:
  the selectable skill must exist at `<workspace>/skills/lark-cli/SKILL.md`
- This repo's source skill:
  `skills/lark-cli/SKILL.md` inside the NextClaw repository

NextClaw loads skills from the workspace `skills/` directory, not from npm global Agent Skill locations.

Default NextClaw workspace:

```bash
~/.nextclaw/workspace
```

So the default installed skill path is:

```bash
~/.nextclaw/workspace/skills/lark-cli/SKILL.md
```

If the user wants the skill installed into a specific project or workspace, install it with an explicit workdir:

```bash
nextclaw skills install lark-cli --workdir <workspace>
```

Do not treat this upstream command as a NextClaw skill install:

```bash
npx skills add larksuite/cli -y -g
```

That upstream command installs upstream Agent Skill assets globally. It does not put the skill into NextClaw's `<workspace>/skills/` directory, so it does not make the skill selectable inside NextClaw by itself.

## Deterministic Integration Recipe

When the user says "help me connect Feishu/Lark in NextClaw" or "make this skill actually work", follow this exact order and do not skip steps.

### Step 0: Verify the NextClaw side first

Check the real NextClaw workspace path before touching `lark-cli`.

- Default workspace: `~/.nextclaw/workspace`
- Expected installed skill file:
  `<workspace>/skills/lark-cli/SKILL.md`

If the user says they already installed the skill, verify that file exists.
If it does not exist, install it with:

```bash
nextclaw skills install lark-cli --workdir <workspace>
```

Do not start debugging Feishu OAuth before this NextClaw-side path is confirmed.

### Step 1: Verify the upstream CLI binary

Run:

```bash
command -v lark-cli
```

If it fails, check common Node bin locations before claiming the CLI is missing:

- `~/.nvm/versions/node/*/bin`
- `/opt/homebrew/bin`
- `/usr/local/bin`

If `lark-cli` exists in one of those directories but is not on `PATH`, use a one-off PATH prefix for the current command session, for example:

```bash
PATH=$HOME/.nvm/versions/node/v22.16.0/bin:$PATH lark-cli --help
```

Only if the binary truly does not exist should you install it:

```bash
npm install -g @larksuite/cli
```

### Step 2: Check current readiness before starting new flows

Run these first:

```bash
lark-cli config show
lark-cli auth status
lark-cli doctor
```

Interpret them in this order:

- `config show` says "Not configured yet" or `doctor` shows `config_file=fail`
  -> configuration is missing; go to Step 3
- `auth status` shows `identity: "bot"` and "No user logged in"
  -> config exists but user login is missing; go to Step 4
- `auth status` shows `identity: "user"` and `doctor` is all pass
  -> environment is ready; go to Step 5

Do not start `config init` or `auth login` blindly before checking current state.

### Step 3: Configure the app exactly once

Use the browser-based config flow:

```bash
lark-cli config init --new
```

For agent-style execution:

- run it once,
- capture the printed browser URL,
- send that URL to the user,
- keep the same process alive until it exits,
- then verify with `config show` and `doctor`.

Success means all of these are true:

- the original `config init --new` process exits with code `0`
- `lark-cli config show` displays a concrete `appId`
- `lark-cli doctor` reports `config_file=pass`
- `lark-cli doctor` reports `app_resolved=pass`

Do not rerun `config init --new` just because the terminal is still waiting.
Do not treat "the user opened the page" as success.

### Step 4: Log in as a user exactly once

Prefer the two-stage device flow:

```bash
lark-cli auth login --recommend --no-wait --json
```

This returns:

- `verification_url`
- `device_code`

Then immediately start the single polling process:

```bash
lark-cli auth login --device-code <DEVICE_CODE>
```

Agent behavior must be:

- show `verification_url` to the user
- start exactly one `--device-code` polling process
- wait for that same process to finish
- then verify with `auth status` and `doctor`

Success means all of these are true:

- the `--device-code` process exits with code `0`
- `lark-cli auth status` shows `identity: "user"`
- `lark-cli auth status` includes user info such as `userName` / `userOpenId`
- `lark-cli doctor` reports `token_exists=pass`
- `lark-cli doctor` reports `token_local=pass`
- ideally `lark-cli doctor` reports `token_verified=pass`

If `identity` is still `bot`, the login is not done.
Do not launch multiple concurrent `auth login` sessions.

### Step 5: Run one real read-only smoke command

After login succeeds, run at least one real API-backed read command before claiming the environment is usable.

Safe default:

```bash
lark-cli contact +get-user --format json
```

Success means:

- command exits `0`
- output contains `"ok": true`
- output contains `"identity": "user"`
- output includes a real `open_id` or user object

Only after this smoke step should the agent proceed to task-specific operations such as task/calendar/docs/mail/im/base actions.

## One-Pass Checklist For Agents

Use this checklist literally:

1. Confirm `<workspace>/skills/lark-cli/SKILL.md` exists.
2. Confirm `command -v lark-cli` works.
3. If not, repair PATH or install `@larksuite/cli`.
4. Run `lark-cli config show`.
5. Run `lark-cli auth status`.
6. Run `lark-cli doctor`.
7. If config missing, run one `lark-cli config init --new` flow and wait.
8. If config exists but identity is `bot`, run one `auth login --recommend --no-wait --json` flow and one `--device-code` polling process.
9. Verify `identity: "user"` with `auth status`.
10. Verify token checks with `doctor`.
11. Run `lark-cli contact +get-user --format json`.
12. Only then execute the user’s actual Feishu/Lark task.

## Do Not Do These Things

- Do not confuse "skill installed into NextClaw workspace" with "`lark-cli` binary installed globally".
- Do not use `npx skills add larksuite/cli -y -g` as a NextClaw skill install step.
- Do not start a second `config init --new` while the first one is still waiting.
- Do not start repeated `auth login` commands when one `--device-code` polling process is already active.
- Do not declare success from browser completion alone.
- Do not declare success from token existence alone if no read command has been tested.
- Do not skip `auth status` and `doctor`.

## What This Skill Covers

- Installation paths documented upstream (for example global npm install of `@larksuite/cli`).
- One-time app credential setup: `lark-cli config init` (or `lark-cli config init --new` when a browser-based setup URL must be handed to the user).
- Authentication: `lark-cli auth login` (including `--recommend` when appropriate), `lark-cli auth status`, and scope-aware flows described in upstream docs.
- Command discovery via `lark-cli --help` and `lark-cli <service> --help`.
- Shortcuts (commands prefixed with `+`), curated API commands, and raw `lark-cli api` calls only as supported by the installed CLI version.
- Security expectations: acting within granted OAuth scopes, dry-run where available, and explicit confirmation before high-impact writes.

## What This Skill Does Not Cover

- Inventing subcommands, shortcuts, or API paths that do not appear in the installed CLI help or upstream documentation.
- Claiming tenant permissions, plan limits, or compliance posture the user’s app or admin policies do not allow.
- Silently bypassing missing app configuration or failed login.
- Silently triggering messaging sends, file uploads, deletions, permission changes, or other high-impact actions without explicit user confirmation when the situation calls for it.
- Treating Lark/Feishu platform behavior or third-party CLI output as native NextClaw behavior.

## First-Use Workflow

When the user asks for a `lark-cli`-powered task, follow this order.

Before taking action, classify the environment into exactly one state and move only to the next state:

- CLI missing
- configured = no
- config in progress
- configured = yes, logged in = no
- login in progress
- ready

Do not start a second config or login flow while one is already in progress. Finish, verify, then continue.

### 1. Classify the task

Classify the task into one of these:

- read-only (list, view, search, export, `auth status`, schema introspection),
- write or side-effect (send messages, create/update/delete resources, share, permission changes),
- long-running or interactive (OAuth URL, device code, background polling).

If the task does not fit what the CLI exposes, say so clearly.

### 2. Check whether the CLI exists

Run:

```bash
command -v lark-cli
```

If missing, explain that the CLI must be installed locally first. Prefer the upstream-recommended global install:

```bash
npm install -g @larksuite/cli
```

After installation, continue with configuration and auth instead of jumping straight into the user task.
This step installs the upstream `lark-cli` binary only. It does not install the NextClaw `lark-cli` skill into the workspace.

### 3. Optional upstream skill bundle

Upstream documents installing additional Agent Skill files globally:

```bash
npx skills add larksuite/cli -y -g
```

Treat this as optional unless the user is following upstream tutorials that assume those files exist, or the CLI reports missing skill assets. Do not present it as a NextClaw marketplace replacement; it is an upstream packaging choice.
If the user's goal is "make `lark-cli` selectable in NextClaw", use `nextclaw skills install lark-cli` and verify `<workspace>/skills/lark-cli/SKILL.md` exists.

### 4. Configure app credentials

Guide the user through credential setup:

```bash
lark-cli config init
```

For agent-style flows where the process prints a URL and expects browser completion, use the non-interactive variant described upstream, for example:

```bash
lark-cli config init --new
```

For agent-style flows:

- run `lark-cli config init --new` in the background,
- extract the printed browser URL and send it to the user,
- wait for the process to exit before treating configuration as finished.

Config success gate:

- the process exits with code `0`, and
- `lark-cli config show` shows a concrete `appId`, and
- `lark-cli doctor` shows `config_file=pass` and `app_resolved=pass`.

If the browser page is opened but the command is still waiting, configuration is not finished yet.
If `config init --new` succeeds once, do not immediately rerun it unless `config show` or `doctor` proves config is still missing or broken.

### 5. Log in

Prefer the non-looping agent pattern:

```bash
lark-cli auth login --recommend --no-wait --json
```

Then use the returned `device_code` to resume polling:

```bash
lark-cli auth login --device-code <DEVICE_CODE>
```

This keeps the flow explicit:

- first command returns the verification URL immediately,
- second command is the single polling process,
- and the agent can avoid repeatedly spawning fresh login sessions.

Login success gate:

- the polling command exits with code `0`, and
- `lark-cli auth status` shows `identity: "user"`, and
- `lark-cli doctor` reports `token_exists=pass`, `token_local=pass`, and ideally `token_verified=pass`.

If login prints success text but `auth status` still shows `identity: "bot"`, treat that as not ready. Do not continue to real user-scoped operations.
If a device-code session is already pending, do not restart `auth login --recommend`; continue or expire that session first.

### 6. Readiness check

Run:

```bash
lark-cli auth status
```

If this does not show a healthy authenticated state with the scopes needed for the task, do not proceed to the real operation yet. Diagnose config and login first.

Optional deeper checks include `lark-cli auth check` for a specific scope when the user’s task depends on one.

Readiness means all of these are true:

- config exists,
- current identity is the one required by the task,
- required scopes are present,
- and a lightweight read command for that domain succeeds when feasible.

Examples:

- Before task operations: `lark-cli auth status` and `lark-cli auth check --scope "task:task:write"`
- Before message send: inspect help and do `--dry-run` first if available
- Before broad automation: prefer one narrow read command in the same domain

## Observable Success Rules

Use these rules to avoid fake success and retry loops:

- `config init --new` is successful only after the process exits and `config show` or `doctor` confirms config is resolved.
- `auth login` is successful only after `auth status` says `identity: "user"`.
- A write operation is successful only after the CLI returns a stable identifier or the resource can be fetched again.
- Do not treat “user opened the browser page” as success.
- Do not treat “command is still waiting” as a cue to start the same flow again.
- If a command returns a concrete resource id or guid, store and reuse that id for verification instead of relying on fuzzy search.

## Safe Execution Rules

- Prefer read-only commands and schema inspection (`lark-cli schema`, `--dry-run`) before mutating operations.
- For sends, deletes, permission changes, org-wide visibility, or bulk updates, ask for explicit confirmation unless the user already gave a clear, scoped instruction covering that exact action.
- Prefer narrow domain flags (for example domain-limited login) when the user’s goal is limited to one surface.
- Use `--format json` or `ndjson` when structured inspection reduces mistakes; use `table` or `pretty` when the user needs human-readable output.
- If the user asks to relax security settings or bypass upstream defaults, refuse silently automating that path; surface upstream risk language and require explicit informed consent in the product channel, not inside the agent’s hidden defaults.

Task-specific rule:

- `task +get-my-tasks` means “tasks assigned to me”, not “every task I created”.
- A task created without `--assignee` may be retrievable by `task tasks get` but not appear in `+get-my-tasks`.
- For task creation verification, prefer this sequence:

```bash
lark-cli task +create ... --format json
lark-cli task tasks get --params '{"task_guid":"<GUID>"}' --format json
```

- If the user wants the task to appear under “my tasks”, assign it explicitly to the current user with `--assignee <open_id>`.

## Privacy, Trust, And Compliance

This CLI can act on behalf of a logged-in user or bot identity within OAuth scopes. Surface that:

- Data may include messages, files, mail, calendar, contacts, and other tenant content.
- Mis-scoped automation can leak sensitive information or send messages to the wrong audiences.
- Upstream documentation includes security warnings; do not downplay them.

When the user is unsure, default to smaller scope, fewer recipients, and read-only verification first.

## Troubleshooting

### `lark-cli` not found

- Explain that Node/npm global install may be missing or not on `PATH`.
- Re-check with `command -v lark-cli` after install.

### Skill installed to the wrong place

- If the user installed an upstream skill globally but NextClaw still cannot select it, verify the real NextClaw workspace path first.
- The success check is the file `<workspace>/skills/lark-cli/SKILL.md`.
- If the user is working in a project-specific workspace, reinstall with:

```bash
nextclaw skills install lark-cli --workdir <workspace>
```

- Do not claim success just because `npx skills add larksuite/cli -y -g` finished.

### Config or auth errors

- Do not blindly rerun both config and login.
- First ask which state failed:
  - `doctor` says config missing or unresolved
  - `auth status` says bot only / not logged in
  - `auth status` says user but scope is insufficient
  - domain read/write command itself failed
- Re-run only the failed stage.
- Use `lark-cli auth status` and `lark-cli auth scopes` to compare granted scopes with the command’s needs.
- If using agent mode, prefer `auth login --no-wait --json` plus `auth login --device-code ...` over repeatedly launching fresh blocking login commands.

### Repeated waiting or apparent loop

- If a `config init --new` or `auth login --device-code` process is already active, keep that single session as the source of truth.
- If the user says they completed the browser step, poll the existing process and then verify with `config show`, `doctor`, or `auth status`.
- Only declare timeout or failure after the current session exits or the device code expires.
- Never stack multiple concurrent login attempts just because the terminal is still waiting.

### Command not recognized

- Inspect `lark-cli --help` and `lark-cli <service> --help` for the installed version.
- Do not guess shortcut names; confirm from help output.

### Rate limits, permission denied, or tenant policy errors

- Treat these as platform or admin policy constraints, not as something to bypass inside NextClaw.

## Success Criteria

The skill is working correctly when:

- the user understands that execution is performed by local `lark-cli` against Lark/Feishu APIs under their app and tokens,
- missing install, config, or login is identified before side effects,
- `lark-cli auth status` reflects readiness before high-trust tasks when feasible,
- config success and login success are judged by observable CLI state rather than browser completion alone,
- the agent follows a single in-flight config/login session instead of spawning repeated retries,
- task or resource writes are verified by concrete ids or follow-up reads,
- destructive or broadcast actions wait for explicit confirmation when required,
- and the real task runs only after the environment is truly ready.
