# v0.16.35 Product Screenshot Refresh

## 迭代完成说明（改了什么）
- 刷新对外产品截图资产，覆盖以下主入口：
  - GitHub / 仓库素材：`images/screenshots/*`
  - landing 对外截图镜像：`apps/landing/public/nextclaw-*.png`
  - docs `Project Pulse` 派生图库：`apps/docs/public/project-pulse/gallery/*`
- 本次截图刷新最终改为直接基于本机真实 NextClaw 实例（`http://127.0.0.1:55667`）重拍，不再以 mock 数据作为最终交付，已重新生成：
  - `providers`
  - `channels`
  - `chat`
  - `skills detail / embedded doc browser`
  - `marketplace plugins`
  - `marketplace skills`
  - `cron jobs`
- 本轮同批次续改进一步修复 [`scripts/docs/refresh-product-screenshots.mjs`](../../../scripts/docs/refresh-product-screenshots.mjs) 的真实实例截图链路：
  - 新增 `SCREENSHOT_USE_REAL_APP_DATA=1` 模式，真实模式下不再拦截 `/api/*`，直接使用当前实例的 providers、登录状态、skills、plugins 与聊天数据。
  - 为 `chat` 场景增加“输入框已出现 + loading 文案已消失 + 骨架屏已消失”的稳定等待，避免成图落在半加载态。
  - 为 `skills detail` 场景增加卡片 hydration 等待、详情打开重试、iframe 尺寸检查，避免详情页偶发未展开或拍到空壳。
  - 将 `addInitScript` 的 `localStorage` 写入改成安全尝试，避免 `data:` iframe 因 `Storage is disabled` 触发 pageerror，误判为截图失败。
- 重新生成 [`apps/docs/.vitepress/data/project-pulse.generated.mjs`](../../../apps/docs/.vitepress/data/project-pulse.generated.mjs)，让 `Project Pulse` 页面上的图库和最近统计数据与本次刷新后的截图保持一致。

## 测试/验证/验收方式
- 截图自动化：
  - `SCREENSHOT_UI_ORIGIN=http://127.0.0.1:55667 SCREENSHOT_USE_REAL_APP_DATA=1 pnpm screenshots:refresh`
  - 结果：11 个截图场景全部成功生成，包含 `providers / channels / chat / marketplace / cron / skills detail`，并直接使用真实实例数据。
- `Project Pulse` 生成：
  - `node scripts/project-pulse/generate-data.mjs`
  - 结果：成功生成 `apps/docs/.vitepress/data/project-pulse.generated.mjs`，并同步更新 `apps/docs/public/project-pulse/gallery/*`。
- 关键图片人工抽查：
  - 抽查 `images/screenshots/nextclaw-chat-page-en.png`
  - 抽查 `images/screenshots/nextclaw-skills-doc-browser-en.png`
  - 结果：未出现报错态、骨架屏、空白详情页或半加载页面。
- docs 构建与发布链路：
  - `pnpm deploy:docs`
  - 结果：VitePress 构建通过，Cloudflare Pages 发布成功。
- landing 发布链路：
  - `pnpm deploy:landing`
  - 结果：landing 构建通过，Cloudflare Pages 发布成功。
- 定向可维护性守卫：
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths scripts/docs/refresh-product-screenshots.mjs scripts/docs/product-screenshot-browser-helpers.mjs --no-fail`
  - 结果：无 error；仅保留 `refresh-product-screenshots.mjs` 的历史超预算 warning。

## 发布/部署方式
- landing：
  - `pnpm deploy:landing`
  - 发布地址：`https://d29bf83f.nextclaw-landing.pages.dev`
- docs：
  - `pnpm deploy:docs`
  - 发布地址：`https://36b18ffb.nextclaw-docs.pages.dev`
- GitHub 仓库首页截图与 README 素材会在本次提交推送后与仓库内容同步。

## 用户/产品视角的验收步骤
1. 打开 landing 首页，确认英雄区与对外展示截图已不是旧版本 UI，并且 `chat` 图不是骨架屏。
2. 打开仓库 [`README.md`](../../../README.md) 与 [`README.zh-CN.md`](../../../README.zh-CN.md)，确认 `Screenshots` 区块展示的是最新产品界面。
3. 打开 docs 的 `Project Pulse` 页面，确认 gallery 中的 `chat / providers / channels / skills` 四组图片已同步为本次新截图，而不是 2026-04-14 之前的旧派生图。
4. 抽查 `images/screenshots/nextclaw-providers-page-en.png`、`apps/landing/public/nextclaw-chat-page-en.png`、`apps/docs/public/project-pulse/gallery/skills-en.png`，确认三处入口展示的是同一批更新后的产品界面。
5. 抽查 `marketplace`、`skills detail` 与 `cron` 的截图资源，确认它们不再停留在更早版本的空白、报错或旧布局状态。

## 可维护性总结汇总
- 长期目标对齐 / 可维护性推进：这次不是新增孤立功能，而是把 GitHub、landing、docs 三个对外入口的产品截图最终收敛到同一批真实实例资产，减少“展示图和真实产品不一致”的外部认知偏差，强化 NextClaw 作为统一入口的可信呈现。
- 本次是否已尽最大努力优化可维护性：是。本轮没有继续叠加 mock 分支去修截图，而是把最终交付切回真实实例模式，并把波动最大的两个场景压成可复用 helper，减少后续重复补丁。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。最终修法优先删掉“靠 mock 兜最终交付”的隐含依赖，改成显式真实模式；同时把 `chat` 与 `skills detail` 的等待逻辑收回单独 helper，而不是继续在 scene 配置里复制粘贴等待片段。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：这轮代码量小幅净增，主要来自两个稳定等待 helper 与一处 `localStorage` 安全保护；增长是最小必要，用来换取真实截图链路稳定成功。图片资产大量更新属于内容替换，不构成逻辑复杂度膨胀。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。`waitForChatReady` 与 `openFirstSkillDetail` 只承接具体场景就绪判定，scene 配置继续只描述“拍什么”，脚本主流程没有被临时分支继续污染。
- 目录结构与文件组织是否满足当前项目治理要求：满足。本轮只触达既有 `scripts/docs/`、截图资源目录与既有迭代 README，没有新增额外目录或散落脚本；`refresh-product-screenshots.mjs` 仍是历史超预算文件，但本轮新增逻辑已经优先用 helper 收敛，没有继续横向复制分支。
- 基于一次独立于实现阶段的 `post-edit-maintainability-review` 结论：通过。
  - 可维护性复核结论：通过
  - 本次顺手减债：是
  - 代码增减报告：
    - 新增：226 行
    - 删除：128 行
    - 净增：+98 行
  - 非测试代码增减报告：
    - 新增：196 行
    - 删除：103 行
    - 净增：+93 行
  - 可维护性总结：no maintainability findings。净增主要来自新增 [`product-screenshot-browser-helpers.mjs`](../../../scripts/docs/product-screenshot-browser-helpers.mjs) 与 README 记录补充，但历史热点文件 [`refresh-product-screenshots.mjs`](../../../scripts/docs/refresh-product-screenshots.mjs) 已从 1124 行回缩到 1068 行，说明这次新增没有继续直接堆进最脆弱的超长脚本。当前保留债务是主截图脚本仍高于治理预算，下一步最自然的 seam 是继续把 scene 定义与 mock/data-source 解析拆成稳定子模块。
