# 2026-02-19 Channel fully plugin-driven via bundled compat injection

## 背景 / 问题

- 用户目标：现有 NextClaw channel 不仅“插件风格”，而是实际走插件注册链路，对齐 OpenClaw 的插件组织方式。
- v0.6.19 后现状：`ChannelManager` 已改成内置插件注册表驱动，但内置渠道仍是 core 内直接注册，不在 compat 插件 registry 中呈现。

## 决策

- 做什么：
  - 在 `@nextclaw/openclaw-compat` loader 中注入 bundled 内置 channel 插件记录（每个 channel 一个插件记录）。
  - `ChannelManager` 改为仅消费 `extensionChannels`，支持 `nextclaw.createChannel` 运行时钩子来创建真实 channel 实例。
  - 保留 OpenClaw 兼容插件能力不变；仅扩展 NextClaw 自身内置渠道注入路径。
- 不做什么：
  - 本次不重写 OpenClaw 兼容 API 全量能力（hook/http/cli/service 等仍按现有 compat 范围）。

## 变更内容

- 关键实现点：
  - 扩展 channel 注册类型，允许插件注册 `nextclaw` 运行时钩子：
    - `packages/nextclaw-core/src/extensions/types.ts`
    - `packages/nextclaw-openclaw-compat/src/plugins/types.ts`
  - `ChannelManager` 从“内置 + 扩展”改为“纯扩展注入”，并支持 `createChannel`：
    - `packages/nextclaw-core/src/channels/manager.ts`
  - compat loader 注入 bundled 内置渠道插件（`builtin-channel-*`）：
    - `packages/nextclaw-openclaw-compat/src/plugins/loader.ts`

- 用户可见变化：
  - `nextclaw plugins list --enabled` 会显示内置渠道插件（`builtin-channel-telegram` 等）。
  - `nextclaw channels status` 在 Plugin Channels 段能看到内置渠道由插件提供。

## 验证（怎么确认符合预期）

```bash
pnpm build
pnpm lint
pnpm tsc

TMP_HOME=$(mktemp -d /tmp/nextclaw-smoke-channels-phase2.XXXXXX)
NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js channels status
NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js plugins list --enabled
rm -rf "$TMP_HOME"
```

验收点：

- `build/lint/tsc` 通过（lint 仅保留既有 warning，无新增 error）。
- `channels status` 的 Plugin Channels 包含 9 个内置渠道插件。
- `plugins list --enabled` 包含 `builtin-channel-*` 条目。

## 发布 / 部署

- 该改动影响 core + compat + cli 运行链路。
- 发布时按 `docs/workflows/npm-release-process.md` 执行 changeset/version/publish。

## 影响范围 / 风险

- Breaking change：低风险行为变化（内置渠道初始化路径变为插件注入）。
- 风险点：若 compat loader 未注入内置插件，渠道将无法启动；已通过 build + smoke 覆盖关键链路。
- 回滚方式：回滚 `ChannelManager` 与 compat loader 的内置注入改动，恢复 v0.6.19 路径。
