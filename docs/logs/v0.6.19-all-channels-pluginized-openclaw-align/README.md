# 2026-02-19 All built-in channels pluginized (OpenClaw-style alignment)

## 背景 / 问题

- 用户要求：NextClaw 渠道层对齐 OpenClaw 的插件化思路，避免 `ChannelManager` 内硬编码渠道分支。
- 现状：内置渠道（telegram/discord/slack/...）由 `ChannelManager` 直接 `if` 分支实例化；外部插件渠道走扩展注册，模式不统一。

## 决策

- 做什么：
  - 在 `nextclaw-core` 新增“内置渠道插件注册层”，把所有内置渠道都声明为插件对象（id / isEnabled / create）。
  - `ChannelManager` 改为统一从“内置插件注册表 + 扩展插件注册”装载渠道。
  - CLI 的 `channels status` 和插件保留 channel id 判断，改为基于内置插件 ID 清单。
- 不做什么：
  - 本次不把内置渠道拆成独立 npm 扩展包（先完成架构对齐与统一入口，后续可再外置化）。

## 变更内容

- 用户可见变化：
  - `nextclaw channels status` 现在按内置插件列表输出渠道状态，不再手写固定渠道顺序。
- 关键实现点：
  - 新增内置渠道插件注册：
    - `packages/nextclaw-core/src/channels/plugins/types.ts`
    - `packages/nextclaw-core/src/channels/plugins/builtin.ts`
    - `packages/nextclaw-core/src/channels/plugins/index.ts`
  - `ChannelManager` 移除内置渠道硬编码分支，改为遍历插件注册表：
    - `packages/nextclaw-core/src/channels/manager.ts`
  - 导出内置插件能力供 CLI 使用：
    - `packages/nextclaw-core/src/index.ts`
  - CLI 对齐内置插件 ID 作为保留 channel id：
    - `packages/nextclaw/src/cli/commands/plugins.ts`
    - `packages/nextclaw/src/cli/commands/channels.ts`

## 验证（怎么确认符合预期）

```bash
pnpm build
pnpm lint
pnpm tsc

TMP_HOME=$(mktemp -d /tmp/nextclaw-smoke-pluginized-channels.XXXXXX)
NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js channels status
rm -rf "$TMP_HOME"
```

验收点：

- `build/lint/tsc` 全部通过。
- `channels status` 能输出内置渠道状态且命令可执行。

## 发布 / 部署

- 本次为架构层重构，发布时按常规 NextClaw 发布流程执行。
- 若发布到 npm，按 `docs/workflows/npm-release-process.md` 执行 changeset/version/publish 闭环。

## 影响范围 / 风险

- Breaking change：否（外部命令与配置键保持兼容）。
- 风险：低到中；主要风险在渠道初始化顺序变为注册表驱动。
- 回滚方式：回滚 `ChannelManager` 与 `channels/plugins/*` 相关提交，恢复原内置分支初始化逻辑。
