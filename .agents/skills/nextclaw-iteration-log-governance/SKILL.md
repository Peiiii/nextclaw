---
name: nextclaw-iteration-log-governance
description: Use when deciding, creating, or updating docs/logs iteration records; when the user asks to commit/提交/收尾 after changes; when changes touch code, scripts, tests, runtime config, large non-code governance/docs rewrites, NPM release records, root-cause fix notes, red-zone touch records, work notes, or goal-progress anchors.
---

# NextClaw Iteration Log Governance

## When To Use

Use this skill during the closing phase when a task may need `docs/logs` records.

Do not create an iteration directory at task start only for note-taking unless the user explicitly asks or the relevant iteration already exists.

## Decision Rules

Create or update an iteration record when any of these is true:

- project code changed,
- scripts or tests changed,
- runtime-path config changed,
- non-code content changed at large scale, such as governance/rule-system restructure,
- historical iteration records are being materially corrected or expanded,
- release or NPM package state must be recorded.

Do not automatically create an iteration record when all of these are true:

- no code/runtime path changed,
- the change is a small metadata, wording, index, thought, plan, design, PRD, or discussion-doc update,
- the user did not explicitly request iteration logging.

Thought/design/plan/PRD documents normally belong under `docs/thoughts`, `docs/plans`, `docs/designs`, or `docs/prd`, not `docs/logs`.

## Thought / Design / Plan Date Prefix

The iteration mechanism requires dated anchors and dotted role suffixes for thought, design, and plan deposits:

- files under `docs/thoughts` must use `YYYY-MM-DD-<topic>.thought.md`,
- files under `docs/designs` must use `YYYY-MM-DD-<topic>.design.md`,
- files under `docs/plans` must use `YYYY-MM-DD-<topic>.plan.md`,
- this rule applies even when the work does not need a `docs/logs` iteration record.

## Same-Batch Rule

If the work is a micro-adjustment, verification fix, or follow-up in the same problem domain and same closing window as the most recent related iteration, update that iteration `README.md`.

Create a new iteration only when the goal has changed, impact expanded, a new independent batch started, a release/commit loop closed, or the user explicitly asked for separate traceability.

If a tiny new iteration was created by mistake, merge its useful content back into the related iteration and remove the mistaken directory.

## Version Rule

Before creating a new directory:

```bash
find docs/logs -maxdepth 1 -type d -name 'v*' | sort
```

Only directories matching `v<semver>-<slug>` count. The new semver must be strictly greater than the maximum valid existing version.

Directory shape:

```text
docs/logs/v<semver>-<slug>/README.md
```

## README Required Sections

Every iteration `README.md` must contain:

1. `## 迭代完成说明`
2. `## 测试/验证/验收方式`
3. `## 发布/部署方式`
4. `## 用户/产品视角的验收步骤`
5. `## 可维护性总结汇总`
6. `## NPM 包发布记录`

If the task is a fix, incident, root-cause investigation, or abnormal-behavior cleanup, the completion section must record:

- root cause,
- how it was confirmed,
- why the fix targets the root cause rather than only the symptom.

If root cause is not fully known, explicitly write `根因未完全定位` with current gaps and next actions.

## NPM Release Record

Always fill this section.

If no package release is involved, write `不涉及 NPM 包发布`.

If release is involved, list:

- whether release is needed and why,
- exact package names,
- current published/unpublished state for each package,
- `待统一发布` status when a package must follow a later batch release,
- external blockers or trigger conditions.

## Maintainability Summary

Always fill this section.

Cover:

- whether best effort was made to improve maintainability,
- whether deletion/simplification/code-less/clearer-boundary principles were followed,
- whether code/branch/function/file/directory sprawl decreased or at least did not worsen,
- whether abstractions and owner boundaries became clearer,
- whether directory/file organization satisfies current governance,
- whether `post-edit-maintainability-review` was used when code maintainability was evaluated,
- or `不适用` with reason when no code maintainability evaluation applies.

## Work Notes

For complex, long-running, or cross-context tasks, create process notes only inside an existing or required iteration:

```text
docs/logs/v<semver>-<slug>/work/working-notes.md
```

Reference work notes from the iteration `README.md`.

## Goal Progress Anchor

Use `goal-progress-anchor` when the task may drift, spans many turns, or the user says not to forget the original goal.

Anchor file:

```text
docs/logs/v<semver>-<slug>/work/goal-progress.md
```

Keep it under 50 lines by default and never over 100 lines. When enabled, user-visible replies must include the anchor counter after the required prefix.

## Red-Zone Touches

If source red-zone files are touched, add:

```md
## 红区触达与减债记录

### <repo-path>

- 本次是否减债：
- 说明：
- 下一步拆分缝：
```

Use the maintainability guard output and `scripts/governance/maintainability/maintainability-hotspots.mjs` as the source of truth.

## Closing Output

At final response time, state:

- whether an iteration record was required,
- the reason,
- the iteration path if created or updated,
- why no record was needed if skipped.
