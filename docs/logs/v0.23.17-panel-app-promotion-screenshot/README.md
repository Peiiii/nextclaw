# v0.23.17 Panel App 宣传截图更新

## 迭代完成说明

- 将 V2EX 宣传稿和官网博客里的 Panel App 首图改为真实的“唐诗卡片”：左侧保留与 Agent 讨论和修改的过程，右侧展示可翻页、随机切换和复制的常驻小应用，直接呈现“左边改、右边用、以后还能继续打开”的使用方式。
- 数据分析配图最终使用真实的季度执行摘要：用户给出收入和渠道数据后，Agent 在当前回复里生成趋势、渠道分布和目标完成度可视化。原新能源汽车市场分析图继续保留为素材，但不再被帖子引用。
- 新截图使用默认 `natural` 主题和真实产品界面，没有使用概念图或重绘 UI；会话列表默认收起，避免无关历史和失败记录进入对外素材。
- 精选会话截图现在会在拍摄前自动收起会话侧栏，避免把无关历史、失败记录和私人会话标题带入对外素材。
- 场景纠偏：电子钢琴虽然醒目，但主体仍在会话正文里，读者更容易把它理解成“生成了一张网页”，无法一眼联想到 Panel App 的右侧边栏使用方式。唐诗卡片同时保留 Agent 会话和右侧应用，信息更准确。
- 补充保存 A 股数据图表工作流原始素材到 `images/marketing/nextclaw-stock-dashboard-workflow-source-cn.png`。该图同时包含 Agent 生成过程、正文结果和右侧预览，适合作为下一次干净重拍的场景基线；原图含无关会话标题和本机路径，因此本批不直接插入公开文章。
- 截图环境会统一拦截本机的私有 UI 注入脚本，防止个人皮肤污染公开素材；Panel App 场景通过截图存储状态收起会话侧栏，不修改或重启当前运行实例。
- 根因：自动截图使用新的浏览器上下文，既不会继承手工收起的侧栏状态，也可能加载本机配置的私有 UI 注入。修复落在统一截图生成路径，而不是事后裁图或修图。
- 官网首图追加更新为真实三栏工作台：左侧保留定时任务入口和真实会话记录，中间展示 2026 年第二季度收入执行摘要，右侧渲染真实的“会话 `@` 文件与目录引用设计”Markdown 文档；素材统一使用雾蓝主题，没有重绘 UI 或填入伪造数据。
- 精选截图模式现在可以按场景保留会话侧栏、筛选真实会话，并把指定本地文件作为当前会话的右栏预览；这些能力都收敛在既有 curated scene owner 中，不影响默认批量截图。
- 修复首图发布后仍可能显示旧图的问题。根因是页面直接引用 `public` 下的固定文件名，图片内容更新后浏览器或 CDN 仍可能命中旧缓存；现在首页从仓库唯一源图经 Vite 生成内容哈希文件名，图片变化会自动得到新 URL，不再依赖人工改名或查询参数。

## 测试/验证/验收方式

- `SCREENSHOT_UI_ORIGIN=http://127.0.0.1:5174 SCREENSHOT_USE_REAL_APP_DATA=1 SCREENSHOT_SCENES=panel-app-running-zh SCREENSHOT_UI_THEME=natural SCREENSHOT_WORKSPACE_SESSION_ID=sid_bmNwLW1xZTE0cWIxLTJjOWI1NTAx SCREENSHOT_PANEL_APP_ID=cG9ldHJ5LWNhcmQucGFuZWw SCREENSHOT_PANEL_APP_TITLE='唐诗卡片' SCREENSHOT_PANEL_APP_ICON='📜' SCREENSHOT_PANEL_APP_KIND=folder SCREENSHOT_PANEL_APP_FILE_NAME=poetry-card.panel pnpm run screenshots:refresh`：成功生成右侧边栏中的真实唐诗卡片场景。
- 三个触达脚本的 `node --check` 与 ESLint 通过；精选场景的中英文输出映射已做定向断言。
- 唐诗卡片源图和 landing 镜像均为 `3024 × 1656`，SHA-256 同为 `bf3f582530ed2207c14434ceafeea6314c3b02bf2ee37db92dcdf55899df1c33`。
- 新能源汽车分析图通过同一精选截图流程生成，源图与 landing 镜像均为 `3024 × 1656`，SHA-256 同为 `2514cf159245b879556c9d0f6039014fe89ec50a659dedd9638a4a13dfa39663`；人工检查确认完整展示市场卡片且没有无关会话历史。
- 最终采用的执行摘要图源资产与 landing 镜像均为 `3024 × 1654`，SHA-256 同为 `48b6d31500473153221caf9843b5e929eaa82d03e2faddab054c436efaea2a36`；原图比标准画布少 2 像素，但关键界面和结果完整，因此保留真实截图，不做重绘或补帧。
- `pnpm --filter @nextclaw/docs exec vitepress build`、`pnpm --filter @nextclaw/landing build` 与 `pnpm docs:i18n:check` 通过；执行摘要图已进入 VitePress 生产构建目录。本地 `5176` 开发服务在本轮验收时未响应，最终 HTTP 与页面验收转到正式发布 URL 完成。
- 工具调用与 Markdown 预览图的源图和 landing 镜像 SHA-256 同为 `c91f262629ef8da09c2b42673edb3e82af2ee254d8db16b55b63d09a934e9044`。
- 本地文档文章和 `/product-screenshots/nextclaw-panel-app-running-cn.png` 均返回 HTTP 200；浏览器实看确认图片比例正常、右侧应用完整、无会话历史、无错误或加载占位。
- `pnpm --filter @nextclaw/landing build` 通过；只提示本地 Browserslist 数据需要更新，不影响构建结果。
- `pnpm lint:new-code:governance` 与 `pnpm check:governance-backlog-ratchet` 通过。
- 定向 maintainability guard：3 个脚本，0 error、2 个既有文件预算 warning；触达脚本合计净减 8 行。
- Cloudflare Pages 本次部署地址 `https://b78f99e3.nextclaw-docs.pages.dev` 与正式域名 `https://docs.nextclaw.io` 均完成线上冒烟：文章、Panel App 图、执行摘要图和 Markdown 预览图均返回 HTTP 200。
- 正式站文章 HTML 已包含 `nextclaw-executive-summary-cn.png` 和“把几个月的收入和渠道数据交给 Agent”的新版说明；线上执行摘要图片 SHA-256 为 `48b6d31500473153221caf9843b5e929eaa82d03e2faddab054c436efaea2a36`，与仓库源资产完全一致。
- 首图追加更新通过真实 `5176` UI + `18888` 数据服务执行精选截图冒烟；`nextclaw-hero-workbench-cn.png` 的源资产与 landing 镜像均为 `3024 × 1656`，SHA-256 同为 `90d8f06615ee6d7c230390c1c451d50c9cdd7b3d4553399cd4ca2365153e80ec`。
- `pnpm -C apps/landing build`、三个截图脚本的 `node --check` 与定向 ESLint、`pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet` 均通过；定向 maintainability guard 为 0 error、0 warning。
- 浏览器在 `http://127.0.0.1:5175/zh/` 实看首屏，确认首图按“真实会话列表 + 可视化结果 + Markdown 预览”呈现，主题、比例和三栏层级一致。
- 本轮 landing 部署地址 `https://f26ba32c.nextclaw-landing.pages.dev` 与正式域名 `https://nextclaw.io/zh/` 均返回 HTTP 200；两处线上首图 SHA-256 与仓库文件一致，均为 `90d8f06615ee6d7c230390c1c451d50c9cdd7b3d4553399cd4ca2365153e80ec`。
- 缓存修复执行 `pnpm -C apps/landing tsc`、`pnpm -C apps/landing lint` 和 `pnpm -C apps/landing build` 均通过；构建产物包含内容哈希资源 `dist/assets/nextclaw-hero-workbench-cn-ZmiZvM7g.png`，首页 bundle 不再把固定 `/nextclaw-hero-workbench-cn.png` 作为首图地址。
- 缓存修复部署地址为 `https://652ea9b3.nextclaw-landing.pages.dev`；正式站浏览器确认首图链接已切换为 `https://nextclaw.io/assets/nextclaw-hero-workbench-cn-ZmiZvM7g.png`。该资源返回 HTTP 200，SHA-256 与仓库源图一致；正式 HTML 使用 `max-age=0, must-revalidate`。

## 发布/部署方式

- 内容与素材先后提交为 `8e64ba89f`、`fa67bd00f`、`e095722ed`；文档站从隔离 worktree 中的 `e095722ed` 构建，避免把主工作区的无关未提交改动带入发布产物。
- 使用本机已安装且完成登录的 Cloudflare CLI 执行 `/opt/homebrew/bin/wrangler pages deploy apps/docs/.vitepress/dist --project-name nextclaw-docs --branch master`，发布成功，部署地址为 `https://b78f99e3.nextclaw-docs.pages.dev`，正式域名 `https://docs.nextclaw.io` 已同步生效。
- 本次没有推送 Git 远端，也没有重启 NextClaw 服务；不涉及数据库 migration、后端发布、NPM 包发布或 runtime update channel。
- 发布阻力的直接原因是先使用了 `pnpm dlx wrangler`，临时 CLI 没有正确复用本机登录态，进而误判为缺少 Cloudflare 凭据。现已把“先发现本机 `wrangler`、先运行 `wrangler whoami`、凭据失效时用同一 CLI 登录”的规则写入 `nextclaw-validation-workflow`，让后续 Cloudflare Pages 发布自动走正确入口。
- 本轮官网首图追加更新已使用本机 Wrangler 发布到 Cloudflare Pages 项目 `nextclaw-landing`，部署地址为 `https://f26ba32c.nextclaw-landing.pages.dev`，正式域名已同步生效；不涉及数据库 migration、后端发布、NPM 包发布或 runtime update channel。
- 首图缓存修复继续部署到同一 Cloudflare Pages 项目，本次地址为 `https://652ea9b3.nextclaw-landing.pages.dev`；没有增加旧 URL fallback，正式站以 Vite 内容哈希资源作为唯一首图入口。

## 用户/产品视角的验收步骤

1. 打开正式文章 `https://docs.nextclaw.io/zh/blog/2026-07-16-self-hosted-codex-workbuddy-panel-apps`。
2. 确认 Panel App 章节展示的是右侧边栏中的唐诗卡片，而不是正文里的电子钢琴或旧数据仪表盘。
3. 确认截图中左侧是 Agent 修改过程，右侧能直接看到翻页、随机和复制操作，并且没有无关会话历史或失败记录。
4. 确认执行摘要图完整展示月度收入、渠道分布和目标完成度，没有无关会话、失败提示或本机路径。
5. 确认下一张工具调用与 Markdown 预览截图仍正常展示，三类图片分别表达“小应用”“可视化分析”和“文档工作流”。
6. 本地打开 `http://127.0.0.1:5175/zh/`，确认首图左侧包含定时任务入口和多类真实会话，中间看板数据完整，右侧设计文档可以直接辨认，且三栏没有裁切或重复素材。

## 可维护性总结汇总

- 产品源码与测试未改动；三个截图脚本合计新增 20 行、删除 28 行，非测试逻辑净减 8 行。
- 没有新增 helper、配置分支或第二套截图路径；精选截图继续由 `waitForCuratedSession` 统一清理侧栏，常规 Panel App 截图继续由 `LocalPanelScreenshotData` 提供持久化布局状态。
- 精选场景的中英文配置由两份重复对象收敛为同一份映射生成；同时删除了截图数据类中三个未使用的公开字段，抵消新增环境约束并减少维护表面。
- 公开截图的页面环境统一屏蔽 `/api/ui-inject.js`，避免每个场景分别处理本机私有主题；设备缩放值直接留在唯一使用处，没有新增单用途配置常量。
- 宣传稿和官网博客只替换示例文字与图片引用，源图与站点镜像继续由同一截图任务一次生成，避免人工维护两份不同素材。
- `post-edit-maintainability-review` 结论：通过；职责仍归既有截图 owner，代码总量下降，后续不需要为每张公开素材手工清理会话历史或私有主题。
- 首图追加能力只修改 `curated-scenes.utils.mjs`：新增 85 行、删除 11 行、净增 74 行，用于提供保留侧栏、真实会话筛选和真实文件预览三项可复用能力；历史超长的主截图入口与本地面板数据文件最终保持零增长。
- 追加复核无 maintainability finding。新增状态生成继续属于 curated scene 配置，不新增第二套截图入口、manager 或 service；后续同类首图只需替换 session id、目标选择器和预览文件路径。

## 红区触达与减债记录

- `scripts/docs/refresh-product-screenshots.mjs` 已超过单文件预算。本次没有继续增长：新增公开截图环境约束的同时，删除单用途 `deviceScaleFactor` 常量，文件行数保持不变。
- 本批次把中英文精选场景的重复结构收敛到 `curated-scenes.utils.mjs`，三个触达脚本合计净减 8 行。下一步若主脚本继续演进，优先把浏览器上下文与页面生命周期迁出，而不是继续向 `captureScene` 堆叠条件。

### apps/landing/src/main.ts

- 本次是否减债：否，但保持零增长。
- 说明：只把中英文首图的两个固定 public URL 替换为 Vite 内容哈希资源入口，新增 2 行、删除 2 行，没有扩大既有 `main.ts` 或 `render` 方法。
- 下一步拆分缝：后续 landing 内容调整继续优先迁出 locale 内容和 section 装配，不在缓存修复中扩大结构重构。

## NPM 包发布记录

不涉及 NPM 包发布。
