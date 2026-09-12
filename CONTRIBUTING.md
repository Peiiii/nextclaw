# Contributing to NextClaw

Thanks for your interest. NextClaw is a small, actively designed product, so maintainer attention — not code volume — is the scarce resource. These rules exist to make suggestions and contributions useful, reviewable, and fair.

## Start here

There is one formal path for bugs, ideas, and contribution proposals: **GitHub Issues**.

- [Report a reproducible bug](https://github.com/Peiiii/nextclaw/issues/new?template=bug_report.yml)
- [Propose an idea or improvement](https://github.com/Peiiii/nextclaw/issues/new?template=feature_request.yml)
- [Browse work open to outside contributors](https://github.com/Peiiii/nextclaw/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22help%20wanted%22)
- [Report a security vulnerability privately](https://github.com/Peiiii/nextclaw/security/advisories/new)

Do not open a pull request first. Start with an Issue, even for a small fix, test, or documentation change. Small and well-evidenced proposals should be quick to approve.

## From suggestion to pull request

### 1. Open an Issue

Describe the problem or opportunity before designing a large solution. Include a reproducible example, user scenario, or other evidence when possible. You may propose an approach, but implementation is optional at this stage.

### 2. Maintainers triage it

A maintainer will choose one of these outcomes:

- **More information needed** — discussion continues; do not implement yet.
- **Accepted, maintainer-owned** — the problem is valid, but it is not open to outside implementation.
- **Open for contribution** — the Issue receives the `help wanted` label and a maintainer states the accepted scope and verification criteria.
- **Not planned / closed** — the project will not pursue it now; the reason should be recorded.

`good first issue` is a newcomer-friendly subset and should also carry `help wanted`.

### 3. Claim the Issue

On an Issue labeled `help wanted`, comment with the scope you intend to implement. Wait for a maintainer to confirm or assign it to you before starting work. This avoids duplicate work and catches scope misunderstandings early.

### 4. Get explicit confirmation

You may start only after both are true:

1. the Issue has the `help wanted` label; and
2. a maintainer explicitly confirms your scope in the Issue or assigns the Issue to you.

The confirmation should state what is included, what is excluded, and how the result will be verified.

### 5. Open one focused pull request

Link the approved Issue, stay inside the confirmed scope, include observed verification results, and disclose AI assistance. Do not stack work on an unmerged pull request or add follow-up roadmap items to the same pull request.

## What does not count as approval

None of the following is permission to implement:

- an item appearing in `docs/ROADMAP.md` or `docs/TODO.md`;
- an open Issue without `help wanted`;
- a maintainer saying an idea is interesting or valid;
- informal chat or community discussion;
- a reaction, silence, or lack of response;
- passing CI or having already completed the code.

The durable approval record is the GitHub Issue: `help wanted` plus explicit maintainer confirmation or assignment.

## Changes requiring careful prior alignment

These normally remain maintainer-owned unless explicitly opened with `help wanted`:

- architecture, public interfaces, config schema, or extension points;
- product direction, roadmap, positioning, or default behavior;
- dependencies, packages, runtime hooks, or cross-runtime contracts;
- auth, credentials, secrets, permissions, or security boundaries;
- large changes (roughly more than 300 changed lines or 10 files).

## Contributions most likely to be approved quickly

These still start with an Issue, but they are usually easier to scope and review:

- reproducible bug fixes;
- tests for existing behavior;
- documentation, typos, and i18n;
- small, focused improvements that preserve existing product and architecture decisions.

Read [`docs/ROADMAP.md`](docs/ROADMAP.md), especially its **Not Doing** section, before proposing a new direction. [`docs/TODO.md`](docs/TODO.md) shows near-term maintainer execution, but neither document is an open task list for outside contributors.

## Pull requests must include

- the approved Issue it addresses;
- the confirmed scope and any explicit exclusions;
- the problem evidence or reproduction;
- commands run and observed results, including what CI does not cover;
- whether AI assistance was used and how the result was reviewed and verified.

Maintainers may close an unapproved or out-of-scope pull request without a line-by-line review. This is a bandwidth and project-direction decision, not a judgment about the contributor.

## 中文说明

NextClaw 的 Bug、建议和贡献提案统一通过 **GitHub Issue** 进入：

- [报告可复现 Bug](https://github.com/Peiiii/nextclaw/issues/new?template=bug_report.yml)
- [提出功能或改进建议](https://github.com/Peiiii/nextclaw/issues/new?template=feature_request.yml)
- [查看对外开放的贡献任务](https://github.com/Peiiii/nextclaw/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22help%20wanted%22)
- [私密报告安全漏洞](https://github.com/Peiiii/nextclaw/security/advisories/new)

请不要先开 PR。完整流程是：

1. 先提 Issue，描述问题、使用场景和证据；方案可以提，但此时不需要实现。
2. 维护者分诊：补充信息 / 问题接受但由维护者负责 / 对外开放 / 当前不做。
3. 只有带 `help wanted` 的 Issue 才对外开放；`good first issue` 是其中适合新人的子集。
4. 在 Issue 下留言说明你准备实现的范围，等待维护者明确回复或把 Issue assign 给你。
5. **`help wanted` + 维护者明确确认或 assignment** 同时成立后，才算获得开工确认。
6. 提交一个范围聚焦的 PR，关联 Issue，遵守确认过的边界，写明验证结果，并披露 AI 参与。

以下都不算开发确认：Roadmap/TODO 中出现、普通开放 Issue、维护者说“想法不错”、聊天讨论、点赞、沉默、CI 通过，或者代码已经写完。

Roadmap 是维护者规划，不是可自由认领的任务列表。没有开放任务时，欢迎先提建议，但请等待项目明确开放后再实现。
