# v0.23.10 Landing 独特价值说明

## 迭代完成说明

- 在官网首页直接回答“NextClaw 有哪些独特价值”，不再展示产品卡片、功能对比矩阵或目标人群限定。
- 内容严格收敛为三项产品价值：可部署到自己的 Linux 设备、NAS 或云服务器，系统开放开源且可持续扩展，Vibe Coding 产物可以成为可运行和管理的小应用。
- 第三项以“让你的 Vibe Coding 小应用不再日抛”为标题，并说明应用可以在 Agent 旁预览、固定到全局边栏、重新打开并继续修改。
- 开源价值同时说明架构清晰、便于理解和学习，以及可以按需改造、扩展和接入自定义能力。
- 首页导航使用“独特价值”入口，直接定位到该区。
- 独特价值区移动到生态内容之后、FAQ 之前，作为用户了解界面、场景和生态之后的产品总结。
- `user-facing-content-boundary` 增加“显式分组守恒”检查：用户已经明确受众数量和分组时，不得擅自增删类别或把支撑能力拆成新的并列项。
- 对比内容进入独立配置 owner，页面渲染由纯渲染函数负责；同时提取页脚渲染，使既有超长 `main.ts` 和 `render` 方法没有继续增长。

## 测试/验证/验收方式

- `pnpm -C apps/landing tsc`：通过。
- `pnpm -C apps/landing lint`：通过，无错误；保留既有 `main.ts` 超长文件和超长方法 warning。
- `pnpm -C apps/landing build`：通过。
- 浏览器功能验收：在 `http://127.0.0.1:5175/zh/#compare` 检查桌面与 `390 x 844` 移动视口；问题、三项独特价值和对应入口均存在，无横向溢出和控制台错误。
- 外链核验：三项价值分别链接到安装文档、GitHub 源码和 Panel Apps 文档。
- maintainability guard：通过；本迭代相关生产代码累计 `+61 / -241`，净减少 180 行，仅保留既有 `main.ts` 文件长度 warning。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:generated-clean`：被本迭代范围外的 `packages/nextclaw/ui-dist` 生成物哈希漂移拦截；落地页自身不涉及该生成目录。
- Cloudflare Pages 部署与线上冒烟：通过；本次部署地址为 `https://8fb65c85.nextclaw-landing.pages.dev`，正式域名 `https://nextclaw.io/zh/` 返回 200 并加载本次 `main-o652Svd3.js`。
- 正式站浏览器验收：通过；`#compare` 区域完整显示三项独特价值，无遮挡或横向溢出，并正常衔接后续 FAQ。

## 发布/部署方式

- 本迭代只提交落地页、用户可见内容规则和本迭代记录，不纳入工作区其他改动。
- 官网使用仓库本地安装的 Wrangler 将 `apps/landing/dist` 发布到 Cloudflare Pages 项目 `nextclaw-landing`。
- 本次部署地址：`https://8fb65c85.nextclaw-landing.pages.dev`；正式站入口：`https://nextclaw.io/zh/#compare`。
- 不涉及后端、数据库或 migration。

## 用户/产品视角的验收步骤

1. 打开官网中文首页，点击顶栏“独特价值”。
2. 确认标题只询问 NextClaw 有哪些独特价值，没有限定适用人群或暗示其他场景较弱。
3. 确认正文严格只有自由部署、开放开源和 Vibe Coding 应用系统三项价值，并分别提供相关入口。
4. 在手机宽度打开同一入口，确认三项价值变为单列阅读，文字和链接没有溢出或遮挡。

## 可维护性总结汇总

- 使用了 `post-edit-maintainability-review` 的标准复核口径。
- 双语内容没有留在应用入口，而是进入 `landing-comparison-content.config.ts`；内容类型直接建模为产品价值，避免再次引入人群限定。
- 提取页脚渲染后，既有 `main.ts` 总行数和 `render` 方法长度都下降；没有新增状态、事件链路、路由类型或重复页面。
- 样式只使用现有雾蓝/绿色变量；价值列表采用无卡片的分隔布局，没有引入竞品品牌色或新的设计体系。

## 红区触达与减债记录

### apps/landing/src/main.ts

- 本次是否减债：是。
- 说明：对比文案移出入口文件，并把页脚渲染移到既有页面渲染工具；文件净减少 4 行，`render` 方法减少 12 行。
- 下一步拆分缝：后续独立处理首页各 section 的装配与下载页大段模板，不在本迭代扩大重构范围。

## NPM 包发布记录

不涉及 NPM 包发布。
