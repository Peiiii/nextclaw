# 2026-02-18 Release v0.5.6

## 迭代完成说明

- 按项目发布流程执行 `changeset -> version -> publish`。
- 本次发布包：`nextclaw@0.5.6`。
- 其他包未发布（npm 上同版本已存在）：
  - `@nextclaw/core@0.5.3`
  - `@nextclaw/openclaw-compat@0.1.4`
  - `@nextclaw/server@0.3.7`
  - `@nextclaw/ui@0.3.8`

## 测试 / 验证 / 验收

### 发布前校验

```bash
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
pnpm release:check
```

结果：通过（仅仓库既有 lint warning，无 error）。

### 冒烟测试（隔离目录）

```bash
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
TMP_HOME=$(mktemp -d /tmp/nextclaw-release-smoke.XXXXXX)
NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js init
NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js config set 'agents.defaults.model' '"openai/gpt-4o-mini"' --json
NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js plugins list --json
NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js status --json
rm -rf "$TMP_HOME"
```

观察点：
- `config set/get` 正常。
- `plugins list --json` 返回空插件数组（默认禁用加载）。
- `status --json` 正常返回结构（示例 `level=stopped`, `exitCode=2`）。

### 线上发布验收

```bash
npm view nextclaw@0.5.6 version
npm view nextclaw dist-tags --json
```

结果：`version=0.5.6`，`latest=0.5.6`。

## 发布 / 部署方式

- 已执行：
  1. `pnpm release:version`
  2. `pnpm release:publish`
- 自动创建 git tag：`nextclaw@0.5.6`。
- 本次仅 NPM 包发布：
  - 远程 migration：不适用
  - 服务部署：不适用

## 发布后文档检查

- 本次变更为 CLI 结构重构发布，功能说明文档无需额外补充；相关重构说明已记录于 `docs/logs/v0.5.37-runtime-god-class-refactor/README.md`。
