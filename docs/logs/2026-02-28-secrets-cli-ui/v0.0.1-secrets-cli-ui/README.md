# 2026-02-28 v0.0.1-secrets-cli-ui

## 迭代完成说明

- 完成 `nextclaw secrets` 子命令族：`audit` / `configure` / `apply` / `reload`，并接入 CLI runtime。
- 在 Web UI 新增 Secrets 管理面板（`/secrets`），支持可视化维护：
  - `secrets.enabled`
  - `secrets.defaults`
  - `secrets.providers`
  - `secrets.refs`
- 后端新增 `PUT /api/config/secrets`，前端新增对应 API/hook。
- 文档补充 secrets 命令说明（中英文命令文档）。

## 测试 / 验证 / 验收方式

1. 基础验证：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm tsc
PATH=/opt/homebrew/bin:$PATH pnpm lint
PATH=/opt/homebrew/bin:$PATH pnpm build
```

2. CLI 冒烟（隔离目录，不写入仓库）：

```bash
TMP_HOME=$(mktemp -d /tmp/nextclaw-secrets-cli-smoke.XXXXXX)
NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js secrets configure --provider env-main --source env --prefix APP_ --set-default --json
APP_OPENAI_API_KEY="sk-test-123" NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js secrets apply --path providers.openai.apiKey --source env --id OPENAI_API_KEY --provider env-main --json
APP_OPENAI_API_KEY="sk-test-123" NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js secrets audit --strict --json
APP_OPENAI_API_KEY="sk-test-123" NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js secrets reload --json
rm -rf "$TMP_HOME"
```

验收点：4 个子命令均返回 `ok: true`；`audit --strict` 通过（`failed: 0`）。

3. UI/API 冒烟（隔离目录，不写入仓库）：

```bash
TMP_HOME=$(mktemp -d /tmp/nextclaw-secrets-ui-smoke.XXXXXX)
NEXTCLAW_HOME="$TMP_HOME" node packages/nextclaw/dist/cli/index.js serve --ui-port 18891
# 另一个终端执行：
# GET http://127.0.0.1:18891/api/health
# PUT http://127.0.0.1:18891/api/config/secrets
```

验收点：`/api/health` 返回 `ok`；`PUT /api/config/secrets` 返回更新后的 secrets 结构；随后 `GET /api/config` 可读取同样结构。

## 发布 / 部署方式

- 按项目发布流程执行：[`docs/workflows/npm-release-process.md`](../../../workflows/npm-release-process.md)
- 本次已执行命令：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm release:version
PATH=/opt/homebrew/bin:$PATH pnpm release:publish
```

- 发布结果：
  - `nextclaw@0.8.34`
  - `@nextclaw/core@0.6.35`
  - `@nextclaw/server@0.5.18`
  - `@nextclaw/ui@0.5.22`
- 不适用项说明：
  - 远程 migration：不适用（本次无后端数据库 schema 变更）。

## 用户 / 产品视角验收步骤

1. 打开 UI，进入 `Secrets` 页面（`/secrets`）。
2. 新增 provider（如 `env-main`），并设置 defaults（如 env 默认 provider）。
3. 新增 ref（如 `providers.openai.apiKey -> env/env-main/OPENAI_API_KEY`）并保存。
4. 在终端执行 `nextclaw secrets audit --strict`，确认 refs 均可解析。
5. 执行 `nextclaw secrets reload`，确认可成功触发重载。
