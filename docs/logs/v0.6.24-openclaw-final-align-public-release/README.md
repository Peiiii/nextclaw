# 2026-02-19 v0.6.24-openclaw-final-align-public-release

## 迭代完成说明

- 目标：完成“对齐 OpenClaw 的最终形态”收尾，确保 NextClaw 所有内置渠道均以独立插件包形式存在，并可被公网安装。
- 本次完成：
  - 将已发布但默认不可见的 9 个 scoped 渠道插件包统一切换为 `public` 可见性：
    - `@nextclaw/channel-plugin-telegram@0.1.0`
    - `@nextclaw/channel-plugin-whatsapp@0.1.0`
    - `@nextclaw/channel-plugin-discord@0.1.0`
    - `@nextclaw/channel-plugin-feishu@0.1.0`
    - `@nextclaw/channel-plugin-mochat@0.1.0`
    - `@nextclaw/channel-plugin-dingtalk@0.1.0`
    - `@nextclaw/channel-plugin-email@0.1.0`
    - `@nextclaw/channel-plugin-slack@0.1.0`
    - `@nextclaw/channel-plugin-qq@0.1.0`
  - 清理 compat 中已无引用的历史遗留实现：`packages/nextclaw-openclaw-compat/src/plugins/bundled/` 整目录删除，避免双轨代码继续造成误导。

## 测试 / 验证 / 验收方式

### 构建与静态验证

```bash
pnpm build
pnpm lint
pnpm tsc
```

结果：
- 均通过；仅存在仓内既有 `max-lines` / `max-lines-per-function` warning，无新增 error。

### 冒烟验证（隔离目录，避免污染仓库）

```bash
TMP_HOME=$(mktemp -d /tmp/nextclaw-final-align.XXXXXX)
NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js channels status
NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js plugins list --enabled
NEXTCLAW_ENABLE_OPENCLAW_PLUGINS=0 NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js plugins list --enabled
rm -rf "$TMP_HOME"
```

验收点：
- `channels status` 显示 9 个渠道均由 `builtin-channel-*` 插件接管。
- `plugins list --enabled` 显示 9 个内置渠道插件全部加载。
- 关闭外部插件发现（`NEXTCLAW_ENABLE_OPENCLAW_PLUGINS=0`）后，9 个 bundled 渠道插件仍可正常加载。

### npm 公网可见性验证

```bash
for p in telegram whatsapp discord feishu mochat dingtalk email slack qq; do
  npm access set status=public "@nextclaw/channel-plugin-$p"
done

for p in openclaw-compat channel-plugin-telegram channel-plugin-whatsapp channel-plugin-discord channel-plugin-feishu channel-plugin-mochat channel-plugin-dingtalk channel-plugin-email channel-plugin-slack channel-plugin-qq; do
  curl -fsSL "https://registry.npmjs.org/@nextclaw%2F${p}" | jq -r '."dist-tags".latest'
done
```

验收点：
- 9 个渠道插件均可从 npm registry 直接查询到版本（`0.1.0`）。
- `@nextclaw/openclaw-compat` 可查询到 `0.1.8`，并依赖上述独立渠道插件包。

## 发布 / 部署方式

本次为 npm 插件生态发布闭环收尾，不涉及后端或数据库。

- 已执行：
  - 渠道插件包可见性设置为 `public`。
  - 公网 registry 直查验证可用。
- 不适用：
  - 远程 migration（无后端/数据库变更）。
  - 服务部署（无服务端发布动作）。
  - 线上 API 冒烟（无后端 API 发布）。
