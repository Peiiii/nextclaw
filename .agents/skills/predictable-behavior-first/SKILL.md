---
name: predictable-behavior-first
description: Use when a task involves fallbacks, backward compatibility, graceful degradation, environment-specific rescue paths, legacy retention, or "just in case" compatibility logic. Prefer explicit, clear, predictable behavior over hidden rescue paths, and require strict necessity plus exit conditions for any compatibility path.
---

# Predictable Behavior First

## Overview

Use this skill to keep system behavior explicit, clear, and predictable.

The product principle behind this skill is simple:

- We do not want surprise success.
- We do not want surprise failure.
- We do not want behavior that changes because of hidden environment state.

Use it to prevent "helpful" compatibility logic from hiding broken packaging, broken config, or broken runtime contracts.

Default stance:

- Prefer fail-fast over silent rescue.
- Prefer one clear source of truth over multiple fallback sources.
- Prefer explicit dev-only switches over automatic environment sniffing.
- Prefer fixing release/build/deploy contracts at the source over teaching shipped runtime to recognize incident signatures.

## When To Use

Trigger this skill when work includes any of these patterns:

- Adding or changing fallback paths.
- Keeping old and new implementations alive at the same time.
- Backward compatibility requests without a clearly proven need.
- Runtime behavior that depends on `cwd`, local repo files, or ambient machine state.
- Graceful degradation that can turn a broken release into a "works on my machine" illusion.
- "Just in case" retries, defaults, silent recovery, or legacy code preservation.
- Protocol or transport mismatches such as `stream` vs non-stream, SSE vs JSON, long-poll vs evented delivery, or request/response shape drift.
- A proposal to inspect stderr/stdout text, broken-version markers, or current incident signatures inside runtime code to explain or route around a release accident.
- A `read/get/list/status/discover/report` path that may import modules, register capabilities, write state, or call external systems.
- Frontend page-load, polling, or focus-refetch behavior that might automatically trigger anything beyond pure data reads.

## Workflow

1. Identify the primary contract.
   For example: published npm package, packaged desktop app, public API, config schema, persisted data contract.
2. Separate shipped-runtime behavior from dev-only behavior.
   A globally installed CLI must not silently depend on repo-local artifacts unless dev mode is explicit.
3. Ask the masking question.
   Would this fallback make system behavior less predictable by hiding a packaging, config, release, or runtime bug that should fail loudly?
4. If yes, remove the fallback or gate it behind an explicit dev-only switch.
   If the failure is a protocol mismatch, fix the primary contract from the first request instead of probing one mode and switching after an error.
5. If compatibility still seems necessary, apply the exception bar from [references/predictable-behavior-policy.md](references/predictable-behavior-policy.md).
6. When keeping any compatibility path, record its trigger, scope, owner, and removal condition in the change summary.

## Read vs Action Checklist

Use this checklist whenever a request path, hook, controller, or helper may be auto-triggered.

1. Decide whether the path is observation or execution.
   Observation means reading state for display, sync, or validation.
   Execution means loading, registering, mutating, authorizing, installing, enabling, disabling, or calling external systems.
2. If the name suggests observation, require pure-read behavior.
   Names like `read`, `get`, `list`, `status`, `discover`, and `report` must be repeat-safe and side-effect-free.
3. If the path can be triggered automatically by frontend lifecycle behavior, raise the bar further.
   Page-load, route-enter, polling, retry, reconnect, and focus-refetch paths must never hide execution behind a read shape.
4. If observation and execution are mixed, split them.
   Preferred shape:
   - one explicit read/discovery path for UI and monitoring
   - one explicit action/load path for runtime or user-triggered actions
5. Check that displayed labels match certainty.
   Do not label a lightweight discovery result as `loaded`, `running`, or `active` unless real execution has actually happened.

## Review Questions

Before accepting a design, answer these:

- Is this path pure-read, or is it secretly executing work?
- If the frontend auto-triggers this path three times, is that still harmless?
- Does the name honestly match the behavior?
- Should this be split into observation and execution instead of adding a mode flag?
- If a mode flag is temporarily kept, is it only an internal transition aid rather than the long-term API shape?

## Forbidden Patch Patterns

Do not add these to shipped runtime unless the user explicitly asks for a temporary incident stopgap and you record a removal condition:

- `stderr.includes(...)` / `stdout.includes(...)` checks that recognize a current packaging, release, deploy, or upstream outage signature.
- hardcoded references to "latest release is broken", a currently bad version, or a known temporary registry accident.
- runtime branches whose only purpose is to explain, soften, or route around a broken artifact that should have been blocked by release validation.
- request one transport mode first, then inspect upstream error text to switch to the real required mode on retry, when the correct primary contract could have been sent immediately.

If the problem is a broken published package, broken installer, broken deploy, or bad config contract, the default fix is:

1. fix the source contract,
2. add a guard/check in release/build/deploy flow,
3. keep runtime behavior generic and truthful.

## Decision Rules

- Behavior should be explicit, clear, and predictable.
- Do not let "works on my machine" paths redefine shipped behavior.
- Do not let production/runtime correctness depend on `cwd`.
- Do not let published artifacts borrow missing resources from source checkouts.
- Do not add silent fallbacks that turn release defects into environment-specific behavior.
- Do not encode one-off incident knowledge into runtime conditionals just because the current failure is easy to pattern-match.
- Do not keep dual paths unless the old path has a real, current, externally constrained purpose.
- If a fallback is only for development, require an explicit switch or explicit environment variable.
- Do not let read-shaped APIs hide load/register/write/execute behavior.
- Do not let frontend automatic requests trigger side effects.
- If a compatibility path stays, it must have:
  - a concrete necessity,
  - a bounded scope,
  - observable signaling,
  - an exit condition.

## Output Requirements

When this skill is used, the answer should state:

- what the primary contract is,
- whether the path is observation or execution,
- whether any auto-triggered caller could hit side effects,
- whether the proposed fallback makes behavior less predictable or masks a real defect,
- whether the proposal is actually an incident-specific runtime patch that should be rejected,
- whether the path is forbidden, dev-only, or temporarily allowed,
- and, if allowed, what removes it later.

## Reference

Read [references/predictable-behavior-policy.md](references/predictable-behavior-policy.md) when you need:

- the exception bar for allowing compatibility,
- concrete examples of allowed vs forbidden fallback logic,
- a compact review checklist for fallback-heavy changes.
