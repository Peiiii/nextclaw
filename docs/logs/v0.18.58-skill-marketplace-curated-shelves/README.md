# v0.18.58-skill-marketplace-curated-shelves

## 迭代完成说明

本轮为 Skill Marketplace 精选货架式展示的第一版可视化草案，不是最终交付闭环。实现重点是把 Marketplace tab 从纯平铺列表推进为更有发现感的入口，同时保持 NextClaw 当前工作台风格。

本次完成：

1. 新增 `curated-shelves/MarketplaceCuratedShelves` 展示组件，用于渲染“场景”“最近更新”两组货架。
2. 新增 `curated-shelves/marketplace-curated-shelves.config.ts`，把场景定义和 tone 样式从渲染组件中拆出，避免组件文件膨胀。
3. 在 Skill Marketplace 的 `Marketplace` tab 中按条件展示货架：只在技能市场、无搜索、非 loading/error、已加载至少 4 个技能时展示。
4. 保留原完整技能列表、安装按钮、已安装状态、详情打开和无限滚动链路，不改变安装/管理业务行为。
5. 根据方案讨论稿统一命名为 `NextClaw 官方`，不再使用 `NextClaw 维护`。
6. 根据用户反馈移除 Skill Marketplace 页内冗余标题区，避免重复标题占据首屏空间。
7. 将第一版过强的 demo 风格 bento 收敛为更紧凑的白底弱边框卡片，降低彩色块和展示感，提高工作台信息密度。
8. 将场景卡片点击从“写入搜索框”改为进入子路由模块页：`/skills/scenes/:scene`，模块内只显示相关技能，搜索框保持不变，并在左上角提供返回上一级。
9. 场景模块页去掉外层大卡片包裹，改为左上角返回箭头 + 标题信息 + 自适应网格。
10. 为货架后的完整列表补齐独立标题，形成“场景 / 最近更新 / 全部技能”的完整层级。
11. 将二级场景页顶部压缩为两行：第一行返回、图标、标题、技能数量；第二行摘要和少量标签，避免顶部信息过高。
12. 将卡片视觉继续收敛：去掉卡片内部 tag 胶囊、作者胶囊和强色安装块，统一场景 icon 色彩为中性灰，降低小块状元素之间的视觉冲突。
13. 将精选货架拆入 `components/curated-shelves/` 子目录，避免 marketplace `components/` 父目录直接文件数越过治理预算。
14. 按用户要求创建视觉实验前检查点：`stash@{0}`，名称为 `checkpoint-skill-marketplace-before-visual-cleanup`。
15. 新增 `GET /api/marketplace/skills/scenes`，返回 `{ scenes: [{ scene, title, description? }] }`，不再给 scenes 列表附加 `type: "skill"`。
16. 在 `GET /api/marketplace/skills/items` 支持 `scene` 查询，由 server 负责把 scene 映射到 tags；未知 scene 返回空列表。
17. 前端场景页通过 `items?scene=<scene>` 获取数据，不再基于当前分页结果做本地 tag 过滤。
18. 删除前端“基础能力”启发式评分货架，避免在没有后端契约时写死伪策展逻辑。
19. 修复进入具体 scene 页面时先闪现旧目录数据的问题：`useMarketplaceItems` 不再跨 `scene/q/tag/sort/pageSize` 复用 placeholder data，scene 首次请求期间展示模块内骨架加载态。
20. 将 scene 数量加回正式契约：`GET /api/marketplace/skills/scenes` 现在返回每个 scene 的 `count`，由 server 基于完整 skill 列表和 scene 映射计算，前端不再用当前分页结果凑数。
21. 压缩“场景”卡片：去掉每张卡重复的 `Explore / View matching skills` 文案，改为紧凑图标、标题、数量和一行描述，降低首屏占用。
22. 压缩“最近更新”货架卡片 header：参考普通 skill 列表卡的信息结构，把技能名称和 `slug` 收到图标右侧两行，移除原先右上角单独来源标签造成的空白。
23. 为“最近更新”和场景二级页 skill 卡片补充稳定识别色，并与下方普通技能列表共用 `MarketplaceItemIcon`：同样代表 skill 的头像区域使用同一套按名称 hash 的颜色逻辑和样式。
24. 优化 marketplace 骨架屏高度：骨架数量不再绑定分页条数，列表加载态和场景二级页加载态使用可填满滚动容器的 grid，尽量覆盖不同屏幕高度，避免高屏 loading 态下方大片空白。
25. 为“场景”入口图标恢复轻量颜色：每个场景沿用已有 tone 配置，仅图标块使用实色识别色，卡片背景仍保持白底弱边框，避免界面再次变得花哨。
26. 优化普通 skill 列表卡操作区：默认用图标展示已安装/已禁用状态，安装、启用/禁用、卸载等高频操作在 hover / focus 时直接浮现，不收进更多菜单。
27. 修复 skill marketplace 首页接口冷启动和并发加载不稳定：普通 `items?page/pageSize` 不再完整拉取全量 catalog，而是只请求远端当前页；`scene` 过滤、`scenes` 列表、skill 详情和 recommendations 下沉到 marketplace API worker 的 D1 原生查询，NextClaw server 只透传远端契约，不再在 BFF 本地用 tag 规则全量过滤；远端 marketplace fetch 增加明确超时，避免上游网络卡住时前端无限 loading。
28. 修复 skill 场景二级页无限滚动失效：场景页原本复用 infinite query，但底部加载 sentinel 被 `isSceneRoute` 条件挡掉，导致接近底部不会自动请求下一页；现在场景页也渲染同一个无限滚动状态，并补充回归测试。
29. 将 skill/plugin marketplace 普通列表默认分页从 `12` 调整为 `20`，减少用户滚动到列表底部时的加载频率；MCP marketplace 保持独立分页策略不变。

## 测试/验证/验收方式

- 定向测试：`pnpm -C packages/nextclaw-ui test src/features/marketplace/components/marketplace-page.test.tsx`
  - 结果：通过。
- 定向测试：`pnpm -C packages/nextclaw-ui test src/features/marketplace/components/marketplace-page.test.tsx src/features/marketplace/components/curated-shelves/marketplace-curated-scene-route.test.tsx`
  - 结果：通过，`7` 个测试通过；覆盖“点击目标卡片进入子路由、不污染搜索、场景页无搜索/目录外壳、返回上一级”。
- TypeScript：`pnpm -C packages/nextclaw-ui tsc`
  - 结果：通过。
- 定向 ESLint：`pnpm -C packages/nextclaw-ui exec eslint src/features/marketplace/components/marketplace-page.tsx src/features/marketplace/components/marketplace-page.test.tsx src/features/marketplace/components/curated-shelves/marketplace-curated-shelves.tsx src/features/marketplace/components/curated-shelves/marketplace-curated-shelves.config.ts src/features/marketplace/components/curated-shelves/marketplace-shelf-card.tsx src/features/marketplace/components/curated-shelves/marketplace-curated-module-state.ts`
  - 结果：无错误；保留既有 `MarketplacePage` `max-statements` warning，数值未继续恶化。
- Playwright 冒烟：
  - 打开 `http://127.0.0.1:5174/skills`。
  - 概览截图通过，`Skill Catalog` 标题出现 1 次；点击 `Development` 后进入 `http://127.0.0.1:5174/skills/scenes/development-debugging`，`Back` 可见，场景页搜索框不可见。
  - 最新截图路径：`/tmp/nextclaw-marketplace-all-title.png`、`/tmp/nextclaw-marketplace-scene-route.png` 与 `/tmp/nextclaw-marketplace-scene-route-mobile.png`。
- Playwright 二级场景页顶部冒烟：
  - 打开 `http://127.0.0.1:5174/skills/scenes/development-debugging`。
  - 结果：返回按钮可见，搜索框不可见；桌面与窄屏截图通过。
  - 最新截图路径：`/tmp/nextclaw-marketplace-scene-header-two-line.png` 与 `/tmp/nextclaw-marketplace-scene-header-two-line-mobile.png`。
- Playwright 清爽版视觉冒烟：
  - 打开 `http://127.0.0.1:5174/skills` 与 `http://127.0.0.1:5174/skills/scenes/development-debugging`。
  - 结果：返回按钮可见，场景页搜索框不可见；概览、场景页、窄屏场景页截图通过。
  - 最新截图路径：`/tmp/nextclaw-marketplace-clean-overview.png`、`/tmp/nextclaw-marketplace-clean-scene.png` 与 `/tmp/nextclaw-marketplace-clean-scene-mobile.png`。
- Maintainability guard：
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/features/marketplace/components/marketplace-page.tsx packages/nextclaw-ui/src/features/marketplace/components/marketplace-page.test.tsx packages/nextclaw-ui/src/features/marketplace/components/curated-shelves/marketplace-curated-shelves.tsx packages/nextclaw-ui/src/features/marketplace/components/curated-shelves/marketplace-curated-shelves.config.ts packages/nextclaw-ui/src/features/marketplace/components/curated-shelves/marketplace-shelf-card.tsx packages/nextclaw-ui/src/features/marketplace/components/curated-shelves/marketplace-curated-module-state.ts`
  - 结果：无错误；保留 `MarketplacePage` 接近文件预算、既有函数复杂度 warning，以及货架主文件接近预算 warning。
- Governance ratchet：`pnpm check:governance-backlog-ratchet`
  - 结果：通过。
- Governance full suite：`pnpm lint:new-code:governance`
  - 结果：此前通过；本次视觉清理后重跑被当前工作区其它已改文件阻塞，阻塞项在 `packages/nextclaw-core/src/features/channels/services/extension-channel.service.ts` 的 module-structure-drift，与 Skill Marketplace 改动无关。
- 本次视觉清理相关定向检查：
  - `pnpm -C packages/nextclaw-ui exec eslint src/features/marketplace/components/curated-shelves/marketplace-shelf-card.tsx src/features/marketplace/components/curated-shelves/marketplace-curated-shelves.tsx src/features/marketplace/components/curated-shelves/marketplace-curated-shelves.config.ts`
  - `node scripts/governance/lint-new-code-context-destructuring.mjs -- <本次视觉清理触达文件>`
  - 结果：通过。
- 本次相关 context destructuring 定向检查：
  - `node scripts/governance/lint-new-code-context-destructuring.mjs -- <本次触达的 marketplace 文件>`
  - 结果：通过。
- 本次 scene 契约化改造补充验证：
  - `pnpm -C packages/nextclaw-server build`
    - 结果：通过；用于刷新本地 `@nextclaw/server` 类型产物，build 保留第三方依赖 warning。
  - `pnpm -C packages/nextclaw-ui tsc --noEmit`
    - 结果：通过。
  - `pnpm -C packages/nextclaw-server tsc --noEmit`
    - 结果：通过。
  - `pnpm -C packages/nextclaw-client-sdk tsc`
    - 结果：通过。
  - `pnpm --dir packages/nextclaw-ui exec vitest run src/features/marketplace/components/curated-shelves/marketplace-curated-scene-route.test.tsx src/features/marketplace/components/marketplace-page.test.tsx`
    - 结果：通过，`7` 个测试通过。
  - `pnpm --dir packages/nextclaw-server exec vitest run src/app/router.marketplace-manage.test.ts`
    - 结果：通过，`6` 个测试通过。
  - 定向 ESLint：
    - UI 触达文件：通过；保留 `MarketplacePage` 既有 `max-statements` warning，指标维持 `42`，未继续恶化。
    - Server / client-sdk 触达文件：通过。
  - `pnpm lint:new-code:governance`
    - 结果：通过；仅提示 `packages/nextclaw-ui/src/shared/lib/api/utils` 仍是历史 flat mixed-responsibility 目录 warning。
  - `pnpm check:governance-backlog-ratchet`
    - 结果：通过。
- 本次详情预览暖色与 Markdown 语义渲染补充验证：
  - `pnpm -C packages/nextclaw-ui tsc --noEmit`
    - 结果：通过。
  - `pnpm --dir packages/nextclaw-ui exec vitest run src/features/marketplace/components/detail-doc/marketplace-detail-doc.test.ts src/features/marketplace/components/marketplace-page-detail.test.tsx`
    - 结果：通过，`5` 个测试通过；覆盖 metadata key-value 渲染、Markdown 标题/列表/行内代码/代码块渲染，以及 HTML escape。
  - `pnpm --dir packages/nextclaw-ui exec eslint src/features/marketplace/components/marketplace-detail-doc.ts src/features/marketplace/components/detail-doc/marketplace-detail-doc-renderer.ts src/features/marketplace/components/detail-doc/marketplace-detail-doc.test.ts src/shared/components/doc-browser/doc-browser.tsx`
    - 结果：无错误；保留 `DocBrowser` 既有 `max-lines-per-function` warning。
  - Playwright 冒烟：
    - 打开 `http://127.0.0.1:5174/marketplace/skills`，拦截 skill content 返回 Markdown + key-value metadata 后点击技能。
    - 结果：右侧详情 metadata 显示为 `<dl>`，正文显示 `<h1>`、`<strong>`、`<code>`、`<li>` 与代码块，不再把 Markdown 标题作为裸 `<pre>` 展示；详情页与 active tab 均无蓝色残留，使用项目 warm 色系。截图路径：`/tmp/nextclaw-marketplace-detail-markdown-rendered-split.png`、`/tmp/nextclaw-marketplace-detail-warm-tab.png`。
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/features/marketplace/components/marketplace-detail-doc.ts packages/nextclaw-ui/src/features/marketplace/components/detail-doc/marketplace-detail-doc-renderer.ts packages/nextclaw-ui/src/features/marketplace/components/detail-doc/marketplace-detail-doc.test.ts packages/nextclaw-ui/src/shared/components/doc-browser/doc-browser.tsx`
    - 结果：通过；保留 `DocBrowser` 接近文件预算与既有超长函数 warning。解析逻辑已收敛到 `components/detail-doc/` 子目录，避免继续挤压 `components/` 根目录预算。
  - `pnpm lint:new-code:governance`
    - 结果：通过。
  - `pnpm check:governance-backlog-ratchet`
    - 结果：通过。
- 本次详情预览视觉与加载态补充验证：
  - `pnpm -C packages/nextclaw-ui tsc --noEmit`
    - 结果：通过。
  - `pnpm --dir packages/nextclaw-ui exec vitest run src/features/marketplace/components/marketplace-page-detail.test.tsx src/features/marketplace/components/marketplace-page.test.tsx`
    - 结果：通过，`8` 个测试通过；覆盖点击技能后先打开骨架态详情，且初始详情不再包含 `Loading` 文案。
  - `pnpm --dir packages/nextclaw-ui exec eslint src/features/marketplace/components/marketplace-detail-doc.ts src/features/marketplace/components/marketplace-page.tsx src/features/marketplace/components/marketplace-page-detail.test.tsx`
    - 结果：无错误；保留 `MarketplacePage` 既有 `max-statements` warning，数值仍为 `42`。
  - Playwright 冒烟：
    - 拦截 `http://127.0.0.1:5174/marketplace/skills` 的 skill content 请求后点击技能。
    - 结果：初始右侧详情 iframe 包含 `aria-busy="true"` 骨架态，不包含 `Loading` 文案；接口返回后 `aria-busy` 消失，页面不再包含旧蓝色渐变样式，使用中性背景并显示真实内容。截图路径：`/tmp/nextclaw-marketplace-detail-skeleton.png`、`/tmp/nextclaw-marketplace-detail-loaded-neutral.png`。
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/features/marketplace/components/marketplace-detail-doc.ts packages/nextclaw-ui/src/features/marketplace/components/marketplace-page.tsx packages/nextclaw-ui/src/features/marketplace/components/marketplace-page-detail.test.tsx`
    - 结果：通过；保留 `MarketplacePage` 接近文件预算和既有超长函数 warning。
  - `pnpm lint:new-code:governance`
    - 结果：通过。
  - `pnpm check:governance-backlog-ratchet`
    - 结果：通过。
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <本次触达文件>`
    - 结果：无错误；保留 `MarketplacePage` 既有超长函数 warning、API types 接近预算 warning、部分历史目录预算 warning。
  - 本地路由 smoke：
    - `curl -I http://127.0.0.1:5174/skills`
    - `curl -I http://127.0.0.1:5174/skills/scenes/development-debugging`
    - 结果：均返回 `200 OK`；Vite 源码模块可加载最新 `marketplace-page.tsx`。
  - 浏览器截图 smoke：
    - 本轮尝试使用 Chrome DevTools MCP 打开 `http://127.0.0.1:5174/skills`，但该 MCP profile 已被占用，工具返回 “browser is already running”；因此改用上述 HTTP smoke 和定向 UI 测试作为替代证明。
- 本次 scene 加载态修复补充验证：
  - `pnpm -C packages/nextclaw-ui tsc --noEmit`
    - 结果：通过。
  - `pnpm --dir packages/nextclaw-ui exec vitest run src/features/marketplace/components/curated-shelves/marketplace-curated-scene-route.test.tsx src/features/marketplace/components/marketplace-page.test.tsx`
    - 结果：通过，`8` 个测试通过；新增覆盖“场景页加载中显示 skeleton，不显示旧目录项”。
  - `pnpm -C packages/nextclaw-ui exec eslint <本次触达 UI 文件>`
    - 结果：无错误；保留 `MarketplacePage` 既有 `max-statements` warning，指标维持 `42`。
  - `pnpm lint:new-code:governance`
    - 结果：通过；保留 `shared/lib/api/utils` 历史 flat mixed-responsibility 目录 warning。
  - `pnpm check:governance-backlog-ratchet`
    - 结果：通过。
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <本次加载态修复触达文件>`
    - 结果：无错误；保留 `MarketplacePage` 接近预算和既有超长函数 warning。
- 本次 scene 数量与紧凑卡片补充验证：
  - `pnpm -C packages/nextclaw-server tsc --noEmit`
    - 结果：通过。
  - `pnpm -C packages/nextclaw-ui tsc --noEmit`
    - 结果：通过。
  - `pnpm --dir packages/nextclaw-server exec vitest run src/app/router.marketplace-manage.test.ts`
    - 结果：通过，`6` 个测试通过；覆盖 scenes 返回 `count` 且不返回 `type`。
  - `pnpm --dir packages/nextclaw-ui exec vitest run src/features/marketplace/components/curated-shelves/marketplace-curated-scene-route.test.tsx src/features/marketplace/components/marketplace-page.test.tsx`
    - 结果：通过，`8` 个测试通过。
  - `pnpm -C packages/nextclaw-server build`
    - 结果：通过；用于刷新本地 `@nextclaw/server` 类型产物，build 保留第三方依赖 warning。
  - `pnpm -C packages/nextclaw-client-sdk tsc`
    - 结果：通过。
  - 定向 ESLint：
    - UI / Server 触达文件：通过。
  - `pnpm lint:new-code:governance`
    - 结果：通过；保留 `shared/lib/api/utils` 历史 flat mixed-responsibility 目录 warning。
  - `pnpm check:governance-backlog-ratchet`
    - 结果：通过。
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <本次 scene count 与紧凑卡片触达文件>`
    - 结果：无错误；保留历史目录预算 warning 与 API types 接近预算 warning。
- 本次“最近更新”卡片 header 补充验证：
  - `pnpm -C packages/nextclaw-ui tsc --noEmit`
    - 结果：通过。
  - `pnpm --dir packages/nextclaw-ui exec eslint src/features/marketplace/components/curated-shelves/marketplace-shelf-card.tsx`
    - 结果：通过。
  - `pnpm --dir packages/nextclaw-ui exec vitest run src/features/marketplace/components/curated-shelves/marketplace-curated-scene-route.test.tsx src/features/marketplace/components/marketplace-page.test.tsx`
    - 结果：通过，`8` 个测试通过。
  - `pnpm lint:new-code:governance`
    - 结果：通过；保留 `shared/lib/api/utils` 历史 flat mixed-responsibility 目录 warning。
  - `pnpm check:governance-backlog-ratchet`
    - 结果：通过。
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/features/marketplace/components/curated-shelves/marketplace-shelf-card.tsx`
    - 结果：未通过；该文件在当前工作区相对 `HEAD` 仍是本批次新增文件，guard 按非功能新增文件统计为非测试净增 `+140` 行。此次 header 微调本身已删除旧 `SourceLabel` 渲染路径并复用同一 `SkillShelfCard` owner，没有新增并行组件。
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/features/marketplace/components/curated-shelves/marketplace-shelf-card.tsx`
    - 结果：通过；作为整个精选货架新增能力批次的 scoped guard，未发现可维护性问题。
  - Playwright 冒烟：
    - 打开 `http://127.0.0.1:5174/skills`。
    - 结果：页面返回 `200 OK`，正文可见 `Recently updated`；卡片文本呈现为 `Codex NARP Runtime` / `codex-narp-runtime` 这类两行 header 信息。截图路径：`/tmp/nextclaw-skill-marketplace-shelf-card.png`。
    - 备注：Chrome DevTools MCP 因 profile 已被占用无法新开页面，已用 Playwright headless 作为替代视觉冒烟。
- 本次“最近更新”卡片轻量配色补充验证：
  - `pnpm -C packages/nextclaw-ui tsc --noEmit`
    - 结果：通过。
  - `pnpm --dir packages/nextclaw-ui exec eslint src/features/marketplace/components/curated-shelves/marketplace-shelf-card.tsx`
    - 结果：通过。
  - `pnpm --dir packages/nextclaw-ui exec vitest run src/features/marketplace/components/curated-shelves/marketplace-curated-scene-route.test.tsx src/features/marketplace/components/marketplace-page.test.tsx`
    - 结果：通过，`8` 个测试通过。
  - Playwright 冒烟：
    - 打开 `http://127.0.0.1:5174/skills`。
    - 结果：`Recently updated` 区域仍显示 slug 与 tag 行；skill 头像与下方普通技能列表共用同一套实色识别色。截图路径：`/tmp/nextclaw-skill-marketplace-shelf-card-color.png`。
- 本次骨架屏高度补充验证：
  - `pnpm -C packages/nextclaw-ui tsc --noEmit`
    - 结果：通过。
  - `pnpm --dir packages/nextclaw-ui exec eslint src/features/marketplace/components/marketplace-page.tsx src/features/marketplace/components/marketplace-page.test.tsx src/features/marketplace/components/marketplace-catalog-grid.tsx src/features/marketplace/components/marketplace-page-parts.tsx src/features/marketplace/components/curated-shelves/marketplace-curated-shelves.tsx src/features/marketplace/components/curated-shelves/marketplace-shelf-card.tsx`
    - 结果：无错误；保留 `MarketplacePage` 既有 `max-statements` warning，数值仍为 `42`。
  - `pnpm --dir packages/nextclaw-ui exec vitest run src/features/marketplace/components/curated-shelves/marketplace-curated-scene-route.test.tsx src/features/marketplace/components/marketplace-page.test.tsx`
    - 结果：通过，`8` 个测试通过；列表页骨架数量更新为 `36`。
  - Playwright 挂起 `items` 请求冒烟：
    - `http://127.0.0.1:5174/skills` 桌面视口 `1366x900`：骨架 `36` 张，grid 高度约 `2076px`。截图路径：`/tmp/nextclaw-marketplace-skeleton-fill-desktop.png`。
    - `http://127.0.0.1:5174/skills` 移动视口 `390x844`：骨架 `36` 张，grid 高度约 `4164px`。截图路径：`/tmp/nextclaw-marketplace-skeleton-fill-mobile.png`。
    - `http://127.0.0.1:5174/skills/scenes/development-debugging` 桌面视口 `1366x900`：骨架 `24` 张，grid 高度约 `1412px`。截图路径：`/tmp/nextclaw-marketplace-scene-skeleton-fill-desktop.png`。
- 本次列表卡操作区补充验证：
  - `pnpm -C packages/nextclaw-ui tsc --noEmit`
    - 结果：通过。
  - `pnpm --dir packages/nextclaw-ui exec eslint <本次 marketplace 触达文件>`
    - 结果：无错误；保留 `MarketplacePage` 既有 `max-statements` warning，数值仍为 `42`。
  - `pnpm --dir packages/nextclaw-ui exec vitest run src/features/marketplace/components/curated-shelves/marketplace-curated-scene-route.test.tsx src/features/marketplace/components/marketplace-page.test.tsx`
    - 结果：通过，`8` 个测试通过。
  - Playwright 冒烟：
    - 使用 mock marketplace 数据打开 `http://127.0.0.1:5174/skills`。
    - 结果：已安装卡片默认存在 `Installed` 状态图标；`Uninstall` 动作默认 opacity 为 `0` 且 pointer events 为 `none`，hover 后 opacity 为 `1` 且 pointer events 为 `auto`。截图路径：`/tmp/nextclaw-marketplace-list-hover-actions.png`。
- 本次列表卡状态与简介截断补充验证：
  - `pnpm -C packages/nextclaw-ui tsc --noEmit`
    - 结果：通过。
  - `pnpm --dir packages/nextclaw-ui exec eslint src/features/marketplace/components/marketplace-list-card.tsx`
    - 结果：通过。
  - `pnpm --dir packages/nextclaw-ui exec vitest run src/features/marketplace/components/marketplace-page.test.tsx`
    - 结果：通过，`5` 个测试通过。
  - Playwright 冒烟：
    - 打开 `http://127.0.0.1:5174/marketplace/skills`。
    - 结果：已安装状态为裸 `CheckCircle2` / `PowerOff` 图标，无背景色；列表卡操作区默认不再占用大宽度，hover 后操作按钮显示；简介从强制单行调整为最多两行。截图路径：`/tmp/nextclaw-marketplace-list-card-status-clean-v2.png`。
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/features/marketplace/components/marketplace-list-card.tsx`
    - 结果：未通过；guard 按整个未提交 diff 统计该文件，包含前面列表卡 hover 操作区的用户可见改造，非测试净增 `+93` 行。
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/features/marketplace/components/marketplace-list-card.tsx`
    - 结果：通过；作为本批 UI 体验改造的 scoped guard，未发现可维护性问题。
  - `pnpm lint:new-code:governance`
    - 结果：通过。
  - `pnpm check:governance-backlog-ratchet`
    - 结果：通过。
- 本次 skill marketplace 接口不返回问题补充验证：
  - 根因：场景货架加入后，NextClaw server 曾在 BFF 层把远端 skill catalog 全量拉回本地，再用本地 scene -> tag 规则过滤和计数；冷启动或并发请求时，本地 Node `fetch` 到远端 marketplace 的 HTTPS 路径偶发慢请求会被放大成前端长时间 loading。
  - 修复：普通 `items` 只透传当前页；`scene` 查询、`scenes` 计数、skill 详情和 recommendations 改由 marketplace API worker 原生 D1 查询支持。缓存已移除，避免掩盖真实链路问题。
  - `pnpm -C packages/nextclaw-server tsc --noEmit`
    - 结果：通过。
  - `pnpm -C workers/marketplace-api tsc`
    - 结果：通过。
  - `pnpm -C workers/marketplace-api lint`
    - 结果：通过。
  - `pnpm --dir packages/nextclaw-server exec vitest run src/app/router.marketplace-manage.test.ts src/app/router.marketplace-content.test.ts`
    - 结果：通过，`15` 个测试通过；覆盖普通 `items` 保留 `page/pageSize` 透传，`scene` 查询透传到远端 marketplace API。
  - `pnpm --dir packages/nextclaw-server exec eslint src/features/marketplace/controllers/skill-marketplace.controller.ts src/features/marketplace/utils/marketplace-catalog.utils.ts src/features/marketplace/index.ts src/app/router.marketplace-manage.test.ts`
    - 结果：通过。
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
    - 结果：无错误；保留 `packages/nextclaw-server/src/app` 历史目录预算 warning，以及 worker `main.ts` / `d1-marketplace-skill.repository.ts` 接近文件预算 warning。
  - `pnpm check:governance-backlog-ratchet`
    - 结果：通过。
  - `pnpm lint:new-code:governance`
    - 结果：通过。
  - 远端契约状态：
    - 当前线上 `https://marketplace-api.nextclaw.io/api/v1/skills/scenes` 仍返回 `404`，说明 worker 代码需要发布后，NextClaw server 的 `scenes` 代理才能在线上闭环。

## 发布/部署方式

本次不涉及发布或部署。若继续推进到正式版本，按正常前端构建与桌面资源打包链路发布即可。

## 用户/产品视角的验收步骤

1. 进入 Skill Marketplace 的 Marketplace tab。
2. 在无搜索条件且技能数据加载成功时，应先看到“场景”货架。
3. 货架之后应看到完整列表自己的标题，例如 `Skill Catalog` / `全部技能`，而不是直接接一组无标题卡片。
4. 点击任一场景卡片后，应进入 `/skills/scenes/:scene` 子路由，而不是把关键词写进搜索框。
5. 场景页应左上角返回、旁边显示标题信息；顶部控制在两行左右，内容直接以自适应网格平铺，不再包一层大卡片。
6. 返回后继续向下应看到“最近更新”和完整技能列表，原安装、已安装状态和详情打开行为保持可用。
7. “最近更新”卡片的 header 应为图标 + 右侧两行信息：第一行技能名称，第二行 slug，不再在右上角留下单独来源标签空白。
8. 普通技能列表卡默认应只显示裸状态图标；hover 后出现安装/启用/卸载等高频操作，简介最多两行展示。
9. 点击普通技能卡片后，右侧详情应先显示整页骨架屏，不再出现零散 `Loading` 文案；加载完成后详情页应采用项目 warm 色系、细边框、纸面感风格，不再使用蓝色渐变卡片。
10. 右侧详情 tab 激活态应使用 warm/amber 风格，而不是蓝色 tab；Skill 正文 Markdown 应语义化渲染，metadata 应优先解析为 key-value 信息块。
11. Installed tab 应继续保持管理列表，不混入发现货架。

## 可维护性总结汇总

- **本次是否已尽最大努力优化可维护性**：阶段性是。第一版先写出可视化草案后，已将单组件拆成 `curated-shelves/` 下的主展示、配置、卡片和模块状态文件，避免一个新大文件承载全部配置、渲染和状态；随后又删除页内冗余标题区，减少首屏 UI 噪音。
- **是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则**：部分满足。本次是新增用户可见能力，因此存在必要代码增长；实现上复用现有列表卡片的安装/详情动作和已有 marketplace 数据，不改变业务链路。
- **是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化**：总代码和文件数因新增用户可见能力增长；父级 `components/` 直接文件数通过 `curated-shelves/` 与 `detail-doc/` 子目录收敛，未越过目录预算。`MarketplacePage` 复杂度 warning 未继续恶化，但文件接近预算，后续若继续推进应优先拆页面 owner/hook；`DocBrowser` 仍有既有超长函数债务。
- **抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰**：页面只装配数据和传递已有动作；`curated-shelves` 子目录负责精选货架展示、场景配置、货架卡片与场景页展示；`detail-doc` 子目录负责详情 Markdown / metadata 渲染；`use-marketplace-curated-scene-route` 负责子路由派生数据，边界更清楚。
- **目录结构与文件组织是否满足当前项目治理要求**：满足。新增文件为同 feature 的展示组件与配置文件，命名符合 kebab-case 与角色后缀。
- **是否基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写**：是，基于 guard、ESLint warning 和代码体量做了二次复核；本轮仍保留 `MarketplacePage` 既有复杂度债务，后续正式化应拆分页面。

### 反馈复盘

- 学习来源：用户指出第一版过于机械复刻参考 demo，且页面标题与大卡片造成空间浪费。
- 学习来源补充：用户指出场景卡片点击变成搜索不是应用商店式体验，应该进入一个模块并能返回上一级。
- 学习来源补充：用户指出模块页应该是子路由、左上角返回、内容自适应平铺，并且完整列表区需要独立标题。
- 学习来源补充：用户指出卡片内部重复小胶囊、强色块和多色系统让界面不够清爽优雅。
- 通用模式：工作台型页面参考外部设计时，只应吸收信息节奏和结构启发，不能复制展示型视觉表皮；场景入口应表达清晰路由层级，而不是伪装成搜索或筛选；内容区优先直接、自适应、无多余包裹；卡片内部不要叠加太多小块状 UI，优先使用文字、间距、细线和少量中性色建立层级；紧凑、效率和项目风格优先。
- 现有规则判断：项目已有前端指导要求 SaaS/工作台界面避免营销化和装饰化，本次问题属于执行偏航，不是规则缺失。因此暂不修改 AGENTS 或 skill，当前代码和迭代记录已修正并留痕。

## NPM 包发布记录

不涉及 NPM 包发布。
