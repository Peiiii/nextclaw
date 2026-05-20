# v0.18.95 Plugin Extension Snapshot Kernel

## 迭代完成说明

本轮继续推进 service 到 kernel 的低冲突重构，完成 `Plugin Extension Snapshot 归属收敛`：

- `ExtensionManager` 承接 plugin registry 到 extension registry、channel bindings、UI metadata snapshot 的构建规则。
- `ExtensionManager` 删除公开 `installHost` 补装入口，加载能力改为随 kernel 对象图构造完成，避免 manager 门面暴露“缺少内部能力”的半初始化状态。
- extension manifest channel contributions 与 plugin registry channel 的去重/覆盖规则进入 kernel owner。
- service `GatewayPluginManager` 删除本地 `PluginSnapshot` owner，只保留插件加载时机、bootstrap 进度、gateway 启停、日志和热重载触发。
- service 侧删除 `plugin-extension-registry.utils.ts`，并移除 plugin index 对 `toExtensionRegistry` 的重导出，避免 extension registry 转换工具继续外泄。
- 删除 kernel/service 内无主调用方的 `loadContributions` / `ExtensionContributions` / `plugin-reload` 残留入口，避免绕过 `ExtensionManager.load/reloadForConfigChange` 主路径。
- 删除 service `ServiceExtensionRuntime` 与 `ExtensionLifecycleService`，将 extension manifest discovery、stdio lifecycle、ingress request/response bridge 收回 kernel `ExtensionRuntimeService`。
- 新增 kernel `ExtensionPluginRegistryService`，承接 plugin registry progressive load、dev first-party plugin loading context、explicit dev override、excludeRoots 与 reserved provider/tool 规则，避免把 registry loader 作为 `extensionManagerDeps` 从 service 传入。
- 将 extension manifest discovery、stdio lifecycle 与 dev development-source helpers 拆入 kernel feature root，避免 `ExtensionRuntimeService` 继续膨胀成大文件。
- 追加收敛 channel list：service `ChannelListViewService` 不再直接访问 `ExtensionManifestDiscoveryService` / `resolveExtensionManifestRoots`，改为调用 kernel `ExtensionChannelCatalogService`。
- `ExtensionRuntimeService` 不再通过 kernel 根入口导出，`loadContributions` 改为内部语义更窄的 `loadChannelContributions`。
- service 启动链路只调用 `kernel.extensions.registerIngressHandlers/start/stop/load/reloadForConfigChange`，不再组装 extension host、plugin registry 或 manifest contributions。

根因：kernel `ExtensionManager` 已经是 extension registry、channel bindings、UI metadata 的事实 owner，但 service gateway 侧仍自行派生并维护同一份 snapshot，再写回 kernel，形成 owner 错位。

后续纠偏根因：删除 public `installHost` 后，一度把同类能力挪进 `extensionManagerDeps`。这仍然是职责泄露，只是泄露位置从运行期补装变成构造期依赖。真正收敛应由 facade 内部或私有协作者持有领域闭环，构造参数只保留基础设施端口。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-kernel build`
- `pnpm -C packages/nextclaw-kernel test -- --run src/managers/extension.manager.test.ts src/services/extension-runtime.service.test.ts src/features/extension-development-source/utils/dev-plugin-overrides.utils.test.ts src/features/extension-development-source/utils/first-party-plugin-load-paths.utils.test.ts src/features/extension-development-source/utils/first-party-plugin-load-paths-path-install.utils.test.ts`
- `pnpm -C packages/nextclaw-service test -- --run src/shared/services/gateway/tests/gateway-plugin-manager.service.test.ts src/commands/channel/channels.test.ts src/shared/services/gateway/tests/nextclaw-app.service.test.ts`
- `pnpm -C packages/nextclaw-service tsc`：当前被并行 agent-runtime/UI router 类型改动阻塞，剩余报错集中在 `AgentRuntimeHandle`、`liveAgentRuntime`、`UiRouterOptions.agentRunRequests` 等非本轮 extension owner 收敛问题。
- `pnpm -C packages/nextclaw-kernel exec eslint src/app/nextclaw-kernel.ts src/managers/extension.manager.ts src/managers/extension.manager.test.ts src/services/extension-runtime.service.ts src/services/extension-runtime.service.test.ts src/services/extension-plugin-registry.service.ts src/features/extension-runtime/index.ts src/features/extension-runtime/types/extension-runtime.types.ts src/features/extension-runtime/services/extension-lifecycle.service.ts src/features/extension-runtime/services/extension-manifest-discovery.service.ts src/features/extension-development-source/index.ts src/features/extension-development-source/utils/dev-plugin-overrides.utils.ts src/features/extension-development-source/utils/dev-plugin-overrides.utils.test.ts src/features/extension-development-source/utils/first-party-plugin-load-paths.utils.ts src/features/extension-development-source/utils/first-party-plugin-load-paths.utils.test.ts src/features/extension-development-source/utils/first-party-plugin-load-paths-path-install.utils.test.ts src/index.ts`
- `pnpm -C packages/nextclaw-service exec eslint src/shared/services/gateway/managers/gateway-plugin.manager.ts src/shared/services/gateway/tests/gateway-plugin-manager.service.test.ts src/commands/channel/channel-list-view.service.ts src/commands/channel/channels.test.ts src/shared/services/gateway/nextclaw-gateway-runtime.service.ts src/shared/services/gateway/nextclaw-app.service.ts src/shared/services/gateway/tests/nextclaw-app.service.test.ts src/cli/commands/agent/cli-agent-runner.utils.ts src/service-runtime.service.ts src/commands/plugin/index.ts`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/nextclaw-service lint`
- `node scripts/governance/lint-doc-file-names.mjs -- docs/plans/2026-05-20-service-to-kernel-non-conflicting-refactor-plan.md docs/logs/v0.18.95-plugin-extension-snapshot-kernel/README.md`
- `node scripts/governance/lint-new-code-governance.mjs -- <本轮文件>`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths <本轮文件>`
- `pnpm check:governance-backlog-ratchet`

`pnpm -C packages/nextclaw-service lint` 通过但保留 18 个既有 warning，未命中本轮触达文件。

## 发布/部署方式

未执行发布或部署。本轮是 kernel/service 内部职责收敛，需随项目后续统一发布闭环进入 NPM/桌面交付。

## 用户/产品视角的验收步骤

- gateway 启动时仍应能加载插件 registry。
- extension manifest channel contribution 应覆盖同 channelId 的 registry channel。
- plugin channel gateway 启停行为保持不变。
- kernel `extensions` 应作为 extension registry、channel bindings、UI metadata 的单一读取入口。
- extension stdio runtime 的 ingress handlers 与 start/stop 生命周期由 kernel `extensions` 统一承接。
- dev plugin override 与 first-party source loading 行为在 gateway 主链路中保持。

## 可维护性总结汇总

- 使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 收尾。
- 正向减债动作：删除 service 侧 snapshot owner、删除 service 侧 extension registry 转换工具、将派生规则收回 kernel owner。
- 复盘改进：已把“新增/移动 public owner API 后必须反查调用方，无明确 contract 且无调用方则删除”、“子系统 manager/facade 不向业务流暴露 registry/snapshot/contributions 等内部中间态”以及“不能把职责泄露从 public 方法挪到 constructor deps/options”的规则补进 `nextclaw-clean-implementation` skill。
- 非新增用户能力，满足非测试代码净增不为正：收尾 maintainability guard 全量 diff 统计 total +4517 / -6896 / net -2379，non-test +2893 / -3547 / net -654。
- maintainability guard 仅提示 `packages/nextclaw-service/src/commands/plugin/index.ts` 接近 400 行预算；本轮没有增加该文件行数，后续 plugin command 拆分可单独处理。

## NPM 包发布记录

不涉及 NPM 包发布。
