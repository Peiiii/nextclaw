# v0.12.57-platform-dev-auto-migrate-default

## 迭代完成说明（改了什么）

- 修复平台本地开发常见报错：`D1_ERROR: no such table: platform_settings: SQLITE_ERROR`。
- 根脚本改为默认先执行本地 D1 migration，再启动服务：
  - `dev:platform:backend`
  - `dev:platform:stack`
  - `dev:platform:admin:stack`
- `scripts/dev-platform-runner.mjs` 默认启用 migration；需要跳过时可手动传 `--no-migrate`。

## 测试/验证/验收方式

- 远程库结构复核（已执行）：
  - `wrangler d1 execute NEXTCLAW_PLATFORM_DB --remote --command "SELECT name FROM sqlite_master ..."`
  - 结果包含 `platform_settings`、`users`、`usage_ledger` 等核心表。
- 本地命令验证（已执行）：
  - `pnpm platform:db:migrate:local` 通过
  - `pnpm -C apps/platform-console build && pnpm -C apps/platform-console lint && pnpm -C apps/platform-console tsc` 通过

## 发布/部署方式

- 本迭代为本地开发链路与脚本修复，无远程部署必需动作。

## 用户/产品视角的验收步骤

1. 在仓库根目录执行：`pnpm dev:platform:stack`。
2. 观察启动日志中先出现 migration，再进入 worker + 前端服务。
3. 打开用户端并请求任一平台接口，确认不再出现 `no such table: platform_settings`。
4. 管理端同理执行：`pnpm dev:platform:admin:stack` 并复验。
