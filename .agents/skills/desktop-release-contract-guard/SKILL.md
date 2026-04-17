---
name: desktop-release-contract-guard
description: Use when building, verifying, or releasing NextClaw desktop installers, DMGs, update bundles, or update manifests. Enforces the packaged update public key contract, the required verification commands, and the rule that raw electron-builder output is not enough.
---

# Desktop Release Contract Guard

## When to Use
- Any NextClaw desktop packaging, preview release, local installer handoff, or update-channel verification task.
- Any task mentioning `DMG`, desktop release, `electron-builder`, update manifest, beta/stable desktop channel, or "检查更新".

## Primary Contract
- A shipped desktop app must contain `Contents/Resources/update/update-bundle-public.pem`.
- The packaged public key must be able to verify the target update manifest signature.
- The packaged runtime must still boot under the Electron-bundled Node runtime, not only under the developer's ambient `node`.
- "能启动" 不等于 "可发布"。缺少更新验签材料的安装包视为坏包。

## Required Commands
1. Default verification command from repo root:
   - `PATH=/opt/homebrew/bin:$PATH pnpm desktop:package:verify`
2. Direct packaging path only after the public-key contract is ensured:
   - `pnpm -C apps/desktop bundle:public-key:ensure`
   - then `pnpm -C apps/desktop dist ...` or `pnpm -C apps/desktop pack ...`
3. If handing a local installer to a human, point them to `apps/desktop/release/...` and state the exact artifact path.

## Non-Negotiable Checks
- Confirm packaged app contains `resources/update/update-bundle-public.pem`.
- Confirm the key parses as a valid public key.
- Confirm it verifies the target manifest signature.
- Confirm installed-app runtime commands still work when executed through the packaged app binary with `ELECTRON_RUN_AS_NODE=1`.
- Confirm update check does not only "switch channel", but can actually complete the signature-verification path.

## Runtime Compatibility Gate
- Treat Electron's bundled Node version as the shipped runtime truth.
- Do not accept a desktop candidate if a CLI/runtime path only works under the developer's local `node` but fails under the packaged app binary.
- Be especially careful with new built-in Node modules such as `node:sqlite`: optional capabilities must not import them at module load time if Electron's bundled Node does not provide them.
- If a capability depends on a newer Node builtin than the packaged Electron runtime, gate that capability explicitly and keep desktop startup alive instead of crashing the whole launcher.
- If macOS DMG smoke falls back from GUI launch to `ELECTRON_RUN_AS_NODE`, run that fallback against an isolated temp home so a failed GUI bootstrap does not contaminate the fallback validation state.

## Forbidden Shortcuts
- Do not ship raw `electron-builder` output without the public-key preparation step.
- Do not "fix" missing packaged public key by skipping manifest signature verification in runtime.
- Do not accept "works with local node" as evidence that the packaged runtime is healthy.
- Do not claim validation passed if only unit tests passed.

## Recommended Response Pattern
- State the root cause in contract terms: missing packaged verifier, broken packaging contract, or manifest/signature mismatch.
- State which real command passed.
- State the exact installer path.
- State the expected user-visible result when clicking "检查更新".
