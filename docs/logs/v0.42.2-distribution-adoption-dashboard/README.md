# 发行与采用大盘

## 迭代完成说明

- Platform Admin 新增“发行与采用”区域，分开展示 GitHub Release asset 累计下载、GitHub 今日/昨日快照差值，以及 npm `nextclaw` 最近 30 日公开下载趋势。
- Worker 新增受 admin token 保护的概览和实时刷新接口；每两小时同步 GitHub Release 与 npm 聚合数据，上海时区零点后固化前一日 GitHub 快照。
- 根因：此前只能临时查询 GitHub/npm，下载、升级与产品活跃口径混杂，且无法持续查看前一天或最新分发数据。
- 根因确认：GitHub 仅提供 Release asset 当前累计下载，npm 提供日下载，现有产品活跃 D1 只保存用户主动同意后的 Agent 请求；三者没有持久化的统一展示 owner。
- 修复直接针对根因：在现有平台 Worker/D1 内建立唯一采集、快照和管理端读取链路，不将下载数伪装为安装成功或 DAU。

## 测试/验证/验收方式

- Worker TypeScript、Platform Admin TypeScript 通过。
- Worker `test:distribution-adoption` 与既有 `test:product-activity` 通过；Worker 全量 lint 与 Admin 定向 ESLint 通过。
- Platform Admin production build 与 `lint:new-code:governance` 通过。
- 本地 D1 成功应用 `0016_distribution-adoption-metrics.sql`，并核验三张新增表的 schema。
- 远端 D1 已成功应用 `0016_distribution-adoption-metrics.sql`；生产 Worker `5e3bf3a0-dd91-455a-9dd0-55f0a306bf99` 已部署，双小时 cron `5 */2 * * *` 已注册。
- Platform Admin 已部署到 `https://99336280.nextclaw-platform-admin.pages.dev`，生产域名 `https://platform-admin.nextclaw.io` 返回 200。
- 已在生产管理员页面点击“刷新实时数据”：GitHub 资产累计 1,956 次、npm 最新完整统计日为 2026-08-19 的 166 次；两来源均显示正常，并成功列出 GitHub 资产与 npm 30 日趋势。
- 发布资产列表已改为服务端分页：生产数据共 2,609 条，默认只返回/渲染 10 条，支持 20 条、发布物/Release 搜索、类别/平台筛选、无结果空态和分页边界。
- 表头已支持服务端排序：发布物、类别、平台、累计、今日、昨日均显示未排序/升序/降序状态；生产实测累计降序正确返回 66、51、49… 的高下载资产。
- 修复排序时滚动跳动：根因是切换 query key 后整个发行面板短暂退回加载卡片、页面高度塌缩；现保留上一页数据直至新结果返回。生产实测同一位置排序前后主滚动区 `scrollTop` 均为 1302.5。

## 发布/部署方式

- 已执行：远端 D1 migration、`nextclaw-provider-gateway-api` Worker deploy、Platform Admin Pages deploy。
- 已执行：管理员 API 实时刷新与生产页面浏览器验收；未登录访问概览接口返回 401，管理端数据接口保持受保护。
- 已执行：分页接口与 Platform Admin 二次部署。Worker 当前版本 `3be71519-6253-42fa-9b8d-fb8b86e6e4d5`；Pages 预览为 `https://1fe15c28.nextclaw-platform-admin.pages.dev`。
- 本批次由用户明确授权在本地 `master` 提交并推送 `origin/master`；不发布 NPM、runtime 或 Desktop update channel。

## 用户/产品视角的验收步骤

1. 管理员打开 `https://platform-admin.nextclaw.io` 首页，确认“发行与采用”与“产品活跃”分开显示。
2. 点击“刷新实时数据”，确认按钮进入等待态并在完成后更新最近成功同步时间。
3. 查看每个 GitHub 发布物的累计、今日、昨日列和 npm 最近 30 日趋势；发布物默认每页 10 条，可切换 20 条，并可按发布物/Release、类别和平台定位；首个 GitHub 日快照前，昨日增量显示 `—`。
4. 确认页面说明“下载不等于独立用户、安装成功或产品活跃”。

## 可维护性总结汇总

- 采集、D1 持久化、API 与展示分别由 Worker service/repository/controller 和 Admin feature component 持有，未新增平行统计服务或第三方 SDK。
- 总览页只保留查询与刷新编排；发行面板抽为独立业务组件，避免继续扩大页面 owner。
- GitHub 资产写入按 50 条分块，避免历史 Release 资产增长时撞上单次 D1 batch 限制；API 只返回当前页，杜绝前端全量加载后的伪分页。
- 前端交互 quality skill 已补入高数据量表格门：默认 10 条、常用上限 20 条、搜索/筛选/空态/分页状态与真实页面验证均成为复用合同。
- `check-maintainability` 复核为 0 errors、0 warnings；热点扫描为 0 tracked hotspots。目录与文件组织治理检查通过。

## NPM 包发布记录

- 不涉及 NPM 包发布。`@nextclaw/platform-admin` 与 `@nextclaw/provider-gateway-api-worker` 均为私有部署应用，因此不创建与实际发布物无关的 changeset。
