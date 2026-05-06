# NPM Package Release Process

Scope: publish npm packages in `packages/*` and `packages/extensions/*`.
This does NOT cover registry/console deployment.

## Prereqs
- npm auth for this repo should come from the project-root `.npmrc` (gitignored).
- If release commands run from an isolated worktree or a different cwd, set
  `NPM_CONFIG_USERCONFIG=/absolute/path/to/<repo>/.npmrc` so npm still reads the
  project-root credentials.

## Standard flow
1) Create changeset
```bash
pnpm changeset
```

2) Sync package READMEs (source of truth in `docs/npm-readmes`)
```bash
pnpm release:sync-readmes
pnpm release:check-readmes
```

3) Bump versions + changelogs
```bash
pnpm release:version
```

4) Publish
```bash
pnpm release:publish
```

### nextclaw runtime update public key

The `nextclaw` package contains the stable launcher for NPM installs. Before publishing any release batch that includes `nextclaw`, generate the packaged runtime update public key with the same signing key used by the runtime update channel:

```bash
NEXTCLAW_UPDATE_BUNDLE_PRIVATE_KEY=... pnpm -C packages/nextclaw runtime-update:build -- --channel beta --skip-build --output-dir tmp/npm-runtime-update-key-check
```

This writes `packages/nextclaw/resources/update-bundle-public.pem`. `prepack` verifies this file so a package without the verifier key is not published by accident.

After publishing a beta package, trigger the `npm-runtime-update-release` workflow with `channel=beta`. Users can then test with:

```bash
npm install -g nextclaw@beta
nextclaw update --channel beta --check
nextclaw update --channel beta
nextclaw update --apply
nextclaw --version
```

Runtime channel storage rule:
- signed manifests and `update-bundle-public.pem` stay on `gh-pages`,
- large `nextclaw-runtime-*.zip` bundle files are uploaded to GitHub Release assets for the matching release tag,
- this avoids GitHub Pages / git push file-size limits while keeping the public manifest URL stable.

Notes:
- `release:version` and `release:publish` automatically run README sync/check.
- `release:check:groups` now only gates the explicit release batch from pending changesets or freshly versioned packages.
- `release:check` now validates only the explicit release batch (packages from pending changesets, or freshly versioned public packages after `release:version`) instead of the whole workspace.
- `release:check` is resumable within the same `name@version` batch. It writes step checkpoints under `tmp/release-checkpoints/`, skips already-passed package steps on retry, and invalidates downstream cache automatically when an upstream internal dependency changes.
- `release:check` now focuses on publish-critical checks by default: `build + typecheck`.
- `release:check` no longer reruns batch lint by default. Use `pnpm release:check:strict` when you explicitly want `build + typecheck + lint` on the current release batch.
- `release:check` now schedules work with separate concurrency pools for `build` and `tsc`, so heavy bundling steps no longer starve the whole batch.
- If you need the historical full-workspace gate, run `pnpm release:check:all` explicitly.
- `pnpm release:report:health` remains a non-blocking repository hygiene report, but it now also prints the current batch registry status so you can distinguish “already published but missing local closure steps” from “still missing on npm”.
- `pnpm release:verify:published` is the registry truth check. It polls npm for the exact `pkg@version` pairs in the current batch and, if publish has already consumed the explicit batch state, falls back to the latest release checkpoint so the closure step still knows what was actually published.
- `release:publish` should run `release:check` (build + typecheck) before publishing.
- `release:publish` now also runs `release:verify:published` after `changeset publish` and before `changeset tag`, so “published online” becomes part of the standard release closure instead of a manual follow-up.
- `release:publish` should create git tags automatically.
- Never run `npm publish` directly inside `packages/*`, `packages/extensions/*`, or `packages/ncp-packages/*`.
- In this pnpm workspace, direct `npm publish` keeps `workspace:*` in the published manifest and breaks downstream installs.
- If you need to publish a single package manually, use `pnpm publish` from that package directory, or the repo-root `pnpm release:publish` flow.
- To force a clean rerun for the current batch, use `NEXTCLAW_RELEASE_CHECK_RESET=1 pnpm release:check`.

## UI-only shortcut

If only the frontend UI changed, use the one-command shortcut. It will create a changeset for
`@nextclaw/ui` + `nextclaw`, then run the standard version + publish steps. The publish check still
reuses the same batch-scoped `release:check`; there is no separate frontend-only checker anymore.

```bash
pnpm release:frontend
```

## Auto release shortcut

If the repo has a mix of:

- already-published package versions that are only missing local git tags, and
- new package drift that happened after the latest version commit,

use the one-command auto flow:

```bash
pnpm release:auto
```

It performs the following steps:

1. `release:sync:published-tags:write`
   - creates missing local git tags only for public packages whose exact `pkg@version` is already
     on the npm registry and whose package directory has no meaningful drift after the latest
     version commit.
2. `release:auto:changeset`
   - scans public packages for meaningful drift after their latest version commit and auto-creates
     a patch changeset for any drift package not already covered by pending changesets.
3. `release:version`
4. `release:publish`

Behavior is intentionally explicit:

- published-but-clean packages get local tags synchronized first, so they stop polluting the next
  release batch;
- only packages with real post-version drift are auto-added to the new changeset;
- existing pending changesets are reused instead of duplicated.

## Beta closure shortcut

If you want the reusable "one command" beta flow for NPM packages, use:

```bash
pnpm release:beta
```

This owner command reuses the existing release contracts instead of inventing a second publish path:

1. run `pnpm release:auto`
2. create a release commit if version / changelog files changed
3. push the current branch and local package tags
4. if the published batch includes `nextclaw`, trigger `npm-runtime-update-release` with `channel=beta`
5. wait for workflow success, verify runtime bundle assets on the matching GitHub release, and verify the public beta manifests on GitHub Pages

Useful flags:

```bash
pnpm release:beta -- --dry-run
pnpm release:beta -- --skip-runtime-channel
pnpm release:beta -- --minimum-launcher-version-override 0.18.12-beta.3
```

Notes:

- `release:beta` requires a clean worktree before it starts, because it may create a release commit and push tags.
- The runtime workflow is only triggered when the release batch includes `nextclaw`; pure package batches do not pay that extra closure cost.
- This command still follows the `minimumLauncherVersion` governance from `packages/nextclaw/npm-runtime-compatibility.json`; do not pass the override unless you are doing a deliberate recovery publish.

## Split beta shortcuts

If you only want to publish beta packages and do **not** want to open the auto-update channel yet, use:

```bash
pnpm release:beta:npm
```

This is the fast path for:

- shipping an npm beta quickly,
- validating package install / manual upgrade first,
- deferring the runtime workflow until later.

It is equivalent to the full beta owner with `--skip-runtime-channel`, but the command name makes the intent explicit.

If `nextclaw@beta` is already published and you later want to open or refresh the runtime update channel only, use:

```bash
pnpm release:beta:runtime
```

By default it:

1. reads the currently published `nextclaw@beta` version,
2. triggers `npm-runtime-update-release` for `channel=beta`,
3. waits for workflow success,
4. verifies GitHub release assets,
5. verifies `gh-pages` manifests and the public beta manifest URL.

Useful flags:

```bash
pnpm release:beta:runtime -- --dry-run
pnpm release:beta:runtime -- --version 0.18.12-beta.8
pnpm release:beta:runtime -- --release-tag nextclaw@0.18.12-beta.8
pnpm release:beta:runtime -- --minimum-launcher-version-override 0.18.12-beta.3
```

Recommended semantics:

- `pnpm release:beta` = full closure, package + runtime channel
- `pnpm release:beta:npm` = package only
- `pnpm release:beta:runtime` = runtime channel only
