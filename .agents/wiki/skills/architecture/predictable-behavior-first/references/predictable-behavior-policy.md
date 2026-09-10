# Predictable Behavior Policy

## Core Principle

Behavior should be explicit, clear, and predictable.

We do not want surprise success and we do not want surprise failure.

Compatibility is not automatically safety.

If a fallback makes a broken package, broken deploy, or broken runtime look healthy in only some environments, it is defect camouflage.

## Default Policy

- Shipped artifacts must be self-sufficient.
- Broken required assets should fail immediately with a direct recovery hint.
- Dev convenience paths are allowed only when they are explicit and impossible to confuse with shipped behavior.

## Exception Bar

Compatibility may stay only if at least one of these is true:

- Removing it would break a real external contract that current users actively depend on.
- A compliance or platform constraint requires overlap during migration.
- The system needs a short-lived rollback bridge to reduce production risk during a controlled rollout.

If none of these is true, remove the compatibility path.

## Required Conditions For Any Allowed Compatibility Path

- Explicit trigger:
  A flag, mode, or environment variable must enable it. No hidden auto-detection by ambient machine state.
- Narrow scope:
  Only cover the exact migration or risk boundary that needs protection.
- Observability:
  Log or surface that the compatibility path was taken.
- Exit condition:
  Define what future event removes it.
- Owner:
  Someone must own cleanup.

## Review Checklist

Ask these questions in order:

1. What exact failure is this fallback trying to avoid?
2. Is that failure actually a defect in packaging, deployment, config, or runtime wiring?
3. If the fallback stays, can a broken release still appear healthy on a developer machine?
4. Can the same goal be met by fail-fast plus a better error message?
5. If compatibility is still required, what explicit trigger and removal condition will keep it bounded?

## Good Patterns

- A published CLI fails with "UI bundle missing; reinstall or rebuild" instead of searching random nearby source folders.
- A dev-only mode uses `NEXTCLAW_UI_STATIC_DIR=/abs/path` to point at a local frontend build.
- A temporary migration bridge prints that legacy mode was activated and names the removal milestone.
- The same input and install state produce the same runtime behavior regardless of repository checkout location.

## Bad Patterns

- A globally installed CLI silently serves UI files from the current repository checkout.
- A fallback scans multiple unrelated directories until something works, hiding a broken package.
- Old and new implementations run in parallel "just in case" with no owner or removal date.
- Silent defaults make a misconfigured system appear healthy while producing environment-specific behavior.
