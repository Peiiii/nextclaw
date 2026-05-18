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
   - This verifies the package contract and isolated GUI smoke. It is not enough for handing a clickable local macOS artifact to a maintainer.
2. Local handoff verification command before giving a clickable macOS artifact to a human:
   - `PATH=/opt/homebrew/bin:$PATH pnpm desktop:package:handoff:verify`
   - This must run the normal package contract plus real-profile GUI smoke against the maintainer machine's desktop data dir.
   - If the user's existing desktop app is already running, quit it first or treat a single-instance-lock failure as a real failed handoff verification.
3. Inspect the governed channel floor before release:
   - `pnpm -C apps/desktop bundle:minimum-launcher-version -- --channel stable`
   - `pnpm -C apps/desktop bundle:minimum-launcher-version -- --channel beta`
4. Direct packaging path only after the public-key contract is ensured:
   - `pnpm -C apps/desktop bundle:public-key:ensure`
   - then `pnpm -C apps/desktop dist ...` or `pnpm -C apps/desktop pack ...`
5. If handing a local installer to a human, point them to `apps/desktop/release/...` only after handoff verification passes and state the exact artifact path.
6. After creating a GitHub prerelease/tag, verify workflow and assets instead of stopping at `gh release create`:
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
- `ELECTRON_RUN_AS_NODE` checks are compatibility diagnostics only. They are useful for isolating packaged-runtime issues, but they do not count as desktop GUI smoke and must not be used to pass a failed app-window launch.

## Cross-Platform Build Contract
- Desktop release builds must treat Windows, macOS, and Linux shells as different execution environments.
- Package build scripts used by the desktop runtime must not depend on POSIX-only expansion such as `$(find ...)`, shell glob expansion, or Unix-only utilities unless the command explicitly runs inside a known compatible shell on every release runner.
- Prefer tool-native globs, Node scripts, or existing workspace package commands over shell-expanded file lists.
- Windows PowerShell release steps must fail on native command errors instead of silently continuing after a broken package build.
- Product bundle creation must assert the packaged runtime shape before publishing:
  - require `runtime/dist/cli/app/index.js`, `runtime/dist/cli/app/index.mjs`, `runtime/dist/cli/app/features/session-search/worker/session-search-worker-host.utils.js`, and `runtime/ui-dist/index.html`;
  - forbid `runtime/node_modules`;
  - enforce a low runtime file-count budget so accidental raw dependency trees fail during build.
- If a runtime asset is missing, fix the package build/bundle contract first; do not debug it as an app startup problem until the packaged files are present.
- Slow first boot caused by thousands of update-bundle files must be solved at the bundle shape owner. Do not optimize extraction, staging trash, or cleanup around a raw `node_modules` tree when the correct fix is to stop producing that tree.

## Unsigned macOS Local Gate
- Do not treat `codesign --verify --deep --strict` as proof that a local unsigned macOS app opens.
- Always classify a macOS launch failure before handing off an artifact:
  - broken bundle signature or missing nested signing material: fix packaging;
  - packaged runtime child process cannot boot: fix the launcher/runtime process owner, not Gatekeeper instructions;
  - `spctl` / AMFI / AppleSystemPolicy rejects ad-hoc or unknown certificate chain: this is unsigned trust policy and requires user approval, a trusted local certificate, or Developer ID notarization.
- For Electron apps, avoid using raw `codesign --deep` as the primary repair path. Sign nested Electron helpers/frameworks with Electron-aware signing, then apply project entitlements only to the owners that need them.
- If the project intentionally ships unsigned macOS builds, final handoff must say whether local launch was truly smoke-tested, blocked by unsigned trust policy, or requires the documented `Open Anyway` flow.
- For intentional unsigned macOS builds, do not ask the user to import, trust, or unlock a local signing certificate unless they explicitly choose to change the product policy to signed builds. The normal no-password path is the documented unsigned-app approval flow, not Keychain trust changes.
- A GUI desktop smoke must prove more than "the process stayed alive":
  - a visible-window lifecycle signal such as `ready-to-show` must be logged;
  - renderer load completion such as `did-finish-load` must be logged;
  - runtime health must pass through the GUI-launched app process;
  - startup elapsed time must be printed and bounded by an explicit threshold.
- Windows GUI smoke must enforce the same visible-window contract:
  - require the real desktop runtime URL from the current `main.log` launch window, for example `runtime.process.ready ... uiUrl=http://127.0.0.1:<port>` or `Loading desktop window URL: http://127.0.0.1:<port>`;
  - require `did-finish-load` or renderer diagnostics for that real runtime URL within the configured `MaxReadySec` threshold;
  - never count the startup shell `data:` page as app readiness, even if it emits `ready-to-show` or `did-finish-load`;
  - require current-launch API probes against the discovered runtime URL, including `/api/health`, `/api/auth/status`, `/api/config`, and `/api/ncp/sessions`;
  - fail on startup blockers from the current log window instead of accepting a later or stale health check;
  - never use an `ELECTRON_RUN_AS_NODE` runtime fallback as a passing GUI result.
- If a smoke script accepts a fixed default port such as `55667` without proving the current GUI launch owns or loaded that port, treat the result as invalid because it can pass against a stale background service.
- Windows desktop runtime child processes launched from the Electron GUI must be hidden (`windowsHide: true`) and covered by a regression test, because visible `init` / `serve` console flashes are release-blocking UX defects.
- Desktop startup speed must be measured on the real app/API readiness path, not merely on a placeholder window. Showing a startup shell improves perceived feedback, but does not satisfy the release gate until the real UI and API are both ready.
- A desktop handoff smoke must also inspect the launcher log for the current launch window and fail on known startup blockers such as `ENAMETOOLONG`, `ENOTEMPTY`, `ERR_FAILED`, `render-process-gone`, or `Failed to bootstrap runtime`; absence of log inspection is not a valid pass.
- When validating a build for a machine that already has desktop state, run a real-profile check against that machine's existing desktop data dir in addition to any isolated smoke. The real-profile check must prove stale staging, bad-version state, and existing bundles do not break startup.
- When the runtime reaches API readiness and provider credentials are available, run `pnpm smoke:ncp-chat` against the desktop-started runtime and require a non-empty assistant reply. A health endpoint alone is not enough to claim the desktop runtime is usable.
- Runtime fallback checks are diagnostics only. They must never turn a failed GUI launch smoke into a passing desktop package verification.

## Directly Usable Package Contract
- A local desktop package is "directly usable" only if the exact artifact path has passed the handoff ladder or the failure is explicitly classified as unsigned macOS trust policy with documented user approval steps.
- For maintainer handoff on macOS, use `pnpm desktop:package:handoff:verify`, not only `pnpm desktop:package:verify`.
- The handoff result must include:
  - artifact path and size;
  - seed bundle path and size;
  - isolated GUI smoke elapsed time;
  - real-profile GUI smoke elapsed time;
  - current-launch log evidence for `Desktop main entry loaded`, runtime startup, `ready-to-show`, `did-finish-load`, and core API health;
  - explicit statement that no known startup blocker appeared in the current launch window.
- Startup is not acceptable just because it eventually appears. Treat a visible-window ready time above the configured `DESKTOP_SMOKE_MAX_READY_SEC` as a failed candidate, then diagnose slow startup before handoff.
- If the same class of failure recurs, improve the smoke or diagnostic script before trying another blind package iteration.

## Local Handoff Validation Ladder
Use this ladder before telling a human that a local DMG / `.app` is ready:

1. Build and inspect artifacts.
   - Print exact artifact paths and sizes.
   - Compare DMG, mac zip, packaged seed bundle, and app contents against the last known good build when size changed unexpectedly.
   - If the size jump is not explained by a known feature, inspect dependencies and embedded runtime contents before handoff.
2. Establish the launch surface before handing off a clickable path.
   - A new unsigned macOS `.app` copy has a fresh cdhash/trust state. Do not present it as directly clickable until that exact path has passed GUI smoke or been approved through macOS UI.
   - For fast visual/UI iteration on a maintainer machine, prefer the already system-approved installed app plus an explicitly updated runtime/UI bundle, then validate through current launcher logs.
   - Keep package validation and visual-preview validation separate in the report; a system-approved preview path does not make a new unsigned DMG approved.
3. Run isolated GUI smoke.
   - Use a clean temp home to catch broken packaging and first-run failures.
   - Require visible window, renderer load, GUI-launched health, and bounded ready time.
4. Run real-profile GUI smoke on the maintainer machine.
   - Use the existing desktop data dir, not a clean substitute.
   - Start log inspection at the current launch line so old errors do not pollute the result and new errors cannot hide in a long log.
   - Confirm staging leftovers, bad-version state, and existing same-version bundles do not break startup.
5. Run AI capability smoke from the GUI-launched runtime.
   - Discover the runtime port from the current desktop log or process tree.
   - Hit `/api/health` on that port.
   - If provider credentials are available, run `pnpm smoke:ncp-chat` and require the expected assistant text.
6. Only then hand off the artifact.
   - If any rung fails, classify the failure and keep debugging. Do not replace the failed rung with a weaker proof.

## Failure Triage Playbook
- Dock bounce or no visible window:
  - Inspect the current launcher log window first and record whether a new `Desktop main entry loaded` line exists.
  - If there is no new JS log, inspect AMFI / AppleSystemPolicy / Gatekeeper logs and treat this as a system admission failure, not a renderer/runtime bug.
  - If JS starts but no window is ready, inspect `ready-to-show`, `did-finish-load`, `render-process-gone`, and renderer console/fetch logs.
- Same app keeps bouncing but no new window appears:
  - Check for `Another desktop instance is already running`.
  - Quit the existing installed app before handoff smoke; do not confuse a single-instance-lock exit with a passing package launch.
- Native module or helper killed by macOS policy:
  - Look for `Library load denied by system policy`, `has no CMS blob`, helper process death, or `.node` paths in the system log.
  - Separate app executable admission from runtime native-module admission; they have different owners and fixes.
  - Do not continue random packaging retries until the first denied path is identified.
- `ERR_FAILED (-2)`:
  - Treat it as renderer could not load the runtime URL, not as a generic network hiccup.
  - Check whether the GUI-launched runtime API ever became ready and whether a renderer helper was killed by macOS policy.
- `ENOTEMPTY`, partial same-version bundle, or slow first boot:
  - Inspect the real version store under the desktop data dir.
  - Same-version seed retry must replace invalid existing bundles before boot; synchronous deletion of large runtime trees on the startup path is a bug.
- `ENAMETOOLONG` under `staging/.trash-*`:
  - Look for recursive trash naming.
  - Cleanup of staging trash must delete directly instead of trashing the trash again.
- Repeated "same seed already failed" after launcher fixes:
  - Quarantine decisions must include the launcher/app-shell fingerprint, not only the packaged seed archive hash.
  - A fixed launcher may need to retry the same seed archive that an older launcher marked bad.
- Suspicious DMG size increase:
  - Compare artifact sizes before debugging runtime behavior.
  - Use `du -sh` and dependency inspection to find accidentally embedded companions, duplicate runtimes, or stale release contents.
  - Removing an obsolete companion dependency is valid only after confirming the shipped runtime no longer depends on it.

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
- isolated smoke passed but the user's app still fails:
  - Run real-profile smoke against the user's existing desktop data dir and inspect the current launch log window.
  - Do not claim fixed until the same class of user-visible path passes.
- public manifest still shows previous version:
  - Check `gh-pages` branch before diagnosing workflow failure
  - If branch is new and public URL is old, wait for propagation and re-check

## Forbidden Shortcuts
- Do not ship raw `electron-builder` output without the public-key preparation step.
- Do not "fix" missing packaged public key by skipping manifest signature verification in runtime.
- Do not accept "works with local node" as evidence that the packaged runtime is healthy.
- Do not claim validation passed if only unit tests passed.
- Do not claim validation passed if only process liveness, `codesign`, or isolated smoke passed.
- Do not present runtime fallback success as GUI success.
- Do not ignore user-provided local errors just because they are absent from a clean smoke environment.
- Do not use POSIX-only shell expansion in runtime package build scripts that run in Windows desktop release jobs.
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
