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
