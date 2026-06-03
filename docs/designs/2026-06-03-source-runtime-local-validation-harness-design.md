# 2026-06-03 源码构建实例本地验证机制

## 背景

NextClaw 的很多产品行为必须通过真实 CLI / 服务进程验证，例如 `restart`、启动恢复、UI 对后端短暂断联的处理，以及安装态资源加载。

直接让 AI 或开发者执行：

```bash
nextclaw restart
```

并不能证明当前仓库源码正确，因为该命令可能来自本机全局安装版，而不是当前 checkout 的代码。

## 目标

提供一套可复用的本地验证机制：

- 明确运行当前仓库构建产物；
- 明确隔离测试实例的运行态；
- 尽量复用真实配置，减少重新配置成本；
- 支持 start / restart / stop / status；
- 能被 AI 通过 skill 稳定触发。

## 入口

统一入口：

```bash
pnpm local:runtime
```

对应脚本：

```text
scripts/local/source-runtime-instance.mjs
```

脚本只通过当前仓库的构建入口启动产品：

```text
packages/nextclaw/dist/cli/app/index.js
```

它不会解析 PATH 中的 `nextclaw`。

## Home 策略

默认使用 `shared-data`：

```text
NEXTCLAW_HOME=~/.nextclaw
NEXTCLAW_RUN_HOME=~/.nextclaw-source-runtime/default/run
```

配置、workspace、sessions、memory 等用户数据仍使用真实 `~/.nextclaw`。运行态文件、日志、service state、restart sentinel 写入 `NEXTCLAW_RUN_HOME`。

这是默认策略，因为它同时满足两个诉求：

- 复用真实用户数据，不需要重新配置；
- 避免测试实例误控制真实主实例。

支持的模式：

- `shared-data`：默认，真实数据 + 独立运行态；
- `clone-config`：可选，复制配置并隔离整份 home；
- `temp`：完全临时 home，适合一次性 smoke；
- `current`：真实 home，高风险，必须显式传 `--allow-current-home`。

## 与 pnpm dev 的边界

`pnpm dev` 是开发总控，会同时拉 backend 和 frontend。用它验证 restart 有一个结构性问题：

- backend 被 restart 杀掉后；
- dev runner 会认为关键子进程退出；
- 整个开发环境可能被收尾。

因此 `pnpm dev` 适合开发联调，不适合作为产品 restart 恢复体验的主验证路径。

要验证最接近安装态的 restart，应使用 build 后的 source runtime harness：

```bash
pnpm local:runtime
pnpm local:runtime:restart
pnpm local:runtime:stop
```

## 与 Docker 的关系

Docker 适合验证隔离发布态，但不是当前默认方案：

- Docker 默认需要独立数据目录，会增加重新配置成本；
- 如果挂载真实 `~/.nextclaw`，又会引入路径、权限和运行态文件冲突；
- Mac 本地网络、端口映射和宿主进程管理也会改变一部分行为。

因此当前优先级是：

1. source runtime harness；
2. Docker profile，作为未来可选扩展。

## AI 触发

新增 skill：

```text
.agents/skills/local-source-runtime-validation/SKILL.md
```

当用户要求“本地验证当前源码构建出的产品实例 / restart / 避免全局安装版”时，AI 应优先读取该 skill，并使用 `pnpm local:runtime`。
