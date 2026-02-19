# 2026-02-19 v0.6.23-channel-independent-plugin-packages

## 迭代完成说明

- 目标：把内置渠道从“仓内 bundled 定义”升级为“独立可安装 npm 插件包”，并继续保持默认可用（bundled 加载）。
- 本次完成：
  - 新增 9 个独立渠道插件包（每个渠道一个 package）：
    - `@nextclaw/channel-plugin-telegram`
    - `@nextclaw/channel-plugin-whatsapp`
    - `@nextclaw/channel-plugin-discord`
    - `@nextclaw/channel-plugin-feishu`
    - `@nextclaw/channel-plugin-mochat`
    - `@nextclaw/channel-plugin-dingtalk`
    - `@nextclaw/channel-plugin-email`
    - `@nextclaw/channel-plugin-slack`
    - `@nextclaw/channel-plugin-qq`
  - 每个插件包都包含独立入口与 `openclaw.plugin.json`，可单独安装/发布。
  - `@nextclaw/openclaw-compat` 的 bundled 渠道加载改为动态解析上述独立包并注册，不再依赖仓内静态定义来源。

## 测试 / 验证 / 验收方式

### 构建与静态验证

```bash
pnpm install
pnpm build
pnpm lint
pnpm tsc
```

结果：通过（lint 仅保留既有 max-lines warning，无新增 error）。

### 冒烟验证（隔离目录）

```bash
TMP_HOME=$(mktemp -d /tmp/nextclaw-final-externalized-ok.XXXXXX)
NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js channels status
NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js plugins list --enabled
NEXTCLAW_ENABLE_OPENCLAW_PLUGINS=0 NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js plugins list --enabled
rm -rf "$TMP_HOME"
```

验收点：
- `channels status` 显示 9 个 `builtin-channel-*` 的插件绑定。
- `plugins list --enabled` 显示 9 个 bundled 插件，来源为独立插件包。
- `NEXTCLAW_ENABLE_OPENCLAW_PLUGINS=0` 时，独立包渠道插件仍可加载。

## 发布 / 部署方式

本次变更影响插件生态与 compat 运行链路，不涉及后端数据库。

### 执行流程（按 `docs/workflows/npm-release-process.md`）

```bash
pnpm release:version
pnpm release:publish
```

发布结果：
- `@nextclaw/openclaw-compat@0.1.8` ✅
- `@nextclaw/channel-plugin-telegram@0.1.0` ✅
- `@nextclaw/channel-plugin-whatsapp@0.1.0` ✅
- `@nextclaw/channel-plugin-discord@0.1.0` ✅
- `@nextclaw/channel-plugin-feishu@0.1.0` ✅
- `@nextclaw/channel-plugin-mochat@0.1.0` ✅
- `@nextclaw/channel-plugin-dingtalk@0.1.0` ✅
- `@nextclaw/channel-plugin-email@0.1.0` ✅
- `@nextclaw/channel-plugin-slack@0.1.0` ✅
- `@nextclaw/channel-plugin-qq@0.1.0` ✅

### 闭环说明（按需项）

- 远程 migration：不适用（无后端/数据库变更）。
- 服务部署：不适用（本次为 npm 包发布）。
- 线上 API 冒烟：不适用（无线上后端 API 发布）。
- CLI 冒烟：已执行并记录。
