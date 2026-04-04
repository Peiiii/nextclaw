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
```

验证结果：

- `generate-data` 通过，成功生成聚合数据模块与 docs 公共截图
- `apps/docs build` 通过，VitePress 可正常构建中英文 `Project Pulse` 页面
- `lint:maintainability:guard` 通过，且在脚本下沉后无新增可维护性告警
- docs preview 冒烟通过，中英文页面均能返回，且包含 `Project Pulse` 标题、截图路径与 Product Notes 链接
- `pnpm deploy:docs` 通过，Cloudflare Pages 已返回部署成功

## 发布 / 部署方式

本次属于 docs 站公开页面变更，发布方式为：

```bash
pnpm deploy:docs
```

本次已实际执行完成，Cloudflare Pages 返回的部署地址为：

- `https://b95f9e8b.nextclaw-docs.pages.dev`

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
4. 确认结构区可见：
   - Top scopes 分布
   - OpenClaw 对比卡
   - 近期 release 批次
5. 确认产品演进区可直接跳转到 Product Notes。
6. 确认截图区可看到当前产品画面，并显示最近截图刷新时间。
7. 确认中英文导航均能从 `Project` 分组进入该页面。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。中途发现 `ProjectPulsePage.vue` 和聚合脚本接近预算后，立即拆分为组件主文件 + 文案文件 + 样式文件，以及聚合入口 + 数据核心模块，没有把功能完成建立在超长文件之上。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：基本做到“增长最小必要”。本次为新增公开页面与自动化链路，文件数净增无法避免，但已把脚本下沉到 `scripts/project-pulse/` 子目录，避免继续恶化 `scripts/` 根目录平铺度；组件也集中在 `apps/docs/.vitepress/components/project-pulse/` 子目录，没有把新功能摊平到根层。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。`generate-data.mjs` 只保留聚合入口，`data-core.mjs` 负责数据读取与时间序列，Vue 主组件只负责页面编排，图表与条形图拆为独立组件，文案与样式外移，边界清楚。
- 目录结构与文件组织是否满足当前项目治理要求：满足。新增脚本、组件、页面、静态产物均落在已有职责目录下，没有新增平行站点或平行数据体系。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：已执行独立复核，结论如下。

可维护性复核结论：通过

本次顺手减债：是

no maintainability findings

可维护性总结：这次新增的是一条真实的新用户可见能力，因此代码有最小必要增长；但通过把脚本和页面都按职责拆开，避免了把新能力变成新的超长文件或新的扁平目录债务。后续若 `Project Pulse` 再扩指标，应继续优先把“数据生成”与“页面展示”分别收敛在现有子目录内，而不是再回到根目录平铺。
