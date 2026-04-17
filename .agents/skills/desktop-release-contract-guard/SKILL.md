---
name: desktop-release-contract-guard
description: Use when building, verifying, or releasing NextClaw desktop installers, DMGs, update bundles, or update manifests. Enforces the packaged update public key contract, the required verification commands, and the rule that raw electron-builder output is not enough.
---

# Desktop Release Contract Guard

## Overview
- This skill is a release decision guide, not just a packaging note.
- Use it to drive the whole desktop release from local verification to GitHub assets to public update-channel confirmation.
- The goal is to prevent three failure modes:
  - shipping a bad package
  - mistaking a partial publish for a finished release
  - changing code when the real problem is release infrastructure or propagation

## When to Use
- Any NextClaw desktop packaging, preview release, local installer handoff, or update-channel verification task.
- Any task mentioning `DMG`, desktop release, `electron-builder`, update manifest, beta/stable desktop channel, or "检查更新".

## Primary Contract
- A shipped desktop app must contain `Contents/Resources/update/update-bundle-public.pem`.
- The packaged public key must be able to verify the target update manifest signature.
- The packaged runtime must still boot under the Electron-bundled Node runtime, not only under the developer's ambient `node`.
- The update-channel minimum launcher version must come from `apps/desktop/desktop-launcher-compatibility.json`, not from `apps/desktop/package.json`.
- "能启动" 不等于 "可发布"。缺少更新验签材料的安装包视为坏包。

## Launcher Compatibility Floor Contract
- `minimumLauncherVersion` is a compatibility floor, not a mirror of the current launcher release version.
- Default assumption: desktop update bundles stay compatible with the existing channel floor.
- Only raise the floor when the new bundle truly depends on a launcher-side contract break, for example:
  - new launcher-owned lifecycle or recovery behavior
  - new bundle manifest/layout/entrypoint contract that older launchers cannot read
  - new launcher-side security or signature contract
  - new launcher-owned state migration that older launchers would handle incorrectly
- Do not raise the floor for:
  - pure UI changes
  - runtime/server/plugin changes that stay inside the bundle
  - ordinary bugfixes or refactors
  - "because this release also ships a newer launcher"
- If the floor changes, update `apps/desktop/desktop-launcher-compatibility.json` intentionally and explain the reason in the release notes / iteration log.

## Required Commands
1. Default verification command from repo root:
   - `PATH=/opt/homebrew/bin:$PATH pnpm desktop:package:verify`
2. Inspect the governed channel floor before release:
   - `pnpm -C apps/desktop bundle:minimum-launcher-version -- --channel stable`
   - `pnpm -C apps/desktop bundle:minimum-launcher-version -- --channel beta`
3. Direct packaging path only after the public-key contract is ensured:
   - `pnpm -C apps/desktop bundle:public-key:ensure`
   - then `pnpm -C apps/desktop dist ...` or `pnpm -C apps/desktop pack ...`
4. If handing a local installer to a human, point them to `apps/desktop/release/...` and state the exact artifact path.
5. After creating a GitHub prerelease/tag, verify workflow and assets instead of stopping at `gh release create`:
   - `gh run view <run-id> --repo <owner/repo> --json status,conclusion,jobs`
   - `gh release view <tag> --repo <owner/repo> --json assets,isPrerelease,url`

## Release Flow
1. Verify locally first.
   - Run `PATH=/opt/homebrew/bin:$PATH pnpm desktop:package:verify`
   - Do not start GitHub release work until this passes.
2. Confirm the update-channel compatibility floor.
   - Read `apps/desktop/desktop-launcher-compatibility.json`
   - Verify the target `minimumLauncherVersion` still matches the governed floor for the channel
3. Create the prerelease or release tag.
   - Treat this as the trigger, not the success signal.
4. Watch the `desktop-release` workflow to completion.
   - Require overall `success`
   - Require the matrix jobs plus publish jobs
5. Verify GitHub release assets are actually present.
   - Expect platform installers, bundles, manifests, mac metadata, and `update-bundle-public.pem`
6. Verify update-channel source of truth.
   - Check `gh-pages` branch contents first
   - Then check the public Pages URL
7. Only announce "发布完成" after both are true:
   - workflow is fully green
   - public update-channel content reflects the new version

## Release Completion Gate
- Treat tag creation or `gh release create` success as the start signal, not the finish line.
- A desktop release is only complete when the release-triggered `desktop-release` workflow finishes with overall `success`.
- Confirm the matrix jobs and the follow-on publish jobs all finished:
  - `publish-release-assets`
  - `publish-desktop-update-channels`
  - `publish-linux-apt-repo` for stable releases
- Release assets may stay empty while the workflow is still running. Do not treat an empty `assets[]` list as proof of either success or final failure until the workflow attempt is finished.
- If packaging, smoke, bundle, and manifest steps already passed and the only failure is `actions/upload-artifact@v4` reporting `Upload progress stalled.`, rerun failed jobs first before changing product code or packaging logic.

## Public Update Channel Gate
- `gh-pages` branch content is the publishing source of truth.
- The public GitHub Pages URL may lag behind the branch due to CDN or Pages propagation.
- If `gh-pages` already shows the new manifest but the public URL still shows the previous version, treat that as propagation delay, not a failed publish.
- Keep watching until the public manifest reflects the new `latestVersion` and `minimumLauncherVersion`.

## Non-Negotiable Checks
- Confirm packaged app contains `resources/update/update-bundle-public.pem`.
- Confirm the key parses as a valid public key.
- Confirm it verifies the target manifest signature.
- Confirm release-manifest `minimumLauncherVersion` matches the channel floor from `apps/desktop/desktop-launcher-compatibility.json`.
- Confirm installed-app runtime commands still work when executed through the packaged app binary with `ELECTRON_RUN_AS_NODE=1`.
- Confirm update check does not only "switch channel", but can actually complete the signature-verification path.

## Runtime Compatibility Gate
- Treat Electron's bundled Node version as the shipped runtime truth.
- Do not accept a desktop candidate if a CLI/runtime path only works under the developer's local `node` but fails under the packaged app binary.
- Be especially careful with new built-in Node modules such as `node:sqlite`: optional capabilities must not import them at module load time if Electron's bundled Node does not provide them.
- If a capability depends on a newer Node builtin than the packaged Electron runtime, gate that capability explicitly and keep desktop startup alive instead of crashing the whole launcher.
- If macOS DMG smoke falls back from GUI launch to `ELECTRON_RUN_AS_NODE`, run that fallback against an isolated temp home so a failed GUI bootstrap does not contaminate the fallback validation state.

## Common Traps
- `gh release create` succeeded:
  - Meaning: the release object exists
  - Not enough because assets and update channels may still be missing
- `tag already exists`:
  - Meaning: a prior create attempt already made the tag or release
  - Do not assume publishing is complete; inspect the workflow and assets
- release page exists but `assets[]` is empty:
  - Usually means the workflow is still running or failed before publish jobs
- `actions/upload-artifact@v4` says `Upload progress stalled.`:
  - First action is `rerun failed jobs`
  - Do not jump to product-code changes if build, smoke, bundle, and manifest steps already passed
- local `node` works but desktop app fails:
  - Trust the packaged Electron runtime, not the developer shell
- public manifest still shows previous version:
  - Check `gh-pages` branch before diagnosing workflow failure
  - If branch is new and public URL is old, wait for propagation and re-check

## Forbidden Shortcuts
- Do not ship raw `electron-builder` output without the public-key preparation step.
- Do not "fix" missing packaged public key by skipping manifest signature verification in runtime.
- Do not accept "works with local node" as evidence that the packaged runtime is healthy.
- Do not claim validation passed if only unit tests passed.
- Do not derive `minimumLauncherVersion` from `apps/desktop/package.json` current version.
- Do not treat "tag already exists" or "release page exists" as proof that assets or update-channel manifests are published.

## Final Handoff Checklist
- Local verify command passed
- Release workflow ended in `success`
- Release assets are complete
- `gh-pages` branch manifest points at the new version
- Public update-channel URL reflects the new version
- Response includes:
  - release URL
  - workflow run URL
  - exact version pair: launcher + bundle
  - any propagation caveat or rerun history if it happened

## Recommended Response Pattern
- State the root cause in contract terms: missing packaged verifier, broken packaging contract, or manifest/signature mismatch.
- State which real command passed.
- State the exact installer path.
- State the expected user-visible result when clicking "检查更新".
