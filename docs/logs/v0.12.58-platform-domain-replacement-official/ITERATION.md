# v0.12.58-platform-domain-replacement-official

## 迭代完成说明（改了什么）

- 平台用户端与管理端前端请求基座支持 `VITE_PLATFORM_API_BASE`，生产默认指向：
  - `https://ai-gateway-api.nextclaw.io`
- 新增生产环境变量文件：
  - `apps/platform-console/.env.production`
  - `apps/platform-admin/.env.production`
- 更新两端 README，明确生产默认 API 域名。

## 测试/验证/验收方式

- 前端构建与静态检查：
  - `pnpm -C apps/platform-console build && pnpm -C apps/platform-console lint && pnpm -C apps/platform-console tsc`
  - `pnpm -C apps/platform-admin build && pnpm -C apps/platform-admin lint && pnpm -C apps/platform-admin tsc`
- 线上域名连通性校验：
  - `https://platform.nextclaw.io` -> 200
  - `https://platform-admin.nextclaw.io` -> 200
  - `https://ai-gateway-api.nextclaw.io/health` -> 200
  - `https://ai-gateway-api.nextclaw.io/platform/auth/me`（无 token）-> 401

## 发布/部署方式

1. 构建用户端与管理端：
   - `pnpm -C apps/platform-console build`
   - `pnpm -C apps/platform-admin build`
2. 发布 Pages：
   - `pnpm dlx wrangler pages deploy apps/platform-console/dist --project-name nextclaw-platform-console --branch master --commit-dirty=true`
   - `pnpm dlx wrangler pages deploy apps/platform-admin/dist --project-name nextclaw-platform-admin --branch master --commit-dirty=true`

## 用户/产品视角的验收步骤

1. 打开用户站 `platform.nextclaw.io`，执行注册/登录，确认请求打到 `ai-gateway-api.nextclaw.io`。
2. 打开管理站 `platform-admin.nextclaw.io`，执行登录，确认请求打到 `ai-gateway-api.nextclaw.io`。
3. 关闭登录态访问受保护接口，预期返回 401。
