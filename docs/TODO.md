# TODO 管理（Inbox / Now / Next / Later）

目标：把“想到的事”统一收口，避免遗漏和重复讨论。  
方法：先收集，再分诊，再进入迭代执行。

## 0. 使用规则

1. 所有临时想法先写到 `Inbox`，不在聊天记录里长期堆积。
2. `Inbox` 条目 24 小时内必须转成 Issue（或明确丢弃），并补上链接。
3. 每周固定一次 triage，把事项移动到 `Now / Next / Later`。
4. 仅从 `Now` 拉任务进入开发，减少中途插队。
5. 完成后移动到 `Done`，并保留 Issue/PR 链接。

配套参考：
- [Issue 标签建议](./workflows/issue-labels.md)
- [GitHub Issue 模板](../.github/ISSUE_TEMPLATE)

## 1. Inbox（收集区，未分诊）

| Date | Idea | Source | Owner | Issue | Next Action |
| --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | 一句话描述待办 | user/ops/dev | @owner | `TBD` | create issue |

## 2. Now（当前迭代必须做）

| Priority | Item | Owner | Issue | DoD |
| --- | --- | --- | --- | --- |
| P1 | 事项标题 | @owner | #123 | 明确验收条件 |

## 3. Next（下一迭代候选）

| Priority | Item | Owner | Issue | Trigger |
| --- | --- | --- | --- | --- |
| P2 | 事项标题 | @owner | #124 | 当前迭代完成后 |

## 4. Later（长期池）

| Item | Reason to defer | Re-check Date | Issue |
| --- | --- | --- | --- |
| 事项标题 | 价值高但不紧急 | YYYY-MM-DD | #125 |

## 5. Done（最近完成）

| Date | Item | Owner | Issue | PR/Commit |
| --- | --- | --- | --- | --- |
| YYYY-MM-DD | 已完成事项 | @owner | #126 | #789 |

## 6. 每周 triage 清单（建议 30 分钟）

- 清空 `Inbox`：全部转 Issue 或丢弃。
- 给每个新 Issue 补齐 `type`、`priority`、`status`。
- 更新 `Now` 容量：在研条目不超过团队并行上限。
- 把阻塞项标记为 `status: blocked` 并写明外部依赖。
