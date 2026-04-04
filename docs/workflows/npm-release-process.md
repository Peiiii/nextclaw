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
- If you need the historical full-workspace gate, run `pnpm release:check:all` explicitly.
- `pnpm release:report:health` remains a non-blocking repository hygiene report, but it now also prints the current batch registry status so you can distinguish “already published but missing local closure steps” from “still missing on npm”.
- `pnpm release:verify:published` is the registry truth check. It polls npm for the exact `pkg@version` pairs in the current batch and fails if they still do not exist after the retry window.
- `release:publish` should run `release:check` (build + lint + typecheck) before publishing.
- `release:publish` now also runs `release:verify:published` after `changeset publish` and before `changeset tag`, so “published online” becomes part of the standard release closure instead of a manual follow-up.
- `release:publish` should create git tags automatically.
- Never run `npm publish` directly inside `packages/*`, `packages/extensions/*`, or `packages/ncp-packages/*`.
- In this pnpm workspace, direct `npm publish` keeps `workspace:*` in the published manifest and breaks downstream installs.
- If you need to publish a single package manually, use `pnpm publish` from that package directory, or the repo-root `pnpm release:publish` flow.

## UI-only shortcut

If only the frontend UI changed, use the one-command shortcut. It will create a changeset for
`@nextclaw/ui` + `nextclaw`, then run the standard version + publish steps.

```bash
pnpm release:frontend
```
