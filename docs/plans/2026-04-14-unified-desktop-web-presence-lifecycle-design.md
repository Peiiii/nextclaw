# Unified Desktop and Web Presence Lifecycle Design

**Goal:** 为 NextClaw 定义一套跨 Desktop 与 Web 一致、可预测、可扩展的“存在形态 / 生命周期”产品方案，让用户能清楚理解“关闭窗口会发生什么”“什么时候服务会继续运行”“网页端为什么不应该跟着浏览器标签页一起死掉”，并为后续托盘常驻、开机自启、网页端服务治理与统一运行时控制实现提供直接落地依据。

**Architecture:** 采用“统一产品语义，不同宿主 owner 执行”的路线。Desktop 由 Electron launcher 负责窗口、托盘、开机自启与显式退出时的 runtime 停止；Web 不再把浏览器页面当作服务 owner，而是把浏览器视作控制面板，服务生命周期由本地宿主、系统服务管理器或平台托管层负责。前端统一消费一套运行时环境与能力合同，根据 `desktop-embedded`、`managed-local-service`、`self-hosted-web`、`shared-web` 四类环境展示不同能力与文案。

**Tech Stack:** Electron、TypeScript、React、Hono、WebSocket realtime、NextClaw CLI runtime、Desktop launcher state、runtime control capability contract。

---

## 长期目标对齐 / 可维护性推进

- 这项设计直接服务 `docs/VISION.md` 中“统一入口、统一体验、足够可靠”的要求。一个想成为 AI 时代个人操作层的产品，不能让不同运行环境在“关闭、退出、后台运行、恢复”这些最基础的问题上各说各话。
- 这次不是在补三个孤立能力点，而是在定义 NextClaw 的“存在形态”产品合同：
  - Desktop 应该像可常驻的本地操作层，而不是一次性网页包装器。
  - Web 应该像连接到服务的控制面，而不是服务本体。
  - 运行时控制应基于统一能力发现合同，而不是 UI 硬编码环境分支。
- 维护性方向：
  - 把“关窗/退出/后台/自启”的宿主差异收敛到 Desktop owner，不把逻辑散落到 renderer 页面。
  - 把“浏览器页面关闭是否影响服务”明确成产品原则，避免继续在 Web UI、remote access、runtime control 中混入相互矛盾的假设。
  - 优先复用现有 `RuntimeControlEnvironment`、`RuntimeLifecycleState`、`DesktopLauncherStateStore`，避免再长一套新合同或新存储。

---

## 问题重新定义

当前讨论的不是“要不要顺手加一个 tray 图标”，而是下面四个更基础的问题：

1. NextClaw 在不同宿主环境中，什么对象才是“真正活着”的主体？
2. 用户关闭一个可见窗口时，产品是否还应该继续工作？
3. 哪些环境允许用户自己控制服务启停，哪些环境只允许看到状态与恢复动作？
4. 用户如何在不同端建立同一套心智，而不被实现细节误导？

如果这些问题不先定义清楚，后续托盘、自启动、runtime control、remote access、恢复态 UI 都会继续出现语义漂移。

---

## 当前现状

### Desktop 现状

- 当前 `apps/desktop/src/main.ts` 在 `window-all-closed` 时直接 `app.quit()`，所以关闭最后一个窗口就等于退出桌面应用。
- 退出时 `before-quit` 会先调用 `stopRuntime()`，随后停止内嵌 runtime 子进程。
- 当前没有 `Tray` 相关实现，也没有“关闭窗口时隐藏到后台”的分支。
- 当前没有开机自启实现，也没有“后台运行/开机自启”相关状态持久化字段。
- 当前 Electron launcher 已经承担了稳定 supervisor 的职责，并持有独立的 launcher state；这意味着把“常驻语义”放在 launcher 是自然演进，而不是架构反方向。

### Web 现状

- 现有 runtime control 合同已经区分 `managed-local-service`、`self-hosted-web`、`shared-web`。
- Remote Access 状态已把 `service.running`、`runtime.state`、`account`、`settings.enabled` 分开表达，说明产品层已经默认“服务状态”独立于页面存在。
- 当前 UI 已经能表达“服务停了”“运行时连接中/已断开”“需要重新授权”，但还没有把“浏览器只是控制面”提升成统一产品原则。

### 已有设计方向

- 既有桌面设计文档已经把托盘、开机自启归到 launcher 责任，而不是业务 runtime 责任。
- 既有统一重启设计已经为跨环境能力发现、运行时状态与不同环境的按钮可用性打下基础。

结论：方向是对的，但“产品语义层”还没有被统一定稿。

---

## 核心设计原则

### 1. 先定义主体，再定义窗口

- Desktop 的主体是 `Desktop Launcher + embedded runtime`。
- Web 的主体是 `managed service / hosted runtime`，不是浏览器页面。
- 页面和窗口默认只是“进入主体的入口”，而不是主体本身。

### 2. 关闭可见入口，不等于销毁主体

- 对 Desktop，关闭窗口默认不应停止服务。
- 对 Web，关闭标签页绝不应停止服务。
- 只有显式“退出应用”或显式“停止服务”才应该进入销毁路径。

### 3. 同一产品语义，不强求同一宿主行为

- Desktop 可以有托盘和开机自启。
- Web 没有托盘，也不应该模拟出“浏览器托盘”式错觉。
- Web 的“自启动”不属于前端页面，而属于服务部署层。

### 4. 能力发现优先，硬编码环境分支最少

- UI 继续基于 `RuntimeControlEnvironment` 与 capability view 决定展示什么。
- 不要把“Desktop 才能怎样、Web 才能怎样”的判断散落到各页面。

### 5. 默认行为必须可预测

- 默认关闭窗口时继续后台运行。
- 默认显式 Quit 才真正停止 Desktop runtime。
- 默认登录系统自动启动为关闭，但能力应存在。
- 默认 Web 页面关闭不影响服务。

---

## 统一产品语义

### A. Close Window

定义：用户关闭当前可见窗口或页面。

- `desktop-embedded`
  - 默认解释为“隐藏窗口，保留 NextClaw 继续在后台运行”。
- `managed-local-service`
  - 浏览器标签页关闭，服务继续运行。
- `self-hosted-web`
  - 浏览器标签页关闭，服务继续运行。
- `shared-web`
  - 浏览器标签页关闭，仅结束当前会话/连接，不影响共享服务本体。

### B. Quit App

定义：用户显式表达“结束桌面应用本体”。

- 只对 `desktop-embedded` 成立。
- 由应用菜单、托盘菜单中的 `Quit NextClaw` 触发。
- 进入真正的停止链路：标记 quitting、停止 runtime、退出 launcher。

### C. Stop Service

定义：用户显式要求停止当前可管理的服务实例。

- `desktop-embedded`
  - 通常不单独提供普通用户入口。
  - 产品语义上，Quit App 已隐含 stop embedded service。
- `managed-local-service`
  - 可在 runtime control / remote access 中提供。
- `self-hosted-web`
  - 仅对有权限的管理员暴露。
- `shared-web`
  - 默认不提供。

### D. Launch at Login / Auto Start

定义：宿主启动时自动把 NextClaw 主体带起来。

- `desktop-embedded`
  - 指 Electron launcher 随系统登录启动，并默认后台运行。
- `managed-local-service`
  - 指本地服务进程由系统服务管理器自动启动。
  - 不是“浏览器自动打开页面”。
- `self-hosted-web`
  - 指自托管实例由部署层常驻。
- `shared-web`
  - 不属于终端用户能力。

---

## 环境矩阵

| Environment | 主体 owner | 关闭窗口/页面 | 显式退出 | 是否支持后台常驻 | 是否支持用户侧自启动 |
| --- | --- | --- | --- | --- | --- |
| `desktop-embedded` | Electron launcher | 隐藏到托盘，不停服务 | `Quit NextClaw` 才停止 runtime 并退出 | 是 | 是 |
| `managed-local-service` | 本地受管服务 | 关闭浏览器不影响服务 | 不适用 | 是 | 是，但属于服务层 |
| `self-hosted-web` | 自托管宿主 | 关闭浏览器不影响服务 | 不适用 | 是 | 是，但属于宿主层 |
| `shared-web` | 平台托管层 | 关闭浏览器仅结束当前会话 | 不适用 | 是 | 不对终端用户暴露 |

这个矩阵是后续所有 UI、文案、按钮和实现 owner 的总依据。

---

## Desktop 设计

### 推荐语义

1. 关闭窗口：默认隐藏到托盘，不停服务。
2. 退出应用：只能通过应用菜单或托盘菜单显式触发。
3. Quit 时才执行 `stopRuntime()`。
4. 开机自启启动后默认不弹主窗口，而是在后台运行并挂托盘。

### 用户可见入口

- 托盘菜单：
  - `Open NextClaw`
  - `Run in Background` 状态说明或设置跳转
  - `Launch at Login`
  - `Check for Updates`
  - `Quit NextClaw`
- 应用菜单：
  - `Hide NextClaw`
  - `Quit NextClaw`
  - 设置入口保持一致
- 设置页新增 `Desktop Presence` 区块：
  - `Close window to background`
  - `Launch NextClaw at login`

### 默认值

- `closeToTray`: `true`
- `launchAtLogin`: `false`
- 若 `launchAtLogin` 为 `true`，则登录启动默认 `startHidden: true`

### 不推荐的做法

- 不推荐“关闭窗口就退出，但开机自启时在后台运行”这种双重语义。
- 不推荐第一版提供“单独停止 embedded runtime 但保留空桌面壳”的入口，因为当前桌面窗口直接加载 runtime 提供的 UI，这种状态会制造复杂且低频的异常模式。

### 技术 owner

- `DesktopPresenceService` 或 `DesktopLifecycleManager`
  - 管理 `isQuitting`
  - 处理窗口 `close` 事件
  - 管理托盘实例
  - 提供 `showWindow / hideWindow / quitApplication`
- `DesktopAutoStartService`
  - 负责平台自启动设置读写
- `DesktopLauncherStateStore`
  - 持久化 presence preferences，避免另开新存储

### 对现有代码的直接影响

- `window-all-closed` 不再无条件 `app.quit()`
- 主窗口 `close` 事件需要区分“显式退出中”与“普通关窗”
- `before-quit` 保留，但只服务于显式退出链路
- 更新场景下 `restartApplication()` 需与 `isQuitting` 协同，避免被“关窗隐藏”逻辑拦截

---

## Web 设计

### 产品原则

浏览器页面不是服务 owner。网页端必须让用户明确感知：

- 页面只是连接到 NextClaw 的控制面。
- 服务继续运行与否，取决于宿主层，而不是浏览器标签页。
- 因此网页端不存在“关网页是否要停服务”的问题。

### `managed-local-service`

适用场景：用户在本机浏览器访问本地 NextClaw 服务。

推荐语义：

- 关闭浏览器标签页，不影响服务。
- 网页端应该提供显式的服务管理入口，而不是让用户靠“关页面”去影响服务。
- 该入口在 v1 中应直接提供：
  - `Start Service`
  - `Restart Service`
  - `Stop Service`
- 若未来要支持“开机自动启动”，应在本地 service manager / installer / CLI 托管层实现，而不是通过浏览器控制。
- 服务管理的主入口应放在 runtime 页面，而不是散落在 remote access 页面中。

UI 文案重点：

- `This page controls your local NextClaw service. Closing the browser does not stop the service.`

### `self-hosted-web`

适用场景：用户管理自己部署在机器或服务器上的 NextClaw。

推荐语义：

- 页面关闭不影响服务。
- v1 默认展示“服务状态 + 宿主管理提示”，而不是急着给一排危险按钮。
- `Restart Service` 仅在宿主明确支持并且当前用户有权限时可见。
- `Stop Service` 应更谨慎，默认只给管理员或干脆不在 v1 暴露。
- 所谓“开机自启”属于部署文档、systemd、Docker restart policy、launchd、Windows service 等宿主层问题，不属于 Web 页面开关。

### `shared-web`

适用场景：共享实例、平台托管实例、用户无底层主机控制权。

推荐语义：

- 用户不应看到 `Stop Service`。
- `Restart Service` 默认不可见；若特殊运营场景确需暴露，也必须经过权限与影响确认。
- 页面只提供：
  - 状态
  - 重新连接
  - 诊断
  - 重新授权

### 不推荐的做法

- 不要把“浏览器恢复上次标签页”包装成“网页端开机自启”。
- 不要让页面关闭时尝试调用 stop/release API。
- 不要在 Web UI 里制造“App Quit”概念。
- 不要把 `Start / Restart / Stop` 一部分放在 runtime control，一部分放在 remote access，造成用户找不到真正的服务管理入口。

---

## 服务管理设计（收敛版）

### 为什么需要服务管理

当前真正缺的不是“网页端也能退出应用”，而是**显式服务管理**：

- 页面关闭不该影响服务，这是 presence 语义。
- 用户如果真的想控制服务，就必须有一组明确动作：`Start / Restart / Stop`。
- 这组动作要按环境暴露，而不是所有环境都一刀切。

### 当前缺口

结合当前实现，缺口已经很清楚：

- `RuntimeControlView` 目前只覆盖 `Restart Service` / `Restart App`。
- remote access 那条链路已经有 `Start / Restart / Stop`，但它属于另一块产品表面。
- 结果就是“服务管理能力已经部分存在，但入口分裂、语义分裂、环境边界不清”。

这说明问题是真实存在的，不是假设性优化。

### 方案比较

#### 方案 A：维持现状，继续分散在 runtime control 和 remote access

- 好处：改动最少。
- 问题：用户要管理服务时不知道去哪里；产品语义继续分裂。

#### 方案 B：把所有服务控制都塞进 remote access

- 好处：复用现有 start/stop/restart 实现。
- 问题：remote access 的职责是“设备可被远程访问”，不是“本机服务生命周期总控”；继续塞会让 remote 页面再次膨胀。

#### 方案 C：保留 `Runtime Presence`，把 `Runtime Control` 收敛为统一的 `Service Management`

- 好处：用户心智最清晰。
- 好处：复用现有 runtime control host 和 remote service control 底座，不需要新造第三套后端系统。
- 好处：能按环境做按钮裁剪。
- 结论：**推荐方案**。

### 最终产品结构

v1 推荐把运行时相关能力收敛成两张卡片，而不是一个大杂烩面板：

- `Runtime Presence`
  - 回答“关闭窗口/页面会发生什么”
  - 回答“是否支持后台常驻 / 开机自启 / Quit App”
- `Service Management`
  - 回答“服务现在是否在运行”
  - 回答“当前能不能 Start / Restart / Stop”
  - 回答“谁是真正的服务 owner”

这两张卡片相关，但不要混成一张：

- `Presence` 关注的是主体与入口关系。
- `Service Management` 关注的是服务生命周期动作。

### Remote Access 的职责收缩

remote access 页面不应继续做“服务管理主入口”。它应该只负责：

- 账号状态
- 设备是否已启用 remote access
- 当前连接/授权/诊断状态
- 与 remote access 直接相关的辅助动作

如果 remote access 页仍临时保留 start/restart/stop 快捷动作，产品上也应明确这是**代理到同一套 service management owner**，而不是另一套独立控制面。

---

## 统一 Runtime Control 合同扩展建议

现有 `RuntimeControlView` 已具备环境与重启能力表达，但还不足以承接完整的服务管理。这里的收敛原则是：

- `Presence` 单独建 view，因为它解决的是“窗口 / 页面 / 常驻”的问题。
- `Service Management` 不再额外新造第三套 view，而是在现有 `RuntimeControlView` 上做最小扩展。

### 推荐新增 view

```ts
type RuntimePresenceView = {
  environment: RuntimeControlEnvironment;
  windowCloseBehavior:
    | "hide-to-background"
    | "exit-app"
    | "browser-tab-only"
    | "not-applicable";
  supportsTray: boolean;
  supportsLaunchAtLogin: boolean;
  supportsStopService: boolean;
  supportsQuitApp: boolean;
  settings?: {
    closeToBackground?: boolean;
    launchAtLogin?: boolean;
  };
  message?: string;
};
```

### 为什么 `Presence` 单独拆 view

- `RuntimeControlView` 解决的是“运行时重启与恢复”。
- `RuntimePresenceView` 解决的是“主体是否常驻、关窗会发生什么、是否支持开机自启”。
- 这两者相关但不是同一件事，强行塞进同一对象会让合同膨胀。

### 推荐扩展现有 `RuntimeControlView`

```ts
type RuntimeServiceState =
  | "running"
  | "stopped"
  | "starting"
  | "stopping"
  | "restarting"
  | "unknown";

type RuntimeControlView = {
  environment: RuntimeControlEnvironment;
  lifecycle: RuntimeLifecycleState;
  serviceState: RuntimeServiceState;
  canStartService: RuntimeActionCapability;
  canRestartService: RuntimeActionCapability;
  canStopService: RuntimeActionCapability;
  canRestartApp: RuntimeActionCapability;
  ownerLabel?: string;
  managementHint?: string;
  message?: string;
};
```

### 为什么不再新建 `ServiceManagementView`

- 这是 runtime control 的核心职责，不是第三种完全独立能力。
- 当前代码里已经有 runtime control host、restart route、manager、card 这条链路。
- 与其再造一套 `service-management` host / route / manager，不如在现有合同里自然扩出来。
- 这样既能统一产品表面，也能避免过度设计。

### 环境动作矩阵

| Environment | Service State | Start | Restart | Stop | Restart App |
| --- | --- | --- | --- | --- | --- |
| `desktop-embedded` | 运行中为主 | 不提供 | 提供 | 普通用户不单独提供 | 提供 |
| `managed-local-service` | 运行中 / 已停止 | 提供 | 提供 | 提供 | 不提供 |
| `self-hosted-web` | 只读或宿主返回 | 默认不提供 | 可选，取决于宿主与权限 | 默认不提供 | 不提供 |
| `shared-web` | 平台托管只读 | 不提供 | 默认不提供 | 不提供 | 不提供 |

### UI 表面建议

- 统一卡片标题使用 `Service Management`，不要继续叫只偏“重启”的 `Runtime Control`。
- 卡片内部固定三层信息：
  - 当前服务状态
  - 当前环境 / owner 提示
  - 可执行动作按钮
- 若某个动作不可用，必须显示原因，而不是静默隐藏所有上下文。

---

## 设置与持久化设计

### Desktop

建议把以下字段加入 launcher state，而不是新增独立配置文件：

```ts
presencePreferences: {
  closeToBackground: boolean;
  launchAtLogin: boolean;
}
```

理由：

- 这是 launcher 级偏好，不属于 runtime config。
- 现有 `DesktopLauncherStateStore` 已承载 launcher 级持久状态，天然适合继续承担。
- 避免把桌面壳偏好混进 runtime config，引起 Desktop 与 Web 配置语义污染。

### Web

- `managed-local-service`
  - 若未来要提供“服务开机自启”开关，应由 service control host 对接宿主层并单独保存。
  - 不应写进浏览器 local storage 或页面 session state。
- `self-hosted-web`
  - 建议第一版只展示“由部署层管理”的只读说明，不在 UI 中直接保存此类状态。
- `shared-web`
  - 不提供 presence settings。

---

## 交互与文案建议

### Desktop 首次触发关窗时

建议首次点击关闭按钮时出现一次轻提示：

- `NextClaw will keep running in the background. You can reopen it from the tray or quit from the menu.`

目的：

- 帮用户建立新心智。
- 降低“为什么关了窗口任务还在跑”的惊讶感。

### Web 页面中的明确说明

- `managed-local-service`
  - `Closing this tab does not stop your local NextClaw service.`
  - `Use Service Management to start, restart, or stop the local service.`
- `self-hosted-web`
  - `This page manages a running NextClaw service. Service lifecycle is controlled by the host environment.`
- `shared-web`
  - `Service lifecycle is managed by the platform.`

---

## 分阶段实施建议

### Phase 1: Desktop Presence 与 Web Presence 语义统一

- Desktop tray + close-to-background + explicit quit。
- Desktop launch-at-login。
- Web 环境文案统一为“页面不是 service owner”。
- `Runtime Presence` 独立成卡片与 owner。

这部分已经是当前方案的已完成基础。

### Phase 2: Service Management v1

- 扩展现有 `RuntimeControlView` 为最小可用 service management 合同。
- 把 runtime 页面上的 `Runtime Control` 收敛成 `Service Management`。
- `managed-local-service` 接入统一的 `Start / Restart / Stop`。
- Desktop 保留 `Restart Service / Restart App`，不额外暴露普通用户 `Stop Service`。
- remote access 页面停止承担主服务控制职责。

### Phase 3: Self-hosted 与 Shared Web 边界固化

- `self-hosted-web` 默认先展示只读状态与宿主提示。
- 只有宿主明确支持、且权限明确时，才暴露 `Restart Service`。
- `shared-web` 固定为只读，无用户侧服务控制按钮。

### Phase 4: 宿主级服务治理

- `managed-local-service` 对接 installer/CLI/system service，支持真正的 service auto-start。
- `self-hosted-web` 输出部署指南，而不是勉强在 UI 内兜底。
- 如需保留 remote access 快捷动作，统一改为委托到同一 service management owner。

---

## 验收标准

### Desktop

1. 关闭最后一个窗口后，NextClaw 仍继续运行，任务不被中断。
2. 用户可从托盘重新打开主窗口。
3. 只有显式 `Quit NextClaw` 才会停止 runtime 并退出应用。
4. 更新重启链路仍能正常工作，不会被“关闭窗口隐藏”逻辑干扰。
5. 开机自启开启后，登录系统会拉起 NextClaw，并默认后台运行。

### Web

1. 关闭浏览器标签页不会停止服务。
2. `managed-local-service` 环境会明确说明浏览器只是控制面，并提供统一的 `Start / Restart / Stop` 入口。
3. `self-hosted-web` 与 `shared-web` 的服务控制按钮与权限边界清晰一致。
4. 用户不会在 Web UI 中看到误导性的 `Quit App` 语义。
5. remote access 页面不再承担“服务管理主入口”职责，或其快捷动作已明确委托到同一 owner。

---

## 设计验证与当前实现核对

这次设计补完不是纸上推演，而是基于当前代码结构做的收敛：

- 当前 runtime control host 已经存在，但只覆盖 `Restart Service / Restart App`。
- 当前 remote access 已经存在 `Start / Restart / Stop` 控制链路。
- 因此“服务管理需要统一入口”是当前真实缺口，不是假问题。
- 当前 Desktop presence 已经独立为 owner，这也证明把 `Presence` 与 `Service Management` 拆开是符合现有代码边界的。

本次设计验证重点是四个判断：

1. 是否避免了继续让 remote access 页面膨胀：是。
2. 是否避免了为 service management 再造第三套 view / host / route：是。
3. 是否保留了环境差异，而不是强行一套按钮打平：是。
4. 是否给出了最小可执行的下一步，而不是一份大而空的长期蓝图：是。

---

## 结论

### 最终推荐

NextClaw 应把“是否继续活着”从窗口语义中拆出来，统一提升为“主体生命周期”语义：

- Desktop：主体是 launcher + embedded runtime，所以关窗默认隐藏，显式 Quit 才停止。
- Web：主体是 service runtime，所以关页面永远不应影响服务。

### 这份方案的核心价值

- 它把 Desktop 与 Web 的差异收敛成一套可解释的统一语义，而不是各自打补丁。
- 它直接支持 cron、remote access、长期 agent 任务、渠道监听等“后台能力”长期发展。
- 它沿用了现有 launcher 与 runtime control 架构，不要求为了一次产品调整重写整套基础设施。

### 推荐的下一步实现顺序

1. `Runtime Control` 收敛为 `Service Management`
2. `managed-local-service` 接入统一的 `Start / Restart / Stop`
3. `self-hosted-web / shared-web` 的按钮与权限边界固化
4. `managed-local-service` 的宿主级自启动治理
