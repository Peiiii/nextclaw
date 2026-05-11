# v0.18.26 Provider Kernel Assembly

## 迭代完成说明

本轮推进 provider 装配层收敛的第一刀纵向切片，并继续删除旧 service/runtime 装配路径：

- 新增方案文档 `docs/plans/2026-05-10-provider-kernel-assembly.md`。
- 让 `kernel.llmProviders` 开始持有 provider catalog、provider 创建和 connection test 入口。
- 将 server provider connection test 路径从直接 `new LiteLLMProvider` 改为调用 `nextclaw.llmProviders.testConnection(...)`。
- 将 gateway runtime 的 provider owner 改为直接使用 `nextclaw.llmProviders`。
- 删除 `RuntimeCommandService.createProvider` / `createMissingProvider`、`NextclawGatewayRuntime.createProviderManager`、`ConfigReloader.makeProvider` 和 service `MissingProvider`。
- 删除 `allowMissingProvider` 兼容开关。
- 删除 runtime `installBuiltinProviderRegistry()`，runtime 只保留 builtin provider catalog 查询能力，不再写入 core global registry。
- 删除 core 旧 `ProviderManager` class，仅保留结构化 `ProviderManager` 类型名给旧测试类型标注过渡。
- 删除 kernel 里未接入的 provider record CRUD、`LlmProviderRecord` 类型出口、provider id 字段和重复 `reload()` 别名。
- 将 NCP/telemetry 调用方收敛为依赖 kernel 暴露的 `LlmProviderRuntime` 结构能力，不再继承 core `ProviderManager`。
- 将 `litellm_provider` 文件改为 kebab-case 命名，满足新代码治理。

这不是最终迁移完成；core global provider registry facade 仍待下一刀删除。

同批次继续推进 kernel 唯一装配层：

- `NextclawKernel` 构造期直接创建真实 `MessageBus` 与 core `SessionManager`；kernel 根据顶层 `homeDir` 推导 `sessionsDir`，`SessionManager` 只接收自己的直接存储目录，不再依赖 `workspace/homeDir`。
- 删除 kernel 内未实现的 fake `SessionManager` stub 和 barrel 出口。
- gateway runtime 改为创建 scoped `NextclawKernel`，并直接使用 `kernel.eventBus`、`kernel.ingress`、`kernel.messageBus`、`kernel.sessions`、`kernel.llmProviders`。
- CLI agent 路径改为创建 scoped `NextclawKernel`，不再自己 `new MessageBus()` / `new SessionManager(...)`。
- runtime update host 改为使用 gateway 传入的 scoped event bus，避免更新事件发到全局 kernel。
- 删除 `createNpmRuntimeUpdateHost()` 空 wrapper，gateway 装配层直接初始化 `NpmRuntimeUpdateHost`。
- server provider connection test 改为使用 UI router options 中传入的 gateway provider manager，不再访问全局 `nextclaw.llmProviders`。
- 删除 server config 中已经没有非测试调用点的 legacy session helper，避免旧 `new SessionManager(...)` 残留成第二装配入口。

同批次继续整合 automation/cron 装配：

- `AutomationManager` 保留命名并变成真实 owner，继承现有 `CronService` 能力，同时保留 cron jobs 数据结构和 `listJobs/addJob/removeJob/enableJob/runJob/status/start/reloadFromStore` 调用面。
- kernel 构造期根据顶层 `homeDir` 推导 `cron/jobs.json`，并直接创建 `kernel.automation`。
- gateway runtime 不再直接 `new CronService(...)`，改为使用 `kernel.automation`；cron store watcher 直接使用 `automation.storePath`，避免 gateway 重新推导同一存储路径。
- 本地 cron CLI service 不再直接实例化 `CronService`，也不再创建 `NextclawKernel`；离线命令只持有一个 `AutomationManager` 直接读写 cron store。
- 删除 kernel 根入口导出的顶层 `nextclaw` singleton，避免仅 import `@nextclaw/kernel` 就隐式创建一套 kernel 对象图。
- 将 core cron service 文件从 `services/service.ts` 规范化为 `services/cron.service.ts`，同步更新 barrel 和测试文件名。
- 删除 `AutomationManager` 中所有未实现 throw stub、未使用 automation CRUD 别名，以及 `AutomationTrigger/AutomationPayload/AutomationState/AutomationRecord` 这类只换名不建模的类型 alias；当前只保留真实可用的 cron 调用面。
- `startGatewayRuntimeSupport` 不再接收 `cronJobs/startCron/cronStorePath/reloadCronStore` 等碎片参数，改为接收 `AutomationManager` owner 并直接调用其状态、启动和 reload 能力。

同批次继续整合 channel 装配：

- `core` 保留唯一真实 `ChannelManager` 实现，作为可复用 channel runtime 组件；不再保留 kernel fake CRUD manager，也不再出现 `CoreChannelManager`/`KernelChannelManager` 两层包装。
- `NextclawKernel` 构造期直接创建并持有 `kernel.channels`，依赖同一个 `kernel.messageBus` 与 `kernel.sessions`。
- `ConfigReloader` 不再接收 `bus/sessionManager` 并自行 `new ChannelManager(...)`，只负责把配置快照和 extension channel registry 装载到 kernel 持有的 channel owner。
- 删除只负责转发 channel 启动的 `GatewayChannelManager`；gateway 延迟启动流程直接调用 runtime 上的 `startDeferredChannels()`，最终进入 `kernel.channels.start()`。
- 删除只保存 workspace 字段的 `GatewayWorkspaceManager`，gateway runtime 直接持有 `workspace` 这个外部事实。
- 删除只创建 marketplace config 的 `GatewayMarketplaceManager`，gateway runtime 直接创建 `marketplace` 配置对象。
- 删除 kernel `ChannelRecord`/CRUD stub/type barrel，以及 core 旧 `services/manager.ts` 和旧 typing-control 测试文件；新增 core manager 定向测试覆盖 load/start/reload/control delivery。

同批次继续清理 kernel 空心 owner：

- 删除 kernel 内未实现的 `TaskManager` throw stub、`ContextBuilder` throw stub，以及对应 `TaskRecord`/`ContextRecord` 类型出口。
- `NextclawKernel` 不再构造 `tasks` / `contextBuilder` 两个没有真实职责闭环的对象。
- 保留 `TaskId` 等仍被 session/kernel run 类型使用的基础 id 类型，不做无关破坏性删除。

同批次继续收敛 config 装配：

- 新增 kernel 内部 `ConfigManager` 作为唯一配置事实 owner，负责配置路径、当前配置快照、配置读取、reload plan 执行，以及 providers/channels 的配置装载。
- `NextclawKernel` 构造期直接创建 `configManager`，并把同一个 `kernel.channels` 与 `kernel.llmProviders` 交给它装配；`workspace` 不再作为 kernel options 传入。
- gateway runtime 不再创建 `GatewayConfigManager`，只引用 `kernel.configManager`；UI config/static dir 保留为 gateway UI runtime 自身状态，不再混入 config owner。
- 删除 service 侧 `GatewayConfigManager` 与 `ConfigReloader` 两层旧 owner，调用方统一改为 `configManager.loadConfig/applyReloadPlan/rebuildChannels/scheduleReload`。
- plugin、extension、NCP dispatch、session realtime bridge、remote runtime 与 gateway controller 的配置读取都收敛到同一个 `ConfigManager` 调用面，不再使用 `loadGatewayConfig` 或 `configManager.reloader`。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/core tsc`：通过。
- `pnpm --filter @nextclaw/kernel tsc`：通过。
- `pnpm --filter @nextclaw/runtime tsc`：通过。
- `pnpm --filter @nextclaw/server tsc`：通过。
- `pnpm --filter @nextclaw/service tsc`：通过。
- `pnpm --filter @nextclaw/kernel tsc`：通过。
- `pnpm --filter @nextclaw/server tsc`：通过。
- `pnpm --filter @nextclaw/service tsc`：通过。
- `pnpm --filter @nextclaw/server tsc`：通过。
- `pnpm --filter @nextclaw/kernel lint`：通过。
- `pnpm --filter @nextclaw/service lint`：通过，有既有 warning。
- `pnpm --filter @nextclaw/service test -- src/commands/service/gateway-manual-restart-contract.controller.test.ts src/shared/services/gateway/tests/gateway-plugin-manager.service.test.ts src/shared/services/gateway/tests/nextclaw-app.service.test.ts src/shared/controllers/gateway.controller.test.ts src/commands/ncp/features/runtime/nextclaw-ncp-runner.test.ts`：通过。
- `pnpm lint:new-code:governance`：通过；仅提示 `gateway.controller.ts` 与其测试是既有 legacy shared orchestration warning。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`：config manager 收敛触达范围总计 +353/-426，净减 73 行；非测试代码 +324/-396，净减 72 行；仅提示 runtime 目录既有预算豁免及少数文件接近预算。
- `pnpm --filter @nextclaw/kernel lint`：通过。
- `pnpm --filter @nextclaw/core lint`：通过，有既有 warning。
- `pnpm --filter @nextclaw/kernel lint`：通过。
- `pnpm --filter @nextclaw/runtime lint`：通过。
- `pnpm --filter @nextclaw/server lint`：通过，有既有 warning。
- `pnpm --filter @nextclaw/service lint`：通过，有既有 warning。
- `pnpm --filter @nextclaw/core test -- src/features/cron/services/cron.service.test.ts src/features/agent/features/tools/cron.test.ts`：通过。
- `pnpm --filter @nextclaw/service test -- src/cli/commands/cron/services/cron-local.service.test.ts`：通过。
- `pnpm --filter @nextclaw/core test -- src/features/llm-providers/providers/litellm.provider.test.ts`：通过。
- `pnpm --filter @nextclaw/service test -- src/shared/services/telemetry/llm-usage-observer.service.test.ts src/commands/ncp/provider/provider-manager-ncp-llm-api.service.test.ts src/commands/service/gateway-manual-restart-contract.controller.test.ts`：通过。
- `pnpm --filter @nextclaw/service test -- src/shared/services/ui/tests/npm-runtime-update-host.service.test.ts`：通过。
- `pnpm --filter @nextclaw/core test -- src/features/channels/managers/channel.manager.test.ts`：通过，覆盖 core `ChannelManager` 装载、启动、control delivery 与 reload。
- `pnpm --filter @nextclaw/service test -- src/commands/service/gateway-manual-restart-contract.controller.test.ts src/shared/services/gateway/tests/gateway-plugin-manager.service.test.ts src/shared/services/gateway/tests/nextclaw-app.service.test.ts`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm lint:new-code:package-public-imports`：通过。
- `pnpm lint:new-code:governance`：通过；仅提示 `packages/nextclaw-service/src/shared/controllers/gateway.controller.ts` 是既有 legacy shared orchestration warning。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`：当前触达范围非测试代码净减 287 行；触达 `packages/nextclaw-server/src/ui/config.ts` 红区，已补红区触达记录。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`：automation/cron 整合继续删减后触达范围总计 +689/-732，非测试代码 +459/-502，净减 43 行；仅提示 server UI 目录既有文件数 warning。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`：channel/gateway 整合触达范围总计 +401/-473，净减 72 行；非测试代码 +266/-345，净减 79 行；仅提示 runtime 目录既有预算豁免和 `nextclaw-ncp-dispatch.utils.ts` 接近文件预算。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`：kernel task/context 空心 owner 清理触达范围总计 +1/-123，净减 122 行；非测试代码 +1/-123，净减 122 行；无维护性发现。

路由测试 `pnpm --filter @nextclaw/server test -- src/ui/router.provider-test.test.ts` 当前被既有 `@core/*` alias 解析问题阻塞，未进入测试用例执行。
路由测试 `pnpm --filter @nextclaw/server test -- src/ui/router.cron.test.ts` 当前同样被既有 `@core/*` alias 解析问题阻塞，未进入测试用例执行。

## 发布/部署方式

未发布。该改动需要随下一次统一 beta/stable 发布批次评估。

## 用户/产品视角的验收步骤

1. 打开 provider 设置页。
2. 对 provider 执行连接测试。
3. 预期：连接测试仍返回原有成功/失败契约，但 provider 实例化由 `kernel.llmProviders` 承担。
4. 启动 gateway 或 CLI agent。
5. 预期：session store 与 message bus 均来自当前 scoped kernel，runtime update 事件也通过同一个 scoped event bus 发布。
6. 使用 cron CLI 或 UI cron API 新增、启停、删除定时任务。
7. 预期：原有 cron jobs JSON 数据继续可读写；gateway runtime 背后的 owner 是 `kernel.automation`；cron CLI 作为离线数据命令直接使用 `AutomationManager`，外部行为不变。

## 可维护性总结汇总

本轮遵守 `deletion-first` 和 `complete-owner` 的方向，删除了 server、gateway、runtime command 和 runtime global install 上的多处 provider 装配路径。

同批次继续删除 fake kernel session manager、gateway/CLI 的散点 session/messageBus 创建，以及 server config 里的 legacy session helper。kernel 现在负责构造同步对象图；gateway/CLI 只传入 workspace/homeDir 这类外部事实，生命周期层不再搬运这些 owner 的创建逻辑。

automation/cron 继续沿用同一原则：保留 `AutomationManager` 这个语义 owner，但不迁移现有数据模型，不额外制造 wrapper/factory。gateway runtime 的 cron 装配入口收敛到 kernel；cron CLI 是离线数据命令，只直接持有 `AutomationManager`，不创建完整 kernel；core 的 `CronService` 仍作为可复用调度组件存在。

channel 收敛继续沿用同一原则：core 只提供唯一可复用的 `ChannelManager` 组件；kernel 是唯一对象图装配点；service 生命周期层只把配置和 extension registry 装载进去，不再创建或包一层 channel owner。本次通过删除 kernel fake manager、类型 stub、service 散点实例化路径，以及 `GatewayChannelManager`/`GatewayWorkspaceManager`/`GatewayMarketplaceManager` 这类薄壳，让职责更集中且非测试代码净减。

kernel task/context 清理继续沿用 `deletion-first` 和 `complete-owner`：未实现、无调用、只会在运行期 throw 的 `TaskManager` / `ContextBuilder` 不应留在 kernel 对象图里。本次直接删除这些空心 owner 和对应类型出口，没有新增兼容别名。

config manager 收敛继续沿用 `single-domain-owner`、`complete-owner` 和 `constructor-builds-graph`：配置路径、配置快照、reload plan、provider reload 与 channel rebuild 回到一个真实 `ConfigManager`；kernel 只负责统一实例化，gateway 只安装服务侧必要 hooks。通过删除 `GatewayConfigManager` 与 `ConfigReloader` 两个旧 owner，并删除 `loadGatewayConfig` / `configManager.reloader` 调用面，本批次非测试代码继续净减。

当前保留债务：

- core 仍存在 global provider registry facade。
- config schema/provider metadata 仍读取 core global registry；下一刀应改为显式 catalog 输入，而不是再包一层兼容。
- core 仍保留结构化 `ProviderManager` 过渡类型名，服务侧测试后续可改到 `LlmProviderRuntime` 后删除。

这些旧路径已写入方案文档的后续删除清单，下一刀应优先删除 global registry facade。

## 红区触达与减债记录

### packages/nextclaw-server/src/ui/config.ts

- 本次是否减债：是。
- 说明：删除该红区文件里直接 `new LiteLLMProvider` 的 provider 创建职责，后续又把 provider connection test 改为使用 UI router options 传入的 gateway provider manager；同时删除无调用点的 legacy session helper 和直接 `new SessionManager(...)` 路径，让红区文件少承担 provider/session 装配细节。
- 下一步拆分缝：继续把 provider config view、provider connection test、provider auth/action 路由从 `config.ts` 中拆到 provider-focused controller/service。

## NPM 包发布记录

不涉及 NPM 包发布。
