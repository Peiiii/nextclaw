# v0.14.105-nextclaw-builtin-provider-default-disabled

## 迭代完成说明

- 将内置 `nextclaw` 模型 provider 的 bootstrap 默认状态从“启用”改为“禁用”。
- 保留自动注入 `nc_free_*` 体验 key 的行为，但首次安装/空配置不再把该 provider 视为可直接使用。
- 收敛默认来源，移除 `migrateConfig()` 对空 `nextclaw` provider 的隐式注入，避免被 schema 默认值回填成 `enabled: true`。
- 补充回归测试，覆盖 core bootstrap 与 server 配置接口两条链路的默认禁用行为。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-core test -- --run loader.nextclaw-provider.test.ts`
- `pnpm -C packages/nextclaw-server test -- --run router.provider-enabled.test.ts`
- `pnpm -C packages/nextclaw-core tsc`
- `pnpm -C packages/nextclaw-server tsc`
- `pnpm exec eslint packages/nextclaw-core/src/config/loader.ts packages/nextclaw-core/src/config/loader.nextclaw-provider.test.ts packages/nextclaw-server/src/ui/router.provider-enabled.test.ts`
- `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-core/src/config/loader.ts packages/nextclaw-core/src/config/loader.nextclaw-provider.test.ts packages/nextclaw-server/src/ui/router.provider-enabled.test.ts`

## 发布/部署方式

- 若本地其它包通过 `@nextclaw/core` 的构建产物消费该逻辑，先执行 `pnpm -C packages/nextclaw-core build`。
- 按正常工作区流程继续执行受影响包的构建、联调或后续 release；本次无数据库、远程 migration 或额外部署动作。

## 用户/产品视角的验收步骤

1. 在全新配置目录下启动 NextClaw，打开 Providers 页面。
2. 确认 `NextClaw Built-in` 存在，但状态显示为禁用而不是已就绪。
3. 确认它不会出现在“已配置/Configured”视图里，也不会被当作默认可用 provider。
4. 手动启用该 provider 后，确认状态切换正常，配置接口返回的 `enabled` 值与 UI 一致。
