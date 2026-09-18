---
name: nextclaw-iteration-log-governance
description: Use when a commit/release, cross-module delivery, important root-cause fix, red-zone change, large governance rewrite, NPM release, work note, or goal anchor may require docs/logs; ordinary small edits do not trigger it.
---

# NextClaw Iteration Log Governance

## When To Use

Use this skill during the closing phase when a task may need `docs/logs` records.

Do not create an iteration directory at task start only for note-taking unless the user explicitly asks or the relevant iteration already exists.

## Decision Rules

Create or update an iteration record when the work has independent delivery or traceability value:

- a commit or release batch is being closed,
- code/runtime changes span modules or a long-running delivery,
- an important root-cause fix or red-zone touch needs durable evidence,
- non-code content changed at large scale, such as governance/rule-system restructure,
- historical iteration records are being materially corrected or expanded,
- release or NPM package state must be recorded.

Do not automatically create an iteration record for:

- uncommitted local edits,
- a small isolated bugfix, test adjustment, style change or refactor with no red-zone/release significance,
- metadata, wording, index, thought, plan, design, PRD or discussion-doc updates,
- work that already belongs to an active related iteration and only needs a later batch-level update.

The user can explicitly request logging at any time. Otherwise, prefer one batch record over one record per task or correction.

Thought/design/plan/PRD documents normally belong under `docs/thoughts`, `docs/plans`, `docs/designs`, or `docs/prd`, not `docs/logs`.

## Thought / Design / Plan / Loop Date Prefix

The iteration mechanism requires dated anchors and dotted role suffixes for thought, design, plan, and loop deposits:

- files under `docs/thoughts` must use `YYYY-MM-DD-<topic>.thought.md`,
- files under `docs/designs` must use `YYYY-MM-DD-<topic>.design.md`,
- files under `docs/plans` must use `YYYY-MM-DD-<topic>.plan.md`,
- files under `docs/loops` must use `YYYY-MM-DD-<topic>.loop.md`,
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
- whether the automatic guard found anything and whether its result triggered the subjective review reference,
- or `不适用` with reason when no code maintainability evaluation applies.

## Work Notes

### Loop 批次与逐轮记录

明确执行 `.loop.md` 任务时，其合同约定的逐轮可追踪性构成日志需求，可在启动时建立批次记录，不受“普通小改动不建日志”限制。复用本规范的 `docs/logs/v<semver>-<slug>/README.md` 与版本分配；一次执行批次一个目录，同批返工不新建版本。新批次重新分配版本，不覆盖旧批次。版本号是文档迭代号，不代表 NPM 发布。

- README 复用上述六个必需章节，在完成说明内维护批次状态、合同相对链接与版本（commit；未提交修订用只读快照或补丁固定）、授权、基准/当前最佳、预算起点/实耗、轮次索引及下一步/停止原因；运行中明确“进行中”，不得预填完成。运行状态使用 `draft / active / paused / blocked / stopped / completed`，只有明确启动或恢复才设为 `active`。
- 每轮使用 `work/YYYY-MM-DD-<topic>-round-<NNN>.md`，日期为该轮开始日期，轮次在批次内递增；返工写回同一文件。沿用 work notes 的 `.md`，不新增文档类型或平行日志根目录。
- 批次 README 顶部提供逐轮优化概览，兼作轮次索引：使用表格或列表直接写明“轮次/详情链接、优化前问题、本轮实际变化、验证结果与限制、保留/放弃决定”，不得只列标题和状态。每轮结束同步摘要，失败、无改动与返工如实列出，基线已有改进不计为本轮成果；用户无需逐个打开日志即可看懂改了什么。摘要引用详细记录，不重复维护实验过程。
- 轮次记录包含问题证据、假设与预设判定、实际改动/返工、结果证据、保留/放弃依据、可测成本及限制。动手前记录判定，结束后补结果；失败也保留，事后补录必须注明来源及未知，禁止编造时间、指标或过程。
- 图片等证据放批次 `evidence/`，使用 `YYYY-MM-DD-round-<NNN>-<description>.<ext>` 并相对链接；仅保留支撑结论的必要证据，不把临时绝对路径当长期记录。
- 合同只定义设计；当前恢复状态唯一归 README，逐轮历史归轮次文件。完成记录不随新实验改写，纠错追加说明；合同修订只影响明确采用新版本的后续轮次。恢复默认读取合同、批次摘要及最近相关轮次。

For complex, long-running, or cross-context tasks, create process notes only inside an existing or required iteration:

```text
docs/logs/v<semver>-<slug>/work/working-notes.md
```

Reference work notes from the iteration `README.md`.

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
