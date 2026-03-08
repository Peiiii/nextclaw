# v0.12.60-platform-domain-config-convergence

## 迭代完成说明（改了什么）

- 完成平台域名配置收敛：
  - Worker 生产自定义域名写入 `workers/nextclaw-provider-gateway-api/wrangler.toml` 的 `routes`
  - 用户端/管理端生产 API Base 固定在各自 `.env.production`
  - 根目录新增平台发布闭环命令：`deploy:platform:backend`、`deploy:platform:console`、`deploy:platform:admin`、`deploy:platform`
- 更新内部域名总表，明确“配置事实源”与文件映射。

## 测试/验证/验收方式

- 配置文件校验：
  - `package.json` 可解析
  - `wrangler.toml` 可解析
- 前端构建校验：
  - `pnpm -C apps/platform-console build && pnpm -C apps/platform-console lint && pnpm -C apps/platform-console tsc`
  - `pnpm -C apps/platform-admin build && pnpm -C apps/platform-admin lint && pnpm -C apps/platform-admin tsc`
- 平台链路冒烟：
  - `pnpm validate:platform:mvp`

## 发布/部署方式

1. 一键平台发布：
   - `pnpm deploy:platform`
2. 分步发布：
   - `pnpm deploy:platform:backend`
   - `pnpm deploy:platform:console`
   - `pnpm deploy:platform:admin`

## 用户/产品视角的验收步骤

1. 打开 `platform.nextclaw.io` 与 `platform-admin.nextclaw.io`，确认页面可访问。
2. 在浏览器网络面板确认前端请求目标为 `ai-gateway-api.nextclaw.io`。
3. 执行一次登录，确认链路正常；未登录访问受保护接口返回 401。
