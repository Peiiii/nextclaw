# 2026-02-15 模板文件外置

## 背景 / 问题

- Workspace 模板字符串硬编码在 `runtime.ts`，后续难以维护和扩展。

## 决策

- 将模板内容拆分为独立文件并随包发布。
- 运行时读取模板文件，支持 `NEXTCLAW_TEMPLATE_DIR` 覆盖目录。

## 变更内容

- 用户可见变化：`onboard` 生成的模板来自模板文件，便于后续维护。
- 关键实现点：
  - 新增 `packages/nextclaw/templates/*` 模板文件。
  - `createWorkspaceTemplates` 读取模板目录并写入 workspace。
  - `package.json` 发布文件包含 `templates`。

## 验证（怎么确认符合预期）

```bash
# build / lint / typecheck
env PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C /Users/peiwang/Projects/nextbot build
env PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C /Users/peiwang/Projects/nextbot lint
env PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C /Users/peiwang/Projects/nextbot tsc

# smoke-check（非仓库目录）
cd /tmp
NEXTCLAW_HOME=/tmp/nextclaw-template-test /Users/peiwang/.nvm/versions/node/v22.16.0/bin/node /Users/peiwang/Projects/nextbot/packages/nextclaw/dist/cli/index.js onboard
test -f /tmp/nextclaw-template-test/workspace/AGENTS.md
grep -q "I am nextclaw" /tmp/nextclaw-template-test/workspace/SOUL.md
```

验收点：

- workspace 下生成 `AGENTS.md`/`SOUL.md`/`USER.md`/`memory/MEMORY.md`。
- `SOUL.md` 中 `${APP_NAME}` 被替换为实际名称。

## 发布 / 部署

- 本次为 CLI 变更，若发布 npm 包按 `docs/workflows/npm-release-process.md` 执行。

## 影响范围 / 风险

- Breaking change? 否
- 回滚方式：恢复 `runtime.ts` 内置模板并移除模板目录。
