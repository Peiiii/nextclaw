# 2026-02-15 init --force 覆盖模板

## 背景 / 问题

- 需要在不删除文件的情况下强制刷新模板内容。

## 决策

- `nextclaw init` 增加 `--force`，覆盖已存在的模板文件。

## 变更内容

- 用户可见变化：`nextclaw init --force` 会重写模板文件。
- 关键实现点：
  - `init` 传递 `force` 给模板生成逻辑。
  - 模板生成在 `force` 下跳过“存在即跳过”的判断。

## 验证（怎么确认符合预期）

```bash
# build / lint / typecheck
env PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C /Users/peiwang/Projects/nextbot build
env PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C /Users/peiwang/Projects/nextbot lint
env PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm -C /Users/peiwang/Projects/nextbot tsc

# smoke-check（非仓库目录）
cd /tmp
NEXTCLAW_HOME=/tmp/nextclaw-force-test /Users/peiwang/.nvm/versions/node/v22.16.0/bin/node /Users/peiwang/Projects/nextbot/packages/nextclaw/dist/cli/index.js init
NEXTCLAW_HOME=/tmp/nextclaw-force-test /Users/peiwang/.nvm/versions/node/v22.16.0/bin/node /Users/peiwang/Projects/nextbot/packages/nextclaw/dist/cli/index.js init --force
```

验收点：

- 第二次执行 `init --force` 会覆盖模板文件并重新输出生成日志。

## 发布 / 部署

- 本次为 CLI 变更，若发布 npm 包按 `docs/workflows/npm-release-process.md` 执行。

## 影响范围 / 风险

- Breaking change? 否
- 回滚方式：移除 `--force` 选项并恢复旧逻辑。
