# v0.16.12-nextclaw-competitive-advantage-marketing

## 迭代完成说明

- 本次对 `apps/competitive-leaderboard` 做了整轮回炉重造，目标从“主观宣传榜”改成“证据化研究榜单”。
- 设计文档已重写为新的可信模型：[docs/plans/2026-04-13-competitive-leaderboard-app-design.md](../../plans/2026-04-13-competitive-leaderboard-app-design.md)
- 新版应用的核心变化：
  - 废弃旧版 `persona + rawScore` 主观评分模型
  - 废弃“把不属于同类的产品硬混进统一总榜”的 universe 设计
  - 只使用官方公开资料作为主要证据源
  - 引入更严格的 `core / watch / exclude` 边界，主动移出非龙虾类产品
  - 把评分改成：
    - `公共信号 40 分`
    - `能力覆盖 60 分`
    - 只有 `core comparable` 层进入统一总榜
- 当前 core 直系同类样本收紧为 8 个：
  - `NextClaw`
  - `OpenClaw`
  - `QwenPaw`
  - `Hermes Agent`
  - `ZeroClaw`
  - `PicoClaw`
  - `IronClaw`
  - `Leon`
- 当前 watch 衍生物样本覆盖：
  - `Sentient`
  - `OpenDAN`
  - `zclaw`
  - `ClawX`
  - `OpenLobster`
  - `n8nClaw`
- 方法论补充了“已审查但排除”的知名大厂产品说明：
  - `腾讯元器`
  - `通义 APP`
  - `有道云笔记 AI 工具`
- 前后端结构也同步重写：
  - `CompetitiveLeaderboardDataService` 只负责数据与元信息装配
  - `CompetitiveLeaderboardScoringService` 负责公共信号、能力覆盖和统一总榜计算
  - 前端改成 `Hero / Universe Map / Core Leaderboard / Scoreboards / Product Profiles / Evidence Drawer / Methodology`
- 旧版残留已清理：
  - 删除 persona 组件
  - 删除旧维度数据、旧 core seed、旧 evidence、旧 universe 数据文件

## 测试/验证/验收方式

- 已执行：
  - `pnpm -C apps/competitive-leaderboard build`
  - `pnpm -C apps/competitive-leaderboard lint`
  - `pnpm -C apps/competitive-leaderboard tsc`
  - `pnpm -C apps/competitive-leaderboard smoke`
  - `pnpm validate:competitive:leaderboard`
- smoke 覆盖点已切到新模型：
  - 首页出现“龙虾类产品研究榜单”
  - 页面出现“先画全市场，再谈总榜”
  - 页面出现“只对真正同类的一层做统一总榜”
  - 页面出现“把‘声量’和‘能力’拆开看”
  - 产品资料卡不少于 14 个
  - 打开证据抽屉后能看到“纳入判断 / 能力矩阵 / 公共信号拆解”
- 维护性治理：
  - 已执行 `pnpm lint:maintainability:guard`
  - 结果：未通过
  - 原因分两类：
    - 本次新增的 `apps/competitive-leaderboard/server/leaderboard-products.data.ts` 作为研究数据目录文件超过 file budget
    - 工作区内已有、与本任务无关的 `apps/desktop/scripts/prepare-manual-update-validation.mjs` 仍存在 guard error

## 发布/部署方式

- 本地开发：
  - `pnpm dev:competitive:leaderboard`
- 本地完整验证：
  - `pnpm validate:competitive:leaderboard`
- 当前仍是仓库内独立 app，尚未接入正式线上部署。
- 若后续上线，建议继续保持“研究型榜单站”身份，而不是直接降级为官网某个宣传分栏。

## 用户/产品视角的验收步骤

1. 执行 `pnpm dev:competitive:leaderboard`。
2. 打开页面，确认首页首先强调这是“研究榜单”，而不是直接宣传 NextClaw。
3. 查看 `Universe Map`，确认页面先区分 `core comparable` 与 `derivative / watch`。
4. 查看 `Core Leaderboard`，确认只对 core 层统一排名。
5. 查看 `公共信号榜` 与 `能力覆盖榜`，确认它们和综合总榜是拆开的。
6. 任意点开一个产品，确认抽屉里能看到：
  - 官方来源
  - 纳入判断
  - 能力矩阵
  - 公共信号拆解
  - 证据条目
7. 打开 watch 产品，确认它保留资料与证据，但不参与统一总榜。
8. 查看方法论区域，确认页面明确披露：
  - 维护方是 NextClaw 团队
  - 只用官方公开资料
  - 非同类产品不混排
  - 已审查但排除的大厂产品及其排除理由

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：否。
  - 主要阻碍是为了先把可信 universe、证据条目和能力矩阵一次性落地，研究数据目录文件 `leaderboard-products.data.ts` 暂时仍然过长，未在本次继续拆到更细模块。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。
  - 本次已经主动删除了旧 persona 组件、旧维度模型、旧主观评分数据文件和旧 universe/evidence 结构，避免新旧两套模型并存；这轮续改又进一步把 `Sentient`、`OpenDAN`、`zclaw` 从统一总榜层降到 `watch`，减少不必要的 core 混排噪音。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：没有做到净减少。
  - 这是一次新 app 的实质性交付，且为了修复“榜单不可信”问题，必须引入新的研究数据与证据结构。
  - 但在新增之前，已经先删掉了旧评分模型和旧数据文件，避免继续叠加历史补丁。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。
  - 数据层：`CompetitiveLeaderboardDataService`
  - 评分层：`CompetitiveLeaderboardScoringService`
  - 页面层：纯展示组件
  - 没有把评分逻辑塞回 React 组件，也没有再保留旧 persona / rawScore 分支。
- 目录结构与文件组织是否满足当前项目治理要求：部分满足。
  - app 仍被清晰收拢在 `apps/competitive-leaderboard`
  - 但 `server/leaderboard-products.data.ts` 超出 file budget，下一步应按 `core / watch` 或按产品批次继续拆分。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是。

### 可维护性复核结论：保留债务经说明接受

- 本次顺手减债：是
- 代码增减报告：
  - 新增：5082 行
  - 删除：0 行
  - 净增：+5082 行
- 非测试代码增减报告：
  - 新增：4980 行
  - 删除：0 行
  - 净增：+4980 行
- no maintainability findings

### 长期目标对齐 / 可维护性推进

- 这次虽然代码净增明显，但方向上确实顺着“边界更清晰、结论更可解释、行为更可预测”推进了一步。
- 真正的大问题不是“代码多了”，而是旧版榜单会误导用户；这次至少把不可信的主观榜结构删掉了，换成了公开证据驱动的模型。
- 下一步最应该继续减债的入口就是把 `leaderboard-products.data.ts` 拆层，避免研究数据目录继续在单文件里膨胀。
