# 2026-02-18 USAGE-driven AI self-management closure

## 背景 / 目标

- 用户希望 NextClaw 的 AI 后续可以直接帮助用户做自我管理。
- 决策：不新增复杂控制面，沿用现有 `docs/USAGE.md` 作为用户 + AI 共用单一指南。
- 目标：形成“文档（USAGE） + 内置 skill + 模板初始化 + 运行时提示”闭环。

## 变更内容

- `docs/USAGE.md`
  - 新增 `AI Self-Management Contract`：先读指南、优先 `--json`、变更后闭环验证、重启语义说明、禁止发明命令。
  - Workspace 文件表新增 `USAGE.md`。
- `packages/nextclaw/scripts/sync-usage-template.mjs`
  - 新增同步脚本：把 `docs/USAGE.md` 同步到 `packages/nextclaw/templates/USAGE.md`。
- `packages/nextclaw/package.json`
  - `build` 前执行 `sync-usage-template`，保证模板指南和主文档一致。
- `packages/nextclaw/templates/USAGE.md`
  - 由同步脚本生成，作为 workspace 初始化时给 AI/用户的本地操作指南副本。
- `packages/nextclaw/templates/AGENTS.md`
  - 新增规则：自管理场景先读 `USAGE.md`。
- `packages/nextclaw/src/cli/runtime.ts`
  - workspace 模板创建新增 `USAGE.md`。
  - `seedBuiltinSkills` 改为“补齐缺失 built-ins”，不再要求 `skills/` 目录为空。
- `packages/nextclaw-core/src/agent/skills/nextclaw-self-manage/SKILL.md`
  - 新增内置 skill，并设置 `always=true`，让 AI 默认带有自管理流程。
- `packages/nextclaw-core/src/agent/context.ts`
  - 系统提示新增 `Self-Management Guide`，明确先读 workspace `USAGE.md`。

## 验证 / 验收

建议最小验证：

```bash
source ~/.nvm/nvm.sh
pnpm -C packages/nextclaw-core build
pnpm -C packages/nextclaw-core lint
pnpm -C packages/nextclaw-core tsc
pnpm -C packages/nextclaw build
pnpm -C packages/nextclaw lint
pnpm -C packages/nextclaw tsc
```

冒烟（隔离目录）：

```bash
export NEXTCLAW_HOME=/tmp/nextclaw-smoke-self-manage
rm -rf "$NEXTCLAW_HOME"

node packages/nextclaw/dist/cli/index.js init
ls "$NEXTCLAW_HOME/workspace" | rg "USAGE.md|AGENTS.md|skills"
ls "$NEXTCLAW_HOME/workspace/skills" | rg "nextclaw-self-manage"
```

期望：
- workspace 存在 `USAGE.md`
- `skills/nextclaw-self-manage` 已就绪（新环境）
- 运行时提示中包含 self-management guide（通过日志或会话检查）

## 发布 / 部署

- 如需随 npm 包发布，按 `docs/workflows/npm-release-process.md`。
- 本次改动不涉及数据库/后端 migration。
