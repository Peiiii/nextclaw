# v0.14.108-nextclaw-init-default-provider-disabled-release

## 迭代完成说明

- 为“CLI 首配路径仍将内置 provider 写成启用状态”的修复补充二次 npm 发布闭环。
- 本轮 release 目标是纠正上一版安装后默认状态错误的问题，确保新装即默认禁用。
- 新增联动 changeset，覆盖：
  - `nextclaw`
  - `@nextclaw/server`
  - `@nextclaw/mcp`

## 测试/验证/验收方式

- 发布前验证：
  - `pnpm -C packages/nextclaw test -- --run runtime.init-config.test.ts`
  - `pnpm -C packages/nextclaw tsc`
  - `pnpm -C packages/nextclaw build`
  - `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw/src/cli/runtime.ts packages/nextclaw/src/cli/runtime.init-config.test.ts`
- 发布后验收：
  - `npm view nextclaw version`
  - `npm view @nextclaw/server version`
  - `npm view @nextclaw/mcp version`
  - 在隔离 `NEXTCLAW_HOME` 目录下启动新版本并检查 `providers.nextclaw.enabled === false`

## 发布/部署方式

- 按 changeset 流程执行 `release:version`。
- 发布阶段保持 README/group 检查，并完成 npm publish 与 tag。
- 无 migration、无服务端部署、无额外前端发布。

## 用户/产品视角的验收步骤

1. 安装或升级到本轮发布后的最新 `nextclaw`。
2. 首次启动时检查生成的 `config.json`，确认 `providers.nextclaw.enabled === false`。
3. 打开 Providers 页面或请求 `/api/config`，确认内置 provider 默认显示为禁用。
4. 手动启用后，确认 provider 行为正常。
