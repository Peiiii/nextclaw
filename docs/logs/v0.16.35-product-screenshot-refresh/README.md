# v0.16.35 Product Screenshot Refresh

## 迭代完成说明（改了什么）
- 刷新对外产品截图资产，覆盖以下主入口：
  - GitHub / 仓库素材：`images/screenshots/*`
  - landing 对外截图镜像：`apps/landing/public/nextclaw-*.png`
  - docs `Project Pulse` 派生图库：`apps/docs/public/project-pulse/gallery/*`
- 本次截图刷新包含当前 UI 的最新产品状态，不再停留在 2026-03-06 的旧截图批次；已重新生成：
  - `providers`
  - `channels`
  - `chat`
  - `skills detail / embedded doc browser`
  - `marketplace plugins`
  - `marketplace skills`
  - `cron jobs`
- 修复 [`scripts/docs/refresh-product-screenshots.mjs`](../../../scripts/docs/refresh-product-screenshots.mjs) 与当前 UI 数据契约脱节的问题：
  - 为 `/api/auth/status` 与 `/api/remote/status` 补齐当前前端所需的最小 mock 响应，避免截图时 `Sidebar` 与 `AccountPanel` 因字段缺失直接崩溃。
  - 将新增状态 mock 抽到 [`scripts/docs/product-screenshot-status-mocks.mjs`](../../../scripts/docs/product-screenshot-status-mocks.mjs)，避免继续把超长截图脚本堆大。
  - 将一组固定 GET mock 收敛为静态映射，顺手把 `resolveMock` 的语句数从 65 降到 51，并把主脚本体积从 1138 行降到 1124 行。
- 重新生成 [`apps/docs/.vitepress/data/project-pulse.generated.mjs`](../../../apps/docs/.vitepress/data/project-pulse.generated.mjs)，让 `Project Pulse` 页面上的图库和最近统计数据与本次刷新后的截图保持一致。

## 测试/验证/验收方式
- 截图自动化：
  - `SCREENSHOT_UI_ORIGIN=http://127.0.0.1:5194 pnpm screenshots:refresh`
  - 结果：11 个截图场景全部成功生成，包含 `providers / channels / chat / marketplace / cron / skills detail`。
- `Project Pulse` 生成：
  - `node scripts/project-pulse/generate-data.mjs`
  - 结果：成功生成 `apps/docs/.vitepress/data/project-pulse.generated.mjs`，并同步更新 `apps/docs/public/project-pulse/gallery/*`。
- docs 构建与发布链路：
  - `pnpm deploy:docs`
  - 结果：VitePress 构建通过，Cloudflare Pages 发布成功。
- landing 发布链路：
  - `pnpm deploy:landing`
  - 结果：landing 构建通过，Cloudflare Pages 发布成功。
- 定向可维护性守卫：
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths scripts/docs/refresh-product-screenshots.mjs scripts/docs/product-screenshot-status-mocks.mjs apps/docs/.vitepress/data/project-pulse.generated.mjs --no-fail`
  - 结果：无 error；仅保留 `refresh-product-screenshots.mjs` 的历史超预算 warning。

## 发布/部署方式
- landing：
  - `pnpm deploy:landing`
  - 发布地址：`https://f5f5ba02.nextclaw-landing.pages.dev`
- docs：
  - `pnpm deploy:docs`
  - 发布地址：`https://bd7062a6.nextclaw-docs.pages.dev`
- GitHub 仓库首页截图与 README 素材会在本次提交推送后与仓库内容同步。

## 用户/产品视角的验收步骤
1. 打开 landing 首页，确认英雄区与对外展示截图已不是旧版本 UI。
2. 打开仓库 [`README.md`](../../../README.md) 与 [`README.zh-CN.md`](../../../README.zh-CN.md)，确认 `Screenshots` 区块展示的是最新产品界面。
3. 打开 docs 的 `Project Pulse` 页面，确认 gallery 中的 `chat / providers / channels / skills` 四组图片已同步为本次新截图，而不是 2026-04-14 之前的旧派生图。
4. 抽查 `images/screenshots/nextclaw-providers-page-en.png`、`apps/landing/public/nextclaw-chat-page-en.png`、`apps/docs/public/project-pulse/gallery/skills-en.png`，确认三处入口展示的是同一批更新后的产品界面。
5. 抽查 `marketplace` 与 `cron` 的截图资源，确认它们不再停留在更早版本的空白或旧布局状态。

## 可维护性总结汇总
- 长期目标对齐 / 可维护性推进：这次不是新增孤立功能，而是把 GitHub、landing、docs 三个对外入口的产品截图重新收敛为同一批最新资产，强化了 NextClaw 作为统一入口的外部呈现一致性。
- 本次是否已尽最大努力优化可维护性：是。除了刷新图片资产，还顺手修了截图脚本和当前 UI 契约脱节的问题，并把新增状态 mock 抽成单独文件，没有继续把一个历史超长脚本简单堆大。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。最终没有在主脚本里继续追加大段内联 mock，而是通过提取 [`product-screenshot-status-mocks.mjs`](../../../scripts/docs/product-screenshot-status-mocks.mjs) 和静态 GET mock 映射，把 `refresh-product-screenshots.mjs` 的总行数从 1138 压回 1124。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：主脚本总代码量净下降 14 行；新增 1 个小型 mock 文件属于最小必要增长，用于换取主脚本回缩和 `resolveMock` 分支收敛。图片资产大量更新属于内容替换，不构成逻辑复杂度膨胀。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。新增文件只承接“截图场景状态 mock”这一单一职责，主脚本继续负责截图流程编排，没有为了这次刷新再引入多余层级。
- 目录结构与文件组织是否满足当前项目治理要求：本次新增文件落在既有 `scripts/docs/` 目录下，命名与职责清晰；`refresh-product-screenshots.mjs` 仍是历史超预算文件，但本次已把它朝缩小方向推进一步，没有继续恶化。
- 基于一次独立于实现阶段的 `post-edit-maintainability-review` 结论：通过。
  - 可维护性复核结论：通过
  - 本次顺手减债：是
  - 代码增减报告：
    - 新增：158 行
    - 删除：67 行
    - 净增：+91 行
  - 非测试代码增减报告：
    - 新增：85 行
    - 删除：67 行
    - 净增：+18 行
  - 可维护性总结：no maintainability findings。总 diff 的净增主要来自新迭代 README 与新的状态 mock 小文件；非测试代码只净增 18 行，而主截图脚本本身已经比改动前少 14 行，`resolveMock` 的语句数也从 65 降到 51，说明这次增长没有继续堆进最脆弱的超长脚本里。当前剩余债务是截图主脚本仍旧超预算，下一步最自然的 seam 是继续把 marketplace / config / chat 场景 mock 拆出稳定子模块。
