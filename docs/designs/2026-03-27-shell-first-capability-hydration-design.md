# 2026-03-27 Shell-First Capability Hydration Design

## 背景

当前 `pnpm dev start` 的 UI shell 已经能先于完整 gateway runtime 起起来，但 `createGatewayStartupContext()` 仍会在 shell 启动后同步执行 `loadPluginRegistry()`。这会导致：

- `/api/auth/status` 这类纯读接口虽然已经注册，但请求若撞进同步插件装配窗口，仍会被主线程阻塞。
- shell ready 与 capability ready 的边界不清晰，开发者只能靠日志猜当前阶段。
- `loadPluginRegistry()` 被错误地当成“启动内核”的前置条件。

## 目标

1. 把 shell ready 变成明确主合同：
   - `/api/health`
   - `/api/auth/status`
   - `/api/app/meta`
   必须在 capability hydration 完成前稳定可用。
2. `loadPluginRegistry()` 不再是启动内核前置条件。
3. 插件、channel、plugin gateway、remote runtime 等能力允许延后加载。
4. 启动状态必须显式暴露，不再依赖终端日志推断。

## 非目标

- 本轮不做独立进程 / worker 化插件运行时隔离。
- 本轮不强制前端消费新的 bootstrap 状态接口。
- 本轮不重写 plugin loader 的整体模型，只优先解决“内核先 ready、能力后 hydration”。

## 方案

### 1. 两阶段启动

#### 阶段 A：Kernel Boot

仅启动最小内核：

- config / auth / shell context
- UI HTTP server
- provider manager
- session manager
- runtime pool
- config reloader

但这里使用 **空 plugin registry / 空 extension registry** 建立运行时，不做真实插件装配。

#### 阶段 B：Capability Hydration

在 shell ready 之后，后台执行 capability hydration：

- progressive plugin registry load
- extension registry apply
- plugin UI metadata publish
- plugin gateways start
- channels restart/start
- NCP plugin runtime sync

### 2. Progressive Plugin Hydration

新增 progressive plugin loader，按插件逐个加载，并在插件之间显式让出事件循环。目标不是把插件变快，而是避免形成一次性十几秒的单块主线程阻塞。

约束：

- 仍然保持行为显式，不增加隐藏 fallback。
- 若 hydration 失败，shell 继续可用，但 bootstrap 状态必须暴露错误。

### 3. Bootstrap Status Contract

新增 `/api/runtime/bootstrap-status`，返回至少以下信息：

- `phase`
  - `kernel-starting`
  - `shell-ready`
  - `hydrating-capabilities`
  - `ready`
  - `error`
- `pluginHydration`
  - `state`: `pending | running | ready | error`
  - `loadedPluginCount`
  - `totalPluginCount`
  - `error`
- `channels`
  - `state`: `pending | ready | error`
  - `enabled`
- `remote`
  - `state`: `pending | ready | conflict | disabled | error`
  - `message`

该接口属于纯读 observation path，不允许触发副作用。

## 启动时序

1. 创建 shell context
2. 启动 UI shell
3. 立即将 bootstrap phase 标记为 `shell-ready`
4. 使用空 plugin registry 创建 gateway core context
5. 启动 runtime loop / support services
6. 后台执行 capability hydration
7. capability hydration 完成后，更新 runtime / channels / UI metadata
8. 将 bootstrap phase 标记为 `ready`

## 风险与控制

### 风险 1：capability hydration 期间仍出现短时卡顿

原因：单个插件 register 仍可能是同步重活。

控制：

- progressive loader 至少把阻塞拆成逐插件小块
- 后续若仍不可接受，再升级为 worker/process 隔离

### 风险 2：空 extension registry 启动后，部分功能暂不可用

这是预期行为，不应伪装成 ready。

控制：

- 显式 bootstrap status
- 保持 `/api/auth/status`、`/api/health`、`/api/app/meta` 稳定
- capability 未 ready 时只暴露 truthful 状态，不做 surprise success

### 风险 3：channel / plugin gateway 热接入顺序错误

控制：

- hydration 完成后统一 apply extension registry
- 再启动 plugin gateway / restart channels
- 所有状态更新通过单一 hydration helper 收敛

## 验收标准

1. 冷启动时，`/api/auth/status` 不再依赖 `loadPluginRegistry()` 完成才能返回。
2. 日志中即使还在加载插件，`/api/runtime/bootstrap-status` 也能明确显示 `hydrating-capabilities`。
3. capability hydration 完成后，channels / plugin gateways / plugin UI metadata 能热接入，不需要重启 shell。
4. 若 capability hydration 失败，shell 保持可用，状态接口返回 `error` 且包含错误信息。

## 本轮实现边界

- 落地空 plugin registry 启动
- 落地 progressive plugin hydration
- 落地 bootstrap status 接口
- 落地最小测试与启动链路验证
