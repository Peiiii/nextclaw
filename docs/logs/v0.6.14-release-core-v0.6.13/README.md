# 2026-02-19 Release core v0.6.13

## 发布目标

- 发布 `@nextclaw/core@0.6.13`，补丁恢复系统提示词中的显式当前时间注入。

## 发布范围

- 已发布：`@nextclaw/core@0.6.13`
- 未发布（版本已存在，无新增发布）：
  - `nextclaw@0.6.13`
  - `@nextclaw/openclaw-compat@0.1.5`
  - `@nextclaw/server@0.4.2`
  - `@nextclaw/ui@0.3.9`

## 执行记录

```bash
pnpm release:version
pnpm release:publish
```

`release:publish` 内执行：

- `pnpm build`
- `pnpm lint`
- `pnpm tsc`
- `pnpm changeset publish`
- `pnpm changeset tag`

## 发布结果

- npm 发布成功：`@nextclaw/core@0.6.13`
- tag 创建成功：`@nextclaw/core@0.6.13`
- 远端版本核验：`npm view @nextclaw/core version` 返回 `0.6.13`

## 验证结果

- `build/lint/tsc` 全通过（仅仓库既有 lint warning，无新增 error）。
- 隔离冒烟（不写仓库目录）执行：
  - `NEXTCLAW_HOME=$(mktemp -d /tmp/nextclaw-smoke-time-restore.XXXXXX) node packages/nextclaw/dist/cli/index.js init`
  - `NEXTCLAW_HOME=<same> node packages/nextclaw/dist/cli/index.js status --json`
  - 观察：初始化成功；`status --json` 正常输出状态（exit code 2 对应 stopped）。

## 文档复盘

- 实现日志：`docs/logs/v0.6.14-restore-current-time-prompt/README.md`
- 发布日志：`docs/logs/v0.6.14-release-core-v0.6.13/README.md`
- 不涉及数据库/后端 migration（不适用）。
