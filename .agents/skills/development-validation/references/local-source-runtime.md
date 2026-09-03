# 本地源码运行验证

验证当前仓库构建出的 NextClaw，避免 PATH 中的旧全局 `nextclaw` 污染结果。

## 构建资格门

调用本参考中的 runtime 命令前，必须先检查当前任务相对基线和未提交 diff 实际触达了哪些层。`pnpm local:runtime` 与 `pnpm local:source-runtime` 的默认启动路径会构建 Portable Runtime 和 NextClaw 源码，不能把它们当成普通 UI 冒烟入口。

| 本次触达面 | 默认验证入口 | 禁止 |
| --- | --- | --- |
| 仅 UI、样式、前端路由、前端测试或用户文档 | 当前 worktree 的 Vite/source UI，代理到已运行且 API 合同兼容的 backend | `local:source-runtime`、`portable-runtime:build`、Cargo、未变化 kernel/Server/Desktop 构建 |
| backend/runtime/CLI 未变化，但需要组装边界证据 | 已运行兼容服务 + 当前 UI，或 assembled boundary test | 因 worktree 没有 `dist` 就全量重建 |
| backend/runtime/CLI 本次确有变化，且风险需要真实进程 | 本参考下方的隔离 source runtime | 复用来源不明或与当前源码不匹配的 runtime 产物 |

worktree 隔离的是源码和依赖链接，不代表所有未变化底层都必须冷构建。缺少 worktree-local `dist`、Cargo target 或 native 产物只是环境事实，不是源码变化证据。若没有标准方式证明既有产物兼容，应停止并披露缺口；除非用户明确授权昂贵验证，不得自行把纯前端任务升级为全量 runtime 构建。

## 纯前端真实页面验证

已有兼容 backend 时，只启动当前 worktree 的 Vite UI，并使用独立前端端口：

```bash
curl -fsS http://127.0.0.1:<api-port>/api/auth/status
VITE_DEV_PROXY_API_BASE=http://127.0.0.1:<api-port> \
  pnpm --filter @nextclaw/ui dev -- --host 127.0.0.1 --port <ui-port>
```

这条路径按需转译当前 UI 源码，不构建或重启 backend、Portable Runtime、WASI、Desktop 和原生依赖。必须确认复用服务的 API 合同覆盖本次 UI 消费；如果本次改了 API/transport/runtime，不能用旧 backend 冒充当前源码证据。

兼容 backend 不可用时，优先使用组件、assembled boundary test 或静态产物预览证明对应风险。只有目标行为确实依赖真实 backend 进程且低成本证据不能替代时，才进入下方重型入口，并在执行前向用户说明将构建的准确层级。

## 默认入口

```bash
pnpm local:runtime
pnpm local:runtime:status
pnpm local:runtime:restart
pnpm local:runtime:stop
```

`local:runtime` 构建当前源码并直接使用 `packages/nextclaw/dist/cli/app/index.js`；默认复用 `~/.nextclaw` 数据，但把 service、UI runtime、restart sentinel 和日志隔离到 `~/.nextclaw-source-runtime/default/run`。它会打印实际 UI、API、restart 和 stop 信息。

只有构建资格门允许时才使用默认入口。Portable Runtime 构建 owner 会按内容指纹自动复用 Git common dir 中的跨 worktree 产物；不要仅为避免 runner 重编而使用来源不明的 `--no-build`。完整 CLI 产物也已证明匹配时才可使用 `--no-build`。

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
