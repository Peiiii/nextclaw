# v0.6.2 restore OpenClaw-compatible plugins (NextClaw-only discovery)

## 迭代完成说明

- 恢复 OpenClaw 兼容插件系统（CLI 命令、运行时加载、配置链路）。
- 恢复 `@nextclaw/openclaw-compat` 包，并重新接回 `nextclaw` 运行时。
- 恢复插件相关命令：
  - `plugins list|info|install|uninstall|enable|disable|doctor`
  - `channels add`（用于插件通道 setup）
- 恢复 `plugins.*` 配置 schema 与 reload 规则（`plugins.*` 变更需重启）。
- 调整插件发现目录：
  - 保留 NextClaw 目录：`${NEXTCLAW_HOME}/extensions`、`<workspace>/.nextclaw/extensions`、`plugins.load.paths`
  - 移除 OpenClaw 目录扫描：`~/.openclaw/extensions`、`<workspace>/.openclaw/extensions`
- 调整插件开关语义：默认启用；仅当 `NEXTCLAW_ENABLE_OPENCLAW_PLUGINS=0` 时关闭。

## 测试 / 验证 / 验收

### 工程校验

```bash
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
pnpm install
pnpm build
pnpm lint
pnpm tsc
```

结果：通过（仅仓库既有 lint warning：`max-lines` / `max-lines-per-function`）。

### 冒烟测试（隔离目录）

```bash
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
TMP_HOME=$(mktemp -d /tmp/nextclaw-plugin-smoke.XXXXXX)
WORKSPACE="$TMP_HOME/workspace"

mkdir -p "$WORKSPACE/.openclaw/extensions/legacy-plugin"
mkdir -p "$WORKSPACE/.nextclaw/extensions/next-plugin"

# 写入最小插件样例（manifest + index）
# ...

NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js plugins --help
NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js channels add --help
NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js plugins list --json

rm -rf "$TMP_HOME"
```

验收点：

- `plugins --help` 可用。
- `channels add --help` 可用。
- `plugins list --json` 仅发现 `next-plugin`，不发现 `legacy-plugin`（确认不再扫描 `.openclaw` 目录）。

## 发布 / 部署方式

- 本次为代码修复迭代，未执行发布。
- 如需发布，按 `docs/workflows/npm-release-process.md` 执行：`changeset -> version -> publish`。
- 本次不涉及数据库与远程 migration。
