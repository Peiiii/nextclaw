# 2026-02-18 Dev runtime decouple (CLI production path cleanup)

## 背景 / 问题

- `pnpm dev start` 走了 CLI runtime 的开发分支，导致开发编排（端口策略、前端进程）与生产启动路径耦合。
- 这种耦合会让生产代码负担开发态复杂性，不符合“vite 配置层解决开发问题、业务代码保持纯净”的工程边界。

## 决策

- 开发态与生产态彻底解耦：
  - 生产 CLI 仅保留生产语义（start/restart/serve/gateway/ui）。
  - 开发编排下沉到仓库级独立脚本与 Vite 配置，不再写入 CLI runtime 分支。
- `start/restart/serve` 不再暴露 dev-only 参数（`--frontend`、`--frontend-port`）。

## 变更内容

- 用户可见变化：
  - `pnpm dev start` 改为 repo 级 dev orchestrator，固定前端端口 `5174`、后端 UI API `18792`。
  - Vite 使用 `strictPort`，端口冲突直接报错，不再自动漂移到新端口。
  - CLI 的 `start/restart/serve` 参数收敛，移除 `--frontend` 与 `--frontend-port`。
- 关键实现点：
  - 新增 `scripts/dev-runner.mjs`：并行启动 backend(`tsx watch`) + frontend(`vite`)。
  - `packages/nextclaw-ui/vite.config.ts`：改为 `host=127.0.0.1`、`port=5174`、`strictPort=true`，并支持 `VITE_API_BASE`。
  - `packages/nextclaw/src/cli/runtime.ts`：移除 dev 分支编排逻辑，仅保留生产启动路径。
  - `packages/nextclaw/src/cli/index.ts`：移除 `--frontend`/`--frontend-port`。
  - `packages/nextclaw/src/cli/utils.ts`：移除 dev 专用前端/端口探测工具函数，`buildServeArgs` 回归生产参数。

## 验证（怎么确认符合预期）

```bash
# 发布前校验
pnpm release:check

# 开发态冒烟（非仓库数据路径）
NEXTCLAW_HOME=/tmp/nextclaw-dev-decouple-smoke pnpm dev start
```

验收点：

- `pnpm dev start` 启动后前端固定在 `http://127.0.0.1:5174`。
- 修改 backend 代码触发重启后，前端端口不漂移。
- `nextclaw start/restart/serve --help` 不再出现 `--frontend`、`--frontend-port`。

## 发布 / 部署

- 已按发布流程执行并发布：
  - `nextclaw@0.4.17`
  - `@nextclaw/ui@0.3.7`
- 参考流程文档：`docs/workflows/npm-release-process.md`。

## 影响范围 / 风险

- Breaking change? 是（CLI 参数层面移除 `--frontend` / `--frontend-port`）。
- 风险控制：开发态能力由 `pnpm dev start` 与 `vite.config.ts` 承接，生产路径保持纯净。
