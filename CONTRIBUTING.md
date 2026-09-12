# Contributing to NextClaw

Thanks for your interest. NextClaw is a small, actively-designed product, so maintainer attention — not code volume — is the scarce resource. These rules exist to keep contributions useful and reviewable, not to discourage them.

## The short version

1. **Talk before you build.** Open an Issue and get maintainer confirmation before implementing anything non-trivial. Unconfirmed work may be closed without detailed review.
2. **One PR, one topic.** No bundling, no stacking on unmerged PRs, no roadmaps inside a pull request.
3. **Give evidence, not conclusions.** Reproduce the real problem, show the before/after, and state what CI does and does not cover. A local "all green" is not proof.
4. **Disclose AI assistance.** AI-assisted contributions are welcome; say so. Correctness remains your responsibility.
5. **Maintainers review on their own schedule.** Closing a PR is not a verdict on you. A closed PR can be reopened after the direction is agreed.

## Requires prior confirmation

Open an Issue first, and wait for a maintainer reply, for anything that:

- changes architecture, public interfaces, config schema, or extension points;
- changes product direction, roadmap, or positioning;
- adds a dependency, a new package, or a new runtime hook;
- touches auth, credentials, secrets, or security boundaries;
- is large (roughly >300 changed lines or >10 files).

## Welcome without prior discussion

- bug fixes with reproducible steps;
- tests, docs, typos, i18n;
- small, focused improvements that stay within existing behaviour.

## Where to start

We plan in the open. Read these before proposing anything:

- [`docs/ROADMAP.md`](docs/ROADMAP.md) — what NextClaw is building next, plus an explicit **Not Doing** list (§4). Read the Not Doing list first; it exists so the same proposals don't have to be declined twice.
- [`docs/TODO.md`](docs/TODO.md) — the near-term execution backlog.
- [`docs/workflows/issue-labels.md`](docs/workflows/issue-labels.md) — how issues are classified.

**Only issues labeled `help wanted` are open for outside contribution.**
Issues labeled `good first issue` are a newcomer-friendly subset of those.

Everything else — including items in `docs/ROADMAP.md` — is maintainer-committed
scope. Do not start implementing it without an explicit `help wanted` label or a
maintainer confirmation on that issue.

If nothing is labeled right now, or the problem you want to fix isn't listed,
open an Issue describing the problem and the evidence. That is the normal path to
getting something accepted, and it is cheap.

## Pull requests must include

- a linked Issue where the direction was confirmed;
- the problem being solved, with evidence;
- scope: what is included and what is explicitly not;
- verification: commands run and observed results;
- whether AI assistance was used, and how the result was verified.

## Review and closure

Maintainers may close a PR that ignores the above without a line-by-line review. This is a bandwidth decision, not a personal one. If you want your work to land, ask for alignment first — a short Issue is usually enough.

## 中文摘要

1. 先提 Issue 取得维护者确认，再动手实现；未确认的改动可能不逐行审查直接关闭。
2. 一个 PR 只做一件事：不打包、不叠在未合并的 PR 上、不在 PR 里排路线。
3. 给证据不给结论：能复现的问题、改动前后的结果，并说明 CI 覆盖了什么、没覆盖什么；"本地全绿"不算证明。
4. 可以借助 AI，但要如实说明；正确性由提交者本人负责。
5. 维护者按自己的节奏 review；关闭不是对你个人的否定，方向确认后可以重开。
6. 仍然欢迎：能复现的 bug 修复、测试、文档、i18n、范围内的聚焦小改进。
7. 只做被标为 `help wanted` 的 issue；`good first issue` 是其中适合新人的子集。`docs/ROADMAP.md` 里的条目属维护者既定范围，未获确认不要直接开工。想做的事不在列表里，就先提 Issue 说明问题和证据——这是正常的纳入路径，成本很低。
