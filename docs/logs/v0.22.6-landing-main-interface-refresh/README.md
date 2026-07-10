# v0.22.6 Landing Main Interface Refresh

## 迭代完成说明

本轮在本地优化官网首页展示重心：首屏从安装命令、Provider 设置和多截图堆叠，调整为以主界面工作台为第一视觉和叙事入口；新增主界面截图故事区；更新中英文首页文案与社交分享图方向。

后续补充修正了截图展示方式：产品截图不再使用裁切填充，改为按完整截图比例展示，并且每张展示图可点击打开原图；首页展示资源改为本轮 `SCREENSHOT_USE_REAL_APP_DATA=1 pnpm screenshots:refresh` 基于真实本地实例生成的主界面、Agent 管理、定时任务和技能市场截图，不再引用旧 micro-browser 图作为首页展示。

继续根据本地预览反馈，修正中文官网文案的翻译腔：删掉“能力进入流程”“能力在背后连接”“持续看见上下文”等不自然表达，改成更顺口的中文短句；同时补强 `user-facing-content-boundary` skill，要求用户可见中文内容做中文语感检查。

继续修正首屏和内容厚度：首屏不再把截图作为半透明背景铺在文字后面，改为正文下方完整产品预览；新增模型、消息渠道、技能/自动化接入展示区，覆盖自定义模型、微信、飞书、QQ、钉钉、企业微信等真实支持面。

继续补齐产品截图证据：新增 Agent 管理界面截图资产，并使用真实本地实例数据重刷 Agent 管理截图；首页主展示区从主工作台、技能与工具、技能市场扩展为主工作台、Agent 管理、定时任务、技能市场四类界面。

继续补充“具体用例启发区”：不再把“安装技能”“接入模型”“统一入口”这类能力入口当成用例，而是改成群聊问题处理、内部会议纪要整理、网页资料调研、定时简报、本地项目排查、客户反馈整理等用户能直接代入的任务场景；同时补强 `user-facing-content-boundary` 与 `product-blog-storytelling`，把“能力入口不能冒充用例”写入后续官网/产品内容流程。

继续校准用例启发区：补入更经典的高频任务，包括数据抓取与可视化、写作初稿、个人小工具和文件批处理，让用户更容易从页面上联想到自己的真实用途。

继续修正安装路径可发现性：新增独立安装路由 `/zh/install/` 与 `/en/install/`，集中展示桌面版、npm 命令行安装和 Docker 部署入口；首页首屏只保留“安装方式”按钮，下载页只给轻提示，不在产品介绍页铺开安装详情。

继续对照改版前的安装/下载信息，恢复 npm 一条命令安装写法与 Docker 一键安装命令；桌面下载页继续保留 macOS Apple Silicon、macOS Intel、Windows x64、Linux x64、Windows 便携 ZIP、未签名首次打开说明和完整发布资产入口。

继续修正首屏主描述：不再用“把对话、资料、技能、工具放在一起”概括产品，改为“AI 时代的个人工作台”与“调动模型、工具、聊天入口和本机能力”，让首屏直接表达 NextClaw 从目标到多步任务推进的核心价值。

继续修正首页截图展示区的视觉层级：将四张产品截图统一放进更克制的展示卡片，弱化标签色和重复边框，并对缩略图做轻微降饱和处理；点击图片仍打开原始完整截图，保证展示页更统一，同时保留真实产品细节。

继续修正展示项重复问题：将“技能与工具”替换为“定时任务”，使用真实本地实例重刷中英文定时任务截图，让四张卡分别对应任务工作台、Agent 管理、自动化执行和技能安装，避免两个技能相关界面挤在一起。

继续基于 WorkBuddy 与 Qoder Work 的调研结果优化首页组织：页面改成“先理解任务价值，再看到不同帮手协作，再进入具体场景，再看真实界面和能力支撑”的顺序。首屏改为“从一句话到可用结果”，新增协作帮手展示区，并将用例区扩展为群聊问题处理、数据抓取与图表报告、主题调研、写作初稿、客户反馈整理、定时简报、个人小工具和文件批处理等 8 个具体任务。

继续强化右侧工作区展示：将面板应用运行和文件/HTML 预览从普通等分卡片提升为前两张大图，图片生成、文档浏览器和应用列表作为补充展示；同时调整中英文文案，让截图先展示真实结果，再说明它对应的具体任务。

继续优化首页信息顺序：首屏之后先展示真实工作台截图和右侧工作区强图，再进入具体用例、协作帮手和生态接入说明，避免用户先读抽象能力描述，尽快形成对产品界面和用途的直观感知。

继续补齐官网基础 SEO：优化首页、下载页和安装页的 title、description、OG/Twitter 文案与 SoftwareApplication 结构化数据；移除过时的 keywords meta；修正 sitemap，让下载页、安装页和中英文页面的 canonical / hreflang / lastmod 保持一致。

继续把官网从单页介绍扩展为更完整的产品站：新增 `/zh/use-cases/`、`/en/use-cases/`、`/zh/integrations/`、`/en/integrations/`、`/zh/releases/`、`/en/releases/` 六个静态路由；顶部导航改为下载、使用场景、集成、安装方式、文档；更新页从顶部导航降到 footer 与产品内更新提示入口；新增页面都补齐 canonical、hreflang、OpenGraph、Twitter card、JSON-LD、sitemap 和 `llms.txt` 入口。

继续做可维护性收口：将 landing 路由、locale 解析、页面标题/区块渲染 helper 和内容类型拆入 `apps/landing/src/shared/lib/landing-content/`，并给 landing 补齐 `@/` alias；`apps/landing/src/main.ts` 从本轮中途的 1768 行降到 1370 行，相比 HEAD 净减少 93 行，避免新增路由继续扩大历史超长文件。

同时新增设计依据文档：`docs/designs/2026-07-05-landing-main-interface-refresh.design.md`。

本轮新增完整产品站扩展方案文档：`docs/designs/2026-07-09-landing-product-site-expansion.design.md`。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/landing tsc`：通过。
- `pnpm --filter @nextclaw/landing build`：通过；仅有 browserslist 数据偏旧提示。
- 新增页面静态 SEO 快检：通过，`sitemap.xml` 包含 `/en/use-cases/`、`/zh/use-cases/`、`/en/integrations/`、`/zh/integrations/`、`/en/releases/`、`/zh/releases/`，新增页面均有 canonical、hreflang 和 JSON-LD。
- Playwright 新增路由冒烟：通过，`/zh/`、`/zh/use-cases/`、`/zh/integrations/`、`/zh/releases/`、`/en/use-cases/`、`/en/integrations/`、`/en/releases/` 均能打开；顶部导航包含下载、使用场景、集成、安装方式和文档，更新页通过 footer 保留低权重入口，控制台无 error。
- Playwright 视觉复验：通过，`/zh/integrations/` 桌面端集成截图改为三列对齐，移动端保持单列；抽查文件为 `/tmp/nextclaw-landing-zh-home.png`、`/tmp/nextclaw-landing-zh-use-cases.png`、`/tmp/nextclaw-landing-zh-integrations-v2.png`、`/tmp/nextclaw-landing-zh-releases.png`、`/tmp/nextclaw-landing-zh-integrations-mobile.png`。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths apps/landing/src/main.ts apps/landing/src/style.css apps/landing/vite.config.ts apps/landing/tsconfig.json apps/landing/src/shared/lib/landing-content/index.ts apps/landing/src/shared/lib/landing-content/landing-content.types.ts apps/landing/src/shared/lib/landing-content/landing-route-pages.utils.ts apps/landing/src/shared/lib/landing-content/landing-route.utils.ts`：通过，保留 2 个 warning；`apps/landing/src/main.ts` 相比 HEAD 净减少 93 行，`render` 方法从 403 行降到 323 行。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm check:generated-clean`：通过。
- `pnpm --filter @nextclaw/landing lint`：通过，保留 2 个 warning：`main.ts` 文件仍超长、`render` 方法仍超长。
- `node --check scripts/docs/refresh-product-screenshots.mjs`：通过。
- `node --check scripts/docs/product-screenshot-config-mocks.mjs`：通过。
- `pnpm check:generated-clean`：通过。
- `pnpm lint:new-code:governance`：通过；保留 `packages/nextclaw-kernel/src/contributions/context-provider/providers` 扁平目录既有豁免 warning。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths apps/landing/src/main.ts scripts/docs/refresh-product-screenshots.mjs scripts/docs/product-screenshot-config-mocks.mjs docs/workflows/product-screenshot-automation.md docs/logs/v0.22.6-landing-main-interface-refresh/README.md`：通过，保留 3 个 warning，均为既有超长文件/函数仍超预算；`apps/landing/src/main.ts` 相比 HEAD 净减少 2 行。
- `SCREENSHOT_USE_REAL_APP_DATA=1 SCREENSHOT_UI_ORIGIN=http://127.0.0.1:5194 pnpm screenshots:refresh`：通过，生成 11 个当前 UI 截图场景；主界面截图使用真实本地会话列表和会话内容，技能市场/技能详情截图使用真实本地技能数据。
- `SCREENSHOT_USE_REAL_APP_DATA=1 SCREENSHOT_UI_ORIGIN=http://127.0.0.1:18888 SCREENSHOT_SCENES=agents-en,agents-zh pnpm screenshots:refresh`：通过，基于真实本地实例的 12 个 Agent 重刷 Agent 管理中英文截图；截图主体不再使用样例 Agent mock 数据。
- `SCREENSHOT_USE_REAL_APP_DATA=1 SCREENSHOT_UI_ORIGIN=http://127.0.0.1:18888 SCREENSHOT_SCENES=cron-jobs,cron-jobs-zh pnpm screenshots:refresh`：通过，基于真实本地实例重刷中英文定时任务截图，并同步到 landing public 资源目录。
- Playwright 桌面与移动端冒烟：`/zh/` 首页展示图均为 `object-fit: contain`，自然尺寸 `3024x1656`，桌面和移动端都完整展示；首屏不再使用半透明背景截图；用例区卡片均为具体任务场景；移动端无水平溢出。抽查文件为 `/tmp/nextclaw-landing-zh-usecases-v4.png` 与 `/tmp/nextclaw-landing-zh-usecases-mobile-v4.png`。
- Playwright Agent 展示区复验：`/zh/` 首页展示区共 4 张卡，Agent 截图自然尺寸 `3024x1656`，桌面与移动端横向溢出均为 0。抽查文件为 `/tmp/nextclaw-landing-zh-agents-showcase-desktop-v2.png` 与 `/tmp/nextclaw-landing-zh-agents-showcase-mobile-v2.png`。
- Playwright 截图展示区视觉复验：`/zh/` 首页四张展示卡均使用统一 `.showcase-card` 样式，缩略图 filter 为 `saturate(0.72) contrast(0.96) brightness(1.025)`，桌面与移动端横向溢出均为 0。抽查文件为 `/tmp/nextclaw-landing-showcase-style-desktop.png` 与 `/tmp/nextclaw-landing-showcase-style-mobile.png`。
- Playwright 定时任务替换复验：`/zh/` 首页已显示“把固定任务自动跑起来”，旧的“边做边找需要的技能”不再出现；定时任务与技能市场截图自然尺寸均为 `3024x1656`，桌面与移动端横向溢出均为 0。抽查文件为 `/tmp/nextclaw-landing-showcase-cron-desktop.png` 与 `/tmp/nextclaw-landing-showcase-cron-mobile.png`。
- Playwright 安装路由冒烟：`/zh/` 首页不再渲染安装详情区，只保留 `/zh/install/` 入口；`/zh/install/` 展示桌面版、npm、Docker 三种安装方式，npm 复制按钮可写入剪贴板；`/zh/download/` 只展示去安装方式页的轻提示。抽查文件为 `/tmp/nextclaw-landing-zh-home-install-link-v2.png`、`/tmp/nextclaw-landing-zh-install-route-v3.png`、`/tmp/nextclaw-landing-zh-install-route-mobile-v3.png` 与 `/tmp/nextclaw-landing-zh-download-install-teaser-v2.png`。
- `pnpm --filter @nextclaw/landing tsc`：通过。
- `pnpm --filter @nextclaw/landing lint`：通过，保留 2 个既有 warning：`main.ts` 文件仍超长、`render` 方法仍超长。
- `pnpm --filter @nextclaw/landing build`：通过；仅有 browserslist 数据偏旧提示。
- 用户可见文案红区扫描：通过，未发现“内部、方案、原则、取舍、WorkBuddy、QoderWork、专家团、能力入口冒充用例”等过程性或竞品引用词进入首页 diff。
- Playwright 桌面与移动端冒烟：`/zh/` 首页存在首屏、6 张协作帮手卡、8 张具体用例卡；图标均可渲染；桌面与移动端横向溢出均为 0。抽查文件为 `/tmp/nextclaw-landing-workbuddy-final-desktop.png` 与 `/tmp/nextclaw-landing-workbuddy-final-mobile.png`。
- Playwright 展示图懒加载复验：滚动到展示区后 4 张真实产品截图均完成加载，自然尺寸均为 `3024x1656`。抽查文件为 `/tmp/nextclaw-landing-workbuddy-showcase-mobile.png`。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths apps/landing/src/main.ts apps/landing/src/style.css`：通过，保留 2 个 warning；本轮进一步压缩声明式文案数据行，`apps/landing/src/main.ts` 相比前一轮净减少 83 行。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm check:generated-clean`：通过。
- `pnpm --filter @nextclaw/landing tsc`：通过。
- `pnpm --filter @nextclaw/landing lint`：通过，保留 2 个既有 warning：`main.ts` 文件仍超长、`render` 方法仍超长。
- `pnpm --filter @nextclaw/landing build`：通过；仅有 browserslist 数据偏旧提示。
- Playwright 右侧工作区展示复验：`/zh/` 首页中面板应用运行和文件/HTML 预览已作为前两张大图展示，图片生成、文档浏览器和应用列表作为三张补充卡；桌面与移动端截图均能直接看到对应界面内容。抽查文件为 `/tmp/nextclaw-app-surface-desktop-section-final.png` 与 `/tmp/nextclaw-app-surface-mobile-final.png`。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths apps/landing/src/main.ts apps/landing/src/style.css`：通过，保留 2 个 warning；`apps/landing/src/main.ts` 相比 HEAD 净增 0 行，`render` 方法从 403 行降到 349 行。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- Playwright 首页顺序复验：`/zh/` 首页 section 顺序为工作台截图、右侧工作区截图、具体用例、协作帮手、生态接入、常见问题；导航“功能”锚点落在第一组真实界面截图。抽查文件为 `/tmp/nextclaw-landing-order-desktop-top.png`、`/tmp/nextclaw-landing-order-desktop-features.png` 与 `/tmp/nextclaw-landing-order-mobile-features.png`。
- `pnpm --filter @nextclaw/landing tsc`：通过。
- `pnpm --filter @nextclaw/landing lint`：通过，保留 2 个既有 warning：`main.ts` 文件仍超长、`render` 方法仍超长。
- `pnpm --filter @nextclaw/landing build`：通过；仅有 browserslist 数据偏旧提示。
- Playwright 安装/下载信息完整性复验：`/zh/install/` 和 `/en/install/` 均显示 `npm install -g nextclaw && nextclaw start` 与 `curl -fsSL https://nextclaw.io/install-docker.sh | bash`；`/zh/install/` 有 3 张安装方式卡与 2 个复制按钮，命令块无横向溢出；`/zh/download/` 仍显示 macOS Apple Silicon、macOS Intel、Windows x64、Linux x64、便携 ZIP、未签名提示、首次打开说明、完整发布资产和安装方式入口。抽查文件为 `/tmp/nextclaw-landing-install-command-audit-v2.png` 与 `/tmp/nextclaw-landing-download-command-audit-v2.png`。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths apps/landing/src/main.ts`：通过，保留 2 个既有 warning；`apps/landing/src/main.ts` 相比 HEAD 净增 0 行，`render` 方法从 403 行降到 349 行。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm check:generated-clean`：通过。
- 静态 SEO 头部检查：通过，根页、英文首页、中文首页、英文下载页、中文下载页、英文安装页、中文安装页均有 title、description、canonical、hreflang；页面内 JSON-LD 可解析；未发现 `meta name="keywords"`。
- sitemap 与 canonical 一致性检查：通过，`sitemap.xml` 包含 7 个 canonical URL，并覆盖 `/en/download/` 与 `/zh/download/`。
- 构建产物 SEO 检查：通过，`dist` 中 7 个页面的 title、description、canonical、JSON-LD 和 sitemap URL 数量与源码一致。
- `pnpm --filter @nextclaw/landing tsc`：通过。
- `pnpm --filter @nextclaw/landing lint`：通过，保留 2 个既有 warning：`main.ts` 文件仍超长、`render` 方法仍超长。
- `pnpm --filter @nextclaw/landing build`：通过；仅有 browserslist 数据偏旧提示。
- Cloudflare Pages 线上冒烟：通过，正式域名 `https://nextclaw.io/zh/` 能打开新版首页，`/zh/use-cases/`、`/zh/integrations/`、`/zh/install/` 均能打开并显示新版标题；顶部导航不再显示“更新”，footer 保留版本更新入口；`sitemap.xml` 与 `llms.txt` 已包含 use-cases、integrations、releases 新路由。

## 发布/部署方式

已通过 Cloudflare Pages 部署到正式站点。

- 部署命令：`pnpm --filter @nextclaw/landing build && pnpm dlx wrangler pages deploy apps/landing/dist --project-name nextclaw-landing --branch master --commit-dirty=true`
- 正式站点：`https://nextclaw.io/zh/`
- 后端 migration：不涉及，官网静态站点改版无后端/数据库变更。
- NPM 发布：不涉及，未修改需要发布的 NPM 包。

## 用户/产品视角的验收步骤

1. 打开本地 landing dev server 的 `/zh/` 与 `/en/`。
2. 确认首屏第一视觉是主界面工作台，而不是 Provider 设置页或安装终端。
3. 确认首屏有“安装方式”入口，但首页正文不直接铺开 npm / Docker 安装详情。
4. 打开 `/zh/install/`，确认能看到桌面版、npm 和 Docker 三种安装方式。
5. 下滑后确认优先看到主界面截图故事区，再看到功能说明。
6. 确认四张展示图分别为主工作台、Agent 管理、定时任务和技能市场，并且没有裁切成局部角落；主工作台、Agent 管理、定时任务与技能市场应展示真实本地数据，不是空态。
7. 确认首页有模型、消息渠道和技能/自动化接入展示，能看到自定义模型、微信、飞书、QQ、钉钉等支持面。
8. 确认首页有具体用例启发区，并且卡片写的是用户任务场景，不是功能入口或能力清单。
9. 确认中文首页文案读起来像中文直接写成，不是英文句式翻译。
10. 确认首页社交预览图元信息已指向主界面截图，并且描述覆盖模型、渠道、技能和本机操作。
11. 确认首屏表达的是“从一句话到可用结果”，不是把产品简单概括成“资料、工具放在一起”。
12. 确认协作帮手区有 6 类角色，能让用户理解一个任务可以调动不同类型的帮手一起完成。
13. 确认用例区有 8 个具体任务，并且没有把“接入模型”“安装技能”“统一入口”这类能力入口当作场景。
14. 确认首页可见文案没有出现 WorkBuddy、Qoder Work、内部方案、设计原则或执行过程描述。
15. 确认右侧工作区展示段落中，前两张大图分别展示面板应用运行和文件/HTML 预览，不再把所有截图压成同等权重的小卡片。
16. 确认首屏之后优先看到真实产品界面截图和右侧工作区截图，然后再看到用例、协作帮手和生态接入说明。
17. 查看页面源代码或构建产物，确认首页、下载页和安装页都有独立 title、description、canonical 与 hreflang；sitemap 包含中英文首页、下载页和安装页。
18. 打开 `/zh/use-cases/` 与 `/en/use-cases/`，确认页面展示的是具体任务场景，包括数据分析、调研、写作、小工具、文件处理、群聊请求和定时简报。
19. 打开 `/zh/integrations/` 与 `/en/integrations/`，确认能看到模型提供商、消息渠道和技能市场截图，以及自定义模型、微信、飞书、QQ、钉钉、MCP、CLI、定时任务等能力入口。
20. 打开 `/zh/releases/` 与 `/en/releases/`，确认版本更新说明按新增、增强、修复分组，并提供 GitHub Releases 和最新版桌面端下载入口。
21. 确认顶部导航和移动端菜单均包含下载、使用场景、集成、安装方式和文档，不再包含“更新”；footer 保留版本更新入口。
22. 确认 `https://nextclaw.io/llms.txt` 与 `https://nextclaw.io/llm.txt` 都包含新增产品页入口。

## 可维护性总结汇总

本次遵循“主界面优先、旧配置叙事降权”的产品原则，同时删除了旧首页安装终端动画、Provider/渠道/部署 logo 云、生态对比表和相关死字段，并修复截图生成脚本中过期的 mock 数据合同；官网展示截图最终改用真实本地实例数据生成，避免空态 mock 图削弱展示效果。

代码增减：landing 源码与首页/下载页元信息整体减少；`apps/landing/src/main.ts` 相比 HEAD 净减少约 240 行。剩余债务是 `main.ts` 与 `render` 仍然超预算，后续可按页面区块继续拆分为更小的 render owner。

后续本地优化继续减少 `apps/landing/src/main.ts` 的声明式文案行数，相比前一轮净减少 83 行；但 `main.ts` 和 `render` 方法仍超预算，后续适合把首页内容数据、区块 render 和路由页 render 拆到更明确的 owner。

本轮右侧工作区展示优化没有继续放大 `apps/landing/src/main.ts`：新增 `renderShowcaseCards` 复用普通 showcase 与 app surface 的重复卡片模板，使 `main.ts` 相比 HEAD 净增 0 行，并把 `render` 方法行数从 403 行降到 349 行。剩余债务仍是 landing 单文件过大，后续更合适的拆分点是把首页区块 render 与文案数据分离。

本轮信息顺序调整只移动现有首页区块和 `features` 锚点，没有新增渲染路径或新组件；`apps/landing/src/main.ts` 仍保持相对 HEAD 净增 0 行。

本轮安装信息完整性修正只恢复既有安装命令与展示可读性，没有新增页面 owner 或分叉渲染路径；`apps/landing/src/main.ts` 仍保持相对 HEAD 净增 0 行。

本轮 SEO 优化只调整静态 HTML 头部元信息与 sitemap，没有新增运行时代码、页面分支或依赖；通过删除过时 keywords meta 和移除 sitemap 中低价值的 changefreq/priority 字段，控制了元信息膨胀。

本轮产品站扩展新增 6 个静态路由和 landing shared lib，但同步拆出了路由工具、内容类型和页面渲染工具；`apps/landing/src/main.ts` 相比 HEAD 净减少 93 行，`render` 方法从 403 行降到 323 行。剩余债务是 `main.ts` 与 `render` 仍超过历史预算，后续更合理的拆分点是把中英文 copy 数据拆出主文件，并把首页大段 render 拆为页面区块 owner。

## NPM 包发布记录

不涉及 NPM 包发布。
