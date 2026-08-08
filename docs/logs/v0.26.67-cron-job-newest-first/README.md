# v0.26.67 定时任务最新创建优先

## 迭代完成说明

- 定时任务列表默认按创建时间倒序展示，新增任务会出现在第一页最前面；创建时间相同时按任务 ID 保持确定性顺序。
- 根因：核心 `CronService.listJobs()` 为调度与 CLI 场景按下次执行时间升序返回任务，UI API 直接继承该顺序并立即分页，导致新建任务根据执行计划落入任意位置或后续页面。
- 根因确认方式：沿 `CronService.listJobs() -> CronRoutesController.listJobs -> CronConfig` 查完整链路，并用后建任务位于源数组后方的路由 fixture 固定修前错误顺序。
- 修复方式：由 UI 列表查询 owner 在状态/关键词过滤后、分页前统一按 `createdAt` 倒序排序；核心调度顺序保持不变，没有新增前端补丁排序或第二套列表链路。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/server exec vitest run src/app/router.cron.test.ts`：3 条路由测试通过；server 的标准 Vitest 配置已能解析共享 workspace 源码链，无需一次性配置。
- 控制器级 HTTP 冒烟：构造旧任务在前、但新任务创建时间更晚的源列表，请求 `/api/cron?offset=0&limit=1`，返回 `200` 且首项为 `newer`。
- `pnpm --filter @nextclaw/server tsc`：通过。
- `pnpm --filter @nextclaw/server lint`：0 error、8 个未触达文件的既有 warning。
- 触达文件定向 ESLint：通过。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm release:summary -- --json`：通过，新增 changeset 被正确识别为 `@nextclaw/server` patch，无配图。
- `pnpm check:generated-clean`：通过。

## 发布/部署方式

- 本次 server 源码、路由测试、changeset 与迭代记录随当前本地提交纳入版本历史；未推送、未发布、未部署。
- 后续随 `@nextclaw/server` 的统一 patch 发布进入产品。
- 不涉及数据库 migration、线上服务重启或远程部署。

## 用户/产品视角的验收步骤

1. 先创建两个执行时间不同的定时任务，最后再创建一个新任务。
2. 打开或刷新“定时任务”页面。
3. 确认最后创建的任务显示在列表第一项，而不是根据下次执行时间落到后面。
4. 当任务超过一页时，确认新任务仍出现在第一页。
5. 暂停、启用或立即执行已有任务，确认这些操作不会因为更新时间变化而把任务移到列表顶部。

## 可维护性总结汇总

- `post-edit-maintainability-guard --non-feature --paths <本次 2 个代码/测试文件>`：0 error、1 warning；warning 为 `packages/nextclaw-server/src/app` 已记录豁免的既有目录文件数预算，本次未新增目录文件、未恶化计数。
- 代码增减报告：新增 13 行，删除 5 行，净增 8 行。
- 非测试代码增减报告：新增 1 行，删除 1 行，净增 0 行。
- 正向减债动作：职责收敛与简化。展示排序只存在于 UI API 的既有过滤/分页主链路，未改核心调度 owner，也未新增 helper、参数、排序状态或前端二次排序。
- 质量与可维护性提升证明：列表顺序从隐式依赖上游调度顺序，变为由分页查询 owner 显式、确定地维护；任务运行或启停不会造成列表跳动。
- 为何不是单纯压缩行数：生产代码是一行等量替换，改动直接消除跨场景顺序语义泄漏，没有把复杂度搬到新抽象或其它文件。
- 可维护性复核结论：通过；no maintainability findings。后续若产品需要多种排序方式，应在同一 API 查询合同中显式建模，而不是由各个前端 consumer 自行排序。

## NPM 包发布记录

- `@nextclaw/server`：已添加 patch changeset，待统一发布。
- 当前未执行 NPM 发布。
