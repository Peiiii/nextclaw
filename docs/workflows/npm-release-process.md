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
