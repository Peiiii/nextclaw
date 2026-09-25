---
name: nextclaw-iteration-log-governance
description: Use when a commit/release, cross-module delivery, important root-cause fix, red-zone change, large governance rewrite, NPM release, work note, or goal anchor may require docs/logs; ordinary small edits do not trigger it.
---

# NextClaw Iteration Log Governance

## When To Use

普通任务在收尾时判断是否需要日志。大型交付执行启动即建立或复用进行中日志，及时保存关键决定、实验、失败、返工和集成结果；最后汇总，不等全部完成才补写。纯讨论/设计继续原文档，不自动启动实现。

## Decision Rules

Record commit/release batches, cross-module or long deliveries, important root causes/red-zone changes, large governance changes, material history corrections and package publication state.

Ordinary uncommitted edits, isolated small fixes/tests/styles/refactors and metadata/discussion-doc edits do not require new logs. Large-delivery execution still records progress. Reuse a related active batch instead of creating one record per correction; explicit user requests override this gate.

Thought/design/plan/PRD documents stay in their own directories; logs link them.

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

## 目录命名

同时支持日期和版本号前缀，新建默认日期：

```text
docs/logs/YYYY-MM-DD-<slug>/README.md
docs/logs/v<semver>-<slug>/README.md
```

日期取记录创建日，同批跨天保持目录，同日独立批次使用可区分的 slug。已有版本号记录原地续写；明确采用版本号形式时才比较现有合法版本并递增，日期目录不参与版本分配。目录号不是 NPM 发布号，不为同批建立日期/版本两份副本，也不批量迁移旧记录。

## README Required Sections

Every iteration `README.md` must contain:

1. `## 迭代完成说明`
2. `## 测试/验证/验收方式`
3. `## 发布/部署方式`
4. `## 用户/产品视角的验收步骤`
5. `## 可维护性总结汇总`
6. `## NPM 包发布记录`

进行中日志保留这些章节，尚未交付/验证如实标明；大型交付另在顶部保存关联入口与过程记录。普通进展直接追加简短事件，长详情按需拆分，具体方法复用[大型交付记录协议](../../process/iteration-work-notes/references/major-delivery-records.md)，不另建一套模板。日志中的交付摘要不覆盖整体合同和当前工作状态。

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

Always state simplification/reuse, sprawl and owner-boundary impact, file-organization compliance, guard findings and whether they triggered subjective review. If code maintainability is inapplicable, state the reason. Do not invent improvement to fill the section.

## Work Notes

### Loop 批次与逐轮记录

明确执行 `.loop.md` 任务时，其合同约定的逐轮可追踪性构成日志需求，可在启动时建立批次记录，不受“普通小改动不建日志”限制。复用上述命名，默认 `docs/logs/YYYY-MM-DD-<slug>/README.md`，也支持版本号；一次批次一个目录，同批返工不新建目录，不覆盖旧批次。普通大型交付不因有持续日志就自动进入 loop 或强制逐轮表格。

- README 复用上述六个必需章节，在完成说明内维护批次状态、合同相对链接与版本（commit；未提交修订用只读快照或补丁固定）、授权、基准/当前最佳、预算起点/实耗、轮次索引及下一步/停止原因；运行中明确“进行中”，不得预填完成。运行状态使用 `draft / active / paused / blocked / stopped / completed`，只有明确启动或恢复才设为 `active`。
- 每轮使用 `work/YYYY-MM-DD-<topic>-round-<NNN>.md`，日期为该轮开始日期，轮次在批次内递增；返工写回同一文件。沿用 work notes 的 `.md`，不新增文档类型或平行日志根目录。
- 批次 README 顶部提供逐轮优化概览，兼作轮次索引：使用表格或列表直接写明“轮次/详情链接、优化前问题、本轮实际变化、验证结果与限制、保留/放弃决定”，不得只列标题和状态。每轮结束同步摘要，失败、无改动与返工如实列出，基线已有改进不计为本轮成果；用户无需逐个打开日志即可看懂改了什么。摘要引用详细记录，不重复维护实验过程。
- 轮次记录包含问题证据、假设与预设判定、实际改动/返工、结果证据、保留/放弃依据、可测成本及限制。动手前记录判定，结束后补结果；失败也保留，事后补录必须注明来源及未知，禁止编造时间、指标或过程。
- 图片、报告等新附件放批次 `artifacts/`，使用 `YYYY-MM-DD-round-<NNN>-<description>.<ext>` 并相对链接；既有 `evidence/` 不迁移。材料是否证明结论由记录注明，不把临时绝对路径当长期记录。
- 合同只定义设计；当前恢复状态唯一归 README，逐轮历史归轮次文件。完成记录不随新实验改写，纠错追加说明；合同修订只影响明确采用新版本的后续轮次。恢复默认读取合同、批次摘要及最近相关轮次。

新建大型交付的合同与当前笔记使用共享的日期前缀 `docs/work/YYYY-MM-DD-<slug>/`，日志回链该入口。已有任务已在迭代内管理笔记时继续使用原路径，不复制第二份。普通跨轮任务按共享工作记录方法保持轻量，不为笔记单独造日志目录。迭代内既有布局例如：

```text
docs/logs/v<semver>-<slug>/work/working-notes.md
```

日志 README 链接唯一工作记录；loop 的当前状态若已归 README，仍以该入口为准，不再建立另一当前状态表。

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
