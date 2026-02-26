# 2026-02-27 v0.0.1-marketplace-workflow-install-fix

## 迭代完成说明（改了什么）

- 排查并修复 `Marketplace Catalog Sync` workflow 最近一次失败（run: `22455777695`）问题。
- 调整 CI 环境初始化顺序：`setup-node` 在前，`setup-pnpm` 在后，避免 `Install dependencies` 阶段出现 `pnpm` 不可用的潜在问题。
- 新增 `Verify pnpm` 步骤，在安装依赖前输出 `pnpm --version`，让故障可观测。
- 更新 `Smoke check` 路由：从旧共享路由 `/api/v1/items` 改为已上线的 typed 路由：
- `/api/v1/plugins/items`
- `/api/v1/skills/items`

## 测试 / 验证 / 验收方式

- `PATH=/opt/homebrew/bin:$PATH pnpm -C workers/marketplace-api run validate:catalog`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C workers/marketplace-api build`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C workers/marketplace-api lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C workers/marketplace-api tsc`
- 结果：以上全部通过。

## 发布 / 部署方式

- 本次仅修复 GitHub Actions workflow，不涉及 npm 发布、数据库迁移或服务部署。
- 合并后由 workflow 在后续 push 自动执行。

## 用户 / 产品视角的验收步骤

1. 推送本次 workflow 修复到 `master` 或 `main`。
2. 打开 `Marketplace Catalog Sync` 最新一次运行。
3. 确认 `Install dependencies` 不再失败，`Verify pnpm` 显示版本号。
4. 确认 `sync` 阶段 smoke check 调用 typed 路由并通过。
