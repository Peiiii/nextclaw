# NextClaw 24h Curated Change Report

## Window

- Time range: `2026-03-06 15:55 CST` to `2026-03-07 15:55 CST`
- Scope basis: Git commits in the repository within the window, plus published package/release signals

## Executive Summary

This 24-hour cycle is not just a routine patch pass. It shows a clear product direction shift:

1. Marketplace skill installation moved from "works when environment is ideal" to "works by default on constrained environments", especially Windows without `git`.
2. CLI operational semantics were clarified for automation reliability: status command behavior and version-query intent are now explicitly separated.
3. Delivery velocity stayed high while release discipline was tightened: multiple package releases landed and release metadata stayed synchronized.
4. Team process governance was strengthened in parallel (cross-platform-first and monotonic log version rules), reducing repeated execution errors in future iterations.

## What Actually Changed (Curated by Theme)

## 1) Marketplace Skill Install Reliability Became Cross-Platform by Default

### Problem before this cycle

- Installing marketplace git-based skills could fail with path-related runtime errors.
- Environments without `git` (common on some Windows setups) were blocked.
- Historical install paths mixed `.agents/skills` and workspace `skills`, causing operational ambiguity.

### Key improvements in this cycle

- Reworked git-skill install path inside NextClaw service flow.
- Added two-stage install strategy:
  - Fast path: `git sparse-checkout` when `git` exists.
  - Fallback path: GitHub HTTP recursive download when `git` is unavailable.
- Standardized target directory to workspace `skills/` for NextClaw-native behavior.
- Added regression tests covering fallback behavior and install/uninstall path expectations.
- Completed smoke verification under isolated temp workspace with `git` intentionally unavailable.

### User-facing impact

- "Click install" on marketplace skills is significantly more robust across host environments.
- Windows users without system git can complete install without manual environment patching.

## 2) CLI Semantics Were Tightened for Automation and Agent Correctness

### Problem before this cycle

- Version query and status query could be conflated by tools/agents.
- Status output interpretation had friction for scripts and automation workflows.

### Key improvements in this cycle

- Explicitly reinforced: version lookup should use `nextclaw --version`.
- Aligned docs and self-management skill guidance to avoid intent misrouting.
- Added diagnostics/status test coverage for expected command behavior.
- Updated usage/troubleshooting docs in both Chinese and English.

### User-facing impact

- Less ambiguity in ops commands.
- Better reliability for scripted checks and AI-assisted self-management flows.

## 3) Release and Distribution Closed the Loop

Within this 24-hour window, release-related actions formed a full chain:

- `nextclaw` package progressed to `0.9.13` and is now the npm `latest`.
- Release metadata/changelog were updated in sync with package versions.
- GitHub release for `nextclaw@0.9.13` was published/updated with bilingual notes.

This means the above improvements are not only in-repo; they are externally consumable.

## 4) Process Governance Was Upgraded (Meta, but High-Leverage)

Two governance updates reduce future delivery noise:

- `docs/logs` semver naming is now enforced as globally monotonic.
- Cross-platform-first rule was added for NextClaw CLI/install/service flows.

These changes reduce repeat mistakes and force platform-awareness earlier in implementation.

## Delivery Footprint (24h)

- Commits in window: `10`
- Dominant change area: `packages/*` (core product/runtime behavior), then docs and app-level surfaces
- Highest-impact commits were concentrated around:
  - marketplace install reliability
  - CLI status/version behavior clarification
  - release synchronization

## Risks and Follow-Ups

## Current residual risks

- GitHub HTTP fallback currently depends on GitHub API/path availability; rate-limit and network edge behavior should be monitored in real-world usage.
- Long-file lint warnings remain historical debt (non-blocking, but still maintenance pressure).

## Recommended next 24h actions

1. Add lightweight telemetry/log markers for fallback path usage rate (`git` path vs `github-http` path).
2. Add one end-to-end UI route smoke in CI for marketplace install with mocked no-git host.
3. Start reducing oversized command/service modules to lower future regression probability.

## Appendix: Representative Commits in Window

- `2f190d1` feat: improve marketplace skill install fallback and status guidance
- `09af0a9` chore(release): publish nextclaw 0.9.13
- `b65c54e` docs: add iteration log for status exit behavior
- `1a555ee` docs: enforce monotonic log versions

