# v0.12.56-platform-user-signup-restored

## 迭代完成说明（改了什么）

- 恢复普通用户注册接口：新增 `POST /platform/auth/register`。
- 自助注册只创建 `user` 角色，不再存在“首个注册用户自动成为 admin”路径。
- 保持管理后台无注册入口（`apps/platform-admin` 仅登录）。
- 用户前端登录页改为“登录/注册”双入口（`apps/platform-console`）。
- 更新平台冒烟脚本：新增“注册成功 + 重复注册冲突（409）”自动校验。

## 测试/验证/验收方式

- 执行一键平台验证：
  - `pnpm validate:platform:mvp`
- 本次验证结果：
  - `workers/nextclaw-provider-gateway-api`：`build/lint/tsc` 通过
  - `apps/platform-console`：`build/lint/tsc` 通过
  - `apps/platform-admin`：`build/lint/tsc` 通过
  - `scripts/platform-mvp-smoke.mjs` 通过（含注册、登录锁定、双额度、充值、账本不可变）

## 发布/部署方式

1. 后端：
   - `pnpm platform:db:migrate:remote`
   - `pnpm -C workers/nextclaw-provider-gateway-api run deploy`
2. 前端：
   - `pnpm -C apps/platform-console build`
   - `pnpm dlx wrangler pages deploy apps/platform-console/dist --project-name nextclaw-platform-console --branch master --commit-dirty=true`
3. 可选复验：
   - `POST /platform/auth/register`（用户站可用）
   - 管理站仅保留登录入口

## 用户/产品视角的验收步骤

1. 打开用户站 `platform.nextclaw.io`，确认有“注册”入口。
2. 使用新邮箱注册并自动进入用户控制台。
3. 用同邮箱再次注册，预期返回“邮箱已注册”（409）。
4. 打开管理站 `platform-admin.nextclaw.io`，确认只有登录入口，无注册入口。
5. 使用普通用户 token 请求管理员接口，预期 403。
