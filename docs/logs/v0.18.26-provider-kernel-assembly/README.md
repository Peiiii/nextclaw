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

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/core tsc`：通过。
- `pnpm --filter @nextclaw/kernel tsc`：通过。
- `pnpm --filter @nextclaw/runtime tsc`：通过。
- `pnpm --filter @nextclaw/server tsc`：通过。
- `pnpm --filter @nextclaw/service tsc`：此前通过；当前工作区因无关 weixin 包改名/删除链路报 `Cannot find module '@nextclaw/channel-extension-weixin'`，未进入 automation/cron 类型问题。
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
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm lint:new-code:package-public-imports`：通过。
- `pnpm lint:new-code:governance`：此前被当前工作区既有 weixin 改动和迁移中的 provider 文件名阻塞；本轮已修正 provider 文件名和 shared 测试落点，收尾阶段重新执行。
- `pnpm lint:new-code:governance`：当前工作区仍被无关文件 `packages/nextclaw-openclaw-compat/src/plugins/bundled-channel-plugin-packages.constants.ts` 的文件角色治理阻塞。
- `pnpm lint:new-code:governance`：automation/cron 触达范围内治理问题已清理；当前仍被无关 weixin 触达文件的 context destructuring 阻塞。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`：当前触达范围非测试代码净减 287 行；触达 `packages/nextclaw-server/src/ui/config.ts` 红区，已补红区触达记录。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`：automation/cron 整合继续删减后触达范围总计 +689/-732，非测试代码 +459/-502，净减 43 行；仅提示 server UI 目录既有文件数 warning。

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
