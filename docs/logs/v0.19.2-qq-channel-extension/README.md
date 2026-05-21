# v0.19.2 qq channel extension

## 迭代完成说明

- 在 `@nextclaw/extension-sdk` 增加 `startBusChannelExtension`，把旧 `MessageBus` 入站消息、outbound text 请求和 channel lifecycle 接到标准 extension channel controller。
- 新增 `@nextclaw/channel-extension-qq`，通过 `startBusChannelExtension` 复用 `QQChannel`，使 QQ 由 extension manifest 贡献。
- 删除旧 `@nextclaw/channel-plugin-qq` 包，并从 openclaw compat bundled plugin、desktop 依赖和根 lint 脚本移除旧 QQ plugin 路径。
- 从 `@nextclaw/channel-runtime` 的旧 builtin runtime factory 移除 `qq`，仅保留 `QQChannel` 导出供 QQ extension 复用。
- 将 QQ extension 加入 kernel 内置 extension manifest discovery 和 service builtin extension package 列表。

## 测试/验证/验收方式

- `pnpm install --lockfile-only --ignore-scripts`：通过。
- `pnpm install --ignore-scripts`：通过，用于刷新新增 workspace 包的本地链接。
- `pnpm -C packages/nextclaw-extension-sdk test`：通过，15 个用例。
- `pnpm -C packages/nextclaw-extension-sdk tsc`、`lint`、`build`：通过。
- `pnpm -C packages/extensions/nextclaw-channel-extension-qq tsc`、`lint`、`build`：通过。
- `pnpm -C packages/extensions/nextclaw-channel-runtime tsc`、`lint`、`build`：通过；lint 仍有既有 warning。
- `pnpm -C packages/nextclaw-kernel test -- src/services/extension-runtime.service.test.ts --run`：通过，4 个用例。
- `pnpm -C packages/nextclaw-kernel tsc`、`lint`：通过。
- `pnpm -C packages/nextclaw-service test -- src/commands/channel/channels.test.ts src/commands/channel/builtin-channels.test.ts --run`：通过，5 个用例。
- `pnpm -C packages/nextclaw-service tsc`、`lint`：通过；lint 仍有既有 warning。
- `pnpm -C packages/nextclaw-openclaw-compat tsc`、`lint`：通过；lint 仍有既有 warning。
- `pnpm -C apps/desktop tsc`、`lint`：通过。
- `git diff --check`：通过。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`：通过。
- `rg "@nextclaw/channel-plugin-qq|nextclaw-channel-plugin-qq|channel-plugin-qq"` 覆盖活跃 package/lock/source 路径：无结果。

## 发布/部署方式

未发布、未部署。本轮只完成源码迁移和本地验证；后续发布时需要统一评估 `@nextclaw/extension-sdk`、`@nextclaw/channel-extension-qq`、`@nextclaw/channel-runtime`、`@nextclaw/kernel`、`@nextclaw/service`、`@nextclaw/openclaw-compat`、desktop 相关包的版本与依赖链。

## 用户/产品视角的验收步骤

- `qq` 仍保留为产品内置渠道，但贡献路径变为 `nextclaw-channel-extension-qq` manifest。
- 旧 `nextclaw-channel-plugin-qq` 不再参与 bundled plugin 注册。
- QQ extension 的 `dist/main.js` 可构建，manifest 指向有效启动入口。
- SDK helper 使 QQ extension 接入代码只保留 channelId、`QQChannel` 构造和错误日志策略。

## 可维护性总结汇总

- 本轮遵守 single-domain-owner：QQ 不再同时拥有旧 plugin 包和新 extension 包。
- 本轮遵守 responsibility-surface-minimization：SDK helper 只抽通用 bus-channel 生命周期、入站提交和 outbound text，不包含 QQ 特定逻辑。
- maintainability guard 结果：总计 `+553 / -317 / net +236`，非测试代码 `+267 / -293 / net -26`，满足非功能改动净减要求。
- 正向减债：删除旧 QQ plugin 包、旧 bundled plugin 注册路径和旧 runtime factory；QQ 接入代码收敛到最小 extension 模板。
- 已使用 post-edit maintainability guard；遗留 warning 为既有文件增长/目录预算风险，本轮没有加重红区复杂度。

## NPM 包发布记录

不涉及 NPM 包发布。新增 `@nextclaw/channel-extension-qq` 包和 SDK API 需要在下一次统一 beta/stable 发布闭环中纳入版本评估。
