# v0.14.106-nextclaw-builtin-provider-default-disabled-release

## 迭代完成说明

- 为“内置 `nextclaw` provider 默认禁用”补充正式 NPM 发布闭环。
- 新增联动 changeset，覆盖：
  - `@nextclaw/core`
  - `@nextclaw/mcp`
  - `@nextclaw/server`
  - `nextclaw`
- 其中 `@nextclaw/mcp` 用于满足仓库既有 release group 约束，确保 `@nextclaw/mcp / @nextclaw/server / nextclaw` 同轮发布。

## 测试/验证/验收方式

- 发布前最小充分验证：
  - `pnpm -C packages/nextclaw-core test -- --run loader.nextclaw-provider.test.ts`
  - `pnpm -C packages/nextclaw-server test -- --run router.provider-enabled.test.ts`
  - `pnpm -C packages/nextclaw-core tsc`
  - `pnpm -C packages/nextclaw-server tsc`
  - `pnpm exec eslint packages/nextclaw-core/src/config/loader.ts packages/nextclaw-core/src/config/loader.nextclaw-provider.test.ts packages/nextclaw-server/src/ui/router.provider-enabled.test.ts`
  - `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-core/src/config/loader.ts packages/nextclaw-core/src/config/loader.nextclaw-provider.test.ts packages/nextclaw-server/src/ui/router.provider-enabled.test.ts`
- 版本生成：
  - `pnpm release:version`
- 发布前说明：
  - 工作区全量 `pnpm release:check` 被本地未完成的 `workers/nextclaw-provider-gateway-api` 改动阻塞，阻塞点不在本次发包链路内。
  - 因此本次以受影响包的定向测试、类型检查、接口冒烟作为发布前验证基线，再执行 `release:publish` 同等步骤中的 README/group 检查与 `changeset publish`。
- 发布后验收：
  - `npm view @nextclaw/core version`
  - `npm view @nextclaw/server version`
  - `npm view @nextclaw/mcp version`
  - `npm view nextclaw version`

## 发布/部署方式

- 按仓库标准 NPM 流程执行 `changeset -> release:version -> release:publish`。
- 若全量 `release:check` 被无关本地 WIP 阻塞，则保持 README/group 检查不变，基于已完成的受影响包验证执行 `changeset publish + changeset tag`。
- 本次仅涉及 npm 包发布：
  - 远程 migration：不适用
  - 服务部署：不适用
  - 前端单独发布：不适用

## 用户/产品视角的验收步骤

1. 安装或升级到本次发布后的最新 `nextclaw`。
2. 启动后打开 Providers 页面，确认 `NextClaw Built-in` 默认处于禁用状态。
3. 调用 `/api/config` 或在 UI 中查看 provider 详情，确认 `providers.nextclaw.enabled === false`。
4. 手动启用后，确认 provider 状态切换正常。
