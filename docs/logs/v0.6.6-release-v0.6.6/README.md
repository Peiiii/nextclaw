# 2026-02-19 Release v0.6.6

## 本次发布内容

- 修复本地开发启动链路中的参数不兼容问题：移除已废弃的 `--ui-host` 参数传递。
- 涉及范围：
  - `scripts/dev-runner.mjs`（`pnpm dev start` 后端子进程参数）
  - 根脚本 `dev:backend`（`package.json`）
- 发布包：`nextclaw@0.6.6`

## 验证与验收

### 1) 发布前全量校验

```bash
pnpm release:check
```

观察点：

- `build` / `lint` / `tsc` 全部通过。
- lint 仅有仓库既有 `max-lines` 警告，无新增 error。

### 2) 主路径冒烟（本地开发启动）

```bash
cd /tmp
LOG=/tmp/nextbot-dev-start-smoke.log
rm -f "$LOG"
NEXTCLAW_HOME=/tmp/nextclaw-dev-smoke pnpm --dir /Users/peiwang/Projects/nextbot dev start >"$LOG" 2>&1 &
RUNPID=$!
sleep 10
kill -INT "$RUNPID" 2>/dev/null || true
sleep 2
pkill -f 'scripts/dev-runner.mjs "start"' 2>/dev/null || true
pkill -f 'tsx watch --tsconfig tsconfig.json src/cli/index.ts serve --ui-port 18792' 2>/dev/null || true
pkill -f 'vite --host 127.0.0.1 --port 5174 --strictPort' 2>/dev/null || true
rg -n "unknown option '--ui-host'|VITE v6.4.1|Local:   http://127.0.0.1:5174/" "$LOG"
```

观察点：

- 不再出现 `unknown option '--ui-host'`。
- 出现 Vite 启动信息与本地地址。

### 3) 发布后线上冒烟（npm）

```bash
cd /tmp
npm view nextclaw version
npx -y nextclaw@0.6.6 serve --help > /tmp/nextclaw-066-serve-help.txt 2>&1
rg -n -- "Usage: nextclaw serve|--ui-port|--ui-host" /tmp/nextclaw-066-serve-help.txt
```

观察点：

- `npm view nextclaw version` 为 `0.6.6`。
- `serve --help` 仅包含 `--ui-port`，不包含 `--ui-host`。

## 发布与部署

按 `docs/workflows/npm-release-process.md` 执行：

```bash
pnpm release:version
pnpm release:publish
```

发布结果：

- `nextclaw@0.6.6`
- 自动 tag：`nextclaw@0.6.6`

## 闭环说明

- 远程 migration：不适用（本次无后端/数据库 schema 变更）。
- 线上关键能力冒烟：已执行（npm 最新版本 + CLI 帮助校验）。
- 文档影响检查：已新增
  - `docs/logs/v0.6.6-dev-runner-ui-host-flag-fix/README.md`
  - `docs/logs/v0.6.6-release-v0.6.6/README.md`
