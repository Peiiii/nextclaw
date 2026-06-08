---
name: local-source-runtime-validation
description: 当用户要在本地验证当前源码构建出的 NextClaw 产品实例、restart/start/stop、避免跑到全局安装版 nextclaw、需要可复用本地安装态/构建态验证命令或 smoke harness 时使用。
---

# 本地源码构建实例验证

## 目标

让 AI 或开发者验证“当前仓库源码构建出来的 NextClaw”真实 start / restart / stop 行为，避免误用 PATH 中已经安装的旧 `nextclaw`。

日常默认使用：

```bash
pnpm local:runtime
```

这个命令会：

- 构建当前源码；
- 使用 `packages/nextclaw/dist/cli/app/index.js` 作为唯一 CLI 入口；
- 使用真实 `~/.nextclaw` 作为 `NEXTCLAW_HOME`，复用同一份配置、workspace、sessions 和 memory；
- 使用 `~/.nextclaw-source-runtime/default/run` 作为 `NEXTCLAW_RUN_HOME`，隔离 `service.json`、`ui-runtime.json`、restart sentinel 和运行日志；
- 打印 UI / API / restart / stop 命令。

## 使用场景

使用本 skill，当用户提到：

- 本地验证产品 restart；
- 开发态命令会跑到旧安装版；
- 想拉一个独立实例测 UI / API / 断联恢复；
- 需要 AI 给一条可复用命令做真实产品冒烟；
- 要验证 build 后的 dist CLI，而不是 `pnpm dev`。

## 推荐流程

1. 启动当前源码构建实例（复用真实数据、隔离运行态）：

```bash
pnpm local:runtime
```

2. 打开输出的 UI 地址，例如：

```text
http://127.0.0.1:18888
```

3. 需要验证 restart 时，使用输出里的 restart 命令，或显式执行：

```bash
pnpm local:runtime:restart
```

4. 查看运行状态：

```bash
pnpm local:runtime:status
```

5. 结束实例：

```bash
pnpm local:runtime:stop
```

## Docker 干净实例

需要容器级隔离、独立数据目录，并从当前仓库源码 build 镜像时，使用短命令：

```bash
pnpm docker:start
```

这个命令会：

- 使用 `docker/compose.yml` 和 `docker/Dockerfile` 从当前仓库源码构建镜像；
- 使用 `~/.nextclaw-docker` 作为默认数据目录，挂载到容器内 `/data`；
- 设置容器内 `NEXTCLAW_HOME=/data`；
- 默认暴露 UI `18891` 和 gateway `18890`，避免占用安装态默认端口；
- 默认容器名和 compose project 为 `nextclaw-docker`，自定义 `--container-name` 会使用独立 compose project，避免不同验证实例互相 recreate；
- 等待 `/api/health` 并打印 UI、API、logs、down 命令。

常用可选参数：

```bash
pnpm docker:start -- --ui-port 18891 --api-port 18890 --data-dir /tmp/nextclaw-docker-smoke
pnpm docker:start -- --dry-run
```

## Home 模式

默认 `shared-data`：

- 数据 home 使用真实 `~/.nextclaw`；
- run home 使用 `~/.nextclaw-source-runtime/<instance>/run`；
- 推荐给人工本地验证：同一份数据，独立进程控制状态。

可配置入口：

```bash
pnpm local:source-runtime -- start --port 18889 --instance test-a
```

复制配置但隔离数据：

```bash
pnpm local:source-runtime -- start --home-mode clone-config --port 18889
```

临时隔离：

```bash
pnpm local:source-runtime -- start --home-mode temp --port 18889
```

真实 home，高风险，只在用户明确要求时使用：

```bash
pnpm local:source-runtime -- start --home-mode current --allow-current-home --port 18888
```

## 重要判断

- 不要用 `nextclaw restart` 验证当前源码；它可能来自全局安装版。
- 不要用 `pnpm dev` 的总控 wrapper 验证 restart 恢复体验；backend 退出会让 dev runner 自己收尾。
- 需要最像用户安装态的本地验证时，优先用 `pnpm local:runtime`。
- 需要自定义端口、实例名或 home 策略时，再用 `pnpm local:source-runtime -- ...`。
- 若本地验证产生新的构建产物，收尾时按项目验证规则运行 `pnpm clean:generated` 或说明产物为何需要保留。
