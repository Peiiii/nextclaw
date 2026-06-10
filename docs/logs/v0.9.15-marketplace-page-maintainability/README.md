# MarketplacePage 可维护性治理

## 迭代完成说明

- 将 `MarketplacePage` 中的安装/管理动作、详情打开逻辑和列表模型分别收敛到专属 hook owner，页面组件回到页面编排职责。
- 将 marketplace 列表视图从 catalog 命名改为 item list 命名，避免组件职责只表达 catalog 分支。
- 将列表卡片的非必要属性透传减少到业务动作、状态和渲染模型，不再向下透传语言字段。
- 修复拆分后技能市场顶部 Tabs 继承基础组件 pill 样式的问题，恢复页面内 underline tab 视觉合同。
- 将中文 SkillHub 入口文案从“更多 Skills 访问 SkillHub”调整为“访问 SkillHub”，避免右上角动作区重复表达。
- 根因：拆分后没有用真实页面验证顶部区域视觉状态，导致基础 Tabs 默认 active 背景/阴影泄漏到 marketplace 页面；右上角重复来自中文 i18n 文案自身冗余。
- 确认方式：对照用户截图和 `TabsTrigger` 基础组件默认样式，定位 active 态默认 `bg-white shadow-sm rounded-md` 与页面预期 underline 样式冲突。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui tsc`
  - 结果：通过。
- `pnpm --filter @nextclaw/ui exec eslint src/features/marketplace/components/marketplace-page.tsx src/features/marketplace/components/marketplace-item-list-view.tsx src/features/marketplace/components/marketplace-list-card.tsx src/features/marketplace/components/marketplace-page-data.ts src/features/marketplace/components/curated-shelves/marketplace-curated-shelves.tsx src/features/marketplace/hooks/use-marketplace-item-actions.ts src/features/marketplace/hooks/use-marketplace-item-detail.ts src/features/marketplace/hooks/use-marketplace-list-model.ts`
  - 结果：通过。
- `pnpm --filter @nextclaw/ui test -- src/features/marketplace/components/__tests__/marketplace-page.test.tsx src/features/marketplace/components/__tests__/marketplace-page-detail.test.tsx src/features/marketplace/components/curated-shelves/__tests__/marketplace-curated-scene-route.test.tsx`
  - 结果：3 个测试文件、13 个测试通过。
- `pnpm lint:new-code:governance`
  - 结果：通过。
- `pnpm check:governance-backlog-ratchet`
  - 结果：通过。
- `git diff --check`
  - 结果：通过。

## 发布/部署方式

- 本次未执行发布或部署。
- 不涉及数据库 migration。
- 不涉及线上 smoke。
- 已新增 `.changeset/marketplace-page-maintainability.md`，后续发布时进入 `@nextclaw/ui` patch 变更说明。

## 用户/产品视角的验收步骤

- 打开 Skills / 技能市场页面。
- 确认顶部“技能市场 / 已安装技能”是 underline tab 样式，而不是 pill/card 样式。
- 确认右上角入口只显示“访问 SkillHub”，不再出现“更多 Skills 访问 SkillHub”的重复表达。
- 搜索、排序、场景卡片、安装态列表和详情打开流程保持可用。

## 可维护性总结汇总

- 本次使用 `frontend-code-optimization`、`mvp-view-logic-decoupling`、`writing-beautiful-code`、`nextclaw-clean-implementation`、`frontend-style-encapsulation`、`frontend-interaction-quality`、`post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 约束实现。
- scoped maintainability guard：
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
  - 结果：通过；总计 `+674 / -674 / net +0`，非测试 `+674 / -674 / net +0`。
- 正向减债动作：删除 `MarketplacePage` 内联业务动作和列表派生逻辑，收敛到更明确的 hook owner；移除 `max-lines-per-function` 豁免；减少列表视图属性透传。
- 命名治理：`MarketplaceItemListView` 表达 item list 视图职责，避免 `CatalogGrid` 覆盖 installed 分支时语义失真。
- 剩余风险：顶部视觉已按截图问题定向修复；仍需在真实产品页面里做一次人工视觉确认，确保浏览器缓存或宿主布局没有额外影响。

## NPM 包发布记录

- 涉及包：`@nextclaw/ui`。
- 发布状态：未发布。
- 后续处理：随下一次统一 NPM 发布批次发布 patch。
