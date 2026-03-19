# v0.14.87-remote-ui-productized-access

## 迭代完成说明

- 将 remote access 从 CLI 辅助能力升级为 UI 主路径：新增 Remote Access 页面、侧边栏入口、平台账号登录/注册、设备设置、doctor 诊断、服务启停/重启控制。
- 为 UI 注入统一 remote access host，并在 `@nextclaw/server` 暴露 `/api/remote/status`、`/api/remote/doctor`、`/api/remote/login`、`/api/remote/logout`、`/api/remote/settings`、`/api/remote/service/:action`。
- 将“当前页面所在 managed service 的 restart”改为复用 CLI 现有的受管服务自重启协调链路，避免 UI 单独维护一套 helper，修复“接口返回 accepted 但服务没有真正拉起”的问题。
- 文档站新增功能文档与教程，并接入导航：
  - [英文功能文档](../../../apps/docs/en/guide/remote-access.md)
  - [中文功能文档](../../../apps/docs/zh/guide/remote-access.md)
  - [英文教程](../../../apps/docs/en/guide/tutorials/remote-access-ui.md)
  - [中文教程](../../../apps/docs/zh/guide/tutorials/remote-access-ui.md)

## 测试/验证/验收方式

- 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/server tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/ui tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter nextclaw tsc`
- 单测：
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/server test -- run src/ui/router.remote.test.ts`
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter nextclaw test -- run src/cli/commands/remote-access-host.test.ts`
- 构建：
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/server build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/ui build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter nextclaw build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/docs build`
- Lint：
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/server lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/ui lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter nextclaw lint`
  - 以上仅有仓库既有 warnings，无本次新增 errors。
- 隔离环境冒烟：
  - 使用 `/tmp/nextclaw-remote-ui-smoke-verify-*` 作为 `NEXTCLAW_HOME`
  - 使用打包后的 `node packages/nextclaw/dist/cli/index.js start --ui-port 19211 --start-timeout 15000`
  - 通过 `POST /api/remote/service/restart` 验证 `pid` 从 `10893` 切换到 `10988`，随后 `GET /api/remote/status` 恢复可访问，最后 `nextclaw stop` 正常停止服务

## 发布/部署方式

- NPM 发布链路：
  - 新增 `.changeset/remote-ui-productized-access.md`
  - 执行 `PATH=/opt/homebrew/bin:$PATH pnpm release:version`
  - 执行 `PATH=/opt/homebrew/bin:$PATH pnpm release:publish`
- 文档站发布：
  - 执行 `PATH=/opt/homebrew/bin:$PATH pnpm deploy:docs`
- UI 构建产物：
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/ui build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter nextclaw build`
  - 确保 `packages/nextclaw/ui-dist` 同步最新 UI 产物后提交

## 用户/产品视角的验收步骤

1. 启动或升级到本次发布后的 `nextclaw`，打开本地 UI。
2. 在侧边栏进入 `Settings -> Remote Access`。
3. 在页面内完成平台账号登录或注册，保存 device name / platform api base / enabled 配置。
4. 在页面中直接点击 `Start` 或 `Restart`，确认页面短暂断开后恢复，并看到服务状态重新变为运行中。
5. 点击 `Run diagnostics`，确认能看到 remote-enabled、platform-token、platform-api-base、local-ui、service-runtime 等检查结果。
6. 按文档教程在另一台设备访问 NextClaw Platform，确认能看到当前设备并完成远程接入。
