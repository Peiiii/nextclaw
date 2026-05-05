---
name: npm-release-contract-guard
description: Use when publishing NextClaw NPM packages or NPM runtime update channels, including beta/stable dist-tags, nextclaw@beta validation, runtime bundle manifests, packaged update public keys, and npm registry closure checks.
---

# NPM Release Contract Guard

## Overview
- Use this skill for NextClaw NPM package releases and NPM runtime update channel releases.
- Keep desktop release work in `desktop-release-contract-guard`; do not add another release orchestration layer.
- The goal is to prevent three mistakes:
  - treating an NPM package publish as complete before registry verification
  - shipping `nextclaw` without the packaged runtime update public key
  - treating an env-only runtime update test as a real user beta validation

## Scope
- `nextclaw` NPM package publishing, including beta and stable dist-tags.
- Workspace package release batches when they include NPM packages.
- NPM runtime update bundles under `npm-runtime-updates/<channel>`.
- User-facing validation of `nextclaw@beta` or stable NPM installs.
- Not desktop DMG/installer/update-manifest publishing.

## Primary Contracts
- Prefer the repo release flow; do not publish from package folders with raw `npm publish`.
- A published `nextclaw` package must include `resources/update-bundle-public.pem`.
- The published package must include both launcher and app runtime entries:
  - `dist/cli/launcher/index.js`
  - `dist/cli/app/index.js`
- NPM runtime update manifests must use `hostKind: "npm-runtime-bundle"`.
- `minimumLauncherVersion` for NPM runtime bundles comes from `packages/nextclaw/npm-runtime-compatibility.json`.
- Do not raise `minimumLauncherVersion` unless the launcher-side contract really broke.

## Package Release Flow
1. Sync and check package README content:
   - `pnpm release:sync-readmes`
   - `pnpm release:check-readmes`
2. Prepare versions with the repo release flow:
   - `pnpm release:version`
3. For a release batch that includes `nextclaw`, make sure the packaged update public key exists before publish:
   - `NEXTCLAW_UPDATE_BUNDLE_PRIVATE_KEY=... pnpm -C packages/nextclaw runtime-update:build -- --channel beta --skip-build --output-dir tmp/npm-runtime-update-key-check`
   - Use `--channel stable` for stable releases.
4. Publish through the repo release flow:
   - `pnpm release:publish`
5. Verify the registry state:
   - `pnpm release:verify:published`
   - `npm view nextclaw dist-tags --json`

## Beta Package Rule
- Prefer the repo changeset/pre-release flow for beta releases.
- If a single-package beta publish is unavoidable, use pnpm:
  - `pnpm -C packages/nextclaw publish --tag beta`
- After publish, verify the tag directly:
  - `npm view nextclaw@beta version`
  - `npm view nextclaw dist-tags --json`

## Runtime Update Channel Flow
1. Trigger `.github/workflows/npm-runtime-update-release.yml` for the target channel.
2. Wait for the workflow conclusion to be `success`; dispatch alone is not a release.
3. Verify `gh-pages` contains the channel files:
   - `npm-runtime-updates/<channel>/manifest-<channel>-<platform>-<arch>.json`
   - `npm-runtime-updates/<channel>/nextclaw-runtime-<platform>-<arch>-<version>.zip`
   - `npm-runtime-updates/update-bundle-public.pem`
4. Verify the public GitHub Pages URL reflects the same manifest version.
5. Confirm the manifest has the expected `latestVersion`, `minimumLauncherVersion`, and `hostKind`.

## User-Facing Beta Validation
- Validate from an isolated home so local development state is not involved:

```bash
export NEXTCLAW_HOME="$(mktemp -d)"
nextclaw update --channel beta --check
nextclaw update --channel beta
nextclaw update --apply
nextclaw --version
```

- Expected behavior:
  - `--check` detects the beta update without downloading.
  - `update --channel beta` downloads and verifies the runtime bundle.
  - `update --apply` switches the active runtime pointer.
  - the next `nextclaw` process runs the downloaded runtime version.

## Completion Gate
- The NPM registry shows the intended package version and dist-tag.
- The runtime update workflow finished successfully.
- The public manifest URL shows the expected version and compatibility floor.
- A real `nextclaw@beta` or stable install can check, download, and apply without custom manifest URL or public key env vars.
- Final release notes must include:
  - NPM package version
  - dist-tag
  - workflow URL
  - public manifest URL
  - exact user-facing validation commands and result

## Forbidden Shortcuts
- Do not use raw `npm publish` as the default release path.
- Do not publish `nextclaw` without `resources/update-bundle-public.pem`.
- Do not claim release success after workflow dispatch only.
- Do not count an env-only `NEXTCLAW_UPDATE_MANIFEST_URL` test as user beta validation.
- Do not raise `minimumLauncherVersion` just because a new package version exists.
