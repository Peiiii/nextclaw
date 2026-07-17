# NextClaw Unified Update System Design

## 1. 目标

本文定义 NextClaw 的统一更新设计，覆盖桌面版、npm 安装版，以及未来其它 host 形态。

核心目标：

- 用户体验统一：自动检查、用户点击后才下载、用户点击后才应用。
- 协议与字段统一：桌面版、npm 版和未来 host 必须共享同一套 update manifest、状态快照和版本兼容语义。
- 壳层尽量稳定：优先更新产品内核，不频繁替换 desktop app 或 npm global package。
- 兼容未签名桌面分发：不依赖 macOS / Windows 官方 app updater 作为主路径。
- 设计简单：复用已有 launcher / bundle / manifest / signature / rollback 能力，只补必要抽象。
- 代码尽量少：避免为每个平台写一套完整更新系统，平台差异只放在 host adapter。

## 2. 背景与现有基础

NextClaw 已经有一批桌面更新基础设施：

- `apps/desktop/src/launcher/services/update.service.ts`
  - 读取 update manifest。
  - 校验 manifest signature。
  - 下载 bundle。
  - 校验 `bundleSha256` 和 `bundleSignature`。
  - 解压并安装到版本目录。
- `apps/desktop/src/launcher/services/update-coordinator.service.ts`
  - 管理 `checking`、`update-available`、`downloading`、`downloaded`、`up-to-date`、`failed` 状态。
  - 自动检查固定开启，检查到更新后等待用户明确下载。
  - 支持 `applyDownloadedUpdate`。
- `apps/desktop/src/launcher/services/bundle-lifecycle.service.ts`
  - 通过 current pointer / previous pointer 切换版本。
  - 支持 candidate 版本、健康确认和回滚。
- `apps/desktop/src/launcher/stores/launcher-state.store.ts`
  - 已有 `currentVersion`、`previousVersion`、`candidateVersion`、`lastKnownGoodVersion`、`badVersions`、`downloadedVersion` 等状态。
- `packages/nextclaw-ui/src/features/system-status/components/desktop-update-config.tsx`
  - 已有更新设置 UI：检查、下载、应用和通道；自动检查和手动下载均为固定产品策略，不提供开关。
- `packages/nextclaw/src/cli/shared/services/update/self-update.service.ts`
  - 目前 npm CLI 更新仍是旧式全局包自更新：通过 `npm view` 检查，再执行 `npm i -g nextclaw`。

因此本设计不是重做更新系统，而是把现有桌面 bundle 更新底座推广成统一更新模型，并让 npm 形态逐步迁移到同一套 runtime bundle 机制。

## 3. 核心原则

### 3.1 自动检查，手动下载，手动应用

系统固定每两小时自动检查更新，不提供关闭配置。检查到新版本后停在 `update-available`，只有用户明确点击后才下载。

系统不自动下载、不自动应用、不自动重启，也不偷偷切换版本。

用户点击“更新”之后，才允许执行版本切换。

### 3.2 壳稳定，内核更新

NextClaw 的更新单元分两层：

- Host / Launcher：桌面 Electron 壳、npm global launcher、未来其它 host。
- Product Runtime Bundle：可被 host 启动的产品内核资产，当前桌面 bundle 已包含 `runtime/`、`ui/`、空 `plugins/` 占位目录和 `manifest.json`；npm 形态应复用同一 contract，但具体包内容必须以实现阶段验收为准。

常规更新只替换 Product Runtime Bundle。

Host / Launcher 只在必须改变启动、IPC、preload、验签、回滚、bundle layout 等 host 合同时才升级。

### 3.3 默认禁止提升 `minimumLauncherVersion`

`minimumLauncherVersion` 是兼容性下限，不是当前 launcher 版本镜像。

默认禁止提升。只有新 bundle 真的依赖旧 launcher 无法理解或无法安全执行的 host 合同时，才允许提升。

允许提升的情况：

- bundle manifest 结构变化，旧 launcher 无法解析。
- bundle 目录布局或 entrypoint 合同变化，旧 launcher 无法启动。
- 更新验签、回滚、生命周期协议发生破坏性变化。
- 新 bundle 必须依赖新版 launcher 的 IPC、preload、native 能力。
- 状态迁移或恢复必须由新版 launcher 执行，否则会损坏数据或无法回滚。

禁止提升的情况：

- 纯 UI 改动。
- runtime / server / plugin 改动仍在 bundle 内自洽。
- bugfix、重构、文案、样式调整。
- 因为本次也发布了新版 launcher。
- 为了让版本号看起来一致。

### 3.4 简单优先

第一阶段只抽象必要能力：

- 一个统一 `UpdateSnapshot`。
- 一个统一 `UpdateManager` 状态机。
- 少量 host adapter。

不引入复杂插件框架、过度泛化的下载管线或平台矩阵 DSL。

### 3.5 共享契约优先

NextClaw 更新系统会长期承载桌面、npm、未来云端/移动/企业 host 等多种分发形态。

因此，能统一的字段、语义、校验规则和 TypeScript 类型必须统一；不能让不同 launcher 各自定义一套相似但不完全兼容的字段。

允许不同 host 拥有不同实现，但不允许不同 host 拥有互相漂移的核心协议。

必须共享的内容：

- update manifest 字段与签名序列化规则。
- bundle manifest 字段与兼容性规则。
- `UpdateSnapshot` 状态字段。
- `minimumLauncherVersion` / `minimumHostVersion` 的语义。
- 下载进度字段。
- current / previous / candidate / lastKnownGood / badVersions 的版本生命周期语义。
- blocked 状态、阻塞原因和恢复建议的含义。

host adapter 只处理差异：

- manifest URL 如何解析。
- bundle 如何存放。
- 如何启动 runtime。
- 点击应用后是否需要重启 app、重启 service，或等待下次 CLI 启动。
- host 太旧时给用户什么升级命令或入口。

## 4. 统一架构

```text
NextClaw UI / System Status
  -> UpdateManager
    -> UpdateAdapter
      -> DesktopBundleUpdateAdapter
      -> NpmRuntimeBundleUpdateAdapter
```

### 4.1 UpdateManager

`UpdateManager` 负责统一状态机：

- 检查更新。
- 下载更新。
- 发布下载进度。
- 应用已下载更新。
- 暴露统一 snapshot 给 UI。

它不直接知道 Electron、npm、平台路径细节。

它应该依赖共享 TypeScript contract，而不是依赖某个桌面专属类型。

### 4.2 UpdateAdapter

adapter 负责不同 host 的差异：

- manifest URL 如何解析。
- bundle 存放在哪里。
- 如何下载和校验。
- 点击应用后如何让新版本生效。
- 是否需要重启 app、重启 service、或下次 CLI 启动生效。

adapter 必须实现同一个接口。建议第一版保持很小：

```ts
type UpdateAdapter = {
  readonly installationKind: InstallationKind;
  getCurrentState: () => Promise<UpdateHostState>;
  checkForUpdate: () => Promise<UpdateCheckResult>;
  downloadUpdate: (update: AvailableUpdate, reporter: UpdateProgressReporter) => Promise<DownloadedUpdate>;
  applyDownloadedUpdate: (update: DownloadedUpdate) => Promise<ApplyUpdateResult>;
};
```

这个接口只表达生命周期，不表达平台细节。Electron IPC、npm cache、bundle layout、service restart 都应该留在具体 adapter 内部。

### 4.3 统一状态

建议统一快照：

```ts
type UpdateStatus =
  | "idle"
  | "checking"
  | "update-available"
  | "downloading"
  | "downloaded"
  | "applying"
  | "restart-required"
  | "up-to-date"
  | "blocked"
  | "failed";

type InstallationKind =
  | "desktop-bundle"
  | "npm-runtime-bundle"
  | "npm-global"
  | "unknown";

type UpdateProgress = {
  downloadedBytes: number;
  totalBytes: number | null;
  percent: number | null;
};

type UpdateBlockReason =
  | "host-too-old"
  | "unsupported-installation"
  | "signature-verification-unavailable";

type UpdateSnapshot = {
  status: UpdateStatus;
  installationKind: InstallationKind;
  channel: "stable" | "beta";
  hostVersion: string | null;
  currentVersion: string | null;
  availableVersion: string | null;
  downloadedVersion: string | null;
  minimumHostVersion: string | null;
  releaseNotesUrl: string | null;
  lastCheckedAt: string | null;
  progress: UpdateProgress | null;
  canApplyInApp: boolean;
  requiresRestart: boolean;
  blockReason: UpdateBlockReason | null;
  recoveryCommand: string | null;
  errorMessage: string | null;
};
```

桌面现有 `DesktopUpdateSnapshot` 可以先映射到这个结构，后续再逐步改名和下沉。

### 4.4 建议代码组织

共享契约需要一个明确 owner，但不应为了“共享”就条件反射式新增包。

判断顺序：

1. 优先放进已有且职责匹配的产品 contract 模块。
2. 只有现有模块依赖方向不成立、发布边界不成立，或职责会被明显污染时，才考虑新增包。
3. 新增包必须解决真实边界问题，而不是把一个小模块过早拆成独立器官。

结合当前仓库，第一推荐 owner 是 `@nextclaw/kernel`。

理由：

- `@nextclaw/kernel` 已经定位为 NextClaw 产品 kernel skeleton，承载 agents、tasks、sessions、context、tools、skills、providers、automation、channels 等产品级类型与 manager。
- update contract 属于 NextClaw 产品操作层的基础生命周期能力，不是桌面专属，也不是 npm 专属。
- `@nextclaw/kernel` 当前比 `@nextclaw/core` 更适合作为纯产品域 contract owner；`@nextclaw/core` 已经包含配置、provider、channel、agent 执行等大量运行时业务。
- `@nextclaw/runtime` 更像 runtime assembly，不适合承载所有 host 都要遵守的协议源头。

建议位置：

```text
packages/nextclaw-kernel/
  src/
    types/
      update.types.ts
      update-manifest.types.ts
      update-lifecycle.types.ts
    managers/
      update.manager.ts
```

如果实现阶段发现 `@nextclaw/kernel` 引入方向会导致循环依赖，或者桌面 launcher 不适合依赖整个 kernel 包，再考虑两种收敛方案：

```text
方案 A：调整 @nextclaw/kernel 导出边界，让纯 types/contract 可轻量引用。
方案 B：新增极小 @nextclaw/update-contract 包，只承载不可再归属的纯 contract。
```

新增包必须满足以下条件才允许：

- desktop launcher、npm launcher、UI、release scripts 都需要同一 contract。
- 放入 `@nextclaw/kernel` 会形成无法接受的依赖环或发布耦合。
- contract 已经稳定到值得独立发布。
- 包内只放纯类型、纯校验、纯序列化，不放 host 实现。

无论最终放在哪里，共享 contract 必须满足：

- 不依赖 Electron。
- 不依赖 Node-only 文件系统 API。
- 不依赖 npm CLI 实现。
- 不依赖 React 或 UI。
- 类型和纯校验逻辑可被 desktop launcher、npm launcher、server 和 UI 同时引用。

建议实现分层：

```text
shared update contracts
  纯类型、枚举、manifest 序列化、版本比较、错误分类

shared update core
  状态机、下载进度模型、通用校验编排

host adapters
  desktop bundle adapter
  npm runtime bundle adapter

UI binding
  把 UpdateSnapshot 渲染成系统状态和设置页操作
```

禁止的组织方式：

- 把通用字段定义在 `apps/desktop` 内，再让 npm 反向引用 desktop。
- 在 UI 组件里定义 update 状态枚举。
- 让 npm updater 和 desktop updater 各自复制一份 manifest type。
- 未评估现有 owner 就新增 `packages/nextclaw-update-contracts`。
- 为了短期省事把核心 contract 写成一组散落的普通对象常量。

### 4.5 类型命名原则

面向长期基础设施，命名应避免把通用概念绑定到当前 host。

推荐：

- `UpdateManifest`
- `UpdateSnapshot`
- `InstallationKind`
- `HostVersion`
- `ProductBundleVersion`
- `MinimumHostVersion`
- `UpdateProgress`
- `UpdateLifecycleState`
- `UpdateBlockReason`

仅在具体 adapter 内使用 host 前缀：

- `DesktopBundleUpdateAdapter`
- `NpmRuntimeBundleUpdateAdapter`

避免：

- 在共享层使用 `DesktopUpdateSnapshot`。
- 在共享层使用 `launcherVersion` 表达所有 host。共享层应优先用 `hostVersion`，桌面 adapter 再映射到 `launcherVersion`。
- 在共享层使用 npm 专属字段表达产品内核版本。

## 5. 检测新版本

### 5.1 统一检测来源

优先使用 NextClaw update manifest，而不是让每种安装形态自己猜版本。

manifest 按 channel / platform / arch / host kind 区分：

```text
desktop-updates/<channel>/manifest-<channel>-<platform>-<arch>.json
npm-runtime-updates/<channel>/manifest-<channel>-<platform>-<arch>.json
```

manifest 示例：

```json
{
  "channel": "stable",
  "platform": "darwin",
  "arch": "arm64",
  "hostKind": "desktop-bundle",
  "latestVersion": "0.4.3",
  "minimumLauncherVersion": "0.0.148",
  "bundleUrl": "https://example.com/nextclaw-0.4.3.bundle.zip",
  "bundleSha256": "...",
  "bundleSignature": "...",
  "releaseNotesUrl": "https://example.com/releases/0.4.3",
  "manifestSignature": "..."
}
```

说明：现有桌面发布链路里的 wire 字段仍是 `minimumLauncherVersion`。共享层可以把它规范化为 `minimumHostVersion` 语义，但第一阶段不应为了命名统一破坏既有桌面 manifest 合同。若未来要改 wire 字段，必须走兼容迁移。

### 5.2 检测流程

```text
读取当前 host kind / channel / platform / arch
  -> 解析 manifest URL
  -> 下载 manifest
  -> 校验 manifestSignature
  -> 校验 channel / platform / arch / hostKind
  -> 比较 latestVersion 与 currentVersion
  -> 检查 minimumLauncherVersion
```

结果：

- 没有新版本：`up-to-date`。
- 有新 bundle 且 host 兼容：`update-available`。
- 有新 bundle 但 host 太旧：`blocked`，`blockReason = "host-too-old"`，展示升级 launcher 的恢复命令。
- manifest 或签名错误：`failed`。

### 5.3 npm registry 的位置

`npm view nextclaw version` 不应该作为产品内核更新的主检测路径。

它只用于：

- 检测 npm launcher 自身是否有新版本。
- 当 `minimumLauncherVersion` / `minimumHostVersion` 不满足时，给出可执行的升级命令。

## 6. 源码包、Host 和 Bundle 的边界

为了避免代码组织混乱，本设计把三个概念严格分开。

### 6.1 源码包

源码包是仓库里的 TypeScript / JavaScript package。

当前相关职责：

- `@nextclaw/kernel`：产品内核 contract 与系统生命周期 owner 的长期归属。
- `@nextclaw/core`：foundation primitives，例如 config、session、provider、channel、agent、bus。
- `@nextclaw/runtime`：官方 runtime distribution / assembly，回答“官方默认装配哪些能力”。
- `nextclaw`：npm 用户入口包，长期应成为 npm launcher，而不是唯一可变产品本体。
- `apps/desktop`：Electron desktop host / launcher。
- `@nextclaw/ui`：展示层，消费 update snapshot，不定义更新协议。

### 6.2 Host / Launcher

Host 是用户机器上稳定存在的入口层。

桌面 host：

```text
NextClaw Desktop.app
  -> Electron main/preload/window
  -> desktop launcher
  -> 读取 current pointer
  -> 启动某个 product bundle
```

npm host：

```text
npm global nextclaw
  -> bin/nextclaw
  -> npm runtime launcher
  -> 读取 current pointer
  -> 启动某个 product bundle
```

npm 本身不提供“下载但不安装、点击后切版本”的能力。这个能力来自 NextClaw 自己的 npm launcher 和 runtime-bundles 目录。

### 6.3 Product Runtime Bundle

Product Runtime Bundle 是发布产物，不是源码包。

它是 host 可以下载、验签、解压、安装并启动的产品内核资产。现有桌面 bundle 已经是这个方向：

```text
bundle/
  manifest.json
  runtime/
  ui/
  plugins/
```

其中 `runtime/` 是部署后的 `nextclaw` 运行体，`ui/` 是构建后的 UI 静态资源，`plugins/` 当前只是空占位目录。

重要边界：

- `@nextclaw/runtime` 是源码包。
- Product Runtime Bundle 是构建产物。
- `runtime-bundles/versions/<version>` 是用户机器上的已安装发布产物目录。
- 不应把 `runtime-bundles/versions` 做进 `@nextclaw/runtime` 源码包内部。

## 7. 用户触发下载

### 7.1 下载对象

用户点击下载后，下载对象是 Product Runtime Bundle，不是安装命令。

禁止把下面命令用于更新包下载阶段：

```bash
npm install -g nextclaw
```

因为它会直接覆盖全局安装，等于下载和应用同时发生。

### 7.2 下载流程

```text
fetch bundleUrl
  -> 读取 Content-Length
  -> stream 写入 staging 文件
  -> 每个 chunk 更新 downloadedBytes
  -> 发布 progress
  -> 下载完成后校验 sha256
  -> 校验 bundleSignature
  -> 解压到 staging directory
  -> 校验 bundle/manifest.json
  -> 安装到 versions/<version>
  -> 记录 downloadedVersion
  -> 状态变为 downloaded
```

现有桌面 `downloadBundle` 使用 `arrayBuffer()` 一次性读取，只能显示“下载中”。后续应改为 stream 下载，以支持进度。

### 7.3 Bundle 内容与用户数据边界

现有桌面 bundle 的目录结构来自 `apps/desktop/scripts/update/services/build-product-bundle.service.mjs`：

```text
bundle/
  manifest.json
  runtime/
  ui/
  plugins/
```

其中 `plugins/` 当前只是构建脚本创建的空目录和 `.keep`，并不等于用户已安装插件目录。

因此，统一更新系统必须明确两类目录：

```text
版本目录：
  host 管理的可运行产品资产，只能由更新系统安装、切换、清理。

用户目录：
  用户配置、workspace、sessions、skills、用户安装插件、日志、缓存。
  更新系统不得因为切换 runtime version 而迁移、覆盖或删除这些内容。
```

当前事实：

- 桌面 runtime home 通过 `NEXTCLAW_HOME` 指向用户数据目录，默认是 `~/.nextclaw`。
- 桌面 bundle 数据目录通过 Electron `userData` 管理，用于 `versions/`、`staging/`、`current.json`、`previous.json` 和 launcher state。
- 用户插件发现主要基于配置与 workspace，例如 `workspace/.nextclaw/extensions`，不属于 desktop bundle `versions/<version>/plugins`。

统一原则：

- bundle 可以包含随产品发布的内置资产或占位目录。
- bundle 不得包含或接管用户安装态。
- prune 只能清理 host 管理的 `versions/` 和 `staging/`，不得触碰 `NEXTCLAW_HOME`、workspace、用户插件目录或用户数据。
- 如果未来 bundle 内置插件集真的要发挥作用，必须通过现有插件加载机制显式接入，并与用户插件目录保持优先级和覆盖规则清晰。

### 7.4 存储位置

桌面版沿用现有 layout：

```text
<launcher data>/
  versions/
    0.4.2/
    0.4.3/
  staging/
  state.json
  current
  previous
```

npm runtime bundle 版建议使用：

```text
~/.nextclaw/
  launcher/
    state.json
  runtime-bundles/
    versions/
      0.4.2/
      0.4.3/
    staging/
    current
    previous
```

这里是 npm host 的建议位置，不是当前既成事实。实现前必须先验证它不会和现有 `~/.nextclaw/config.json`、`workspace/`、`sessions/`、`skills/`、用户插件目录发生冲突。

路径可以不同，但字段语义、状态机和更新 contract 应一致。

## 8. 用户点击更新后如何生效

### 8.1 生效机制

新版本生效不靠覆盖当前版本目录，而靠切换 current pointer。

下载完成后：

```text
versions/
  0.4.2/
  0.4.3/

current -> 0.4.2
downloadedVersion = 0.4.3
```

用户点击更新：

```text
校验 versions/0.4.3 仍然存在且 manifest 合法
  -> previous -> 0.4.2
  -> current -> 0.4.3
  -> candidateVersion = 0.4.3
  -> candidateLaunchCount = 0
  -> downloadedVersion = null
  -> 重启 app / service，或等待下次 CLI 启动
```

### 8.2 桌面版生效

桌面版点击更新后：

- 切换 current pointer。
- 重启 Electron app 或 runtime service。
- launcher 启动时读取 current pointer。
- 从 `versions/<currentVersion>` 启动 UI 和 runtime。

### 8.3 npm runtime bundle 版生效

npm 全局包逐步变成稳定 launcher / shim。

`nextclaw` 命令启动时：

```text
读取 npm host 的 current pointer
  -> 定位 runtime-bundles/versions/<currentVersion>
  -> 启动该版本 runtime
```

点击更新后只切 current pointer。

这使 npm 形态和桌面形态统一：

- 桌面：Electron 壳不变，切 bundle。
- npm：npm launcher 不变，切 bundle。

### 8.4 npm 的“替换”到底替换什么

npm 方案里不会在自动更新阶段替换 npm global package。

替换对象是 npm launcher 指向的 runtime bundle：

```text
npm global nextclaw
  version: launcher 0.2.0
  path: npm 全局安装目录

~/.nextclaw/runtime-bundles/
  current -> 0.18.13
  previous -> 0.18.12
  versions/
    0.18.12/
    0.18.13/
```

用户运行 `nextclaw` 时：

```text
bin/nextclaw
  -> npm launcher
  -> read current
  -> spawn runtime-bundles/versions/<current>/runtime entrypoint
```

用户点击下载时：

```text
下载 0.18.13 bundle
  -> 校验
  -> 解压到 runtime-bundles/versions/0.18.13
  -> downloadedVersion = 0.18.13
  -> current 仍然是 0.18.12
```

用户点击更新时：

```text
previous = 0.18.12
current = 0.18.13
candidateVersion = 0.18.13
downloadedVersion = null
```

旧 npm 包不变。旧 runtime bundle 也不立即删除，它保留为 previous / rollback 目标。

这要求 npm 包长期收敛为：

```text
nextclaw npm package
  bin/nextclaw
  dist/launcher/...
  resources/seed-product-bundle.zip   # 可选，需单独验证体积与职责
```

如果没有 seed bundle，npm launcher 首次运行可以走远程 manifest 下载初始 bundle；如果有 seed bundle，则首次运行可以先解压 seed 形成 `current`。这两种方式都必须保证不覆盖用户数据目录。

### 8.5 npm launcher 升级不是更新主链路

`npm install -g nextclaw@latest` 不属于 Product Runtime Bundle 更新主链路，也不需要被设计成一个独立 update adapter。

它只是在 host 太旧时暴露给用户的手动动作：

```text
blocked
  blockReason = "host-too-old"
  recoveryCommand = "npm install -g nextclaw@latest"
```

这表示当前 npm launcher 壳不满足新 bundle 的最低 host 要求。系统可以告诉用户需要升级壳，但不应把这个提示包装成一套平行 updater。

因此，npm 形态的长期主路径仍然只有：

```text
NpmRuntimeBundleUpdateAdapter
```

它负责检查、下载、校验 runtime bundle，并在用户确认后切 current pointer。

### 8.6 桌面与 npm 的统一点和差异点

统一点：

- 都读取同一语义的 update manifest。
- 都使用 `latestVersion`、`minimumHostVersion`、bundle hash、bundle signature。
- 都把下载完成和应用生效拆成两步。
- 都保留 current / previous / downloaded / candidate / lastKnownGood / badVersions 语义。
- 都通过切 current pointer 让新产品内核生效。

差异点：

- 桌面 host 是 Electron launcher，当前已有 bundle lifecycle 实现。
- npm host 是全局 `nextclaw` launcher，当前尚未完成 runtime bundle 化，需要独立设计启动 shim。
- 桌面 host 的数据目录是 Electron `userData`；npm host 应在 `~/.nextclaw` 下选择不会污染现有用户数据的子目录。
- 桌面点击应用通常需要重启 app 或 runtime service；npm 点击应用后可能是重启服务，也可能是下一次 CLI 启动生效。
- 桌面可以依赖 packaged seed bundle；npm 可以考虑 seed bundle，但必须先证明不会扩大 npm 包职责或破坏安装体积。

这意味着：统一的是 contract 和生命周期，不是强行让两个 host 的文件路径、启动命令、打包脚本完全一致。

## 9. 多版本并存与回滚

统一保留以下版本角色：

- `currentVersion`：当前正在使用的版本。
- `previousVersion`：上一版本，用于回滚。
- `lastKnownGoodVersion`：最近确认健康的版本。
- `downloadedVersion`：已下载但尚未应用的版本。
- `candidateVersion`：刚切换过去、尚未确认健康的新版本。
- `badVersions`：启动失败或被隔离的版本。

启动恢复流程：

```text
如果存在 candidateVersion：
  如果这是切换后的第一次启动：
    candidateLaunchCount + 1
    允许试跑
  否则：
    认为 candidate 未成功确认健康
    回滚到 previousVersion 或 lastKnownGoodVersion
    badVersions 加入 candidateVersion
```

健康确认条件：

- runtime 进程成功启动。
- UI 或 API 健康检查通过。
- bundle manifest、runtime、ui、plugins 目录仍可读。
- 必要的启动端点能返回正常响应。

确认健康后：

```text
candidateVersion = null
candidateLaunchCount = 0
lastKnownGoodVersion = currentVersion
```

清理策略：

- 保留 current。
- 保留 previous 或 lastKnownGood。
- 保留 downloaded。
- 删除未被状态引用的旧版本和 staging 临时目录。

## 10. 平台差异

### 10.1 macOS / Windows 桌面版

未签名阶段不依赖标准 autoUpdater 替换整个 app。

主路径：

```text
Electron launcher 不变
  -> 下载 signed product bundle
  -> 切 current pointer
  -> 重启 app
```

首次安装仍可能需要用户处理 Gatekeeper / SmartScreen。之后常规产品更新发生在 bundle 层。

### 10.2 Linux 桌面版

Linux 没有统一官方桌面自动更新通道，仍走 bundle 层更新。

AppImage、deb、apt repo 等只负责安装或升级 host。产品内核仍优先通过 bundle 更新。

### 10.3 npm 安装版

短期：

- npm global install 继续作为用户入口。
- 更新包下载不得执行 `npm install -g`。
- 若当前 npm launcher 不支持 runtime bundle，系统只提示升级 launcher，不额外设计 tgz 预下载主链路。

长期：

- npm global package 只做 launcher。
- runtime bundle 存在 `~/.nextclaw/runtime-bundles/versions` 或等价隔离子目录。
- 更新靠 current pointer 生效。
- `npm install -g` 只用于升级 launcher。

## 11. 代码组织

### 11.1 三层组织

实现时按三层组织，避免桌面和 npm 横向复制两套系统：

```text
1. update contract
2. update core lifecycle
3. host adapter
```

推荐落点：

```text
packages/nextclaw-kernel/
  src/types/update.types.ts
  src/types/update-manifest.types.ts
  src/types/update-lifecycle.types.ts
  src/managers/update.manager.ts

apps/desktop/src/launcher/update/
  desktop-bundle-update.adapter.ts
  desktop-bundle-layout.store.ts
  desktop-bundle-download.service.ts
  desktop-bundle-activation.service.ts

packages/nextclaw/src/cli/launcher/
  npm-runtime-launcher.ts
  npm-runtime-bundle-update.adapter.ts
  npm-runtime-bundle-layout.store.ts
  npm-runtime-bundle-bootstrap.service.ts
```

第一阶段不要求立即移动现有桌面文件。可以先由 desktop adapter 包装现有 `DesktopUpdateCoordinatorService` / `DesktopUpdateService`，再逐步收敛命名。

### 11.2 各层职责

`@nextclaw/kernel`：

- 定义 `UpdateManifest`、`UpdateSnapshot`、`UpdateStatus`、`UpdateBlockReason`。
- 定义 current / previous / candidate / rollback 的生命周期语义。
- 提供最小 `UpdateManager` 状态机或接口。
- 不依赖 Electron、React、npm CLI、Node 文件系统实现细节。

`apps/desktop`：

- 负责 Electron `userData` 路径。
- 负责桌面 bundle 下载、验签、解压、安装、切 pointer。
- 负责 app / service 重启。
- 不定义共享 manifest / snapshot 类型。

`packages/nextclaw`：

- 负责 npm global launcher。
- 负责 `~/.nextclaw/runtime-bundles` 或等价目录布局。
- 负责 npm host 的首次 bundle bootstrap、启动 shim、bundle 切换。
- 不把 `npm install -g` 当作更新包下载或常规更新主路径。

`@nextclaw/runtime`：

- 继续作为官方 runtime assembly 源码包。
- 不承载 runtime-bundles 版本目录。
- 不成为 update contract owner。

`@nextclaw/ui`：

- 只消费统一 `UpdateSnapshot`。
- 展示状态、进度、按钮和阻塞原因。
- 不定义更新协议。

### 11.3 禁止混淆

禁止：

- 把用户机器上的 `runtime-bundles/versions` 放进 `@nextclaw/runtime` 源码包。
- 让 desktop 和 npm 分别复制一份 update manifest type。
- 在 UI 里发明状态枚举。
- 把 npm launcher 升级命令包装成一个 updater adapter。
- 让 bundle 更新清理用户数据、workspace、skills、sessions 或用户插件目录。

## 12. 开发态边界

统一更新系统只应该默认影响安装态，不应该默认改变日常开发态。

### 12.1 基本原则

```text
生产 / 安装态：
  host launcher -> current pointer -> runtime bundle

开发态：
  host launcher -> repo source / dev build
```

开发态如果强制读取 `current` pointer 并启动已安装 bundle，会让源码修改、热调试、局部构建都变复杂。因此开发态默认绕过 installed bundle resolution。

### 12.2 桌面开发态

桌面开发态应继续使用仓库内 runtime script 或 dev build。

当前桌面 dev 脚本已经显式设置 runtime 入口：

```text
NEXTCLAW_DESKTOP_RUNTIME_SCRIPT=../../packages/nextclaw/dist/cli/app/index.js
```

因此桌面开发态默认行为应是：

```text
Electron shell
  -> 使用 repo 构建产物 / dev runtime script
  -> 不读取 production current pointer
  -> 不自动检查、下载或切换真实更新 bundle
```

更新系统在桌面开发态只用于显式验证：

- 本地 update manifest 测试。
- 本地 bundle 下载 / 验签 / 切换 smoke。
- 设置页或系统状态 UI 的状态展示调试。

### 12.3 npm 开发态

npm launcher bundle resolution 只适用于真正的安装态 `nextclaw` 命令。

以下场景应视为开发态，默认直接运行源码或构建产物：

```bash
pnpm -C packages/nextclaw dev
pnpm -C packages/nextclaw start
tsx packages/nextclaw/src/cli/app/index.ts
```

只有从 npm global package 的 bin 入口启动时，才默认走：

```text
npm launcher -> ~/.nextclaw/launcher/runtime-bundles/current
```

### 12.4 更新链路开发入口

需要测试 updater 时必须显式打开测试路径，而不是污染普通开发路径。

推荐保留或新增类似入口：

```bash
pnpm -C apps/desktop validation:serve-local-update
pnpm -C apps/desktop smoke:update
```

npm host 后续可增加显式 smoke：

```bash
NEXTCLAW_UPDATE_MANIFEST_URL=http://127.0.0.1:xxxx/manifest.json \
nextclaw update:dev-smoke
```

原则：

- 日常开发不走 production bundle pointer。
- 更新链路测试显式指定 manifest、channel 和临时目录。
- smoke 必须使用隔离 `NEXTCLAW_HOME` 或等价临时目录，不能把测试数据写入真实用户 home。

## 13. UI 行为

统一 UI 状态：

- `已是最新`
- `正在检查更新`
- `发现新版本`
- `正在下载 42%`
- `更新已下载`
- `点击更新`
- `正在应用`
- `需要重启`
- `更新被阻塞：需要升级壳`
- `更新失败，可重试`

版本展示建议：

- 主版本：产品内核版本，也就是 bundle version。
- 高级信息：host / launcher version。

按钮策略：

- `检查更新`：始终可见，忙碌时 disabled。
- `下载更新`：有可用 bundle 且未下载时可点。
- `更新` / `重启更新`：已下载后可点。
- `升级壳`：host 太旧时显示手动命令或下载入口。

## 14. 分阶段实现建议

不建议一次性完成桌面 + npm 的完整统一更新系统。合理拆成两个阶段。

### 14.1 第一阶段：统一 contract + 桌面闭环

目标：不改变 npm 启动模型，先把已有桌面能力收拢成统一语义，并补齐用户可见下载进度。

1. 给现有桌面下载增加 stream progress。
2. 把 `DesktopUpdateSnapshot` 映射为通用 `UpdateSnapshot`，先不大规模重命名。
3. UI 在系统状态区域展示版本、下载进度和已下载更新按钮。
4. 保留现有桌面 `DesktopUpdateCoordinatorService` 作为第一版 adapter。
5. 在 `@nextclaw/kernel` 增加 update contract/types，先不强行搬迁所有桌面实现。
6. npm 侧只增加状态判断和阻塞提示，避免继续把 `npm i -g` 当更新包下载。

暂不做：

- 大规模重构所有 desktop updater 文件。
- 引入全新 update framework。
- 一次性完成 npm runtime bundle launcher 迁移。
- 默认提升 `minimumLauncherVersion`。

验收重点：

- 桌面能显示下载进度。
- 下载完成后不立即切换版本。
- 点击更新后沿用现有 current pointer 生效。
- 旧的桌面回滚能力不退化。
- npm 更新包下载阶段不会执行 `npm install -g`。

### 14.2 第二阶段：npm launcher runtime bundle 化

目标：把 npm global package 从“完整产品本体”收敛为稳定 launcher，让 npm 安装态也能使用 runtime bundle + current pointer 更新。

需要实现：

1. npm launcher 启动 shim。
2. `~/.nextclaw/launcher/runtime-bundles` 或等价隔离目录布局。
3. npm host 的 current / previous / candidate / rollback 状态。
4. npm runtime bundle 下载、验签、安装和切换。
5. 首次启动 bootstrap：远程下载初始 bundle，或经过体积与职责评估后使用 seed bundle。
6. npm 安装态与开发态判定，确保 pnpm/tsx/repo dev 不走 installed bundle pointer。

验收重点：

- 全局 npm 包版本不因 runtime bundle 更新而变化。
- 点击更新只切 current pointer。
- 新版 runtime 启动失败能回滚到 previous。
- 更新系统不覆盖 `~/.nextclaw/config.json`、workspace、sessions、skills、用户插件目录。
- 开发态默认不受 runtime bundle pointer 影响。

## 15. 验证要求

桌面 bundle 更新验证：

- 能检查到本地测试 manifest。
- 能显示下载进度。
- 下载完成后 current 不变、downloadedVersion 有值。
- 点击更新后 current pointer 切换。
- 重启后新版本生效。
- 健康确认后 candidate 清空。
- 模拟坏 bundle 时能回滚并隔离 badVersion。

npm 验证：

- 更新包下载阶段不会执行 `npm install -g`。
- host 太旧时进入 `blocked`。
- `blockReason` 为 `host-too-old`。
- `recoveryCommand` 明确提示升级 npm launcher。
- runtime bundle 支持后，点击更新只切 current pointer，不重装 npm global package。
- npm global package 版本不因 runtime bundle 更新而变化。
- previous runtime bundle 可用于回滚。
- 开发态通过 repo / pnpm / tsx 启动时不读取 production current pointer，除非显式进入 updater smoke。

governance 验证：

- release manifest 的 `minimumLauncherVersion` 与治理配置一致。
- 若提升 `minimumLauncherVersion`，发布说明必须说明旧 launcher 不能安全运行的具体原因。
- 纯 UI、runtime、plugin、bugfix、refactor 不得提升 `minimumLauncherVersion`。

## 16. 非目标

本设计不要求：

- 未签名阶段替换整个 `.app` / installer。
- 默认静默安装更新。
- npm 安装版立刻完全摆脱 `npm install -g`。
- 一次性统一所有历史 update 命令输出。
- 让用户无感重启正在运行的工作台。
- 开发态默认走 installed runtime bundle。

## 17. 结论

NextClaw 更新系统应统一为：

```text
manifest 检测
  -> 用户点击下载 bundle
  -> hash / signature 校验
  -> 多版本并存
  -> 用户点击切 current pointer
  -> candidate 健康确认
  -> 失败回滚
```

桌面版和 npm 版的长期差异不应该是两套更新逻辑，而只是不同 host adapter：

- 桌面 host：Electron launcher 启动 bundle。
- npm host：npm launcher 启动 bundle。

这条路线符合 NextClaw 的长期愿景：让系统具备自感知和自治能力，同时保持用户可控、可回滚、可治理。
