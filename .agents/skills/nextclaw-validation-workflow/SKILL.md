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
- If the reported issue is an editor/tsserver unused-symbol diagnostic such as `ts(6133)`, or a change removes/moves imports and exported types across package boundaries, first run ESLint autofix on the touched files or package so `unused-imports/no-unused-imports` can remove stale imports automatically. Then run a validation path that can surface unused locals for the touched package or touched files. If the stricter unused check is blocked by unrelated existing diagnostics, report those blockers and still prove the touched symbol no longer appears or is no longer unused.

Source code, scripts, tests, or runtime-path config:

- ESLint is required before closeout or commit.
- Prefer the package-level lint command for the touched package, for example `pnpm --filter nextclaw lint`.
- If package-level lint is already blocked by unrelated existing errors, run ESLint on every file touched by the current change and report:
  - the exact targeted ESLint command,
  - whether targeted lint has errors or only warnings,
  - the package-level lint command attempted,
  - the unrelated existing package-level errors that still block full lint.
- Governance commands do not replace ESLint. `pnpm lint:new-code:governance` catches repository governance rules, but it is not a substitute for `@typescript-eslint` / ESLint checks.
- Cross-workspace package import boundary changes must pass `pnpm lint:new-code:package-public-imports` directly or through `pnpm lint:new-code:governance`.
- Agent execution path changes must keep live code on the NCP agent-run main chain. `pnpm lint:new-code:governance` performs a live-code scan and fails if `AgentLoop`, `NativeAgentEngine`, `runtimePool`, `GatewayAgentRuntimePool`, or `processDirect(...)` reappears under `packages/`, `apps/`, or `workers/`.
- Do not commit code after touching source files unless package-level lint passed, or targeted ESLint for all touched files passed and the full package lint failure is explicitly identified as unrelated existing debt.

User-visible or runnable behavior:

- “验证通过”不是只指编译、类型、lint、单测或治理检查通过；只要改动有可运行行为、用户路径、API/transport 行为或功能语义变化，就必须包含功能验证。
- 功能验证优先级：真实用户路径 / 真实复现路径 > 最贴近链路的冒烟或 assembled boundary test > 最小可证明替代验证。
- 如果功能验证没有执行、只能执行替代验证，或仍有路径没覆盖，最终回复不得笼统说“验证通过”；必须明确写出“功能未验证”或“剩余功能验收缺口”。
- run a smoke test close to the real workflow,
- use a non-repo isolated location for smoke data when possible.
- If a workspace UI/runtime package is consumed from source by another local app, package-level `tsc`/tests are not enough. Verify the consuming app path too, either by loading the app in the dev server or by directly requesting the transformed Vite `@fs` module for the touched source file. This catches alias/import-resolution failures that the edited package can miss.
- If the user reported a specific local command, URL, endpoint, port, or desktop/dev entrypoint, run that exact path after the fix whenever it is safe; package tests or route-level substitutes are not enough to claim the user-visible issue is fixed.
- If local dev falls back to a different port because the user's reported port is occupied, do not treat the fallback port as proof for the reported issue. Verify the reported port directly, or restart the stale local dev process and re-run the same user-facing path on the original port.

HTTP/API/transport contract changes:

- isolated client/controller unit tests are not enough,
- add an interface-level test at the assembled API boundary that exercises the real route/controller plus the wrapper or adapter layers used in the product path,
- assert the exact response/event contract shape, not only status codes or that a method was called,
- for command/handle APIs, include a negative guard against returning legacy acknowledgements such as `{ ok: true }` without the required `data` payload.

Bugfix or abnormal behavior fix:

- define the observable success condition before closing,
- verify with the most realistic available path.
- When the real path fails, treat that failure as the current reproduction result and continue fixing the chain until the same path passes or a concrete external blocker is identified.

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
