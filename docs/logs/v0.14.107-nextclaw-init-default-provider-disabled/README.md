# v0.14.107-nextclaw-init-default-provider-disabled

## 迭代完成说明

- 通过已发布 `nextclaw@0.13.21` 的隔离冒烟确认：首次安装后的 `config.json` 仍会把内置 `nextclaw` provider 写成 `enabled: true`。
- 根因定位为 CLI `init()` 首配路径直接执行 `ConfigSchema.parse({}) + saveConfig()`，绕开了 `loadConfig()` 中“自动补体验 key 但默认禁用”的统一初始化逻辑。
- 将首次创建配置文件的入口收敛为 `initializeConfigIfMissing()`，强制走 `loadConfig(configPath)`，避免新装路径与常规加载路径出现行为分叉。
- 补充 CLI 级回归测试，覆盖“首次创建 config 文件时内置 provider 默认禁用”的真实初始化链路。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw test -- --run runtime.init-config.test.ts`
- `pnpm -C packages/nextclaw tsc`
- `pnpm -C packages/nextclaw build`
- `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw/src/cli/runtime.ts packages/nextclaw/src/cli/runtime.init-config.test.ts`

## 发布/部署方式

- 本次仅涉及 `nextclaw` CLI 首配路径修复，但受 release group 约束，后续 npm 发版需联动 `@nextclaw/mcp` 与 `@nextclaw/server`。
- 无数据库 migration、远程部署或服务端额外发布动作。

## 用户/产品视角的验收步骤

1. 在全新目录下执行 `npx nextclaw@<new-version> serve --ui-port <port>`。
2. 打开生成的 `config.json`，确认 `providers.nextclaw.enabled === false`，同时仍生成 `nc_free_*` 体验 key。
3. 请求 `/api/config`，确认返回的 `providers.nextclaw.enabled === false`。
4. 手动启用该 provider 后，确认 UI 和配置文件状态切换正常。
