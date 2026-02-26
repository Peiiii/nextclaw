# 2026-02-27 v0.0.1-marketplace-full-layer-split

## 迭代完成说明（改了什么）

- 将 Marketplace API Worker 的数据结构从混合 `items/recommendations` 拆分为两套独立分区：`catalog.plugins` 与 `catalog.skills`。
- 将 Worker HTTP 路由彻底拆分为 typed 路由：
- `GET /api/v1/plugins/items`
- `GET /api/v1/plugins/items/:slug`
- `GET /api/v1/plugins/recommendations`
- `GET /api/v1/skills/items`
- `GET /api/v1/skills/items/:slug`
- `GET /api/v1/skills/recommendations`
- 移除共享旧路由（`/api/v1/items*`、`/api/v1/recommendations`）。
- 将 `@nextclaw/server` 的 marketplace proxy 全部改为 typed 上游调用，并移除共享 `/api/marketplace/recommendations`。
- 将 `@nextclaw/ui` marketplace API 的 recommendations 接口改为 typed 版本（`/api/marketplace/{plugins|skills}/recommendations`）。
- 新增 server 侧测试覆盖：
- 共享 recommendations 路由不再暴露（404）
- typed recommendations 路由会代理到 typed worker endpoint
- 更新 worker catalog 校验脚本与 README，明确两类数据/接口彻底分离。

## 测试 / 验证 / 验收方式

- `PATH=/opt/homebrew/bin:$PATH pnpm -C workers/marketplace-api run validate:catalog`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server test -- --run`
- `PATH=/opt/homebrew/bin:$PATH pnpm build`
- `PATH=/opt/homebrew/bin:$PATH pnpm lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm tsc`
- 冒烟：
- server typed recommendations 路由：`/api/marketplace/plugins/recommendations` 返回 200，且上游命中 `/api/v1/plugins/recommendations`（由测试断言验证）。
- 共享 recommendations 路由：`/api/marketplace/recommendations` 返回 404（由测试断言验证）。

## 发布 / 部署方式

- NPM 发布按项目流程执行：`changeset -> release:version -> release:publish`。
- 本次仅 marketplace 数据/API 分层改造，不涉及数据库/后端 migration。
- 若部署 Worker，执行：`pnpm -C workers/marketplace-api run deploy`。

## 用户 / 产品视角的验收步骤

1. 进入 `Plugins` 模块，确认列表与已安装视图正常。
2. 进入 `Skills` 模块，确认列表与已安装视图正常。
3. 确认不存在共享入口：访问旧的 recommendations 共享路径应不可用。
4. 在插件与技能模块分别执行推荐请求，确认两边数据互不混入。
