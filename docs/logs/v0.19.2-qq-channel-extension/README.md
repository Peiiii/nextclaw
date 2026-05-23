# v0.19.2 qq channel extension

## 迭代完成说明

- 在 `@nextclaw/extension-sdk` 增加 `startBusChannelExtension`，把旧 `MessageBus` 入站消息、outbound text 请求和 channel lifecycle 接到标准 extension channel controller。
- 新增 `@nextclaw/channel-extension-qq`，通过 `startBusChannelExtension` 复用 `QQChannel`，使 QQ 由 extension manifest 贡献。
- 删除旧 `@nextclaw/channel-plugin-qq` 包，并从 openclaw compat bundled plugin、desktop 依赖和根 lint 脚本移除旧 QQ plugin 路径。
- 从 `@nextclaw/channel-runtime` 的旧 builtin runtime factory、公共导出和源码目录彻底移除 QQ 实现；`QQChannel` 由 `@nextclaw/channel-extension-qq` 自己拥有。
- 将 QQ extension 加入 kernel 内置 extension manifest discovery 和 service builtin extension package 列表。
- 后续收尾补丁将 QQ extension 对 `@nextclaw/channel-runtime` 的依赖拆除，QQ 包内保留自己的 `services/qq-channel.service.ts` 和定向测试，旧 runtime 只继续承载尚未迁移的旧渠道。
- 继续删除 QQ 迁移后的旧 runtime 依赖残留：`@nextclaw/channel-runtime` 不再声明 `qq-official-bot`，QQ SDK 只由 `@nextclaw/channel-extension-qq` 持有；同时清理 QQ service 内部无效参数、临时变量、重复 metadata 分支、非必要公开方法表面和 QQ 自定义 bus 镜像类型。

## 测试/验证/验收方式

- `pnpm install --lockfile-only --ignore-scripts`：通过。
- `pnpm install --ignore-scripts`：通过，用于刷新新增 workspace 包的本地链接。
- `pnpm -C packages/nextclaw-extension-sdk test`：通过，15 个用例。
- `pnpm -C packages/nextclaw-extension-sdk tsc`、`lint`、`build`：通过。
- `pnpm -C packages/extensions/nextclaw-channel-extension-qq tsc`、`lint`、`build`：通过。
- `pnpm -C packages/extensions/nextclaw-channel-extension-qq test`：通过，5 个用例。
- `pnpm -C packages/extensions/nextclaw-channel-runtime tsc`、`lint`、`build`：通过；lint 仍有既有 warning。
- QQ 迁移残留清理补丁验证：`pnpm install --lockfile-only --ignore-scripts`、`pnpm -C packages/extensions/nextclaw-channel-extension-qq tsc`、`lint`、`test`、`build`、`pnpm -C packages/extensions/nextclaw-channel-runtime tsc`、`lint`、`build`、`pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、`git diff --check` 均通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`：通过，非测试代码 `+15 / -27 / net -12`，仅提示 QQ service 接近文件预算。
- `rg "params\\.[a-zA-Z0-9_]*(runtime|Runtime|gateway|Gateway|owner|Owner)\\.[a-zA-Z0-9_]+\\s*=" packages/extensions/nextclaw-channel-extension-qq/src/services/qq-channel.service.ts`：无结果。
- `pnpm -C packages/nextclaw-kernel test -- src/services/extension-runtime.service.test.ts --run`：通过，4 个用例。
- `pnpm -C packages/nextclaw-kernel tsc`、`lint`：通过。
- `pnpm -C packages/nextclaw-service test -- src/commands/channel/channels.test.ts src/commands/channel/builtin-channels.test.ts --run`：通过，5 个用例。
- `pnpm -C packages/nextclaw-service tsc`、`lint`：通过；lint 仍有既有 warning。
- `pnpm -C packages/nextclaw-openclaw-compat tsc`、`lint`：通过；lint 仍有既有 warning。
- `pnpm -C apps/desktop tsc`、`lint`：通过。
- `git diff --check`：通过。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`：通过。
- `rg "@nextclaw/channel-plugin-qq|nextclaw-channel-plugin-qq|channel-plugin-qq"` 覆盖活跃 package/lock/source 路径：无结果。
- `rg "@nextclaw/channel-runtime|QQChannel|qq\\.service" packages/extensions/nextclaw-channel-extension-qq packages/extensions/nextclaw-channel-runtime`：确认 QQ extension 不再依赖 `@nextclaw/channel-runtime`，旧 runtime 不再导出 `QQChannel`。

## 发布/部署方式

未发布、未部署。本轮只完成源码迁移和本地验证；后续发布时需要统一评估 `@nextclaw/extension-sdk`、`@nextclaw/channel-extension-qq`、`@nextclaw/channel-runtime`、`@nextclaw/kernel`、`@nextclaw/service`、`@nextclaw/openclaw-compat`、desktop 相关包的版本与依赖链。

## 用户/产品视角的验收步骤

- `qq` 仍保留为产品内置渠道，但贡献路径变为 `nextclaw-channel-extension-qq` manifest。
- 旧 `nextclaw-channel-plugin-qq` 不再参与 bundled plugin 注册。
- QQ extension 的 `dist/main.js` 可构建，manifest 指向有效启动入口。
- SDK helper 使 QQ extension 启动入口只保留 channelId、`QQChannel` 构造和错误日志策略；QQ 的渠道实现归属 QQ extension 包内部。

## 可维护性总结汇总

- 本轮遵守 single-domain-owner：QQ 不再同时拥有旧 plugin 包和新 extension 包。
- 本轮遵守 responsibility-surface-minimization：SDK helper 只抽通用 bus-channel 生命周期、入站提交和 outbound text，不包含 QQ 特定逻辑。
- maintainability guard 结果：总计 `+553 / -317 / net +236`，非测试代码 `+267 / -293 / net -26`，满足非功能改动净减要求。
- 正向减债：删除旧 QQ plugin 包、旧 bundled plugin 注册路径和旧 runtime factory；QQ 接入代码收敛到最小 extension 模板。
- 后续收尾补丁正向减债：删除 QQ 对旧 `@nextclaw/channel-runtime` owner 的依赖，迁移后 diff 总计 `+81 / -92 / net -11`，非测试代码 `+71 / -73 / net -2`，严格非功能口径通过；遗留 warning 仅为 QQ service 接近文件预算。
- 本轮 QQ 清理补丁继续正向减债：删除旧 runtime 的 `qq-official-bot` 依赖声明和 lockfile importer，清理 QQ service 的无效 `messageType` 参数、无消费返回字段、`payload` 临时变量、重复 `userId/userName` 分支，并将 `isAllowed` 收为私有方法；QQ extension 入口直接使用 SDK 标准 `BusChannelMessageBus`，不再维护 QQ 私有 bus 镜像类型。
- 已使用 post-edit maintainability guard；遗留 warning 为既有文件增长/目录预算风险，本轮没有加重红区复杂度。

## NPM 包发布记录

不涉及 NPM 包发布。新增 `@nextclaw/channel-extension-qq` 包和 SDK API 需要在下一次统一 beta/stable 发布闭环中纳入版本评估。
