# Issue 标签建议（最小可用）

本文提供一套可直接落地的最小标签体系，目标是让 `triage`、排期和协作分工可视化且可检索。

## 1. 最小标签集合（12 个）

| 维度 | 标签 | 用途 |
| --- | --- | --- |
| type | `type: bug` | 缺陷修复 |
| type | `type: feature` | 新能力/增强 |
| type | `type: chore` | 维护、重构、非功能需求 |
| priority | `priority: p0` | 阻塞发布/核心流程中断 |
| priority | `priority: p1` | 高优先级，建议本迭代处理 |
| priority | `priority: p2` | 正常优先级，进入候选池 |
| priority | `priority: p3` | 低优先级，长期事项 |
| status | `status: needs-triage` | 新建待分诊 |
| status | `status: ready` | 已澄清、可执行 |
| status | `status: in-progress` | 开发中 |
| status | `status: blocked` | 被外部依赖阻塞 |
| status | `status: done` | 已完成（关闭前短暂停留可选） |

## 2. 命名与使用约定

- 一个 Issue 必须且只能有一个 `type:*`。
- 一个 Issue 必须且只能有一个 `priority:*`。
- 一个 Issue 同时只能有一个 `status:*`。
- 新建 Issue 默认 `status: needs-triage`；每周固定一次 triage，将其改为 `ready / blocked / done`。
- 进入开发时改为 `status: in-progress`，合并后关闭并移除进行中状态。

## 3. 与模板配套关系

- `.github/ISSUE_TEMPLATE/bug_report.yml` 默认打标：`type: bug` + `status: needs-triage`。
- `.github/ISSUE_TEMPLATE/feature_request.yml` 默认打标：`type: feature` + `status: needs-triage`。
- `.github/ISSUE_TEMPLATE/task.yml` 默认打标：`type: chore` + `status: needs-triage`。

## 4. 一次性创建标签（可选）

如果仓库还没有这些标签，可用 GitHub CLI 执行：

```bash
gh label create "type: bug" --color D73A4A --description "Defect"
gh label create "type: feature" --color A2EEEF --description "Feature work"
gh label create "type: chore" --color FEF2C0 --description "Maintenance task"
gh label create "priority: p0" --color B60205 --description "Critical"
gh label create "priority: p1" --color D93F0B --description "High"
gh label create "priority: p2" --color FBCA04 --description "Medium"
gh label create "priority: p3" --color 0E8A16 --description "Low"
gh label create "status: needs-triage" --color EDEDED --description "Need triage"
gh label create "status: ready" --color 0E8A16 --description "Ready to work"
gh label create "status: in-progress" --color 1D76DB --description "Work in progress"
gh label create "status: blocked" --color 5319E7 --description "Blocked by dependency"
gh label create "status: done" --color C5DEF5 --description "Completed"
```

建议：先在测试仓验证颜色和命名，再同步到正式仓库。
