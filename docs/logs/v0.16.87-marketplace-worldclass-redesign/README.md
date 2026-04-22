# v0.16.87-marketplace-worldclass-redesign

## 迭代完成说明
本轮收尾将 `packages/nextclaw-ui` 中被误改的 Marketplace / Skills 展示层恢复回更接近重构前的常规信息架构，并保留后续已经接好的数据查询、安装/管理动作与目录治理结果。实际落地包括：
1. 移除了 `features/marketplace/components/marketplace-page.tsx` 中后续引入的沉浸式 Hero Banner、自定义毛玻璃导航和大面积视觉包装，恢复为 `PageHeader + Tabs + FilterPanel + 列表` 的常规页面骨架。
2. 将 `marketplace-list-card.tsx` 的卡片表现从高装饰度、强动效的 App Store 风格恢复为更紧凑、信息优先的列表卡片，保留安装、启停、卸载等真实操作入口。
3. 将 `marketplace-page-parts.tsx` 的筛选栏、骨架屏和无限滚动状态恢复为更朴素稳定的样式，避免样式层覆盖过强导致 Skills 页面视觉偏离原本产品预期。

**根因及修正说明**：
- 根因：`2026-04-17 21:48:00 +0800` 的提交 `e6392a36 Refactor nextclaw UI presentational reuse` 对 Marketplace / Skills 展示层做了大幅视觉重写，把原本更标准的页面骨架替换成了强装饰化的 Hero、定制导航和高度风格化卡片；后续目录治理提交并不是这次 UI 变化的来源。
- 根因确认方式：通过 `git log` 和 `git show --stat e6392a36` 对 `packages/nextclaw-ui/src/components/marketplace` 与当前 `features/marketplace/components` 的历史进行比对，确认该提交一次性删除旧版页面实现并引入整套新视觉结构；同时对当前 `marketplace-page.tsx` 代码检查可直接看到 `Modern App Store Hero` 等设计痕迹。
- 本次修复为何命中根因：本次不是再做局部样式打补丁，而是直接把误引入的展示骨架整体恢复为旧版布局语义，只保留后续仍然正确的数据与交互链路，因此命中了“展示层被整体换风格”这一根因，而不是只修局部表象。

## 测试/验证/验收方式
- 定向前端测试：`pnpm -C packages/nextclaw-ui test src/features/marketplace/components/marketplace-page.test.tsx`
- 类型检查：`pnpm -C packages/nextclaw-ui tsc`
- 包级构建：`pnpm -C packages/nextclaw-ui build`
- 定向 ESLint：`pnpm -C packages/nextclaw-ui exec eslint src/features/marketplace/components/marketplace-page.tsx src/features/marketplace/components/marketplace-page-parts.tsx src/features/marketplace/components/marketplace-list-card.tsx`
- 额外说明：`pnpm -C packages/nextclaw-ui lint` 仍会被包内既有历史 lint backlog 阻塞，本次未新增该类硬错误；定向到本次恢复文件后仅剩 `MarketplacePage` 的既有复杂度 warning。

## 发布/部署方式
- 按正常前端流程合并并构建 `@nextclaw/ui` 即可，无需额外迁移或数据补偿。

## 用户/产品视角的验收步骤
1. 进入 NextClaw 的 Marketplace / Skills 页面。
2. 页面顶部应回到常规的标题、副标题、Tabs 与搜索/排序栏，而不是大面积深色 Hero 头图。
3. 插件/技能卡片应以更紧凑的列表卡片出现，信息阅读优先，不再是明显偏 App Store 展示化的高装饰卡片。
4. 继续验证搜索、切换 `Marketplace / Installed`、安装、启停、卸载和详情打开，功能行为应保持正常。

## 可维护性总结汇总
- **本次是否已尽最大努力优化可维护性**：是。在不破坏后续真实功能链路的前提下，优先删除了误引入的大块展示层包装，而不是继续在其上叠补丁。
- **是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则**：是。本次方向是回退过度设计，减少视觉结构层级和样式噪音，让页面再次以信息结构为中心。
- **是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化**：是。恢复后删除了 Hero、自定义切换条和复杂卡片装饰带来的额外展示复杂度，没有新增文件，也没有增加目录债务。
- **抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加**：是。数据查询、详情打开、安装/管理动作仍沿用现有边界，本次只收缩展示层，不再增加新的抽象拼接。
- **目录结构与文件组织是否满足当前项目治理要求；若未满足，必须记录具体现状、为何本次未处理、以及下一步整理入口**：本次触达文件仍位于 `features/marketplace/components/`，未破坏当前目录治理结果。
- **是否基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写**：否。本次为一次范围很小的展示层回退修复，采用了定向代码审查与验证命令完成可维护性判断，未单独再跑完整的主观复核技能。

## NPM 包发布记录
- 本次不涉及 NPM 包发布。
