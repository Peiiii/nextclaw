# v0.23.1 NextClaw Agent 文档站重设计

## 迭代完成说明

本次没有沿用旧文档的“指南 / 教程 / 手册 / 参考”骨架，而是从当前产品愿景、源码路由、真实界面文案和产品截图重新建立 Agent 产品文档：

- 深入对照 WorkBuddy 的简介、快速开始、创建任务、任务对话、结果查看、自动化和右侧栏，以及 QoderWork 的典型案例与用户故事，提炼 Agent 产品共通的“目标 -> 执行 -> 干预 -> 结果 -> 复用”链路。
- 重写 `docs/designs/2026-07-15-docs-task-driven-redesign.design.md`，明确事实源优先级、NextClaw 产品模型、能力覆盖矩阵、全新信息架构、遗留内容处置和页面内容合同。
- 从当前源码和真实界面确认任务与会话、会话工作区、文件预览、Agents、Skills、MCP、Panel Apps、Doc Browser、定时任务、消息渠道、模型运行时和安全权限等真实能力。
- 顶部导航改为开始、工作方式、任务案例、安装与参考、更新和更多；更新笔记使用独立顶栏 Tab，并在指南与任务案例侧栏保留“产品动态”分组。
- 重写中英文首页，用真实工作台、结果预览、Agent、Panel App、定时任务和消息渠道截图说明产品完整工作方式。
- 重写中英文介绍、快速开始、创建任务、执行跟进、结果检查和下一步，形成安装后可连续走通的首任务链路。
- 新增或重写会话工作区、Agent 与子任务、工具、Skills/MCP、Panel Apps、Doc Browser、定时任务、消息渠道、模型和安全权限等核心功能页。
- 任务案例从 6 个扩展到 10 个，新增写作、用户反馈分析、图片生成和代码项目；所有案例均包含材料、示例指令、执行、结果检查和复用方式。
- Desktop、npm、Docker、源码运行、模型配置、渠道教程、命令和故障排查入口全部保留，没有因重构丢失。
- 更新 `user-facing-content-boundary` skill，固化“当前产品事实高于旧页面、旧内容不得自动成为重设计基线”的规则，避免以后再次出现只换外观不重做内容骨架的问题。

用户页面只呈现产品、步骤、结果和边界；竞品调研、旧内容批判、取舍过程和重设计依据仅留在内部设计与迭代记录中。

## 测试/验证/验收方式

- `node node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --allowSyntheticDefaultImports apps/docs/.vitepress/config.ts apps/docs/.vitepress/navigation/docs-navigation.config.ts apps/docs/.vitepress/theme/index.ts`：通过。
- `node_modules/.bin/eslint apps/docs/.vitepress/config.ts apps/docs/.vitepress/navigation/docs-navigation.config.ts apps/docs/.vitepress/theme/index.ts`：通过。
- `./node_modules/.bin/vitepress build`：在 `apps/docs` 下通过。
- `node scripts/docs/docs-i18n-check.mjs`：通过，75 个中英文 Markdown 页面镜像一致。
- `node scripts/governance/checks/lint-new-code-governance.mjs`：通过。
- `node scripts/governance/backlog/check-governance-backlog-ratchet.mjs`：通过。
- `git diff --check`：通过。
- 用户内容红旗扫描：未发现 WorkBuddy、QoderWork、内部方案、分类依据或改版过程进入中英文页面。
- 本地 HTTP 冒烟：中文首页、12 个核心功能页、任务总览、4 个新增案例、英文首页和英文入门入口均返回 200。
- 浏览器桌面验收：`1440 x 1000` 下抽查首页、Panel Apps、入门链路、核心功能页与任务页；所有真实截图加载成功，页面无横向溢出。
- 浏览器移动验收：`390 x 844` 下检查首页与功能详情；标题、按钮、生命周期、截图和正文均在视口内，无横向溢出。
- 浏览器路由巡检：18 个中英文核心路由均有标题、正文和可访问页面，图片错误数为 0。
- 更新入口复验：指南页同时存在顶栏“更新”和侧栏“产品动态 -> 查看每个版本的更新”，均指向 `/zh/notes/`；更新列表实际打开，标题为“产品更新笔记”。

## 发布/部署方式

本轮按用户确认执行提交、推送和文档站双站部署：

- 全球站已通过 Cloudflare Pages 发布，部署产物地址为 `https://e60d7ddb.nextclaw-docs.pages.dev`，正式域名为 `https://docs.nextclaw.io`。
- 国内镜像使用同一构建产物，通过临时私有 OSS 对象和 ECS 云助手完成校验、解包、Nginx 配置检查与重载；临时对象在部署成功后已删除，正式域名为 `https://docs.nextclaw.net`。
- `node scripts/deploy/nextclaw-net-docs-mirror/verify-docs-mirror.mjs` 通过：DNS、`/health` 和中文快速开始页均正常。
- 全球站与国内镜像的中文首页、快速开始、任务案例、更新笔记和 Panel Apps 页面均返回 200，首页均存在 `/zh/notes/` 顶栏入口。
- 两个正式域名返回的中文首页 SHA-256 一致，确认国内镜像与全球站使用同一版内容。

本轮不涉及数据库 migration、后端 API、NPM 包或产品运行时发布。

## 用户/产品视角的验收步骤

1. 打开 `http://127.0.0.1:5176/zh/`，确认首屏直接说明 NextClaw 如何从任务走到真实结果。
2. 依次打开“安装 NextClaw”“快速开始”“创建第一个任务”“查看任务结果”，确认首次使用链路连续，不需要先理解全部配置。
3. 查看首页的工作台、结果预览、Agent、Panel App、定时任务和渠道截图，确认文字与真实界面一一对应。
4. 打开“工作方式”中的会话工作区、Skills 与 MCP、Panel Apps、Doc Browser 和消息渠道，确认不再是几行占位内容。
5. 打开任务案例，确认 10 个标题都是具体待办；任一案例都能看到材料、可复制指令、执行过程和检查方式。
6. 打开安装页，确认 Desktop、npm、Docker 和源码路径仍然完整。
7. 在手机宽度打开首页和任一功能页，确认内容、图片和导航没有遮挡或横向滚动。

## 可维护性总结汇总

- 导航与侧栏继续由 `docs-navigation.config.ts` 单一 owner 管理，VitePress `config.ts` 只负责装配。
- 中英文页面保持相同 URL 和结构，i18n 检查已覆盖 75 对 Markdown 页面。
- 真实截图继续复用 `images/screenshots` 唯一资产源，文档站没有复制第二套图片。
- 旧 URL 保留，已经失去主路径价值的页面只退出导航或改为兼容指引，没有制造平行入口。
- 主题层只增加通用布局和响应式样式，没有新增 Vue 组件、store、运行时状态或业务依赖。
- `post-edit-maintainability-guard` 返回“不适用：未发现 changed code-like files”；本轮没有修改产品源码、脚本、测试或运行链路，代码可维护性复核不适用。
- 本轮可维护性收益来自删除旧 `config.ts` 中的大段内联导航、建立单一导航 owner，以及用统一页面合同替代零散占位内容。

## NPM 包发布记录

不涉及 NPM 包发布。
