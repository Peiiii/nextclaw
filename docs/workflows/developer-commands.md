# NextClaw 开发命令参考

本文记录仓库维护者常用的本地开发与验证入口。根 `package.json` 的 `scripts` 是全部命令的可执行事实源；本文解释需要人工选择的主要入口及其边界，不复制发布流水线的全部内部命令。

## 快速选择

| 目标 | 命令 | 作用 |
| --- | --- | --- |
| 启动完整开发栈 | `pnpm dev start` | 启动 packages watcher、后端和前端，适合日常源码开发 |
| 查看开发栈状态 | `pnpm dev:status` | 查看由开发 runner 管理的进程与端口 |
| 停止开发栈 | `pnpm dev:kill` | 只停止开发 runner 管理的进程 |
| 人工验证真实更新 | `pnpm dev:verify-update` | 构造隔离的本地旧版与新版，先证明同一进程能定时发现候选版本，再供开发者在真实页面里下载、应用并观察自动重启 |
| 验证当前源码安装态 | `pnpm local:runtime` | 从当前源码构建并启动一个与全局安装隔离的产品实例 |
| 只启动后端或前端 | `pnpm dev:backend` / `pnpm dev:frontend` | 分别启动单侧开发服务，适合定向调试 |

## 完整开发栈

### `pnpm dev start`

日常开发的默认入口。它编排 workspace package 构建监听、NextClaw 后端和前端开发服务器，并在终端打印访问地址。

这个入口默认使用 `~/.nextclaw`。需要隔离真实配置时，显式设置：

```bash
NEXTCLAW_HOME=/tmp/nextclaw-dev-home pnpm dev start
```

相关命令：

- `pnpm dev:status`：查看 runner 记录的进程是否仍在运行。
- `pnpm dev:kill`：停止 runner 记录的开发进程。
- `pnpm dev:claude`：使用本地 Claude runtime source 启动同一开发栈，用于 Claude runtime 联调。
- `pnpm dev:packages:build`：一次性构建开发栈依赖的 workspace packages。
- `pnpm dev:packages:watch`：持续监听并重建这些 packages。
- `pnpm dev:extensions:build`：一次性构建 channel extensions。
- `pnpm dev:extensions:watch`：持续监听 channel extensions。

### 单侧与独立应用

- `pnpm dev:backend`：在固定 UI 端口配置下启动 NextClaw 后端。
- `pnpm dev:frontend`：启动 NextClaw UI 的 Vite 开发服务器。
- `pnpm dev:desktop`：启动 Electron 桌面端开发环境。
- `pnpm dev:companion`：启动 companion 应用。
- `pnpm dev:docs`：启动文档站。
- `pnpm dev:landing`：启动官网 landing 应用。
- `pnpm dev:platform:stack`：迁移本地 platform 数据库并启动 platform console 与 backend。
- `pnpm dev:platform:admin:stack`：在 platform stack 基础上同时启动 admin。

这些入口各有独立生命周期，不由 `pnpm dev:kill` 统一接管，除非它们本身由 `pnpm dev start` 启动。

## 当前源码产品态验证

### `pnpm local:runtime`

从当前工作树构建 NextClaw，并以独立 home、run state 和固定本地入口启动源码实例。它用于验证 restart/start/stop、进程归属和安装态行为，避免误跑 PATH 中的全局 `nextclaw`。

```bash
pnpm local:runtime
pnpm local:runtime:status
pnpm local:runtime:restart
pnpm local:runtime:stop
```

这一组命令不会构造候选更新源；更新人工验收应使用下面的专用入口。

### `pnpm dev:verify-update`

这是 runtime update 的本地人工验收入口。它会：

1. 为当前 runtime 构建输入计算源码指纹；源码未变化时复用已准备的签名 fixture。
2. 源码变化时只构建已经过期的 workspace dist；UI 输入未变化时不会重复执行 Vite build。
3. 依赖图未变化时复用已经裁剪的 runtime deploy 模板，并用当前 workspace 产物刷新模板；依赖变化时重新执行一次生产 runtime deploy。
4. 使用生产 runtime update builder 构建并签名 candidate bundle 与 manifest，再从同一 bundle 解出较低版本号的 baseline。
5. 使用独立 `NEXTCLAW_HOME`、`NEXTCLAW_RUN_HOME` 和端口启动 baseline。
6. 以验证专用短周期启动真实产品，自动证明 baseline 不经 restart、不调用检查 API，也能由产品定时器发现候选版本。
7. 自动打开真实页面，等待开发者亲自点击下载和应用。
8. 观察最终版本、managed service PID 和 runtime pointer 是否一起切换。

```bash
pnpm dev:verify-update
pnpm dev:verify-update -- --no-open
pnpm dev:verify-update -- --port 56144
pnpm dev:verify-update -- --keep
pnpm dev:verify-update -- --rebuild
```

- `--no-open`：不自动打开浏览器，只打印 URL。
- `--port <port>`：使用固定端口，便于外部脚本或浏览器复现。
- `--keep`：退出时保留临时构建目录与状态文件，便于排查；隔离服务仍会停止。
- `--rebuild`：本次忽略 fixture 与 runtime deploy 缓存，强制重新构建源码、生产依赖树和签名 update bundle。
- `Ctrl+C`：停止该入口创建的服务，并在未指定 `--keep` 时清理临时目录。

命令在准备完成后还会等待一次约 15 秒的周期检查，并打印 `Discovery: automatic ... without restart`。这段等待专门证明“运行中发现新版本”，不是真实生产频率；正常安装态固定每两小时检查一次，验证专用短周期不会持久化，也不会进入产品设置。

它验证的是当前源码里的更新机制，不是“某个历史已发布版本能否更新”。baseline 与 candidate 都来自当前工作树，因为下载、应用和 relaunch 逻辑首先运行在 baseline 进程中；直接使用带历史 bug 的旧二进制，无法证明当前修复后的机制是否正确。

首次运行需要准备 production fixture。之后有两种加速：同一份源码会直接命中 `tmp/nextclaw-update-verification-cache/`；源码变化但依赖图未变化时，会命中 `tmp/nextclaw-update-verification-runtime-cache/`，只刷新过期的 workspace 构建产物，不重新部署全部生产依赖。命令会打印各准备阶段的耗时和缓存状态。缓存不保存 private key，也不改变真实 check/download/apply/relaunch 链路。

参考本机验收数据：最终 fixture 命中时约 8–14 秒可进入页面；源码变化但依赖未变化时约 36–78 秒；`--rebuild` 完整绕过缓存时约 85 秒。不同机器、并行负载和本次变化的 package 数会造成差异，应以终端打印的阶段耗时为准。日常回归使用默认命令，只有怀疑缓存、修改 builder/打包输入或准备发布时才使用 `--rebuild`。

fixture 的 production deploy 使用本机 pnpm store 离线装配，因此运行前应先正常执行过 `pnpm install`。依赖不完整时命令会直接失败并要求补齐依赖，不会在本地更新验收期间等待 registry 网络重试。

## 构建与质量检查

- `pnpm build`：按依赖顺序构建整个 workspace。
- `pnpm build:ui`：只构建 NextClaw UI。
- `pnpm build:desktop` / `pnpm build:companion`：分别构建桌面端与 companion。
- `pnpm tsc`：运行整个 workspace 的 TypeScript 检查。
- `pnpm lint`：运行整个 workspace 的 ESLint。
- `pnpm lint:ui` / `pnpm tsc:ui`：只检查 NextClaw UI。
- `pnpm check:generated-clean`：检查构建生成物是否与仓库期望一致。
- `pnpm lint:maintainability:guard`：运行可维护性、新代码治理与 backlog ratchet 守卫。

定向改动优先运行受影响 package 的 `build`、`tsc`、`lint` 和相关 smoke；交付前再按仓库验证流程补足治理检查。

## Docker 本地环境

- `pnpm docker:up`：构建并启动 Docker Compose 环境。
- `pnpm docker:down`：停止 Compose 环境。
- `pnpm docker:logs`：持续查看容器日志。
- `pnpm docker:ps`：查看容器状态。
- `pnpm docker:smoke`：运行 Docker 安装态冒烟。

Docker 入口验证容器交付形态，不代替源码 runtime 或本地 update 的专用验收。

## 命令 owner 边界

- 根 `package.json`：pnpm/npm 开发脚本的事实源。
- 本文：维护者开发与本地验证入口的说明。
- `commands/commands.md`：AI 元指令，不记录 pnpm 开发命令。
- 文档站 Commands 页面：面向最终用户的 `nextclaw` CLI，不记录仓库内部 dev harness。
- 发布、桌面安装包和 runtime channel 的命令按对应 release skill 与 workflow 执行，不从本文推断发布权限。
