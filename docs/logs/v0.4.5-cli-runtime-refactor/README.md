# 2026-02-15 CLI 运行时重构

## 背景 / 问题

- CLI 主入口过大（~1200 行），工具函数与业务逻辑混杂，阅读与维护成本高。

## 决策

- `index.ts` 仅保留命令注册与编排。
- 工具函数统一迁出到 `utils.ts`。
- 业务逻辑集中到 `CliRuntime` 类中组织。

## 变更内容

- 用户可见变化：CLI 行为不变，仅结构重构。
- 关键实现点：
  - 新增 `cli/utils.ts`，集中端口、UI、服务状态等工具函数。
  - 新增 `cli/runtime.ts`，以类封装命令业务逻辑。
  - `cli/index.ts` 精简为命令注册与调用运行时方法。

## 验证（怎么确认符合预期）

```bash
# build / lint / typecheck
pnpm -C /Users/peiwang/Projects/nextbot build
pnpm -C /Users/peiwang/Projects/nextbot lint
pnpm -C /Users/peiwang/Projects/nextbot tsc

# smoke-check（非仓库目录）
cd /tmp
/Users/peiwang/.nvm/versions/node/v22.16.0/bin/node /Users/peiwang/Projects/nextbot/packages/nextclaw/dist/cli/index.js --help
```

验收点：

- `--help` 正常输出命令列表，进程退出码为 0。

## 发布 / 部署

- 本次为结构性重构，是否发布 npm 版本由需求决定；如需发布，按 `docs/workflows/npm-release-process.md` 执行。

## 影响范围 / 风险

- Breaking change? 否
- 回滚方式：恢复 `cli/index.ts` 旧结构与删除新增文件即可。
