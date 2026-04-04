# v0.15.22 Project Pulse Docs Dashboard

## 迭代完成说明

本次新增了 docs 站公开页面 `Project Pulse`，把 NextClaw 的工程节奏与产品节奏收敛到一个可以对内管理、也可以对外展示的页面里。

本次完成项：

- 新增方案文档：
  - [2026-04-04 Project Pulse Dashboard Plan](../../plans/2026-04-04-project-pulse-dashboard-plan.md)
- 新增 `Project Pulse` 聚合数据生成链路：
  - `scripts/project-pulse/generate-data.mjs`
  - `scripts/project-pulse/data-core.mjs`
- 复用并聚合现有 LOC 指标，同时新增：
  - Git commit 趋势
  - Git tag 推导的 release 批次趋势
  - Product Notes 时间线
  - docs 站公开截图素材
- 新增 docs 页面与可视化组件：
  - `apps/docs/en/guide/project-pulse.md`
  - `apps/docs/zh/guide/project-pulse.md`
  - `apps/docs/.vitepress/components/project-pulse/*`
- 新增 docs 站静态产物：
  - `apps/docs/.vitepress/data/project-pulse.generated.mjs`
  - `apps/docs/public/project-pulse/gallery/*`
- 更新 docs 导航，将 `Project Pulse` 纳入 `Project` 分组
- 续改入口可见性，补齐三处显式入口：
  - 顶层导航 `Project / 项目` 直接进入 `Project Pulse`
  - 中英文首页 Hero 增加 `Project Pulse` 按钮
  - 中英文 Roadmap 页顶部增加前往 `Project Pulse` 的显式跳转
- 续改趋势图体验，按“成熟图表引擎 + 自定义产品摘要层”的方向重做趋势区：
  - 趋势曲线从手写 SVG 命中区逻辑切换为 `ECharts`
  - 每张趋势卡新增 `Latest / Change / Since start / Peak / Low` 这类摘要信息
  - 保留产品叙事层与视觉样式，但把 tooltip、坐标轴、响应式渲染交给成熟图表引擎
  - 移动端与桌面端统一为更稳定的 tooltip、轴标签和焦点高亮体验
- 续改 `Top scopes` 条形榜布局，修复长路径在双栏区域横向溢出并压到右侧卡片的问题：
  - `bar-list` 头部改成真正可收缩的双列布局
  - scope 名称改成两行截断 + 必要断词，而不是单行 `span` 省略
  - 小屏下数值自动落到下一行，避免再出现路径与数值互相挤压
- 续改 commit 趋势卡，补齐天级别观察视角：
  - 数据生成链路新增 `commitDaily`
  - commit 卡默认展示近 30 天“每日 commit 趋势”
  - 保留近 12 周周级视角，并在卡片内支持 `每日 / 每周` 切换
  - 日级与周级切换时，摘要窗口文案和 delta 说明会同步更新
- 扩展 `.github/workflows/code-volume-metrics.yml`，在现有 LOC workflow 中同步刷新 `Project Pulse` 聚合数据与截图副本
- 更新内部工作流说明与 metrics README

## 测试 / 验证 / 验收方式

已执行：

```bash
node scripts/project-pulse/generate-data.mjs
pnpm -C apps/docs build
pnpm lint:maintainability:guard
pnpm deploy:docs
curl -s http://127.0.0.1:4174/en/guide/project-pulse | rg -n "<title>Project Pulse|/project-pulse/gallery/chat-en\\.png|/en/notes/2026-04-03-project-aware-sessions-and-unified-patch-release"
curl -s http://127.0.0.1:4174/zh/guide/project-pulse | rg -n "<title>Project Pulse|/project-pulse/gallery/chat-zh\\.png|/zh/notes/2026-04-03-project-aware-sessions-and-unified-patch-release"
node - <<'EOF'
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });
  await page.goto('http://127.0.0.1:4174/en/guide/project-pulse', { waitUntil: 'networkidle' });
  await page.waitForSelector('.trend-chart__canvas svg', { timeout: 15000 });
  console.log(await page.locator('.trend-chart__canvas svg').count());
  await browser.close();
})();
EOF
node - <<'EOF'
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1236, height: 1364 } });
  await page.goto('http://127.0.0.1:4174/zh/guide/project-pulse', { waitUntil: 'networkidle' });
  const metrics = await page.evaluate(() => {
    const card = document.querySelector('.project-pulse__two-column > .project-pulse__panel');
    const benchmarkPanel = document.querySelector('.project-pulse__panel--accent');
    if (card instanceof HTMLElement && benchmarkPanel instanceof HTMLElement) {
      const cardRect = card.getBoundingClientRect();
      const benchmarkRect = benchmarkPanel.getBoundingClientRect();
      return Array.from(document.getElementsByClassName('bar-list__label')).map((label) => {
        if (label instanceof HTMLElement) {
          const rect = label.getBoundingClientRect();
          return {
            text: label.textContent,
            overflowPastCard: rect.right > cardRect.right,
            overlapBenchmark: rect.right > benchmarkRect.left
          };
        }
        return null;
      });
    }
    return null;
  });
  console.log(JSON.stringify(metrics, null, 2));
  await browser.close();
})();
EOF
node - <<'EOF'
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });
  await page.goto('http://127.0.0.1:4175/zh/guide/project-pulse', { waitUntil: 'networkidle' });
  const commitCard = page.locator('.project-pulse__trend-grid .project-pulse__panel').nth(1);
  await commitCard.locator('.trend-chart__summary-context').waitFor({ timeout: 10000 });
  console.log(await commitCard.locator('.trend-chart__summary-context').textContent());
  await commitCard.locator('.project-pulse__segmented-button').nth(1).click();
  await page.waitForTimeout(400);
  console.log(await commitCard.locator('.trend-chart__summary-context').textContent());
  await browser.close();
})();
EOF
curl -s https://d432c516.nextclaw-docs.pages.dev/en/guide/project-pulse | rg -n "Project Pulse|trend-chart__canvas"
node - <<'EOF'
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });
  await page.goto('https://d432c516.nextclaw-docs.pages.dev/en/guide/project-pulse', { waitUntil: 'networkidle' });
  await page.waitForSelector('.trend-chart__canvas svg', { timeout: 20000 });
  console.log(await page.locator('.trend-chart__canvas svg').count());
  await browser.close();
})();
EOF
```

验证结果：

- `generate-data` 通过，成功生成聚合数据模块与 docs 公共截图
- `apps/docs build` 通过，VitePress 可正常构建中英文 `Project Pulse` 页面
- `lint:maintainability:guard` 通过，且在脚本下沉后无新增可维护性告警
- docs preview 冒烟通过，中英文页面均能返回，且包含 `Project Pulse` 标题、截图路径与 Product Notes 链接
- 本地浏览器冒烟通过，Playwright 已确认趋势区成功渲染出 3 张 `ECharts` SVG 图表
- 本地浏览器边界检查通过，`Top scopes` 所有长路径均未再越过左侧卡片边界，也未再与右侧基准卡重叠
- 本地浏览器切换验证通过，commit 卡默认显示“近 30 天每日 commit 节奏”，切换后可正确切到“近 12 周交付节奏”
- `pnpm deploy:docs` 通过，Cloudflare Pages 已返回部署成功
- 线上冒烟通过，远端部署页成功渲染出 3 张趋势图，最新值展示正常

## 发布 / 部署方式

本次属于 docs 站公开页面变更，发布方式为：

```bash
pnpm deploy:docs
```

本次已实际执行完成，Cloudflare Pages 返回的部署地址为：

- `https://b95f9e8b.nextclaw-docs.pages.dev`
- 入口修正续改后的最新部署地址：`https://8c9c2464.nextclaw-docs.pages.dev`
- 图表体验优化续改后的最新部署地址：`https://d432c516.nextclaw-docs.pages.dev`
- `Top scopes` 布局溢出修复后的最新部署地址：`https://1513266e.nextclaw-docs.pages.dev`
- 日级 commit 趋势续改后的最新部署地址：`https://8e170c40.nextclaw-docs.pages.dev`

## 用户 / 产品视角的验收步骤

1. 打开 docs 站中英文 `Project Pulse` 页面。
2. 确认首屏可见核心概览：
   - 当前源码 LOC
   - 最近 30 天 commits
   - 最近 90 天 release 批次
   - 最近产品更新日期
   - 相对 OpenClaw 的体积占比
3. 确认趋势区可见三条图表：
   - LOC 历史
   - commit 节奏
   - release 节奏
4. 确认每张趋势卡不仅有曲线，还能看到：
   - 最新值
   - 相对上一窗口变化
   - 相对起点变化
   - 峰值 / 低点
   - 悬停后的精确 tooltip
5. 确认结构区可见：
   - Top scopes 分布
   - OpenClaw 对比卡
   - 近期 release 批次
6. 确认产品演进区可直接跳转到 Product Notes。
7. 确认截图区可看到当前产品画面，并显示最近截图刷新时间。
8. 确认中英文导航均能从 `Project` 分组进入该页面。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。中途发现 `ProjectPulsePage.vue` 和聚合脚本接近预算后，立即拆分为组件主文件 + 文案文件 + 样式文件，以及聚合入口 + 数据核心模块；本轮图表续改又进一步删除了自绘图表的命中区、坐标、hover 管理等自定义逻辑，改成“成熟库负责渲染，页面负责产品摘要”的更小复杂度方案。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：基本做到“增长最小必要”。本次为新增公开页面与自动化链路，文件数净增无法避免，但已把脚本下沉到 `scripts/project-pulse/` 子目录，避免继续恶化 `scripts/` 根目录平铺度；组件也集中在 `apps/docs/.vitepress/components/project-pulse/` 子目录，没有把新功能摊平到根层。本轮图表优化虽然引入一个第三方依赖，但删除了继续手搓图表引擎的维护方向，整体复杂度下降。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。`generate-data.mjs` 只保留聚合入口，`data-core.mjs` 负责数据读取与时间序列，Vue 主组件只负责页面编排，图表与条形图拆为独立组件，文案与样式外移；本轮趋势图进一步把“摘要信息”和“图形渲染”分层，没有继续把图表底层机制补丁式叠在页面组件里。
- 目录结构与文件组织是否满足当前项目治理要求：满足。新增脚本、组件、页面、静态产物均落在已有职责目录下，没有新增平行站点或平行数据体系。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：已执行独立复核，结论如下。

可维护性复核结论：通过

本次顺手减债：是

no maintainability findings

可维护性总结：这次新增的是一条真实的新用户可见能力，因此代码有最小必要增长；但通过把脚本和页面都按职责拆开，避免了把新能力变成新的超长文件或新的扁平目录债务。本轮趋势图续改又把原本容易继续膨胀的自绘图表逻辑收敛为成熟图表引擎承载，保留的复杂度主要集中在产品摘要层，方向更可持续。后续若 `Project Pulse` 再扩指标，应继续优先把“数据生成”与“页面展示”分别收敛在现有子目录内，而不是再回到根目录平铺。
