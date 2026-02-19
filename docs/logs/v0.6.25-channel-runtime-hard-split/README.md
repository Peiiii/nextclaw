# 2026-02-19 v0.6.25-channel-runtime-hard-split

## 迭代完成说明

- 目标：彻底消除“插件壳 + core 里保留旧渠道实现”的半拆分状态，落地真正的渠道实现外置。
- 本次完成：
  - 新增独立运行时包 `@nextclaw/channel-runtime`，承载 9 个渠道实现：
    - telegram / whatsapp / discord / feishu / mochat / dingtalk / email / slack / qq
  - 9 个渠道插件包改为直接依赖 `@nextclaw/channel-runtime`，不再通过 `@nextclaw/core` 的 `listBuiltinChannelPlugins` 取实现。
  - `@nextclaw/core` 删除上述 9 个渠道实现文件，仅保留渠道管理抽象与 builtin channel id 列表。
  - `@nextclaw/openclaw-compat` 的 plugin-sdk 改为通过 `@nextclaw/channel-runtime` 生成 builtin channel 插件桥接。
  - 根脚本 `build/lint/tsc` 纳入 `packages/nextclaw-channel-runtime`，保证发布前统一校验。

## 测试 / 验证 / 验收方式

### 构建与静态验证

```bash
pnpm install
pnpm build
pnpm lint
pnpm tsc
```

结果：
- 全部通过；仅保留仓内既有 max-lines 系列 warning，无新增 error。

### 冒烟验证（隔离目录）

```bash
TMP_HOME=$(mktemp -d /tmp/nextclaw-runtime-split.XXXXXX)
NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js channels status
NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js plugins list --enabled
NEXTCLAW_ENABLE_OPENCLAW_PLUGINS=0 NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js plugins list --enabled
rm -rf "$TMP_HOME"
```

验收点：
- `channels status` 显示 9 个渠道均由 `builtin-channel-*` 插件接管。
- `plugins list --enabled` 显示 9 个渠道插件全部成功加载。
- 关闭外部插件发现后（`NEXTCLAW_ENABLE_OPENCLAW_PLUGINS=0`），9 个 bundled 渠道插件仍可加载。

## 发布 / 部署方式

本次变更为插件运行时结构重构，不涉及后端数据库。

建议发布顺序：

```bash
# 1) version/changelog
pnpm release:version

# 2) 发布（会先走 build/lint/tsc）
pnpm release:publish
```

建议发布组件：
- `@nextclaw/channel-runtime`（新增）
- `@nextclaw/channel-plugin-*`（9 个，更新依赖）
- `@nextclaw/openclaw-compat`（plugin-sdk 依赖调整）
- `@nextclaw/core`（移除内置渠道实现）

闭环说明：
- 远程 migration：不适用（无后端/数据库变更）。
- 服务部署：不适用（npm 包变更）。
- 线上 API 冒烟：不适用（无后端 API 发布）。
