---
name: gemigo-cli
description: Use when the user wants to install, log in to, configure, or operate the local GemiGo CLI (`gemigo`) through NextClaw, especially to publish a built static app and obtain a hosted public URL.
---

# GemiGo CLI

## Overview

Use this skill when the user wants to publish a built static app through the local `gemigo` CLI from inside NextClaw.

This skill is intentionally decoupled:

- The skill owns explanation, onboarding, readiness checks, workflow selection, risk disclosure, and success verification.
- The `gemigo` CLI owns the actual login and deployment calls to GemiGo.

From the user's point of view, the experience should feel complete:

- install or verify the local CLI,
- confirm login state against the intended origin,
- validate that the target is a built static output directory,
- create or fix `gemigo.app.json`,
- ask for explicit confirmation before remote write actions,
- then deploy and report the resulting hosted URL.

Do not pretend the environment is ready when it is not.

## Current Product Boundary

Current `gemigo` scope is intentionally narrow:

- log in with `gemigo login`
- inspect login state with `gemigo whoami`
- clear login state with `gemigo logout`
- publish a prebuilt static site directory with `gemigo deploy` or `gemigo publish`

Do not claim that `gemigo` can currently:

- install project dependencies,
- infer build commands automatically without inspection,
- build the app for the user without running a real build command,
- deploy server-side code,
- or publish a raw source repository root that has not been built.

The safe rule is simple:

- build first,
- deploy the generated static output second.

## Install Boundary: NextClaw Skill vs Local CLI

Always distinguish these two layers:

- NextClaw marketplace skill install:
  the selectable skill exists at `<workspace>/skills/gemigo-cli/SKILL.md`
- Local GemiGo CLI install:
  the `gemigo` binary exists on the user's machine

Installing this marketplace skill does not automatically install the `gemigo` binary.
If the user wants to actually publish an app, both layers must be ready.

Default NextClaw workspace:

```bash
~/.nextclaw/workspace
```

Typical installed skill path:

```bash
~/.nextclaw/workspace/skills/gemigo-cli/SKILL.md
```

Install the local CLI with:

```bash
npm install -g gemigo
```

## Deterministic Workflow

When the user asks to publish a static app with GemiGo, follow this order and do not skip steps.

### Step 0: Classify the request

Classify the task into one of these:

- install or verify `gemigo`,
- log in or inspect login state,
- create or fix `gemigo.app.json`,
- deploy a built static directory,
- troubleshoot a failed deployment.

If the user gives you a source repository instead of a built output directory, treat the build step as separate preparation work before deploy.

### Step 1: Verify the local CLI binary

Run:

```bash
command -v gemigo
```

If missing, explain that the local CLI must be installed first:

```bash
npm install -g gemigo
```

Only after the binary exists should you continue to auth or deploy steps.

### Step 2: Verify current login state against the intended origin

Default origin:

```bash
https://gemigo.io
```

Run:

```bash
gemigo whoami --origin https://gemigo.io
```

Interpret the result literally:

- success with a user identity:
  login is ready for that origin
- `No saved session found`:
  the user has not logged in on this machine yet
- `Stored session is for ...`:
  the saved login is for a different origin
- `Saved session is no longer valid`:
  the session expired and login must be redone

Do not continue to deploy if `whoami` is not healthy.

### Step 3: Log in when needed

Default login:

```bash
gemigo login
```

Provider-specific login:

```bash
gemigo login --provider github
gemigo login --provider google
```

Remote or no-auto-open flow:

```bash
gemigo login --no-browser
```

Important behavior:

- the CLI may open a browser automatically,
- `--no-browser` prints the login URL instead,
- the saved session is origin-specific,
- if origin changes, the user must log in again for that origin.

After login, rerun:

```bash
gemigo whoami --origin <origin>
```

Only a successful `whoami` counts as readiness.

### Step 4: Validate the deployment target

The target must be a built static output directory, not the source repo root.

Required shape:

- `index.html` exists at the directory root
- there is no top-level `package.json`

Observable checks:

```bash
test -f <dir>/index.html
test ! -f <dir>/package.json
```

If the user only gave you source code:

1. detect the framework and build command
2. run the real build
3. locate the generated output directory such as `dist`, `build`, or another static export folder
4. validate that output directory before deploy

Do not deploy the repo root just because it is the most obvious path.

### Step 5: Create or fix `gemigo.app.json`

Create the manifest in the project root or pass a custom path with `--config`.

Required fields:

- `visibility`
- `category`
- `tags`
- `defaultLocale`
- `locales`
- `locales[defaultLocale].name`
- `locales[defaultLocale].description`

Useful optional fields:

- `sourceDir`
- `slug`
- extra locale entries such as `zh-CN`

Portable example:

```json
{
  "$schema": "https://gemigo.io/schema/gemigo.app.schema.json",
  "sourceDir": "./dist",
  "slug": "my-static-app",
  "visibility": "public",
  "category": "Tools",
  "tags": ["static", "demo"],
  "defaultLocale": "en",
  "locales": {
    "en": {
      "name": "My Static App",
      "description": "A static app published to GemiGo."
    },
    "zh-CN": {
      "name": "我的静态应用",
      "description": "一个发布到 GemiGo 的静态应用。"
    }
  }
}
```

If the manifest is incomplete or invalid, fix it before deploy instead of letting the user hit a later failure.

### Step 6: Require explicit confirmation before deploy

`gemigo deploy` is a remote write action.
It may create a project and trigger a hosted deployment on the user's account.

Before running deploy, make sure the user explicitly wants to proceed.

What to confirm:

- which directory will be deployed,
- which origin will be used,
- whether visibility is `public` or `private`,
- and that a remote project/deployment will be created or updated.

### Step 7: Deploy and report the resulting URL

Explicit directory form:

```bash
gemigo deploy <dir> --config ./gemigo.app.json
```

Manifest-driven form:

```bash
gemigo deploy --config ./gemigo.app.json
```

Alias:

```bash
gemigo publish <dir> --config ./gemigo.app.json
```

After success, surface the deployment result clearly:

- project slug if present,
- hosted URL or domain if present,
- and any next action the user should take.

Do not stop at "command exited successfully" if the CLI output already reveals the public URL.

## Recommended Execution Pattern

If the user gives you source code only:

1. inspect the project and identify the build command
2. run the build
3. locate the built static output directory
4. validate the directory shape
5. create or fix `gemigo.app.json`
6. verify `gemigo whoami`
7. ask for deploy confirmation
8. run `gemigo deploy`
9. report the resulting URL

If the user already gives you a built directory:

1. validate the directory
2. create or fix `gemigo.app.json`
3. verify `gemigo whoami`
4. ask for confirmation
5. run `gemigo deploy`

## Safe Execution Rules

- Keep read actions and write actions distinct.
- `whoami` is safe to run before asking for confirmation.
- `deploy` or `publish` must stay behind explicit confirmation.
- Do not hide missing login, origin mismatch, or invalid static directory errors.
- Do not claim that a source repo root is deployable unless it is actually the built output directory.
- Prefer the hosted schema URL in manifests.
- If the user is using a non-default environment, keep `--origin` or `GEMIGO_ORIGIN` explicit through the whole flow.

## Troubleshooting

### `gemigo` not found

- The local CLI is not installed.
- Install it with:

```bash
npm install -g gemigo
```

Then re-check with:

```bash
command -v gemigo
```

### `No saved session found`

- The user is not logged in yet for that machine and origin.
- Run:

```bash
gemigo login --origin <origin>
```

### `Stored session is for ...`

- The saved login belongs to another origin.
- Re-run login for the target origin:

```bash
gemigo login --origin <origin>
```

### `Saved session is no longer valid`

- The stored session expired or was rejected by the server.
- Run login again, then re-check with `whoami`.

### `Static directory must contain index.html at its root`

- The wrong directory was passed.
- Find the actual build output directory and deploy that instead.

### `Static directory must not contain a top-level package.json`

- The user likely passed the source repository root instead of the built output.
- Build first, then point `gemigo deploy` at the generated static folder.

## Success Criteria

This skill is working correctly when:

- the user understands that `gemigo` publishes a built static app rather than raw source,
- missing local CLI install or missing login is discovered before deploy,
- the deployment target is validated as a real static output directory,
- `gemigo.app.json` is complete enough for deploy,
- remote write actions happen only after explicit confirmation,
- and the final hosted URL or domain is surfaced back to the user.

## Resources

- GemiGo homepage:
  https://gemigo.io
- GemiGo source repository:
  https://github.com/Peiiii/deploy-your-app
