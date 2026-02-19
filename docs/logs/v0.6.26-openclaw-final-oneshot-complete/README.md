# 2026-02-19 v0.6.26-openclaw-final-oneshot-complete

## 迭代完成说明

- 目标：按“一次性完成全部”要求，完成 OpenClaw 对齐的最终闭环（目录语义、实现外置、发布、发布后验收）。
- 本次完成：
  - 目录语义化：将插件与运行时包迁移至 `packages/extensions/*`。
    - `packages/extensions/nextclaw-channel-runtime`
    - `packages/extensions/nextclaw-channel-plugin-*`（9 个）
  - 真正实现外置：9 个渠道实现从 `@nextclaw/core` 移除，统一归属 `@nextclaw/channel-runtime`。
  - 插件直连运行时：9 个渠道插件不再通过 core builtin 列表取实现，改为直接依赖 `@nextclaw/channel-runtime`。
  - compat 桥接对齐：`@nextclaw/openclaw-compat` plugin-sdk 改为使用 `resolveBuiltinChannelRuntime`。
  - workspace/构建链路对齐：根 `workspaces` 与 `build/lint/tsc` 已纳入 `packages/extensions/*`。

## 测试 / 验证 / 验收方式

### 构建与静态验证

```bash
pnpm install
pnpm build
pnpm lint
pnpm tsc
```

结果：
- 全通过；仅存在仓内历史 `max-lines`/`max-lines-per-function` warning，无新增 error。

### 冒烟验证（隔离目录，避免仓库写入）

```bash
TMP_HOME=$(mktemp -d /tmp/nextclaw-full-final.XXXXXX)
NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js channels status
NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js plugins list --enabled
NEXTCLAW_ENABLE_OPENCLAW_PLUGINS=0 NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js plugins list --enabled
rm -rf "$TMP_HOME"
```

验收点：
- 9 个渠道全部由 `builtin-channel-*` 插件接管。
- 关闭外部发现后，bundled 渠道插件仍可加载。

### 发布后安装验证（全新目录）

```bash
TMP_DIR=$(mktemp -d /tmp/nextclaw-install-check.XXXXXX)
cd "$TMP_DIR"
npm init -y
npm i @nextclaw/channel-plugin-discord@0.1.1
node -e "console.log(require.resolve('@nextclaw/channel-plugin-discord')); console.log(require.resolve('@nextclaw/channel-runtime'));"

TMP_DIR2=$(mktemp -d /tmp/nextclaw-compat-install.XXXXXX)
cd "$TMP_DIR2"
npm init -y
npm i @nextclaw/openclaw-compat@0.1.9
node -e "console.log(require.resolve('@nextclaw/openclaw-compat')); console.log(require.resolve('@nextclaw/channel-plugin-telegram'));"
```

验收点：
- `channel-plugin-*` 安装时可正常解析 `@nextclaw/channel-runtime`。
- `openclaw-compat` 安装后可解析 bundled 渠道插件包。

## 发布 / 部署方式

已按项目发布流程执行：

```bash
pnpm release:version
pnpm release:publish
```

本次发布结果：
- `@nextclaw/core@0.6.17`
- `@nextclaw/openclaw-compat@0.1.9`
- `@nextclaw/channel-runtime@0.1.1`
- `@nextclaw/channel-plugin-telegram@0.1.1`
- `@nextclaw/channel-plugin-whatsapp@0.1.1`
- `@nextclaw/channel-plugin-discord@0.1.1`
- `@nextclaw/channel-plugin-feishu@0.1.1`
- `@nextclaw/channel-plugin-mochat@0.1.1`
- `@nextclaw/channel-plugin-dingtalk@0.1.1`
- `@nextclaw/channel-plugin-email@0.1.1`
- `@nextclaw/channel-plugin-slack@0.1.1`
- `@nextclaw/channel-plugin-qq@0.1.1`

闭环说明：
- 远程 migration：不适用（无后端/数据库变更）。
- 服务部署：不适用（npm 包发布）。
- 线上 API 冒烟：不适用（无后端 API 发布）。
