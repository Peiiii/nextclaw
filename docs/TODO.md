# TODO 管理（Execution Backlog）

目标：把“近期要做什么”收口到一个地方，并和中长期路线图打通。  
中长期方向请看 [ROADMAP](./ROADMAP.md)。

## 0. 机制边界（Roadmap / TODO / Issue）

1. `ROADMAP` 负责方向和阶段目标（3-12 个月）。
2. `TODO` 负责可执行事项（天/周级）。
3. `GitHub Issue` 负责任务追踪与协作（状态、讨论、验收）。
4. 任一 TODO 条目都必须绑定 Issue，避免“文档里有、系统里没有”。
5. 完成项必须回填 PR/提交链接，保留可审计路径。

配套参考：
- [项目路线图](./ROADMAP.md)
- [Issue 标签建议](./workflows/issue-labels.md)
- [GitHub Issue 模板](../.github/ISSUE_TEMPLATE)

## 1. Inbox（收集区，24 小时内分诊）

| Date | Idea | Source | Owner | Issue | Next Action |
| --- | --- | --- | --- | --- | --- |
| 2026-05-26 | 设计渠道多账号管理：微信、飞书等渠道统一支持显式列出、切换、禁用、删除账号/智能体，避免历史账号隐式参与运行 | user-feedback | @owner | `TBD` | create issue: define cross-channel multi-account UX, runtime selection semantics, and migration from single-default replacement |
| 2026-05-14 | 为 toolkit / library 类 package 设计 `lib` 类型 module-structure protocol，并将 `@nextclaw/ncp-toolkit` 从本次授权豁免迁回正式目录治理 | user-feedback | @owner | `TBD` | create issue: define lib protocol, migration plan, and remove authorized waiver |
| 2026-03-30 | 排查发布链是否存在过度依赖与过宽联动发布，重点审视 `@nextclaw/channel-plugin-weixin`、Codex SDK 等是否应继续直接跟随 `@nextclaw/core` / release batch | user-feedback | @owner | `TBD` | create issue: map release dependency graph and propose narrower publish groups |
| 2026-03-11 | Brave Search API 获取需绑卡，评估 Firecrawl / Tavily 作为默认或可选替代 | user-feedback | @owner | `TBD` | create issue: compare providers and decide default strategy |
| 2026-04-11 | 为 LLM usage / prompt cache 观测补统一日志事件模块；当前已补 CLI 本地 history / stats，但仍缺项目级日志抽象、retention 与多出口复用能力 | user-feedback | @owner | `TBD` | create issue: design pluggable usage event logger and retention strategy |
| YYYY-MM-DD | 一句话描述待办 | user/ops/dev | @owner | `TBD` | create issue or drop |

## 2. Now（当前迭代必须做）

| Priority | Item | Owner | Issue | DoD |
| --- | --- | --- | --- | --- |
| P1 | 事项标题 | @owner | #123 | 明确验收条件 |

## 3. Next（下一迭代候选）

| Priority | Item | Owner | Issue | Trigger |
| --- | --- | --- | --- | --- |
| P2 | 事项标题 | @owner | #124 | 当前迭代完成后 |

## 4. Later（待排序池）

| Item | Reason to defer | Re-check Date | Issue |
| --- | --- | --- | --- |
| 事项标题 | 价值高但不紧急 | YYYY-MM-DD | #125 |

## 5. Done（最近完成）

| Date | Item | Owner | Issue | PR/Commit |
| --- | --- | --- | --- | --- |
| YYYY-MM-DD | 已完成事项 | @owner | #126 | #789 |

## 6. 每周 triage 清单（建议 30 分钟）

- 清空 `Inbox`：全部转 Issue 或丢弃。
- 给新 Issue 补齐 `type`、`priority`、`status`。
- 从 `ROADMAP` 挑 1-3 个里程碑拆到 `Next`。
- 控制 `Now` 在团队并行上限内，避免过载。
- 阻塞项标记为 `status: blocked`，并写明外部依赖。
