# Iteration v0.12.12-24h-curated-report-and-promo

## 迭代完成说明（改了什么）

- 基于 `2026-03-06 15:55 CST` 到 `2026-03-07 15:55 CST` 的仓库真实提交，整理了一份“非机械拼接”的 24 小时变更报告：
  - `change-report.md`
- 产出一份可直接对外使用的中英文宣传文案集（含发布说明版、社媒短版、技术社区版）：
  - `promo-copy.md`
- 报告不是按 commit 顺序罗列，而是按产品价值与用户影响拆成四条主线：
  1. marketplace skill 安装可靠性
  2. CLI 语义与自动化可预期性
  3. 发布闭环
  4. 规则治理升级

## 测试/验证/验收方式

- 数据来源验证：
  - `git log --since='24 hours ago'`
  - `git log --since='24 hours ago' --name-status`
- 发布状态验证：
  - `npm view nextclaw dist-tags --json`
  - `npm view nextclaw versions --json`
- 输出文件检查：
  - `docs/logs/v0.12.12-24h-curated-report-and-promo/change-report.md`
  - `docs/logs/v0.12.12-24h-curated-report-and-promo/promo-copy.md`

## 发布/部署方式

- 本次为文档与文案整理，不涉及代码发布与部署。
- 如需对外分发：
  1. 将 `change-report.md` 用作日报/周报基础稿。
  2. 将 `promo-copy.md` 中对应版本复制到 GitHub Release、社媒或社区平台。

## 用户/产品视角的验收步骤

1. 打开 `change-report.md`，确认能快速回答“这 24 小时真正的产品增量是什么”。
2. 打开 `promo-copy.md`，确认中英文文案可直接粘贴使用，无需二次重写。
3. 检查文案是否覆盖三种场景：Release、社媒短贴、技术社区说明。

