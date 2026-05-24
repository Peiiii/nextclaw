# v0.19.25 渠道 Extension 第一批迁移

## 迭代完成说明

本轮完成渠道 extension 迁移计划中的任务 5：将 `dingtalk`、`wecom`、`slack`、`email`、`whatsapp` 从旧 OpenClaw channel plugin wrapper 切到标准 `nextclaw-channel-extension-*` 包。

核心改动：

- 新增 5 个 extension 包，每个包只保留 manifest、`src/main.ts` 标准启动入口、`src/index.ts` 和包级配置。
- 删除对应 5 个旧 `nextclaw-channel-plugin-*` wrapper 包。
- 将 service builtin extension、desktop 运行时依赖、根 build/lint/tsc 脚本、kernel builtin discovery 测试切到新 extension 包。
- 从 OpenClaw compat bundled channel plugin 列表中移除这 5 个旧包，旧路径当前只保留 `telegram` 和 `discord`。

## 测试/验证/验收方式

已通过：

- `pnpm install --lockfile-only --ignore-scripts`
- `pnpm install --ignore-scripts`
- `pnpm -C packages/extensions/nextclaw-channel-extension-dingtalk tsc`
- `pnpm -C packages/extensions/nextclaw-channel-extension-dingtalk lint && pnpm -C packages/extensions/nextclaw-channel-extension-dingtalk build`
- `pnpm -C packages/extensions/nextclaw-channel-extension-email tsc && pnpm -C packages/extensions/nextclaw-channel-extension-email lint && pnpm -C packages/extensions/nextclaw-channel-extension-email build`
- `pnpm -C packages/extensions/nextclaw-channel-extension-slack tsc && pnpm -C packages/extensions/nextclaw-channel-extension-slack lint && pnpm -C packages/extensions/nextclaw-channel-extension-slack build`
- `pnpm -C packages/extensions/nextclaw-channel-extension-wecom tsc && pnpm -C packages/extensions/nextclaw-channel-extension-wecom lint && pnpm -C packages/extensions/nextclaw-channel-extension-wecom build`
- `pnpm -C packages/extensions/nextclaw-channel-extension-whatsapp tsc && pnpm -C packages/extensions/nextclaw-channel-extension-whatsapp lint && pnpm -C packages/extensions/nextclaw-channel-extension-whatsapp build`
- `pnpm -C packages/nextclaw-kernel test -- src/services/extension-runtime.service.test.ts --run`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-service tsc`
- `pnpm -C packages/nextclaw-openclaw-compat tsc`
- `pnpm -C apps/desktop tsc`
- `pnpm -C packages/nextclaw-service test -- src/commands/channel/builtin-channels.test.ts src/commands/channel/channels.test.ts --run`
- `pnpm -C packages/nextclaw-openclaw-compat test -- src/plugins/loader.bundled-enable-state.test.ts src/plugins/channel-runtime.test.ts --run`
- `pnpm tsc`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/nextclaw-service lint`
- `pnpm -C packages/nextclaw-openclaw-compat lint`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- Manifest smoke：读取 5 个新增 `nextclaw.extension.json` 并确认贡献 channel id 与包 id 匹配。

额外修复：

- 为 `packages/nextclaw-openclaw-compat` 补充 Vitest `@core` alias，并让 plugin loader 在开发态加载 workspace `@nextclaw/core` 源码时同步提供 `@core` alias，避免 bundled legacy plugin 定向测试无法覆盖真实路径。

## 发布/部署方式

未执行发布或部署。本轮是仓库内结构迁移，需要后续统一进入 NPM beta/release 批次时一并评估这些新增 extension 包的发布。

## 用户/产品视角的验收步骤

1. 启动 NextClaw 服务后，确认 `dingtalk`、`wecom`、`slack`、`email`、`whatsapp` 仍出现在渠道列表中。
2. 确认这些渠道由 extension manifest 贡献，不再通过旧 `channel-plugin-*` wrapper 注册。
3. 在有真实平台凭证时，分别对 5 个渠道做入站消息和 outbound reply 冒烟。
4. 若渠道未启用或缺少凭证，确认 extension 进程能 build，manifest 能发现，且 disabled 配置不会导致启动崩溃。

## 可维护性总结汇总

本轮遵循 deletion-first 和 single-domain-owner：删除 5 个旧 wrapper 包，新增 5 个标准 extension 包，把一方渠道贡献路径收敛到 manifest extension。

维护性结果：

- 总体代码净减少，主要来自删除旧 wrapper 包及其历史 changelog。
- 非测试生产代码也为净减少；新增代码主要是每个渠道最小 extension 壳和 manifest。
- owner 边界更清晰：通用生命周期由 `@nextclaw/extension-sdk` controller 承载，渠道特定实现仍留在 `@nextclaw/channel-runtime`，后续再继续拆迁 `telegram`/`discord` 和 runtime 清理。
- 最终目标已明确：这 5 个新 extension 当前不依赖 `openclaw-compat`；`@nextclaw/channel-runtime` 是迁移期临时依赖，所有一方渠道迁完后应删除旧 runtime/旧 plugin 路径。
- `post-edit-maintainability-guard` 通过，但保留一个既有目录预算警告：`packages/nextclaw-openclaw-compat/src/plugins` 文件数仍超过预算，未因本轮新增文件而恶化。

## NPM 包发布记录

需要后续统一发布，当前未发布：

- `@nextclaw/channel-extension-dingtalk`
- `@nextclaw/channel-extension-email`
- `@nextclaw/channel-extension-slack`
- `@nextclaw/channel-extension-wecom`
- `@nextclaw/channel-extension-whatsapp`

本轮同时删除旧包：

- `@nextclaw/channel-plugin-dingtalk`
- `@nextclaw/channel-plugin-email`
- `@nextclaw/channel-plugin-slack`
- `@nextclaw/channel-plugin-wecom`
- `@nextclaw/channel-plugin-whatsapp`

发布时需要确认这些旧包是否需要 deprecated 标记，还是仅从后续发布批次中停止携带。
