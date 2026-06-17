# v0.20.81 Skill Marketplace Card Density

## 迭代完成说明

本次按用户反馈优化 Skill Marketplace 主列表卡片密度，目标是让 skill 卡片更像可快速扫描的能力货架，而不是宽松的大说明块。

完成内容：

1. 将 Skill Marketplace 主列表从 `2xl` 才进入三列，调整为桌面 `xl` 即显示三列。
2. 将主列表卡片收紧为 `156px` 左右的紧凑卡片，降低圆角、padding 和操作按钮占位。
3. 首行保留 skill 图标、名称、安装规格和 hover/focus 操作；描述与标签移到首行下方，并使用整张卡片宽度，不再继承图标列缩进。
4. 为主列表卡片补充最多 3 个轻量标签 chip，帮助用户快速判断 skill 场景。
5. 同步调整 loading skeleton，让加载态尺寸与新卡片密度一致。
6. 将已安装/已禁用状态文案从组件内临时双语逻辑收敛到 marketplace i18n 文案 owner。
7. 过滤 skill 卡片里的冗余 `skill` 标签：skill marketplace 里所有条目本身都是 skill，`skill` 作为 tag 不提供额外决策信息；主列表卡片与“最近更新”货架卡片均不再展示该标签。
8. 将标签调整为底部锚点：描述长短不同也不会让标签停在卡片中部。
9. 将主列表卡片操作区移到右下角：右上角只展示已安装/禁用状态；桌面端安装、更新、卸载等操作保持 hover/focus 浮现，移动端保持直接可点。
10. 将底部操作按钮缩小到接近标签 chip 的视觉密度，降低高度、图标尺寸和字重，让操作不再抢过标签与状态层级。

本次不改变 skill 安装、更新、卸载、详情打开、搜索、排序和分页业务链路。

## 测试/验证/验收方式

- 定向 ESLint：
  - `pnpm -C packages/nextclaw-ui exec eslint src/features/marketplace/components/marketplace-list-card.tsx src/features/marketplace/components/marketplace-item-list-view.tsx src/features/marketplace/components/marketplace-page-parts.tsx`
  - 结果：通过。
- 定向测试：
  - `pnpm -C packages/nextclaw-ui test -- src/features/marketplace/components/__tests__/marketplace-page.test.tsx`
  - 结果：通过，初次密度调整为 `5` 个测试通过；补充过滤 `skill` 标签后为 `6` 个测试通过。
- TypeScript：
  - `pnpm -C packages/nextclaw-ui tsc`
  - 结果：通过。
- Package 级 ESLint：
  - `pnpm -C packages/nextclaw-ui lint`
  - 结果：通过。
- 补充定向 ESLint：
  - `pnpm -C packages/nextclaw-ui exec eslint src/features/marketplace/components/marketplace-list-card.tsx src/features/marketplace/components/curated-shelves/marketplace-shelf-card.tsx src/features/marketplace/components/__tests__/marketplace-page.test.tsx`
  - 结果：通过。
- Maintainability guard：
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/features/marketplace/components/marketplace-list-card.tsx packages/nextclaw-ui/src/features/marketplace/components/marketplace-item-list-view.tsx packages/nextclaw-ui/src/features/marketplace/components/marketplace-page-parts.tsx packages/nextclaw-ui/src/shared/lib/i18n/locales/zh-CN/marketplace.json packages/nextclaw-ui/src/shared/lib/i18n/locales/en-US/marketplace.json`
  - 结果：通过，无错误、无警告。
- Governance：
  - `pnpm lint:new-code:governance`
  - 结果：通过。
  - `pnpm check:governance-backlog-ratchet`
  - 结果：通过。
- Playwright 视觉冒烟：
  - 打开 `http://127.0.0.1:5174/skills`，拦截 marketplace API 返回固定 skill 数据。
  - 结果：`1440x900` 下主列表首行 `3` 张卡；主卡尺寸约 `344x156`；正文左偏移约 `15px`，图标右边界约 `51px`，证明描述不再继承图标列缩进。
  - 截图：`/tmp/nextclaw-skill-card-density.png`。
- 补充 Playwright 视觉冒烟：
  - 打开 `http://127.0.0.1:5174/skills`，拦截 marketplace API 返回一个已安装且可更新/卸载的 skill。
  - 结果：主列表首行仍为 `3` 张卡；已安装卡右上角保留状态 icon，`Update` / `Uninstall` 在桌面默认隐藏并在 hover/focus 后于右下角浮现；未安装卡 `Install` 也位于右下角；`skill` 标签未展示。
  - 截图：`/tmp/nextclaw-skill-card-density-actions.png`。
- 最终 Chrome 视觉冒烟：
  - 使用本机 Chrome 渲染 `http://127.0.0.1:5174/skills`，拦截 marketplace API 返回固定 skill 数据。
  - 结果：`1440x900` 下主列表首行 `3` 张卡；已安装卡操作区默认 `opacity: 0`、`pointer-events: none`，hover 后 `opacity: 1`、`pointer-events: auto`；操作按钮高度 `24px`、字号 `11px`、字重 `500`，与标签 chip 的高度、字号、字重一致。
  - 截图：`/tmp/nextclaw-skill-card-density-actions-hover.png`。
- Browser 插件尝试：
  - 尝试连接 in-app browser 打开本地页面，WebView attach 超时；已用 Playwright 真实渲染作为替代视觉验收。

## 发布/部署方式

无需单独部署。该改动属于 `@nextclaw/ui` 用户可见体验优化，待用户确认视觉方向后再决定是否添加 changeset 并进入后续统一前端/NPM 发布。

## 用户/产品视角的验收步骤

1. 打开 `Skills` 页面。
2. 确认 `All Skills` 主列表在普通桌面宽度下一行展示 3 个 skill 卡片。
3. 确认每张卡的图标只影响首行，描述与标签从卡片左侧内容边界开始，不再空出图标列。
4. 确认标签始终贴近卡片底部，不因为描述长短不同而停在中部。
5. 确认右上角只展示状态，安装/更新/卸载操作在桌面端 hover/focus 后从右下角浮现，移动端可直接点击。
6. 确认卡片仍能点击打开详情。
7. 确认窄宽度下仍自然退回两列或一列。

## 可维护性总结汇总

本次复用现有 `MarketplaceListCard`、`MarketplaceItemListView` 和 `MarketplaceListSkeleton` owner，没有新增并行卡片组件或页面级样式覆盖。代码增减为 `+67 / -44 / +23`，非测试代码同为 `+67 / -44 / +23`；增长来自用户可见卡片结构、标签 chip、loading skeleton 对齐和 i18n 文案收敛。`post-edit-maintainability-guard` 无 findings；`post-edit-maintainability-review` 结论为通过，当前增长属于视觉能力草案的最小必要增长，未引入新抽象、fallback 或重复业务链路。

## NPM 包发布记录

不涉及 NPM 包发布。本轮是用户正在确认的视觉草案，暂不添加 changeset；待视觉方向确认并准备提交/发布时，再按 release notes 规则判断是否补充用户 changelog。
