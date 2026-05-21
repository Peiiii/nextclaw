# NextClaw Portable Edition Design

## 1. 文档目的

本文定义 NextClaw Desktop 新增 **Portable Edition** 的产品与技术方案。

这里的 Portable Edition 不是“安装器里的一个 portable 选项”，也不是把默认桌面版改成便携模式，而是一个独立下载产物：

```text
NextClaw-Portable-<version>-win-x64.zip
NextClaw-Portable-<version>-win-arm64.zip
```

用户下载后解压，把整个目录放到 U 盘或任意可写目录，双击即可使用。NextClaw 自己管理的数据默认跟随这个目录移动。

本文用于方案 review。通过 review 后再进入实现。

## 2. 愿景对齐

Portable Edition 增强的是 NextClaw 的“开箱即用”和“个人操作层”属性：

- 用户不需要安装、不需要管理员权限、不需要理解系统数据目录。
- 用户可以把自己的 NextClaw 工作台、会话、配置、插件和运行时状态带到另一台电脑上。
- Portable Edition 是新的分发形态，不是孤立功能点；它提升的是 NextClaw 作为统一入口的可携带性和进入门槛。

边界也必须清楚：Portable Edition 追求 NextClaw 自有数据随目录走，不承诺操作系统完全零痕迹。系统仍可能留下最近打开记录、系统日志、SmartScreen / Gatekeeper 记录、GPU 或字体缓存等宿主痕迹。

## 3. 产品定义

### 3.1 推荐下载形态

本次 Windows 完整交付范围覆盖 Windows x64 和 Windows arm64：

```text
NextClaw-Portable-<version>-win-x64.zip
NextClaw-Portable-<version>-win-arm64.zip
```

解压后目录结构：

```text
NextClaw-Portable/
  NextClaw Desktop.exe
  nextclaw-portable.json
  data/
    desktop/
      userData/
      launcher/
      versions/
      staging/
      current.json
      previous.json
    runtime-home/
    logs/
```

`data/` 是 Portable Edition 的用户数据根目录，不是安装文件的一部分。它用于保存 NextClaw 自己管理的会话、配置、运行时状态、日志、插件和更新状态。便携包里不预置用户数据；`data/` 可以不存在，第一次启动时由应用创建。

### 3.2 与普通桌面版的关系

普通桌面版继续存在：

```text
NextClaw.Desktop-Setup-<version>-<arch>.exe
```

Portable Edition 新增为独立产物：

```text
NextClaw-Portable-<version>-win-x64.zip
NextClaw-Portable-<version>-win-arm64.zip
```

两者不是同一个安装流程的不同选项。

- 普通桌面版：适合长期安装，写入系统默认 app data，保留开始菜单、桌面快捷方式、卸载入口。
- Portable Edition：适合 U 盘、临时电脑、免安装环境，NextClaw 自有数据写入应用目录旁边的 `data/`。

### 3.3 明确不做

本次 Windows 完整交付不做：

- 不把默认桌面版改成 portable。
- 不让用户在安装器里选择 portable。
- 不承诺一个 exe 内部自写入全部数据。
- 不覆盖 macOS / Linux。
- 不支持 Portable Edition 的应用内自动更新；用户需要下载新版 Portable Edition 包手动替换程序文件。

## 4. 成功标准

本次 Windows 完整交付完成后，必须满足：

- 用户解压 `NextClaw-Portable-<version>-win-x64.zip` 或 `NextClaw-Portable-<version>-win-arm64.zip` 后双击可启动。
- 首次启动自动创建 `./data/`。
- NextClaw 自有桌面状态、launcher 状态、runtime home、运行时 bundle、日志都写入 `./data/`。
- 创建会话、修改配置、重启后数据仍保留在 portable 目录。
- 把整个 `NextClaw-Portable/` 移动到另一个路径后仍可启动。
- 同一台机器可以同时存在、同时运行普通安装版和 Portable Edition，二者数据互不污染、窗口互不抢占。
- 自动化验证能证明默认系统数据目录没有写入 NextClaw 管理数据。

## 5. 核心设计原则

命中的经典设计原则：

- `single-domain-owner`：portable 路径归属必须只有一个事实 owner。
- `information-expert`：知道 portable root、触发条件、路径派生规则的对象负责生成 profile。
- `complete-owner`：Portable owner 必须覆盖路径检测、路径派生、环境注入和 Electron path 应用闭环。
- `responsibility-surface-minimization`：业务层、update 层、runtime 层不直接判断 portable，只消费统一路径结果。
- `no-compatibility-by-default`：不为内部实现保留多套平行路径分支；现有 override 能复用，但最终入口应收敛到 profile。

一句话架构原则：

**Portable Edition 是一个安装形态 profile，不是散落在各处的 `if portable`。**

## 6. 架构方案

### 6.1 核心抽象：`DesktopInstallationProfile`

本次 Windows 完整交付不应只新增一个 `isPortable()` 判断，而应把“安装形态”建模成一个稳定 profile。所有启动期路径、锁、更新能力和打包 marker 都从这个 profile 派生。

建议新增：

```text
apps/desktop/src/services/desktop-installation-profile.service.ts
```

职责：

- 判断当前启动属于普通安装版还是 Portable Edition。
- 解析 installation root / portable root。
- 派生桌面数据目录、Electron `userData`、日志目录、runtime home、profile lock scope。
- 输出更新能力，而不是让 update 层自己判断 portable。
- 生成要注入给 runtime 的 env patch。

建议类型：

```ts
type DesktopInstallationKind = "installed" | "portable";

type DesktopUpdateCapability = {
  supported: boolean;
  blockReason: "unsupported-installation" | null;
  message: string | null;
};

type DesktopInstallationProfile = {
  installationKind: DesktopInstallationKind;
  profileId: string;
  portableRoot: string | null;
  desktopDataDir: string;
  desktopUserDataDir: string;
  runtimeHome: string;
  logsDir: string;
  instanceScopeId: string;
  updateCapability: DesktopUpdateCapability;
  runtimeEnvPatch: Record<string, string>;
};
```

`profileId` 用于区分普通安装版和不同 portable 目录。它不应该由用户手写；portable 模式下可由 portable root 的规范化路径或其 hash 派生，普通安装版使用稳定的 `installed`。`instanceScopeId` 用于 single instance 边界，默认等于 `profileId`。

这个抽象的价值：

- 路径风险降低：其它模块不再自己拼 portable 路径。
- 更新风险降低：update 层只看 `updateCapability`，不直接判断安装形态。
- 同时运行风险降低：single instance 只看 `instanceScopeId`，不再使用全局产品名作为唯一边界。
- 测试成本降低：profile resolver 是纯逻辑，能用单元测试穷举 installed / portable / marker / argv。

### 6.2 Owner 职责边界

`DesktopInstallationProfile` 的本质不是“portable 管理器”，而是桌面启动链路里的**安装形态事实源**。

它负责回答：

- 当前是普通安装版还是 Portable Edition。
- 如果是 Portable Edition，portable root 在哪里。
- 桌面数据、Electron `userData`、日志、runtime home 应该写到哪里。
- 当前实例的 single instance 边界是什么。
- 当前安装形态是否支持应用内更新。
- 启动 runtime 时需要注入哪些环境变量。

它不负责：

- 不创建窗口。
- 不启动 runtime process。
- 不下载或应用更新。
- 不管理会话、插件业务状态或 provider 配置。
- 不决定 UI 怎么展示。
- 不承载长生命周期状态。

因此它不是桌面运行时总控，也不是一个新的“大 manager”。它只在启动早期把安装形态事实算清楚，然后让下游 owner 消费这个事实。

### 6.3 上下游链路

上游只有桌面启动入口：

```text
main.ts
  -> resolveDesktopInstallationProfile(...)
```

输入来自：

```text
process.execPath
process.argv
process.env
Electron 默认 userData / logs
默认 runtime home
nextclaw-portable.json marker
```

下游是桌面启动链路中的具体 owner：

```text
Electron app paths
  <- profile.desktopUserDataDir / profile.logsDir

Desktop logger
  <- profile.logsDir

DesktopBundleLayoutStore
  <- profile.desktopDataDir

RuntimeServiceProcess
  <- profile.runtimeEnvPatch / profile.runtimeHome

Desktop instance lock
  <- profile.instanceScopeId

Desktop update shell/source
  <- profile.updateCapability
```

完整启动链路：

```text
main.ts
  -> resolveDesktopInstallationProfile(...)
  -> applyDesktopInstallationProfile(app, process.env, profile)
  -> createDesktopLogger(profile)
  -> acquireDesktopInstanceLock(app, profile)
  -> new DesktopApplication({ profile, logger }).start()
    -> bundle layout
    -> runtime process
    -> update shell
    -> window
```

### 6.4 抽象力度：单 owner 优先，延迟拆分

本次 Windows 完整交付不应一上来把 resolver / applier / coordinator / marker 都拆成独立 service 文件。合理力度是：

```text
apps/desktop/src/services/desktop-installation-profile.service.ts
```

先承载：

- `resolveDesktopInstallationProfile(...)`
- `applyDesktopInstallationProfile(...)`
- marker schema 的最小读取和校验
- runtime env patch 生成
- update capability 生成
- instance scope id 生成

其中纯解析和副作用应用可以拆成同文件内的函数，而不是立刻升级为多个 owner。

只有出现真实变化点时才延迟拆分：

- 如果 single instance 需要项目自有 lock file、进程探测、二次启动消息协议，再拆 `desktop-instance-coordinator.service.ts`。
- 如果 marker 需要版本迁移、跨脚本共享 schema、兼容多种 portable root 规则，再拆 `desktop-portable-marker.service.ts`。
- 如果 profile resolver 膨胀到覆盖多个平台和安装形态，再拆 resolver / applier。

这个力度符合 `abstraction-calibration`：抽象先保护真实不变量，不为了“看起来有架构”制造空心中转层。

### 6.5 更新能力抽象

Portable Edition 本次 Windows 完整交付不支持应用内更新，这个规则不应散落成 UI 或 update service 里的多个 `if portable`。

建议 profile 输出：

```ts
updateCapability: {
  supported: false,
  blockReason: "unsupported-installation",
  message: "Portable Edition does not support in-app updates yet. Download a newer Portable Edition and keep the data directory."
}
```

update source / update shell 只消费 capability：

```ts
if (!profile.updateCapability.supported) {
  return createBlockedUpdateSnapshot(profile.updateCapability);
}
```

这样以后如果 Portable Edition 要支持完整包更新，只需要改变 profile / capability owner 和对应 updater，不需要在 UI、IPC、update service 多处追改判断。

### 6.6 打包 marker 抽象

`nextclaw-portable.json` 不应只是一个空文件。建议定义成最小 manifest：

```json
{
  "kind": "nextclaw-portable",
  "version": 1
}
```

职责：

- 读取 marker。
- 校验 `kind` 和 `version`。
- 未来如果 portable root 规则升级，可以通过 marker version 做显式迁移。

本次 Windows 完整交付中，marker 读取和校验先放在 `desktop-installation-profile.service.ts` 内部；只有 marker schema 需要跨脚本复用或版本迁移时，才拆成独立 marker owner。打包脚本也应复用同一份 marker schema 或同一份常量，避免运行时和打包时各写一套格式。

### 6.7 启动期对象图

推荐启动顺序：

```text
main.ts
  -> resolveDesktopInstallationProfile(...)
  -> applyDesktopInstallationProfile(app, process.env, profile)
  -> createDesktopLogger(profile)
  -> acquireDesktopInstanceLock(app, profile)
  -> DesktopApplication.start(profile)
```

`DesktopApplication` 构造时接收 profile：

```ts
new DesktopApplication({ profile, logger }).start();
```

下游创建 owner 时继续传 profile 或 profile 中的具体能力对象：

```text
DesktopApplication
  -> DesktopUpdateShellService(profile.updateCapability)
  -> DesktopBundleLayoutStore(profile.desktopDataDir)
  -> RuntimeServiceProcess(profile.runtimeEnvPatch)
```

这样路径、锁、更新能力都来自同一个对象图，不再靠全局函数临时读取环境。

### 6.8 触发方式

Portable Edition 不依赖用户传参。portable 包内自带 marker：

```text
nextclaw-portable.json
```

本次 Windows 完整交付的判断规则：

1. 如果可执行文件同级目录存在 `nextclaw-portable.json`，启用 portable。
2. 如果启动参数带 `--portable-root <path>`，仅用于测试和内部验证。
3. 如果两者都不存在，走普通安装版逻辑。

不推荐把 `NEXTCLAW_PORTABLE=1` 作为用户产品入口。环境变量可以作为测试辅助，但不应成为下载即用的核心触发方式。

### 6.9 Portable root 解析

Windows 本次交付：

```text
portableRoot = dirname(process.execPath)
```

开发和测试中可用 `--portable-root` 覆盖。

macOS 后续不能直接用 `.app/Contents/MacOS` 作为 root，应另行设计 `.app` 外层 portable root。本文不覆盖 macOS。

### 6.10 路径合同

portable 模式下：

```text
desktopDataDir     = <portableRoot>/data/desktop
desktopUserDataDir = <portableRoot>/data/desktop/userData
runtimeHome        = <portableRoot>/data/runtime-home
logsDir            = <portableRoot>/data/logs
```

必须在最早阶段执行：

```ts
app.setPath("userData", profile.desktopUserDataDir);
app.setPath("logs", profile.logsDir);
process.env.NEXTCLAW_DESKTOP_DATA_DIR_OVERRIDE = profile.desktopDataDir;
process.env.NEXTCLAW_DESKTOP_RUNTIME_HOME_OVERRIDE = profile.runtimeHome;
```

现有基础：

- `apps/desktop/src/utils/desktop-paths.utils.ts` 已支持 `NEXTCLAW_DESKTOP_DATA_DIR_OVERRIDE`。
- `apps/desktop/src/utils/desktop-paths.utils.ts` 已支持 `NEXTCLAW_DESKTOP_RUNTIME_HOME_OVERRIDE`。
- `DesktopBundleLayoutStore` 已通过 `resolveDesktopDataDir()` 派生 `launcher/versions/staging/current.json`。
- runtime 启动环境通过 `createDesktopRuntimeEnv()` 注入 `NEXTCLAW_HOME`。

因此本次 Windows 完整交付的关键不是重写所有路径，而是把早期 profile 应用顺序收口。

### 6.11 同时运行合同

本次 Windows 完整交付必须支持普通安装版和 Portable Edition 同时运行。

同时运行的产品含义：

- 已安装的 `NextClaw Desktop` 可以保持打开。
- 用户再从 U 盘启动 `NextClaw-Portable/NextClaw Desktop.exe` 时，portable 应打开自己的窗口。
- portable 的二次启动应唤起同一个 portable profile 的窗口，而不是唤起普通安装版窗口。
- 普通安装版和 portable 的会话、配置、runtime home、launcher state、日志互相隔离。

实现要求：

- `app.setPath("userData", ...)` 必须在 `app.requestSingleInstanceLock()` 之前完成。
- single instance 行为必须以 profile 为边界，而不是以产品名为边界。
- 如果 Electron 内置 single instance lock 在 Windows 上无法天然按 `userData` 隔离，必须改为项目自有的 profile-scoped lock，不能牺牲同时运行目标。
- 验证必须覆盖：普通安装版运行中启动 portable、portable 运行中启动普通安装版、同一个 portable 目录二次启动只唤起自身窗口。

## 7. 启动顺序调整

当前 `apps/desktop/src/main.ts` 顶层会创建 logger：

```ts
const logger = createDesktopLogger();
installDesktopProcessErrorLogging(logger);
logDesktopMainEntryLoaded(logger);
```

Portable profile 必须在 logger 创建和任何 `app.getPath("userData")` / `app.getPath("logs")` 之前应用，否则日志可能先写到本机目录。

建议调整为：

```text
main.ts
  -> resolveDesktopInstallationProfile(...)
  -> applyDesktopInstallationProfile(app, process.env, profile)
  -> createDesktopLogger()
  -> installDesktopProcessErrorLogging(logger)
  -> logDesktopMainEntryLoaded(logger, profile)
  -> DesktopApplication.start()
```

`DesktopApplication` 内部不要重新判断 portable，只消费已经生效的路径。

## 8. 打包方案

### 8.1 Windows portable artifact

本次 Windows 完整交付推荐产物为 zip 目录版，而不是单个自解压 exe：

```text
NextClaw-Portable-<version>-win-x64.zip
```

zip 内容来自 electron-builder 的 Windows unpacked 输出，再补入：

```text
nextclaw-portable.json
```

推荐新增脚本：

```text
apps/desktop/scripts/package-windows-portable.mjs
```

职责：

- 复用现有 desktop package build 结果或触发 `electron-builder --win dir`。
- 复制 unpacked app 到 `NextClaw-Portable/`。
- 写入 `nextclaw-portable.json`。
- 不预置用户数据，不依赖 zip 内空目录；`data/` 由应用首次启动创建。
- 分别压缩为 `NextClaw-Portable-<version>-win-x64.zip` 和 `NextClaw-Portable-<version>-win-arm64.zip`。

不建议本次 Windows 完整交付直接使用 electron-builder `portable` target 作为主方案，因为我们需要清楚控制目录结构、marker 文件和自动化验证路径。后续可评估是否替换。

### 8.2 Release asset 命名

发布资产必须带版本号和架构。这里的“包命名”指 GitHub Release / 下载页上用户实际下载的 zip 文件名，不是应用内展示名。

```text
NextClaw-Portable-<version>-win-x64.zip
NextClaw-Portable-<version>-win-arm64.zip
```

zip 内部顶层目录保持不带版本：

```text
NextClaw-Portable/
```

这样用户升级或放到 U 盘时目录名稳定，外部下载文件又能清楚表达版本和架构。

## 9. 更新策略

Portable Edition 本次 Windows 完整交付不支持应用内更新。

原因：

- portable 目录可能在 U 盘上，写入慢、权限不稳定、断连风险高。
- 正在运行的 exe 自替换在 Windows 上容易遇到文件占用。
- Portable Edition 的正确更新单元是整个 portable 包，而不是只更新普通安装版意义上的 launcher 或 runtime bundle。
- 本次 Windows 完整交付把路径闭环、同时运行和发布验证做稳，比提前接入更新更重要。

本次 Windows 完整交付策略：

- Portable Edition 的更新 UI 显示为“不支持应用内更新”或“请下载新版 Portable Edition”。
- 不自动检查、不自动下载、不在应用内应用 runtime bundle 更新。
- 用户升级时下载新版 `NextClaw-Portable-<version>-win-<arch>.zip`，退出旧版本后覆盖或替换程序文件。
- `data/` 目录是用户数据，升级时必须保留；文档和 UI 文案不得引导用户删除 `data/`。

后续如果要做更新，必须按 Portable Edition 作为完整安装形态来设计，即下载并替换新版 portable 包，同时保留 `data/`。这不进入本次 Windows 完整交付范围。

## 10. 验证方案

新增验证命令：

```text
pnpm desktop:portable:verify
```

建议落到根脚本，内部调用：

```text
scripts/desktop/desktop-portable-verify.mjs
```

Windows 真实启动烟测可复用：

```text
apps/desktop/scripts/smoke-windows-desktop.ps1
```

验证必须覆盖：

1. 构建 `NextClaw-Portable-<version>-win-x64.zip` 和 `NextClaw-Portable-<version>-win-arm64.zip`。
2. 解压到临时目录。
3. 启动 portable exe。
4. 等待 GUI ready 与 `/api/health`。
5. 校验当前 launch 日志在 `<portableRoot>/data/logs/main.log` 或 `<portableRoot>/data/desktop/launcher/main.log`。
6. 校验 runtime home 为 `<portableRoot>/data/runtime-home`。
7. 校验 desktop data 为 `<portableRoot>/data/desktop`。
8. 校验 `current.json`、`versions/`、`staging/` 不写入系统默认 app data。
9. 将整个 portable 目录移动到新路径，再次启动。
10. 与普通安装版数据目录隔离。
11. 普通安装版运行中启动 portable，portable 必须打开自己的窗口。
12. portable 运行中启动普通安装版，普通安装版必须打开自己的窗口。
13. portable update UI 必须显示不支持应用内更新或手动下载新版 portable 包，不得启动普通桌面版更新流程。

验证中不得只检查进程存活。必须沿用桌面 release smoke 的可见窗口、runtime health、日志窗口证据要求。

## 11. 代码触达范围

预计本次 Windows 完整交付触达：

```text
apps/desktop/src/main.ts
apps/desktop/src/utils/desktop-paths.utils.ts
apps/desktop/src/utils/desktop-logging.utils.ts
apps/desktop/src/services/desktop-installation-profile.service.ts
apps/desktop/src/services/desktop-installation-profile.service.test.ts
apps/desktop/src/services/desktop-update-source.service.ts
apps/desktop/src/services/desktop-update-shell.service.ts
apps/desktop/package.json
apps/desktop/scripts/package-windows-portable.mjs
scripts/desktop/desktop-portable-verify.mjs
scripts/desktop/desktop-package-build.mjs
.github/workflows/desktop-validate.yml
.github/workflows/desktop-release.yml
docs/internal/desktop-install-unsigned.md
```

条件触达：

- 只有当 Electron 内置 single instance 无法满足 profile 隔离时，才新增 `apps/desktop/src/services/desktop-instance-coordinator.service.ts`。
- 只有当 marker schema 需要跨脚本共享或版本迁移时，才新增 `apps/desktop/src/services/desktop-portable-marker.service.ts`。

不应触达：

- NCP 会话主链路。
- chat 业务逻辑。
- provider / model 配置语义。
- update manifest 核心签名规则，除非验证发现 portable 路径无法复用现有 contract。

## 12. 风险与处理

### 12.1 启动早期路径泄漏

风险：logger 或 Electron path 在 portable profile 应用前已初始化。

处理：

- profile 解析和 `app.setPath` 必须在 `createDesktopLogger()` 前。
- 增加测试覆盖：portable profile 应用后 logger 写入 portable logs。

### 12.2 与普通安装版单实例锁冲突

风险：普通安装版和 Portable Edition 使用同一个 Electron single instance lock，导致无法同时启动或互相拉起窗口。

处理：

- 同时运行是本次 Windows 完整交付的硬性成功标准。
- 必须在请求 single instance lock 前应用 portable `userData`。
- 若 Electron 内置锁不能满足 profile 隔离，则实现项目自有 profile-scoped lock。
- 不能用“检测到已有 NextClaw 就退出”作为 portable 行为。

### 12.3 U 盘路径移动

风险：状态中写入绝对路径，移动目录后失效。

处理：

- portable profile 每次启动按当前 `process.execPath` 重新解析。
- 验证必须包含移动目录后启动。

### 12.4 只读介质

风险：用户把 portable 放到只读目录或权限受限 U 盘。

处理：

- 启动前检测 `data/` 可写。
- 不可写时给出清晰错误：当前 portable 目录不可写，请移动到可写位置。
- 不要自动 fallback 到系统 AppData，否则会破坏 portable 承诺。

### 12.5 杀软和 SmartScreen

风险：未签名 zip / exe 在 Windows 上可能被拦截。

处理：

- 这属于分发信任问题，不改变 portable profile 架构。
- release 文档说明 unsigned 风险。
- 后续签名策略与普通桌面版统一治理。

## 13. 实施前风险摸排与降险设计

正式改主流程前，先做一轮风险 burn-down。目标不是提前实现完整功能，而是把最容易出 bug 的点拆成小合同、小验证和可回退设计。

### 13.1 路径泄漏摸排

风险问题：

- 哪些代码会在 portable profile 生效前读取 `app.getPath("userData")`、`app.getPath("logs")` 或写日志？
- 哪些路径仍可能绕过 `resolveDesktopDataDir()` / `resolveDesktopRuntimeHome()`？

降险设计：

- 建立 `DesktopInstallationProfile` 作为启动期第一个 owner，先应用路径，再创建 logger、state store、update service 和 runtime。
- `desktop-logging.utils.ts` 不自行推导 portable，只消费已经生效的 profile / env。
- 新增路径泄漏测试：portable profile 生效后，logger、bundle layout、runtime env 都必须指向 `<portableRoot>/data/...`。

验收：

- 单元测试覆盖 profile 应用顺序。
- smoke 日志中必须打印 `installationKind=portable`、`desktopDataDir=<portableRoot>/data/desktop`、`runtimeHome=<portableRoot>/data/runtime-home`。
- 默认系统 app data 目录不得出现本次 portable 启动生成的 `launcher/current.json`、`versions/`、`staging/`。

### 13.2 同时运行摸排

风险问题：

- Electron 的 `requestSingleInstanceLock()` 在 Windows 上是否会被不同 `userData` 自动隔离？
- 普通安装版和 portable 是否会互相唤起窗口？
- 同一个 portable 目录二次启动是否仍能唤起自己的窗口？

降险设计：

- portable profile 必须在 `requestSingleInstanceLock()` 前应用。
- single instance 的边界是 `profileId`，不是产品名。
- 先写一个最小 profile-scoped lock 设计预案：如果 Electron 内置锁无法满足隔离，就用 `<profileDataDir>/launcher/instance.lock` 作为项目级锁 owner，普通安装版和不同 portable root 拥有不同锁。
- 二次启动消息必须携带 `profileId`，接收方只响应同 profile 的 second-instance。

验收：

- 普通安装版运行中启动 portable：portable 打开自己的窗口。
- portable 运行中启动普通安装版：普通安装版打开自己的窗口。
- 同一 portable 目录二次启动：只唤起该 portable 窗口。
- 两个不同 portable 目录同时启动：各自拥有自己的数据目录和窗口。

### 13.3 更新入口摸排

风险问题：

- portable 是否会误用普通桌面版更新流程？
- UI 是否会显示可自动检查、下载、应用更新，造成错误预期？

降险设计：

- `DesktopInstallationProfile` 输出 `installationKind="portable"`。
- update source / update shell 根据 installation kind 进入 blocked 状态。
- portable 的 update snapshot 明确表达 `unsupported-installation`，文案为“Portable Edition 本次 Windows 完整交付不支持应用内更新，请下载新版 Portable Edition 并保留 data 目录”。
- 不复用普通桌面版的 runtime bundle 自动更新入口，避免半套更新语义。

验收：

- portable 启动后更新 UI 不出现“下载更新 / 应用更新”的可执行动作。
- API snapshot 中 `blockReason` 为 `unsupported-installation` 或等价的 portable blocked 原因。
- 普通安装版更新流程不受影响。

### 13.4 打包产物摸排

风险问题：

- electron-builder 的 win-unpacked 输出是否能稳定复用为 portable 根目录？
- x64 / arm64 产物命名、目录结构、marker 文件是否稳定？
- zip 内部目录是否符合用户直接解压使用的预期？

降险设计：

- 不直接采用 electron-builder `portable` target 作为本次 Windows 完整交付主方案。
- 用项目脚本从 `win-unpacked` 生成受控 zip，显式写入 `nextclaw-portable.json`。
- zip 外部文件名带版本和架构，zip 内部顶层目录固定为 `NextClaw-Portable/`。

验收：

- 解压后 marker 位于 `NextClaw-Portable/nextclaw-portable.json`。
- exe 与 marker 同级。
- 不预置用户数据，首次启动创建 `NextClaw-Portable/data/`。

### 13.5 推荐执行顺序

实现时按以下顺序降低风险：

1. 写 `DesktopInstallationProfile` 纯单元测试，只验证 marker、root、路径派生和 env 注入。
2. 调整 `main.ts` 启动顺序，让 profile 在 logger 和 single instance 之前生效。
3. 验证普通安装版路径不变。
4. 验证 portable 路径全部进入 `./data/`。
5. 验证 ordinary installed + portable 同时运行。
6. 禁用 portable 应用内更新入口。
7. 最后再接入 portable zip 打包和 CI / release workflow。

这样每一步都能独立回退，避免把路径、锁、更新、打包四类风险揉成一个大改动。

## 14. Windows 完整交付与后续扩展

### 本次：Windows Portable Edition 完整交付

目标：

- 先完成实施前风险摸排与降险验证。
- 新增 portable profile owner。
- 新增 Windows x64 和 Windows arm64 portable zip 产物。
- 验证所有 NextClaw 自有数据进入 `./data/`。
- 验证移动目录后可启动。
- 验证普通安装版和 Portable Edition 可同时运行。
- 接入 `desktop-validate.yml` 的 portable smoke。
- 接入 `desktop-release.yml`，上传 Windows portable zip release asset。
- release notes / 内部安装文档说明 Portable Edition 的使用、升级和 `data/` 保留规则。

不做：

- macOS / Linux portable。
- Portable Edition 应用内更新。
- 官网下载页产品化大改版；但 release 资产和文档说明必须完整。

### 后续：跨平台扩展

目标：

- Linux AppImage portable data root。
- macOS `.app + data/` 目录版。
- 评估 Portable Edition 应用内更新。

## 15. 已定产品决策

本轮 review 后，本次 Windows 完整交付按以下决策执行：

1. 本次交付覆盖 Windows x64 和 Windows arm64。
2. Portable Edition 必须支持和普通安装版同时运行。
3. `data/` 是用户数据目录，不预置用户数据，由应用首次启动创建。
4. 用户下载的 zip 文件名带版本号和架构；zip 内部顶层目录不带版本。
5. 本次交付不支持 Portable Edition 应用内更新；升级方式是下载新版 portable 包并保留 `data/`。

## 16. 推荐结论

推荐先做 **Windows Portable Edition 完整交付**，并把它作为正式发行物设计，而不是安装器选项或临时 zip。

最小正确方案是：

- 一个独立 portable artifact。
- 一个唯一 portable profile owner。
- 一个 marker 文件触发 portable。
- 所有 NextClaw 自有路径从 profile 派生。
- 普通安装版和 Portable Edition 可同时运行。
- 本次 Windows 完整交付禁用 portable 应用内更新，避免半套更新语义。
- 实施前先完成风险摸排，把路径、single instance、更新入口和打包产物分别验证。
- 一个专门验证命令证明不会写回本机数据目录。

这个 Windows 范围一次实现是合理的；继续扩大到全平台和 Portable Edition 应用内更新则不建议放进本次 Windows 完整交付。
