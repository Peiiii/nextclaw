# 2026-02-15 完整模板集

## 背景 / 问题

- 需要对齐 OpenClaw 级别的完整度（身份/灵魂/用户/工具/记忆/启动/心跳）。

## 决策

- 提供完整模板集（多文件），并在 init/start 时补齐缺失文件。
- 模板内容保持可维护与可扩展。

## 变更内容

- 用户可见变化：初始化会生成完整模板集。
- 关键实现点：
  - 新增/完善 `templates/*` 模板文件。
  - `createWorkspaceTemplates` 生成完整文件清单。

## 验证（怎么确认符合预期）

```bash
# build / lint / typecheck
env PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C /Users/peiwang/Projects/nextbot build
env PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C /Users/peiwang/Projects/nextbot lint
env PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C /Users/peiwang/Projects/nextbot tsc

# smoke-check（非仓库目录）
cd /tmp
NEXTCLAW_HOME=/tmp/nextclaw-full-templates /Users/peiwang/.nvm/versions/node/v22.16.0/bin/node /Users/peiwang/Projects/nextbot/packages/nextclaw/dist/cli/index.js init
test -f /tmp/nextclaw-full-templates/workspace/AGENTS.md
test -f /tmp/nextclaw-full-templates/workspace/SOUL.md
test -f /tmp/nextclaw-full-templates/workspace/USER.md
test -f /tmp/nextclaw-full-templates/workspace/IDENTITY.md
test -f /tmp/nextclaw-full-templates/workspace/TOOLS.md
test -f /tmp/nextclaw-full-templates/workspace/BOOT.md
test -f /tmp/nextclaw-full-templates/workspace/BOOTSTRAP.md
test -f /tmp/nextclaw-full-templates/workspace/HEARTBEAT.md
test -f /tmp/nextclaw-full-templates/workspace/MEMORY.md
```

验收点：

- 完整模板文件均生成。

## 发布 / 部署

- 本次为 CLI 变更，若发布 npm 包按 `docs/workflows/npm-release-process.md` 执行。

## 影响范围 / 风险

- Breaking change? 否
- 回滚方式：恢复简化模板与旧生成逻辑。
