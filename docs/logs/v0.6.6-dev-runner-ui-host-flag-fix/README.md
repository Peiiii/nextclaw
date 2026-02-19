# v0.6.6-dev-runner-ui-host-flag-fix

## 做了什么

- 修复 `pnpm dev start` 启动失败问题：移除 dev runner 传给后端的废弃参数 `--ui-host`。
- 同步修复根脚本 `dev:backend`，避免手动执行时再次触发同类报错。

关键改动：

- `scripts/dev-runner.mjs`：`serve` 子进程参数从 `--ui-host 127.0.0.1 --ui-port 18792` 改为仅 `--ui-port 18792`。
- `package.json`：`dev:backend` 脚本移除 `--ui-host 127.0.0.1`。

## 怎么验证

- `pnpm build`
- `pnpm lint`
- `pnpm tsc`
- 冒烟（非仓库目录执行）：
  - `cd /tmp && LOG=/tmp/nextbot-dev-start-smoke.log && rm -f "$LOG" && NEXTCLAW_HOME=/tmp/nextclaw-dev-smoke pnpm --dir /Users/peiwang/Projects/nextbot dev start >"$LOG" 2>&1 & RUNPID=$!; sleep 10; kill -INT "$RUNPID" 2>/dev/null || true; sleep 2; pkill -f 'scripts/dev-runner.mjs "start"' 2>/dev/null || true; pkill -f 'tsx watch --tsconfig tsconfig.json src/cli/index.ts serve --ui-port 18792' 2>/dev/null || true; pkill -f 'vite --host 127.0.0.1 --port 5174 --strictPort' 2>/dev/null || true; rg -n "unknown option '--ui-host'|VITE v6.4.1|Local:   http://127.0.0.1:5174/" "$LOG"`

验收点：

- 日志中不再出现 `unknown option '--ui-host'`。
- 日志出现 Vite 启动信息（`VITE v6.4.1` 与 `Local: http://127.0.0.1:5174/`）。

## 用户视角验收链路

- 步骤 1：在仓库根目录运行 `pnpm dev start`。
  - 观察点：不再报 `unknown option '--ui-host'`。
- 步骤 2：观察前端提示地址。
  - 观察点：出现 `http://127.0.0.1:5174/`。
- 步骤 3：按 `Ctrl+C` 停止。
  - 观察点：进程可正常退出，不残留报错。

## 发布 / 部署

- 本次变更仅影响本地开发编排脚本，不涉及后端 API、数据库、npm 发布或线上部署。
- 远程 migration：不适用。
- 线上部署：不适用。

## 影响范围 / 风险

- Breaking change：否。
- 风险：极低，仅删除已废弃参数，行为与当前 CLI 参数规范保持一致。
- 回滚方式：恢复 `scripts/dev-runner.mjs` 与 `package.json` 的原参数即可。
