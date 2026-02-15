# 2026-02-15 ESLint 行数限制收紧

## 背景 / 问题

- 需要进一步收紧文件/函数长度约束，推动拆分与可维护性

## 决策

- 保持 warn 级别，但将阈值下调至 800 行/150 行

## 变更内容

- `max-lines`: 1200 → 800
- `max-lines-per-function`: 300 → 150

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
