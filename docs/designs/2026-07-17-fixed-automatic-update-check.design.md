# NextClaw 固定周期检查与手动下载更新设计

## 背景

NextClaw 的桌面端与 NPM runtime update 已经共享更新快照、签名 manifest、下载、应用和版本切换合同，但更新策略仍有四处结构性缺口：

- 桌面端虽然会在启动、窗口重新聚焦和系统恢复时检查，但定时唤醒为一小时、实际最短检查间隔为五小时，两个策略不一致。
- NPM runtime update host 只在构造或首次读取状态时触发一次自动检查，没有运行期间的周期调度。
- `automaticChecks` 被建模成用户偏好并持久化，用户可以关闭一项本应作为产品可靠性基线的能力；这也让桌面 IPC、HTTP API、SDK、前端和两个状态文件都承担了不必要的配置合同。
- `autoDownload` 同样被做成跨层偏好，而且 NPM 安装态默认开启；自动检查一旦发现版本便可能直接消耗网络和磁盘，偏离“先提示、再由用户明确下载”的可预测交互。

这会导致已经长时间运行的安装实例只有在 restart 后才可靠发现新版本，也让本地验证只能证明“启动时检查”，不能证明“不重启也会发现后来发布的新版本”。

## 用户目标

- 桌面端和 NPM 安装端只要持续运行，就会自动检查更新。
- 自动检查固定开启，每两小时检查一次，不提供关闭入口，也不写入持久化配置。
- 永远不自动下载，不提供下载策略配置，也不把 `autoDownload` 写入持久化状态。
- 检查到新版本后停在 `update-available`；只有用户明确点击下载才进入下载，应用和必要的重启也仍由用户确认。
- 开发者无需等待真实发版或真实两小时，就能在本地通过同一产品主链路验证运行中发现新版本。

## 成功标准

1. `automaticChecks` 与 `autoDownload` 都从共享类型、快照、桌面 IPC、HTTP API、SDK、前端 manager、UI 和持久状态中消失。
2. 任意自动检查、手动检查或更新通道切换只更新可用版本状态，不调用下载；只有显式 `downloadUpdate` 动作可以开始下载。
3. 自动检查策略只有一个事实源：生产间隔固定为两小时。
4. 桌面端和 NPM host 都在明确的 `start` / `dispose` 生命周期内管理定时器，不由构造函数或 `getState` 暗中启动。
5. 最近两小时已经检查过时，进程启动不会重复请求；到期后无需 restart 即可检查。
6. 手动检查或切换更新通道会刷新 `lastUpdateCheckAt`，下一次自动检查从新的检查时间重新计算。
7. 桌面应用只运行桌面更新 owner；其内嵌 runtime service 不再同时启动不可见的 NPM 更新 owner。
8. `pnpm dev:verify-update` 会自动证明：同一 PID 的 baseline 在启动后通过周期调度发现 candidate，之后开发者可以继续亲自点击下载和应用。
9. 桌面产品更新 smoke 会证明同一 Electron 进程在运行期间通过周期调度发现新版本。

## 设计原则与关键取舍

### 更新可靠性与资源消耗都使用固定策略

自动检查是 NextClaw 维持版本连续性和安全更新能力的产品基线，属于稳定产品策略，不是用户偏好。按照 `responsibility-surface-minimization`，owner 自己能够决定的内部策略不应扩散为 UI、API 和持久化字段。

下载会消耗网络和磁盘，并改变本地待应用状态。产品固定采用“只检查、不自动下载”：系统负责持续发现更新，资源消耗动作必须由用户明确触发。既然没有可选策略，`autoDownload` 也不应作为一个永远为 false 的伪偏好继续存在。

### 检查与下载、应用继续分离

周期任务只负责发起检查。发现新版本后固定停在 `update-available`，等待用户点击下载；下载完成后固定停在 `downloaded`，等待用户点击应用。系统不自动下载、不自动 apply，也不自动切换运行版本。

### 精确延迟，不使用固定轮询近似

使用递归 `setTimeout`，根据持久化的 `lastUpdateCheckAt` 计算下一次剩余时间：

```text
nextDelay = max(0, lastCheckedAt + 2h - now)
```

固定 `setInterval(2h)` 会让“启动前刚检查过”的实例最多接近四小时才再次检查，不符合每两小时策略。递归定时器可以在启动、手动检查、通道切换、系统恢复后重新计算准确剩余时间。

非法或未来的 `lastUpdateCheckAt` 视为立即到期，避免时钟漂移让自动检查长期停摆。检查失败仍沿用现有行为记录本次 `lastUpdateCheckAt`，防止网络故障造成紧密重试。

## Owner 与架构

### Kernel：策略事实源

在 `@nextclaw/kernel` 的 `utils` 中维护纯函数：

- 生产自动检查间隔常量：两小时。
- 根据 `lastCheckedAt`、当前时间和内部注入间隔计算剩余延迟。
- 解析显式验证模式下的短间隔；未开启验证模式时忽略任何间隔覆盖值。

这里不持有定时器、不读取进程环境。Kernel 只拥有产品策略和纯计算，具体宿主负责生命周期。

该纯策略同时发布 ESM 与窄 CJS 子入口。Desktop 主进程只依赖这个无副作用的 CJS 边界，避免把整个 ESM Kernel 拉进 Electron CommonJS 启动链；策略事实仍只有一份。

### DesktopUpdateManager：桌面定时器 owner

`DesktopUpdateManager` 继续负责 Electron 侧更新生命周期：

- `startAutomaticChecks` 注册唯一 timer、窗口聚焦和系统 resume 触发。
- 每次触发先让 `DesktopUpdateCoordinatorService` 判断是否到期并执行检查，再按最新 `lastCheckedAt` 安排下一次 timer。
- 手动检查和更新通道切换完成后重新安排 timer。
- `dispose` 统一清理 timer 与 Electron listeners。

`DesktopUpdateCoordinatorService` 继续拥有检查、手动下载、应用和快照状态，不新增平行 scheduler service。它使用 Kernel 的纯策略判断是否到期，检查路径与下载路径之间不再存在自动跳转。

更新通道切换必须先等待当前检查收口，再持久化新通道并为新通道发起独立检查。active check promise 使用任务身份保护清理，旧任务的 `finally` 不得清掉后创建的新任务；这样旧通道 manifest 不会被投影到新通道状态。

### NpmRuntimeUpdateHost：NPM 定时器 owner

`NpmRuntimeUpdateHost` 已经拥有 NPM 更新状态、检查、下载、应用和事件发布，因此周期调度属于它自己的生命周期闭环：

- constructor 只建立对象图，不发网络请求。
- `start()` 启动一次到期判断和后续 timer。
- `getState()` 保持纯读，不再顺手启动检查。
- `dispose()` 清理 timer。
- `ServiceGatewayManager.start/stop` 确定性调用其生命周期。
- 更新通道切换先等待当前 active task 收口，再写入新通道并检查，不能复用旧通道的在途任务。

不新增通用 scheduler class。两个宿主的触发源和生命周期不同，共享纯策略即可；强行抽象 callback scheduler 会增加配置和跳转，却不会减少真实复杂度。

### 桌面内嵌 runtime 的单一 owner

桌面 UI 已通过 Electron bridge 使用 `DesktopUpdateManager`。桌面启动的内嵌 runtime service 不应再创建第二个 NPM runtime update host，否则会出现两套定时器、两个状态文件和一个不可见的更新结果。

桌面 runtime 环境固定注入 `NEXTCLAW_DISABLE_RUNTIME_UPDATE_HOST=1`，让桌面安装形态只有桌面更新 owner。独立 NPM 安装态不注入该值，继续由 `NpmRuntimeUpdateHost` 负责。

## 合同与持久化迁移

共享更新合同删除 `UpdatePreferences`，`UpdateSnapshot` 删除 `preferences` 与 `canAutoDownload`。以下只服务更新偏好的入口同步删除：

- `PUT /api/runtime/update/preferences`
- client SDK `updatePreferences`
- desktop bridge 与 IPC `updatePreferences`
- 前端 `runtimeUpdateManager.updatePreferences`

前端不再展示任何自动检查或自动下载开关，只保留更新通道选择，并静态说明系统每两小时检查、下载和应用需要用户确认。

桌面 `launcher/state.json` 与 NPM `npm-runtime-update-state.json` 删除整个 `updatePreferences`。读取旧状态时，normalizer 直接忽略该对象；下一次正常写入会自然移除 `automaticChecks` 与 `autoDownload`。不保留旧 API、空对象、固定 false 字段或 alias，避免退役策略继续污染内部合同。

## 本地验证机制

### 生产策略与验证加速

生产间隔必须固定两小时，但人工验证不能等待两小时。宿主构造参数允许注入内部检查间隔；正常产品装配始终使用 Kernel 的两小时默认值。

只有显式设置以下两项时，进程装配层才启用短间隔：

```text
NEXTCLAW_UPDATE_VERIFICATION_MODE=1
NEXTCLAW_UPDATE_VERIFICATION_INTERVAL_MS=<positive integer>
```

这两个变量只由仓库内验证脚本使用，不写入用户配置、不进入 UI、不进入用户 CLI 文档。未开启 verification mode 时，interval 变量即使存在也会被忽略；非法值直接失败，不静默回退。

### `pnpm dev:verify-update`

现有命令继续复用真实签名 fixture、真实 launcher、真实 managed service 和真实页面，但初始状态改为：

- `lastUpdateCheckAt` 写入本次启动前的当前时间，确保启动时不会立即检查。
- verification interval 设为数秒。

harness 除了等待 `/api/app/meta` 的 baseline 版本，还会等待更新 API 出现 candidate，并断言：

- candidate 是由产品 timer 发现，而不是 harness 调用 check API；
- 发现前后 managed service PID 相同；
- `lastUpdateCheckAt` 已更新；
- `availableVersion` 等于 candidate。

随后才打印“环境已就绪”，开发者继续在真实页面点击下载、应用并观察 PID 与版本切换。

### Desktop 产品 smoke

桌面 `smoke:update` 使用真实 Electron、preload bridge、桌面状态文件、本地签名 manifest 和 bundle：

- baseline 版本直接读取已安装 seed manifest，candidate 由 baseline 的下一个 patch 版本生成，不使用会随发布过期的硬编码版本。
- smoke 运行期间隔离仓库 `build/update-release-metadata.json` 的陈旧生成物，并在结束后原样恢复，避免元数据与 fixture seed 不一致时覆盖候选版本。
- 临时覆盖仓库 seed bundle 前保存原始字节，成功或失败清理时都原样恢复，保证验证命令可重复运行且不污染工作区。
- 启动前把 channel 设为 beta、`lastUpdateCheckAt` 设为当前时间。
- 通过 verification mode 将周期压缩为数秒。
- 不调用 `checkForUpdates` 或 `updateChannel` 来发现 beta；等待同一 Electron 进程的 snapshot 自动进入 `update-available`。
- 再沿既有 bridge 下载、应用、relaunch，并校验 pointer 和最终版本。

这不是单元测试，而是完整产品链路 smoke。Kernel 纯策略仍补充定向测试，用于覆盖时间边界；它不能替代上述两个真实运行验收。

## 文件落点

- `docs/designs/2026-07-17-fixed-automatic-update-check.design.md`：本设计与验收合同。
- `packages/nextclaw-kernel/src/utils/automatic-update-check.utils.ts`：两小时策略和剩余延迟纯计算。
- `apps/desktop/src/managers/desktop-update.manager.ts`：桌面 timer 与 Electron 触发生命周期。
- `apps/desktop/src/launcher/services/update-coordinator.service.ts`：桌面到期判断、手动下载与应用主链路。
- `packages/nextclaw-service/src/services/runtime/npm-runtime-update-host.service.ts`：NPM timer 生命周期。
- 两个 update state store：删除整个 `updatePreferences` 持久化合同。
- shared/server/client/UI/desktop bridge：删除 update preference contract、配置入口和两个开关。
- `scripts/dev/verify-update.mjs`：运行中自动发现的人工验收 owner。
- `apps/desktop/scripts/smoke-product-update.mjs`：桌面运行中自动发现 smoke。
- `docs/workflows/developer-commands.md`：更新人工验收的可观察结果和速度说明。

## 验收矩阵

| 场景 | 可观察判定 |
| --- | --- |
| NPM 启动且上次检查未到两小时 | 不立即请求，剩余时间到期后检查 |
| NPM 长时间运行后发布 candidate | PID 不变，自动出现 `availableVersion` |
| Desktop 长时间运行后发布 candidate | Electron 进程不重启，bridge snapshot 自动变为 `update-available` |
| 任意自动或手动检查 | 发现更新后停在 `update-available`，不产生下载请求 |
| 用户点击下载 | 进入下载流程并停在 `downloaded` |
| 手动检查 | 立即检查，并从新的 `lastCheckedAt` 重新计算两小时 |
| 更新通道切换 | 若旧通道检查在途则先等待其收口，再单独检查新通道并重新计算两小时；不复用旧检查结果 |
| 旧状态含 `automaticChecks: false` 或 `autoDownload: true` | 整个旧偏好对象被忽略；自动检查仍运行且不自动下载，后续写入移除该对象 |
| 桌面内嵌 runtime | HTTP runtime update host 不暴露，只有桌面 bridge owner |
| 正常产品环境误设短间隔变量 | 未开启 verification mode 时仍固定两小时 |

## 验证命令

实现完成后至少运行：

1. Kernel 时间策略定向测试。
2. Desktop coordinator/manager、NPM update host/state store、server controller、client SDK 与 UI 相关测试。
3. 所有触达 TypeScript package 的 `tsc`。
4. `pnpm dev:verify-update -- --no-open`，观察同 PID 自动发现 candidate；完成下载与应用链路。
5. `pnpm -C apps/desktop smoke:update`，观察同 Electron 进程自动发现 candidate 并完成 apply/relaunch，同时确认 seed bundle 运行前后无漂移。
6. 相关 lint、`pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、maintainability guard。
7. 构建/冒烟后检查 `git status --short`，清理非预期生成产物。

## 非目标

- 不删除手动下载、手动应用或下载进度能力。
- 不自动 apply，不静默重启用户进程。
- 不取消 stable/beta 更新通道选择。
- 不新增面向用户的检查频率配置、环境配置文档或高级设置。
- 不把定时器放进前端页面、React effect 或 HTTP `getState` 请求。
- 不用轮询 UI 或刷新页面补偿后端生命周期缺口。
- 本轮不发布 NPM 包、桌面安装包或远程 update channel。
