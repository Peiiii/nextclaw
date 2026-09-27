# Bibo 标签页图标提交与发布

## 迭代完成说明

用户反馈 Bibo 网页标签页缺少 logo，并明确要求统一为官网紫色 Bibo 图标、提交并发布。官网、应用及应用帮助页原本没有 favicon 声明；线上 HTML 和源码均确认这一缺口。为三个入口增加显式 SVG 图标引用，官网与应用采用相同的紫色 Bibo 图形。

本批基于远程 master `f1b54c5233fb6145a70f80dedb4dc5fade938e2c`，只迁移本次图标和用户说明增量，保留主工作区原有思考文档，并保留远程应用已有功能。图标修复提交 `fadac2fedffde71ce632de9e161de04b1af5c3c3` 已推送远程 master，两站部署和图标线上验证完成。

## 测试/验证/验收方式

官网静态构建、应用 Vite 构建、三项 TypeScript 检查与现有 40 项测试通过；现有桌面／手机产品冒烟通过。浏览器已核验官网、应用首页、应用 `/chat` 和帮助页的 favicon 引用、SVG 响应类型、与源文件一致及 16×16 解码渲染；发布后对线上重复此判定，并比较两个域名图标内容一致。命名治理与治理 backlog ratchet 通过。

线上浏览器已验证官网、应用首页、`/chat` 和帮助页都引用并成功解码紫色 Bibo SVG，响应与冻结源码逐字节一致。官网六个既有候选路径继续返回 200，未知路径返回 404。额外的认证真实对话 smoke 在模型流探针遇到 HTTP 429，未完成模型生成、保存与刷新链路；本批未改变该链路，未重试或绕过限额。

## 发布/部署方式

精确提交本批文件并普通推送远程 master，冻结图标修复提交作为发布源码。官网通过既有 `site-build.controller.mjs` 与 Worker `bibo-bot` 发布；应用通过 Wrangler 4.138.0 发布 Worker 静态资源，使用 `--containers-rollout none` 保留未变化的现有容器。采用本机已有 OAuth 身份执行人工 CLI 发布。

- 官网：`b8b88170-ba21-441f-9ed7-3dbbf4857c3f`，新增／修改两个资源。
- 应用：`71c6dae7-0f72-493b-8dcd-3368f6d9e9fa`，新增／修改三个资源，其余 177 个资源复用。
- 原版本：官网 `b3315566-aba6-41a7-9dc1-9b31be4604eb`，应用 `ec225c8f-e0dc-4770-b4f1-edb449c130a9`。
- 已执行 `pnpm release:reconcile:mainline -- --remote origin-https`；主工作区因用户已有 WIP 保持原状，返回 `LOCAL_WORKTREE_RETRYING` 并启动自动回流 owner。
- `AUTOMATION_INTERVENTIONS: 0`。

## 用户/产品视角的验收步骤

打开 https://bibo.bot/、https://app.bibo.bot/ 及应用帮助页，检查标签页显示同款紫色 Bibo 图标。若浏览器缓存旧图标，关闭原标签页并重新打开。

## 可维护性总结汇总

只增加标准静态图标与页面引用，不新增运行逻辑。两个独立域名各自携带同款图标，避免跨域请求依赖。英文和中文用户说明同步。现有命名治理检查通过；diff-only maintainability 检查判定本批没有需检查的代码文件。复盘不新增全局规则：缺口已在产品入口修复。

## NPM 包发布记录

不涉及 NPM 包发布。Bibo 为独立托管服务；应用图标修复添加私有 `@nextclaw/bibo-hosted` patch changeset，不发布 NextClaw NPM 或桌面版本。
