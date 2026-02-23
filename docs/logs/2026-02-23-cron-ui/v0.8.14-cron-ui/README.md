# 2026-02-23 Cron UI 查看与删除

## 迭代完成说明（改了什么）
- 新增 UI 端 Cron 定时任务页面：支持查看任务详情、筛选、刷新、启用/禁用、立即执行与删除。
- UI API 增加：
  - `GET /api/cron` / `DELETE /api/cron/:id`
  - `PUT /api/cron/:id/enable`（启用/禁用）
  - `POST /api/cron/:id/run`（立即执行，可强制）
- UI 路由与侧边栏新增“定时任务”入口，完善国际化文案。

## 测试 / 验证 / 验收方式
- 未执行（本次变更涉及 UI + API，建议执行）：
  - `pnpm -C packages/nextclaw-server build && pnpm -C packages/nextclaw-server lint && pnpm -C packages/nextclaw-server tsc`
  - `pnpm -C packages/nextclaw-ui build && pnpm -C packages/nextclaw-ui lint && pnpm -C packages/nextclaw-ui tsc`
- 冒烟建议：
  - 启动网关 + UI，进入“定时任务”页。
  - 确认列表展示现有 Cron 任务；可启用/禁用；立即执行可触发状态更新；点击删除后任务从列表消失且再次刷新不再出现。

## 发布 / 部署方式
- 若涉及 npm 发布或线上部署，按项目流程执行（参考 `docs/workflows/npm-release-process.md`）。
- 若仅本地使用 UI，无需发布。

## 用户 / 产品视角的验收步骤
- 进入 UI → “定时任务”。
- 能看到已有任务列表，信息包含名称、计划、下一次/上一次执行与状态。
- 启用/禁用按钮生效，状态徽标同步变化。
- 立即执行后，执行状态与时间更新。
- 点击删除并确认后，任务被移除且刷新后不再出现。
