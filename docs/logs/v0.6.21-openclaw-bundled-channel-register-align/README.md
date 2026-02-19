# 2026-02-19 v0.6.21-openclaw-bundled-channel-register-align

## 迭代完成说明

- 目标：在不扩展 channel 能力面的前提下，对齐 OpenClaw 插件写法。
- 已完成对齐：
  - 内置渠道改为 bundled 独立插件定义（每个渠道一个插件模块）：
    - `packages/nextclaw-openclaw-compat/src/plugins/bundled/channels/*.ts`
  - bundled 内置渠道改为走 `register(api) -> registerChannel(...)` 注册路径，不再旁路注入。
  - 运行时继续只消费插件注册结果（`ChannelManager` 仅基于 extension channels 实例化）。
- 关键实现：
  - 新增 bundled 渠道插件工厂与聚合入口：
    - `packages/nextclaw-openclaw-compat/src/plugins/bundled/channels/factory.ts`
    - `packages/nextclaw-openclaw-compat/src/plugins/bundled/channels/index.ts`
  - Loader 新增 `appendBundledChannelPlugins`，对 bundled 渠道执行 `register(api)`。
  - 对齐类型：`OpenClawPluginDefinition` 增加 `configSchema` 字段。
  - 调整 CLI 保留 channel id 规则，避免 bundled 注册被保留名误拦截。

## 测试 / 验证 / 验收方式

### 构建与静态验证

```bash
pnpm build
pnpm lint
pnpm tsc
```

结果：通过（lint 仅保留既有 max-lines warning，无新增 error）。

### 冒烟验证（隔离目录）

```bash
TMP_HOME=$(mktemp -d /tmp/nextclaw-smoke-bundled-align.XXXXXX)
NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js channels status
NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js plugins list --enabled
NEXTCLAW_ENABLE_OPENCLAW_PLUGINS=0 NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js channels status
NEXTCLAW_ENABLE_OPENCLAW_PLUGINS=0 NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js plugins list --enabled
rm -rf "$TMP_HOME"
```

验收点：
- `channels status` 的 Plugin Channels 显示 9 个 `builtin-channel-*` 绑定。
- `plugins list --enabled` 显示 9 个 bundled 内置渠道插件。
- `NEXTCLAW_ENABLE_OPENCLAW_PLUGINS=0` 时，bundled 内置渠道插件仍可加载。

## 发布 / 部署方式

本次属于 npm 包发布，不涉及后端服务或数据库。

### 执行流程（按 `docs/workflows/npm-release-process.md`）

```bash
pnpm release:version
pnpm release:publish
```

发布结果：
- `nextclaw@0.6.16` ✅
- `@nextclaw/core@0.6.16` ✅
- `@nextclaw/openclaw-compat@0.1.6` ✅
- tags 已创建：
  - `nextclaw@0.6.16`
  - `@nextclaw/core@0.6.16`
  - `@nextclaw/openclaw-compat@0.1.6`

### 闭环说明（按需项）

- 远程 migration：不适用（无后端/数据库变更）。
- 服务部署：不适用（本次仅 npm 包发布）。
- 线上 API 冒烟：不适用（无线上后端接口发布）。
- CLI 冒烟：已执行并记录。
