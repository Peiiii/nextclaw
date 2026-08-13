# 本地源码运行验证

验证当前仓库构建出的 NextClaw，避免 PATH 中的旧全局 `nextclaw` 污染结果。

## 默认入口

```bash
pnpm local:runtime
pnpm local:runtime:status
pnpm local:runtime:restart
pnpm local:runtime:stop
```

`local:runtime` 构建当前源码并直接使用 `packages/nextclaw/dist/cli/app/index.js`；默认复用 `~/.nextclaw` 数据，但把 service、UI runtime、restart sentinel 和日志隔离到 `~/.nextclaw-source-runtime/default/run`。它会打印实际 UI、API、restart 和 stop 信息。

不要用全局 `nextclaw restart` 证明当前源码，也不要用会在 backend 退出时自行收尾的 `pnpm dev` wrapper 验证 restart 恢复。

需要自定义实例、端口或数据策略时使用：

```bash
pnpm local:source-runtime -- start --port 18889 --instance test-a
pnpm local:source-runtime -- start --home-mode clone-config --port 18889
pnpm local:source-runtime -- start --home-mode temp --port 18889
```

`current` 会直接使用真实 home，风险较高，仅在用户明确要求时执行：

```bash
pnpm local:source-runtime -- start --home-mode current --allow-current-home --port 18888
```

## Docker 隔离

需要从当前源码构建镜像、独立数据目录和容器级隔离时：

```bash
pnpm docker:start
pnpm docker:start -- --ui-port 18891 --api-port 18890 --data-dir /tmp/nextclaw-docker-smoke
pnpm docker:start -- --dry-run
pnpm docker:stop
```

默认数据目录为 `~/.nextclaw-docker`，容器内 `NEXTCLAW_HOME=/data`，UI/API 端口为 `18891/18890`。自定义 `--container-name` 使用独立 compose project，避免不同验证实例互相 recreate。

## 完成条件

- 日志与命令证明使用当前源码入口及预期 home/run home；
- 用与风险匹配的 start/restart/stop、UI 或 API 路径验证目标行为；
- 停止不再需要的实例；
- 运行产生的非交付构建产物按验证流程清理，或说明保留原因。
