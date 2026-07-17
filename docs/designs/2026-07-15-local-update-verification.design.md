# NextClaw 本地更新人工验证设计

## 背景

NextClaw 的 runtime update 会跨越签名 manifest、bundle 下载、版本目录安装、pointer 激活、managed service 退出、launcher 重新选包和页面重连。开发者目前只能等下一个版本真正发布后，再从旧版本手工更新到新版本，才能亲自判断这些行为是否正确。

仓库已经有两类相关能力：

- `packages/nextclaw/scripts/build-npm-runtime-update-channel.mjs` 可以构建真实、自包含、带签名合同的 runtime bundle。
- `packages/nextclaw/scripts/smoke-npm-runtime-update.mjs` 可以自动验证 check、download、apply 和 launcher 选包，但其轻量 fixture 不会启动完整产品页面，不能提供人工点击验收环境。
- `scripts/local/source-runtime-instance.mjs` 可以启动当前源码构建实例，但它明确关闭 runtime update host，也没有本地候选版本和 update manifest。

缺口不是另一条自动测试，而是一个开发者可以亲自操作的、本地双版本更新环境。

## 用户目标

开发者在仓库根运行：

```bash
pnpm dev:verify-update
```

命令完成准备后自动打开真实 NextClaw 页面。隔离基线会先通过产品自身的 automatic check 发现本地 candidate，页面直接出现可用版本和下载入口；开发者再亲自执行下载、应用、等待重连和刷新页面，不需要先发布 NPM 包或 runtime channel。

## 成功标准

- 使用当前源码构建 baseline 和 candidate，不命中 PATH 中的全局 `nextclaw`。
- baseline 与 candidate 拥有可比较的不同版本号；更新执行代码和候选产品代码都来自当前工作树。
- 使用真实 runtime bundle builder、真实签名校验、真实 update API、真实 launcher 和真实 managed service。
- 使用独立 `NEXTCLAW_HOME`、`NEXTCLAW_RUN_HOME` 和动态端口，不读写真实 `~/.nextclaw`。
- 页面初始显示 baseline 版本；人工应用更新后自动恢复，并显示 candidate 版本。
- 页面启动后必须自行显示可用 candidate 和下载入口；手动再次检查或点击下载后必须自行进入下一状态，不能依赖刷新补偿丢失的实时事件。
- 终端能观察到旧 PID、新 PID和最终版本。
- `Ctrl+C` 会停止该命令创建的服务并清理临时目录；`--keep` 可显式保留现场。
- 同一份源码重复验证时复用已准备的签名 fixture，不再重复构建 workspace 和生产依赖树。
- 源码变化时只刷新过期的 workspace dist，并复用依赖图未变化的 runtime deploy 模板；不能因改一个 updater 文件重新构建全部 35 个依赖包。
- 强制重建只允许一次 production deploy；各阶段必须输出耗时，避免重新退化后只能靠体感发现。

## 核心方案

### 双版本构造

candidate 使用 `packages/nextclaw/package.json` 的当前版本，例如 `0.23.0`。

当 candidate 是 stable 版本时，baseline 使用同 core 的开发 prerelease，例如：

```text
baseline  0.23.0-dev.0
candidate 0.23.0
```

stable 版本在 runtime 版本比较中高于同 core prerelease，因此无需修改仓库 package version，也无需伪造更高的未来正式版本。

baseline 和 candidate 都由当前工作树构建。原因是下载、激活和 self-relaunch 逻辑运行在 baseline 进程中；如果 baseline 直接使用含历史 bug 的已发布二进制，当前源码里的修复在 candidate 启动前没有机会执行，无法验证“修复后的更新机制以后是否正确”。

### Candidate 构建

新命令不自行复制 bundle 规则，而是调用现有生产 builder：

```text
build-npm-runtime-update-channel.mjs
```

builder 输出：

- 自包含 candidate runtime zip；
- bundle manifest；
- update manifest；
- 临时 Ed25519 public key。

manifest 和 bundle 使用本地 `file://` URL。file source 是现有 update source 的正式支持路径，仍会经过 manifest signature、bundle hash、bundle signature、platform、arch 和 launcher compatibility 校验；本轮不额外引入 HTTP server 生命周期。

### 准备性能、增量构建与两级缓存

旧方案在 harness 中先为 baseline 执行一次 `pnpm deploy`，随后 production builder 又为 candidate 执行一次相同的 `pnpm deploy`。两份运行时都来自当前工作树，第二次装配没有增加验证覆盖，只增加了约一轮完整依赖复制成本。

新方案只让 production builder 装配一次 candidate runtime。builder 生成的签名 update bundle 同时是 baseline 的唯一材料来源：harness 将同一个 bundle 解压到本次隔离目录，再只修改临时副本里的 package version。这样 baseline 运行的仍是当前源码，真实更新时下载和安装的仍是 production builder 生成的原始签名 bundle，但冷启动不再重复部署依赖。

harness 会对能够影响 NextClaw runtime 的源码与构建输入计算 SHA-256 指纹，包括 `packages/`、workspace lock/config、TypeScript config、UI/runtime 构建输入和同步进发布包的 usage resource。一级 fixture 缓存只保存：

- production builder 输出的 candidate bundle；
- 签名 update manifest；
- 对应 public key；
- 描述源码指纹、版本、channel、platform 和 arch 的 metadata。

临时 private key 在 fixture 构建结束后立即删除。源码指纹不变时，后续运行直接复用该已签名 fixture；源码、依赖、构建配置、版本、平台或 fixture schema 任一变化都会形成新的缓存键。缓存缺失或内容不完整时会明确打印原因并重建，不会静默借用其他版本。

只缓存最终 fixture 仍不足以支持日常迭代：开发者改动一行源码后，源码指纹必然变化，如果每次都运行 `pnpm --filter nextclaw... build`，仍会重建完整依赖闭包。因此默认重建改为复用现有 `workspace-package-dist-watcher` 的新鲜度判断，只构建输入时间晚于 dist 的 package。UI 没有 TypeScript dist contract，由 harness 独立比较 UI 构建输入和 `dist/index.html`；只有 UI 输入变化时才运行 Vite build，随后统一同步到 `packages/nextclaw/ui-dist`。usage resource 在计算源码指纹前先由既有同步脚本归一化。

production builder 继续是 runtime bundle 的唯一 owner，但新增显式、dev-only 的 runtime deployment cache 参数。二级缓存按 lockfile、workspace/package metadata、platform、arch、Node major 和 cache schema 寻址，保存一次 `pnpm deploy --prod` 后已经裁剪的 runtime 模板。源码改变但依赖图不变时，builder 复制该模板，用当前 workspace package 的 `files` 合同覆盖 root runtime 和已部署的 workspace dependencies，然后继续走同一套 prune、bundle manifest、zip、hash 和签名流程。依赖图变化、缓存不完整或 schema 变化时，重新执行真实 production deploy。

`--rebuild` 同时绕过一级 fixture 与二级 runtime deployment cache，完整刷新源码产物并执行 production deploy；产物只属于本次临时目录。这条路径用于证明缓存没有掩盖发布合同问题，默认路径用于高频人工回归。

本地 fixture 构建会显式要求 builder 以 pnpm offline 模式执行 production deploy。验证命令的前置条件是仓库依赖已经通过正常 `pnpm install` 进入本机 store；缺失依赖时直接失败，不通过 registry 重试把一次本地验收变成不可预测的网络等待。production builder 的发布默认值保持不变，只有 dev harness 传入该显式参数。

两级缓存分别位于被 git 忽略的 `tmp/nextclaw-update-verification-cache/` 与 `tmp/nextclaw-update-verification-runtime-cache/`。它们只缩短 dev harness 的准备阶段，不改变 shipped runtime，不绕过 check/download/apply/launcher/relaunch 中任何产品合同。

本机实测中，原始冷启动准备约为 136.3 秒；优化后，无缓存 `--rebuild` 为 84.6 秒，源码变化且命中 runtime deployment cache 时约为 35.7–77.5 秒，源码未变化且命中最终 fixture 时为 7.5–14.2 秒。完成缓存 owner 拆分后的最新真实更新准备为 38.1 秒。区间差异来自同时变化的 package 数和本机并行构建负载；如果同一工作区的其他任务在两次运行之间继续写入 runtime 源码，新的源码指纹会按合同产生 cache miss，这不属于热缓存退化。该数据只作为退化观察基线，不承诺不同机器的绝对耗时。验收重点是命令输出的缓存状态与分阶段耗时相符。

### Baseline 构建与启动

命令从 candidate update bundle 解出独立 baseline package root，再只修改该临时副本的 package version。baseline 从自己的：

```text
dist/cli/launcher/index.js
```

启动 managed service，并注入：

```text
NEXTCLAW_HOME=<temp>/home
NEXTCLAW_RUN_HOME=<temp>/run
NEXTCLAW_UPDATE_MANIFEST_URL=file://...
NEXTCLAW_UPDATE_BUNDLE_PUBLIC_KEY_PATH=<temp>/update-public-key.pem
```

fixture 不写入任何更新偏好；自动检查固定开启，产品也永远不会自动下载。初始 `lastUpdateCheckAt` 写入当前时间，并由显式 verification mode 把生产两小时周期压缩为数秒。harness 不直接调用 check API，而是等待同一个 baseline PID 通过真实 product runtime update host 的 timer 发现 candidate；这样命令打开页面后会明确出现 candidate 和下载入口，同时下载与应用仍由开发者亲自操作。

### 人工验收与监控

命令启动后保持前台运行并轮询真实：

```text
GET /api/app/meta
```

同时读取隔离 run home 的 `service.json`。观察到 candidate 版本后，必须确认：

- 最终 `productVersion` 等于 candidate；
- 新 PID 与初始 PID 不同；
- `current.json` 指向 candidate。

命令只配置隔离环境和验证专用时间压缩参数并观察结果，不直接调用 check/download/apply。automatic check 由产品 timer 执行，并且必须在 managed service PID 不变时发现 candidate；发现后必须保持 `update-available` 而不下载，下载与应用的人工点击仍然是这条入口的核心价值，开发者也可以在更新页再次手动检查。

首次真实页面验收发现，runtime update host 的 check/download 命令会立即返回 `checking`/`downloading`，最终结果只通过 WebSocket 事件送回页面。如果页面刚打开、实时连接尚未建立，最终事件可能丢失，页面会一直停在处理中，刷新后才读取到后端已经完成的状态。该行为违背命令调用者对 `Promise<UpdateSnapshot>` 的完成语义，也会让人工验证产生假卡死。

因此产品链路同时收敛命令响应合同：check/download 仍持续发布进度事件，但 HTTP 命令会等待当前任务结束并返回最终 snapshot。页面既能通过实时事件获得进度，也能通过本次命令响应可靠获得最终状态；这不是 UI fallback，也没有引入第二套状态源。

`pnpm` 在终端收到 `Ctrl+C` 时可能先结束 script 子进程，因此清理不能只依赖主 harness 的异步 signal handler。命令会同时启动一个脱离终端进程组的 cleanup watchdog：它等待 harness 退出，再从隔离 `service.json` 读取并停止 owned PID；未指定 `--keep` 时删除临时目录。主 harness 仍会先尝试即时清理，watchdog 是进程生命周期兜底，不参与产品更新行为。

## Owner 与文件落点

- `scripts/dev/verify-update.mjs`：开发态人工验收环境的生命周期 owner；负责装配、启动、观察和发起清理。
- `scripts/dev/managers/update-verification-fixture.manager.mjs`：源码指纹、最终 fixture 缓存、构建产物新鲜度和签名 fixture 的流程 owner。
- `scripts/dev/utils/update-verification-command.utils.mjs`：同步命令执行与阶段耗时输出的无状态工具。
- `scripts/dev/verify-update-cli.mjs`：命令参数与 help 文案 owner。
- `scripts/dev/verify-update-cleanup.mjs`：脱离 `pnpm` 进程组的 owned service 与临时目录清理 owner。
- `packages/nextclaw/scripts/build-npm-runtime-update-channel.mjs`：candidate runtime bundle 和签名发布合同的唯一 builder。
- `packages/nextclaw/scripts/managers/npm-runtime-deployment-cache.manager.mjs`：dev harness 显式启用的 runtime deploy 模板缓存、workspace artifact 刷新、裁剪与原子写入 owner；production 默认构建不启用缓存。
- `packages/nextclaw` launcher/service/runtime update owners：真实产品行为，不增加 dev 特判。
- 根 `package.json`：公开 `dev:verify-update` 入口。
- `docs/workflows/developer-commands.md`：仓库开发与本地验证命令参考。
- `README.md`：只保留高频入口和开发命令参考链接，不复制完整命令表。

新脚本是一个有明确启动/观察/清理生命周期的 dev harness，因此不塞进已经承担 source runtime start/restart/stop 的 `source-runtime-instance.mjs`，也不把人工交互生命周期继续堆进自动 smoke 文件。

## 命令合同

```bash
pnpm dev:verify-update
pnpm dev:verify-update -- --no-open
pnpm dev:verify-update -- --port 56144
pnpm dev:verify-update -- --keep
pnpm dev:verify-update -- --rebuild
```

- 默认自动选择可用端口并打开浏览器。
- `--no-open` 只准备环境并打印 URL。
- `--port` 用于需要固定入口的复现。
- `--keep` 在退出时保留临时目录和日志，但仍停止该命令创建的进程。
- `--rebuild` 本次不读取 fixture 或 runtime deployment 缓存，完整重建源码、production deploy 与签名 update bundle。
- 未识别参数直接失败，不做猜测或静默 fallback。

## 安全边界

- 这是显式 dev-only 命令，不进入 shipped NextClaw CLI。
- 不读取或复制真实用户配置；空 home 使用产品默认初始化路径。
- 不修改仓库 package version、真实 update channel 或全局 NPM 安装。
- 不通过 PATH 查找 `nextclaw`。
- fixture 缓存由当前源码输入指纹寻址；命中、未命中、损坏重建和显式绕过都会输出可观察状态。
- 缓存不保存 update private key，也不成为产品 runtime 的 fallback source。
- 清理只处理隔离 run state 中记录的、由本命令启动的 PID。
- 构建、启动、健康检查或版本观察失败时显式退出并打印临时目录，不用全局安装或旧产物兜底。

## 开发命令文档

当前 `README.md` 只记录 `pnpm dev start`、`dev:backend` 和 `dev:frontend`，`package.json` 是全部脚本的可执行事实源，但缺少面向维护者的作用说明。

新增 `docs/workflows/developer-commands.md`，覆盖高频开发、当前源码安装态验证、更新人工验收、Docker、构建和质量检查命令。公开用户 CLI 命令继续由 docs site 的 command index 管理；AI 元指令继续由 `commands/commands.md` 管理，三者不混写。

## 验收方式

1. 运行 `pnpm dev:verify-update -- --rebuild --no-open --port <free-port>`，记录完整 production deploy 路径耗时。
2. 确认命令打印 baseline、candidate、临时目录和 UI URL。
3. 请求 `/api/app/meta`，确认 baseline 版本。
4. 确认产品在 managed service PID 不变时通过周期 timer 展示 candidate 与下载入口；再依次点击 download、apply，确认无需刷新即可进入下一状态，并可按需再次点击 check 验收手动检查。
5. 等待旧 PID 退出、新 PID 接管。
6. 请求 `/api/app/meta`，确认 candidate 版本。
7. 检查 `current.json` 和隔离 `service.json`。
8. 发送 `Ctrl+C`，确认服务停止、临时目录被清理。
9. 不修改源码再次运行同一命令，确认输出 fixture `cache hit`，并记录到页面可用的热启动耗时。
10. 修改一个 runtime workspace package 后再运行默认命令，确认只刷新过期 dist、命中 runtime deployment cache，并记录加速重建耗时。
11. 再次使用 `--rebuild`，确认它明确绕过两级缓存，且不会覆盖正在使用的 cached fixture。
12. 运行脚本 ESLint、相关 package `tsc`/build、generated clean、governance 和 maintainability 检查。

## 非目标

- 本轮不替代现有自动 smoke。
- 本轮不接入 CI 或 runtime release workflow。
- 本轮不实现历史 published version → working tree candidate 模式。
- 本轮不增加故障注入或 rollback 场景选择器。
- 除显式 verification mode 的时间压缩参数外，不增加新的产品 update 状态或 dev-only 行为分支。
