# 2026-02-15 ESLint 行数限制规则

## 背景 / 问题

- 需要在工程层面约束文件与函数长度，避免长函数/巨型文件继续增长

## 决策

- 使用 ESLint 内置 `max-lines` 与 `max-lines-per-function` 规则
- 先以 warn 级别落地，避免现有大文件阻断 CI（后续可逐步收紧）

## 变更内容

- 所有包新增行数限制规则（core/server/cli/ui）
  - `max-lines`: 1200（跳过空行与注释）
  - `max-lines-per-function`: 300（跳过空行与注释）

## 验证（怎么确认符合预期）

```bash
# build / lint / tsc
pnpm build
pnpm lint
pnpm tsc

# smoke-check（非仓库目录）
cd /tmp
PATH="/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH" \
  /Users/peiwang/Projects/nextbot/packages/nextclaw-core/node_modules/.bin/tsx -e \
  "import { SessionsListTool } from '/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/agent/tools/sessions.ts';\nimport { SessionManager } from '/Users/peiwang/Projects/nextbot/packages/nextclaw-core/src/session/manager.ts';\nconst manager = new SessionManager('/tmp/nextclaw-smoke');\nconst session = manager.getOrCreate('cli:direct');\nmanager.save(session);\nconst tool = new SessionsListTool(manager);\ntool.execute({ limit: 1 }).then((out) => {\n  const ok = out.includes('sessions');\n  console.log(ok ? 'smoke-ok' : 'smoke-fail');\n});"
```

验收点：

- build/lint/tsc 全部通过
- 冒烟输出包含 `smoke-ok`

## 发布 / 部署

- 本次为规则调整，不做发布；如需发布按 `docs/workflows/npm-release-process.md`

## 影响范围 / 风险

- Breaking change：否（仅新增 lint 规则）
- 回滚方式：回退本次提交
