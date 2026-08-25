# 0.43.0 全平台正式版发布工作记录

## 观测口径

- 以 GitHub Actions、registry、公开 Release、manifest、APT 和主线协调器输出为准。
- 每个阶段记录 wall time、最慢 job/step、外部等待、失败重试和恢复入口。
- 已成功的不可逆 identity 不重复发布。

## 阶段观测

| 阶段 | 状态 | 耗时/最慢项 | 发现与处理 |
| --- | --- | --- | --- |
| 范围审计 | 完成 | product dry-run 3.6s | 44 个版本变化、43 个上传包；发现 patch 推导与缺失结构化 Notes，在发布前修正为 0.43.0 minor |
| Exact-commit prepare | 等待新提交 | 待记录 | 旧 SHA `1a7a592de` 的 artifact 不用于正式发布；新提交 push 后自动重建 |
| NPM stable | 未开始 | 待记录 | 单次 `target=product` workflow |
| Runtime / install | 未开始 | 待记录 | NPM_READY 后沿同一 workflow 继续 |
| Desktop stable | 未开始 | 待记录 | Product ready 后顺序触发，隐藏 Draft 原子公开 |
| 主线对账 | 未开始 | 待记录 | 每个远程完成门后自动执行 |

## 提效复盘

- 正式 workflow 尚未 dispatch，当前所有修正都发生在可逆准备阶段。
- 目标是验证新自动化能从提交、prepare、单次 product dispatch、Desktop dispatch 到主线对账无人值守闭合。
