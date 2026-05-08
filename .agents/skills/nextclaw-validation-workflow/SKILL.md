---
name: nextclaw-validation-workflow
description: Use when running /validate, choosing validation commands after changes, closing code work, checking TypeScript/build/lint requirements, doing bugfix resolution verification, smoke testing, maintainability guard/review, governance ratchets, or release validation.
---

# NextClaw Validation Workflow

## Classify The Change

First classify the touched surface:

- pure docs / wording / metadata,
- source code,
- TypeScript types or import/export boundaries,
- scripts or tests,
- runtime-path config,
- user-visible or runnable behavior,
- bugfix / root-cause fix,
- release or deployment path.

## Required Baseline

Pure docs, wording, or trivial metadata:

- build/lint/tsc not required,
- say why they are not applicable,
- still do structural checks that match the edit, such as links, headings, or size stats.

TypeScript source, type declarations, import/export boundaries, or runtime path:

- `tsc` is required,
- tests, eslint, and governance commands do not replace `tsc`.

Source code, scripts, tests, or runtime-path config:

- ESLint is required before closeout or commit.
- Prefer the package-level lint command for the touched package, for example `pnpm --filter nextclaw lint`.
- If package-level lint is already blocked by unrelated existing errors, run ESLint on every file touched by the current change and report:
  - the exact targeted ESLint command,
  - whether targeted lint has errors or only warnings,
  - the package-level lint command attempted,
  - the unrelated existing package-level errors that still block full lint.
- Governance commands do not replace ESLint. `pnpm lint:new-code:governance` catches repository governance rules, but it is not a substitute for `@typescript-eslint` / ESLint checks.
- Do not commit code after touching source files unless package-level lint passed, or targeted ESLint for all touched files passed and the full package lint failure is explicitly identified as unrelated existing debt.

User-visible or runnable behavior:

- run a smoke test close to the real workflow,
- use a non-repo isolated location for smoke data when possible.

Bugfix or abnormal behavior fix:

- define the observable success condition before closing,
- verify with the most realistic available path.

## Maintainability Closure

For source, scripts, tests, or runtime-path config:

1. Run maintainability guard:

```bash
node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs
```

For pure bugfix, pure refactor, structure cleanup, naming cleanup, or other non-feature changes:

```bash
node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature
```

You may add `--paths <touched-files...>` when narrowing to touched scope is appropriate.

2. Run governance:

```bash
pnpm lint:new-code:governance
pnpm check:governance-backlog-ratchet
```

3. Run `post-edit-maintainability-review`.

For non-feature changes, the review fails if non-test code net growth is positive.

## Code Structure Precheck

Before code edits, use `nextclaw-clean-implementation` and explicitly check:

- whether this is a new user capability,
- what can be deleted first,
- owner class / manager / service / presenter boundary,
- no function sprawl,
- ordinary functions do not mutate inputs,
- class instance methods use arrow fields when applicable,
- React effects only sync external systems,
- no duplicate functionality,
- smallest credible validation.

## Bugfix Resolution Verification

For fixes, record:

- `验证场景`,
- `观察指标`,
- `结果`,
- `剩余未验证缺口`.

Priority order:

1. Real reproduction path.
2. Targeted smoke close to the chain.
3. Minimal proof substitute.

If real verification is blocked, say why and what the next smallest proof would be.

## Release Validation

For release or deployment:

- migration is required only when backend/database changes require it,
- online smoke is required for affected critical APIs or UI paths,
- NPM release must list exact packages and dependent packages,
- docs review is part of release closure,
- skipped steps must be marked `不适用` with reason.

## Retrospective Closure

After a bugfix, abnormal-behavior fix, or release closure, do a short retrospective before the final answer:

- name the workflow gap or repeated friction, if any,
- decide whether the improvement belongs in `AGENTS.md`, an existing skill, a new skill, automation, validation command, or ordinary docs,
- directly apply small rule or skill improvements when they are clearly needed,
- create a follow-up only when the improvement is larger than the current safe scope,
- say when no mechanism change is needed and why.

## Final Response Checklist

Include only the relevant items:

- commands run and outcomes,
- exact `tsc` command if TypeScript path was touched,
- smoke scenario and observation,
- maintainability guard/review outcome,
- retrospective result and any mechanism/skill improvement,
- release/deploy/NPM state,
- skipped validation with `不适用` reason.
