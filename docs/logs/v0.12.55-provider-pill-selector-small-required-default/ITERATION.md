# v0.12.55 Provider Pill Selector for Small Required Defaults

## 迭代完成说明（改了什么）
- 在 Provider 配置页新增“胶囊按钮选择器（PillSelector）”。
- 新增自动判定规则：当字段满足“必选 + 有默认值 + 选项数量 <= 3”时，自动使用胶囊按钮；否则继续使用下拉框。
- 已接入两个实际场景：
  - MiniMax OAuth 授权方式（global/cn）
  - Wire API 选择（auto/chat/responses）
- 这样用户在少量选项场景下可以一眼看到所有选择，减少下拉点击成本。

## 测试/验证/验收方式
- 全量验证：
  - `pnpm build`
  - `pnpm lint`
  - `pnpm tsc`
- 冒烟验证：
  - `node scripts/platform-mvp-smoke.mjs`

## 发布/部署方式
- 本次为 UI 交互层优化，无数据库或 migration 变更。
- 按常规前端/工作区发布流程构建并发布包含 `nextclaw-ui` 的版本。

## 用户/产品视角的验收步骤
1. 打开 Provider 页面并选择 `minimax-portal`。
2. 在 OAuth 授权方式区域确认显示为胶囊按钮（而不是下拉）。
3. 点击不同胶囊按钮，确认选中态清晰切换。
4. 展开高级设置，若 `wireApi` 满足规则，确认也显示胶囊按钮。
5. 对于不满足规则的字段，确认仍保持下拉框行为。
