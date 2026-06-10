# NextClaw Service / Kernel Maintainability Implementation Plan

**目标：** 分批治理 `nextclaw`、`@nextclaw/service` 与 `@nextclaw/kernel` 的维护性问题，优先收敛真实 owner、减少公共表面、清理高置信垃圾代码，并保持每一批都可独立验证和回滚。

**架构方向：** `nextclaw` 保持 CLI/bin facade；`@nextclaw/service` 承担长期服务宿主、CLI runtime 与发布/启动控制；`@nextclaw/kernel` 承担产品 kernel 主干 owner。优化重点不是重新分层造概念，而是把已经漂移的职责收回真实 owner，收窄公共 export，把内置扩展、service app、runtime restart 等链路变成单一事实源。

**适用规范：** 执行前必须按任务触发 `nextclaw-delivery-workflow`、`nextclaw-clean-implementation`、`writing-beautiful-code`；涉及 kernel 主干/owner 使用 `kernel-branch-owner-architecture`；涉及目录/命名使用 `file-organization-governance`、`role-first-file-organization`、`file-naming-convention`；涉及死代码使用 `nextclaw-dead-code-governance`；收尾使用 `nextclaw-validation-workflow`、`post-edit-maintainability-guard`、`post-edit-maintainability-review` 与 `nextclaw-iteration-log-governance`。

---

## 目标架构方案

`packages/nextclaw-service` 的最佳形态是 **Service Runtime 主干 + 稳定 Manager Owners + 角色目录落位**。这里的“主干/分支”只用于分析 owner 拓扑，不进入实现命名；实现统一使用 `manager`、`controller`、`service`、`store`、`utils`、`types` 等既有角色。

### 目标目录结构

```text
packages/nextclaw-service/src/
├── app/
│   └── nextclaw-service-runtime.ts
├── controllers/
│   └── commands/
│       ├── agent-command.controller.ts
│       ├── channel-command.controller.ts
│       ├── config-command.controller.ts
│       ├── cron-command.controller.ts
│       ├── diagnostics-command.controller.ts
│       ├── gateway-command.controller.ts
│       ├── logs-command.controller.ts
│       ├── marketplace-skill-command.controller.ts
│       ├── mcp-command.controller.ts
│       ├── platform-auth-command.controller.ts
│       ├── remote-command.controller.ts
│       ├── restart-command.controller.ts
│       ├── secrets-command.controller.ts
│       ├── service-command.controller.ts
│       ├── start-command.controller.ts
│       ├── stop-command.controller.ts
│       ├── ui-command.controller.ts
│       └── usage-command.controller.ts
├── launcher/
│   ├── npm-runtime-launcher.service.ts
│   └── utils/
├── managers/
│   ├── managed-service.manager.ts
│   ├── runtime-update.manager.ts
│   ├── service-command.manager.ts
│   ├── service-gateway.manager.ts
│   ├── service-marketplace.manager.ts
│   ├── service-remote.manager.ts
│   ├── service-restart.manager.ts
│   └── service-workspace.manager.ts
├── services/
│   ├── gateway/
│   ├── marketplace/
│   ├── remote/
│   ├── restart/
│   ├── runtime/
│   └── ui/
├── stores/
├── types/
├── utils/
└── index.ts
```

关键约束：

- `src/` 根只保留 `index.ts` 和角色目录，不直接挂 `*.service.ts` 角色实现。
- `app/` 只放 service package 启动/装配主干，不放领域流程细节。
- `managers/` 放业务编排 owner；manager 拥有状态、生命周期或多步流程闭环。
- `controllers/commands/` 放 CLI 命令入口适配；命令 controller 只解析 CLI 输入并调用 manager，不拥有领域流程。
- `services/` 放 manager 私有或跨 manager 可复用的 IO/协议/平台适配能力；service 必须有 class 且拥有流程、生命周期或远程 IO 协调。
- `stores/` 放本地状态文件、运行态 state/pointer、安装状态等持久化 owner。
- `utils/` 放无状态解析、归一化、格式化、路径转换。
- `launcher/` 只保留 NPM package launcher 的入口语义，不再混入 runtime update manager。

### 主干 owner

`NextclawServiceRuntime` 作为 public facade 保留类名，避免破坏 `@nextclaw/service` 外部 API；文件从 `src/service-runtime.service.ts` 迁到 `src/app/nextclaw-service-runtime.ts`。

目标职责：

- 创建并持有长期 manager 对象图。
- 暴露顶层 CLI runtime API，例如 `init`、`login`、`agent`、`update` 和 `commands`。
- 把稳定 manager 直接接线给 CLI command / gateway runtime。
- 不实现任何 manager 内部细节流程。

它不再承担：

- command group 的构造细节。
- restart request / self relaunch / background restart 状态机。
- managed service start/stop/readiness 状态机。
- marketplace / remote / gateway / runtime update 的领域流程。

### 稳定 manager owner

| Manager | 当前代码来源 | 目标职责 | 主要依赖 |
| --- | --- | --- | --- |
| `ServiceCommandManager` | `NextclawServiceRuntime.createCommands`、各 `*Commands` class | 创建并持有 CLI command controllers，统一把 CLI command 接到 manager。 | 各领域 manager、`logo` |
| `ServiceRestartManager` | `RuntimeRestartRequestService`、`RestartCoordinator`、`armManagedServiceRelaunch`、`writeRestartSentinelFromExecContext` | 统一 restart request、pending restart、background restart、self relaunch、manual-required、restart sentinel。 | `ManagedServiceManager`、restart stores/utils |
| `ManagedServiceManager` | `ManagedServiceCommandService`、`ManagedServiceSupervisor`、`managedServiceStateStore`、`localUiRuntimeStore` | 管理后台 service start/stop/foreground/readiness/state。 | `ServiceGatewayManager`、runtime services/stores |
| `ServiceGatewayManager` | `NextclawGatewayRuntime`、gateway support services | 管理 gateway runtime 生命周期、UI startup、bootstrap status、remote/bootstrap/runtime loop。 | `NextclawKernel`、server UI、remote/marketplace/update managers |
| `RuntimeUpdateManager` | `NpmRuntimeUpdateManager`、`NpmRuntimeUpdateService`、bundle/update state files、`NpmRuntimeUpdateHost` | 管理 runtime update check/download/apply/bundle/update host。 | distribution service、update stores/services |
| `ServiceMarketplaceManager` | skills marketplace files、`ServiceMarketplaceInstaller`、`ServiceMcpMarketplaceOps` | 管理 marketplace install/update/publish/query。 | marketplace client/services/stores |
| `ServiceRemoteManager` | remote commands、remote access host、remote service control | 管理 remote access/control/platform API 协作。 | platform auth services、managed service state |
| `ServiceWorkspaceManager` | `WorkspaceManager`、`initializeConfigIfMissing`、runtime init | 管理 workspace/template 初始化与 init 过程。 | config/path utils |

### 当前文件到目标文件的迁移映射

| 当前文件/目录 | 目标文件/目录 | 说明 |
| --- | --- | --- |
| `src/service-runtime.service.ts` | `src/app/nextclaw-service-runtime.ts` | 保留 `NextclawServiceRuntime` public class，文件角色从 service 实现变为 app 主干边界。 |
| `src/shared/services/restart/runtime-restart-request.service.ts` | `src/managers/service-restart.manager.ts` | 合入 restart manager，不保留只有中转意义的 request service。 |
| `src/shared/services/restart/restart-coordinator.service.ts` | `src/managers/service-restart.manager.ts` 或 `src/services/restart/restart-coordinator.service.ts` | 若只是 manager 私有策略，可合入 manager；若测试价值高且策略独立，保留为 restart service。 |
| `src/shared/services/restart/service-runtime-self-relaunch.service.test.ts` | `src/managers/service-restart.manager.test.ts` | 测 self relaunch 应直接测 restart manager 的意图级能力。 |
| `src/shared/utils/restart/restart-sentinel.utils.ts` | `src/utils/restart-sentinel.utils.ts` | 无状态文件读写/格式化属于 utils。 |
| `src/shared/services/runtime/runtime-command.service.ts` | `src/managers/managed-service.manager.ts` 或 `src/services/runtime/runtime-command.service.ts` | start/stop/foreground 编排进入 manager；底层 spawn/run command 可留 service。 |
| `src/shared/services/runtime/service-managed-startup.service.ts` | `src/managers/managed-service.manager.ts` + `src/services/runtime/managed-service-startup.service.ts` | 高层 start/readiness 状态机进 manager；纯 readiness helper 可留 service/utils。 |
| `src/shared/services/runtime/managed-service-supervisor.service.ts` | `src/services/runtime/managed-service-supervisor.service.ts` | 进程探测/监督是 runtime service，不强行改 manager。 |
| `src/shared/stores/managed-service-state.store.ts` | `src/stores/managed-service-state.store.ts` | store 移到根 `stores/`。 |
| `src/shared/stores/local-ui-runtime.store.ts` | `src/stores/local-ui-runtime.store.ts` | store 移到根 `stores/`。 |
| `src/shared/services/gateway/nextclaw-gateway-runtime.service.ts` | `src/managers/service-gateway.manager.ts` | Gateway runtime 生命周期 owner 改为 manager。 |
| `src/shared/services/gateway/gateway-restart-wake.service.ts` | `src/services/gateway/gateway-restart-wake.service.ts` | Gateway manager 私有协作 service。 |
| `src/shared/services/gateway/managers/*` | `src/managers/service-remote.manager.ts` / `src/managers/service-gateway.manager.ts` / `src/services/gateway/*` | 现有 `managers/` 嵌套先按职责拆回顶层 manager 或 gateway service，不保留多层 manager 目录。 |
| `src/launcher/npm-runtime-update.manager.ts` | `src/managers/runtime-update.manager.ts` | Runtime update 高层 owner 是 manager。 |
| `src/launcher/npm-runtime-update*.service.ts` | `src/services/runtime-update/*.service.ts` | check/download/source/bundle 等底层能力留 service。 |
| `src/launcher/npm-runtime-update-state.store.ts` | `src/stores/npm-runtime-update-state.store.ts` | update 状态持久化进 stores。 |
| `src/launcher/npm-runtime-bundle-layout.store.ts` | `src/stores/npm-runtime-bundle-layout.store.ts` | bundle layout 状态/路径 owner 进 stores。 |
| `src/launcher/npm-runtime-launcher.service.ts` | `src/launcher/npm-runtime-launcher.service.ts` | package launcher 入口语义保留在 launcher。 |
| `src/shared/services/ui/npm-runtime-update-host.service.ts` | `src/services/runtime-update/npm-runtime-update-host.service.ts` | UI host 是 runtime update 的服务适配。 |
| `src/shared/services/ui/runtime-control-host.service.ts` | `src/services/ui/runtime-control-host.service.ts` | UI runtime control 适配留 service。 |
| `src/shared/services/ui/companion-runtime.service.ts` | `src/services/ui/companion-runtime.service.ts` | UI companion runtime service。 |
| `src/shared/services/marketplace/*` | `src/services/marketplace/*` | marketplace IO/installer service 归 marketplace services。 |
| `src/cli/commands/skills/*` | `src/controllers/commands/marketplace-skill-command.controller.ts` + `src/managers/service-marketplace.manager.ts` + services/stores/utils | CLI 入口是 controller；install/update/publish/query 编排进 manager；client/retry/payload 归 services/utils/stores。 |
| `src/commands/remote/*` | `src/controllers/commands/remote-command.controller.ts` + `src/managers/service-remote.manager.ts` + services/utils | remote CLI 入口和 remote 业务 owner 分离。 |
| `src/commands/platform-auth/*` | `src/controllers/commands/platform-auth-command.controller.ts` + `src/services/platform-auth/*` | 平台认证命令 controller 调用 auth services。 |
| `src/commands/channel/*` | `src/controllers/commands/channel-command.controller.ts` + `src/services/channel/*` | channel 命令入口和视图/配置服务分离。 |
| `src/commands/service/*` | `src/controllers/commands/service-command.controller.ts` + `src/managers/managed-service.manager.ts` + services/runtime | autostart/status/start/stop 归 managed service manager。 |
| `src/cli/commands/config/*` | `src/controllers/commands/config-command.controller.ts` + `src/services/config/*` | config command 入口变 controller。 |
| `src/cli/commands/cron/*` | `src/controllers/commands/cron-command.controller.ts` + `src/services/cron/*` | cron command 入口变 controller；本地 cron service 保留 service。 |
| `src/cli/commands/diagnostics/*` | `src/controllers/commands/diagnostics-command.controller.ts` + `src/services/diagnostics/*` + `src/utils/diagnostics-render.utils.ts` | diagnostics collector/renderer 分离。 |
| `src/cli/commands/gateway/index.ts` | `src/controllers/commands/gateway-command.controller.ts` | CLI 命令入口改 controller。 |
| `src/cli/commands/start/index.ts` | `src/controllers/commands/start-command.controller.ts` | CLI 命令入口改 controller。 |
| `src/cli/commands/restart/index.ts` | `src/controllers/commands/restart-command.controller.ts` | CLI 命令入口改 controller。 |
| `src/cli/commands/serve/index.ts` | `src/controllers/commands/serve-command.controller.ts` | CLI 命令入口改 controller。 |
| `src/cli/commands/stop/index.ts` | `src/controllers/commands/stop-command.controller.ts` | CLI 命令入口改 controller。 |
| `src/cli/commands/ui/index.ts` | `src/controllers/commands/ui-command.controller.ts` | CLI 命令入口改 controller。 |
| `src/cli/commands/mcp/index.ts` | `src/controllers/commands/mcp-command.controller.ts` + `src/services/mcp/*` | CLI 命令入口和 MCP ops 分离。 |
| `src/cli/commands/secrets/index.ts` | `src/controllers/commands/secrets-command.controller.ts` + `src/services/secrets/*` | CLI 命令入口和 secrets 业务服务分离。 |
| `src/cli/commands/logs/index.ts` | `src/controllers/commands/logs-command.controller.ts` | CLI 命令入口改 controller。 |
| `src/cli/commands/usage/*` | `src/controllers/commands/usage-command.controller.ts` + `src/services/usage/*` | usage command 入口和查询服务分离。 |
| `src/shared/types/cli.types.ts` | `src/types/cli.types.ts` | 公共 CLI contract 归根 `types/`。 |
| `src/shared/utils/*` | `src/utils/*` 或对应领域 `services/<domain>/utils/` | 全局无状态工具进根 utils；领域私有工具贴近对应服务目录。 |

### `module-structure.config.json` 目标

最终不应继续使用 `legacy-service-host-src`。目标 contract 应表达：

```json
{
  "contractKind": "legacy",
  "organizationModel": "legacy-service-runtime-manager-src",
  "rootPolicy": "legacy-frozen",
  "enforcement": "error",
  "allowedRootDirectories": [
    "app",
    "controllers",
    "launcher",
    "managers",
    "services",
    "stores",
    "types",
    "utils"
  ],
  "allowedRootFiles": ["index.ts", "module-structure.config.json"],
  "sharedDirectories": []
}
```

这次不新增全局 module-structure protocol。原因是 `nextclaw-service` 当前是单 package 局部治理，新增全局 protocol 会扩大治理脚本维护面；用 package 自己的 legacy contract 约束根目录即可。

### 命名原则

- 高层业务编排统一用 `*.manager.ts`，例如 `service-restart.manager.ts`。
- CLI 命令入口统一用 `*.controller.ts`，例如 `restart-command.controller.ts`。
- 拥有外部 IO、平台适配、协议桥接、子进程协作的能力用 `*.service.ts`。
- 持久化状态或 state file owner 用 `*.store.ts`。
- 无状态解析、格式化、路径处理用 `*.utils.ts`。
- 不新增 `branch`、`host`、`runtime` 作为角色目录；这些词只能作为领域名或 public class 名的一部分，不能替代角色后缀。

## 背景证据

- `packages/nextclaw/src/cli/app/index.ts` 是 CLI 命令注册入口，`packages/nextclaw/src/cli/launcher/index.ts` 只是配置 distribution 后转交 `@nextclaw/service` launcher。结论：`nextclaw` 包应保持薄 facade，不应吸收 service/kernel 业务 owner。
- `packages/nextclaw-service/src/service-runtime.service.ts` 同时负责 command group 创建、init/login/agent/update、自重启、restart coordinator 接线。当前自重启测试位于 `packages/nextclaw-service/src/shared/services/restart/service-runtime-self-relaunch.service.test.ts`，但没有对应 service，只能强转顶层 runtime 访问私有方法。
- `packages/nextclaw-kernel/src/index.ts` 根出口导出了 manager、store、service、utils、types。这个公共表面过宽，容易把内部 helper 固化成外部合同。
- `packages/nextclaw-kernel/src/features/extension-runtime/services/extension-manifest-discovery.service.ts` 硬编码内置 extension package 列表；`packages/nextclaw-service/package.json` 同时维护 `nextclaw.builtinExtensions` 和完整 dependencies。结论：内置扩展清单存在双事实源风险。
- `pnpm dlx knip --workspace @nextclaw/kernel --workspace @nextclaw/service --workspace nextclaw --include files,exports,dependencies --reporter compact --no-exit-code --max-show-issues 200` 报告中有大量测试、bin、scripts、`ui-dist` 误报；生产候选必须逐项反查，不能自动删除。
- `pnpm metrics:local` 显示当前 `packages/nextclaw-kernel` 与 `packages/nextclaw-service` 是仓库 LOC 前列核心包。治理应小刀推进，避免一次性重构主链路。

## 非目标

- 不重写 kernel 主干。
- 不把 `Panel App` 与 `Service App` 合并为一个 app 类型。
- 不用 knip 自动删除文件。
- 不为短期兼容保留未发布、无真实外部合同的旧路径。
- 不在当前计划里处理 `packages/nextclaw-core` 现有未提交改动。

## 执行原则

- 每批只处理一个责任链，默认非测试生产代码净增 `<= 0`。
- 先写或调整定向测试，再改生产代码。
- 每批结束必须跑对应 package 的 `tsc`、相关测试、targeted governance；触达源码时不能只跑 lint。
- 若发现当前批次需要扩大到公共 API 或发布合同，先停止并更新本计划，不顺手改。
- 工作区已有无关 WIP 时，只 stage 本批次触达文件。
- “主干/分支”只用于架构关系分析，不作为实现角色命名；`nextclaw-service` 内新增或迁移的业务编排 owner 默认使用既有角色名，例如 `manager`、`service`、`store`、`controller`、`utils`，不得新增 `branch` 目录或 `*.branch.ts` 文件。

## Task 1: 抽出 Service Runtime 自重启 Owner

**目标：** 让自重启逻辑从 `NextclawServiceRuntime` 回到明确 service owner，消除测试强转私有方法的坏味道。

**Files:**

- Create: `packages/nextclaw-service/src/shared/services/restart/service-runtime-self-relaunch.service.ts`
- Modify: `packages/nextclaw-service/src/shared/services/restart/service-runtime-self-relaunch.service.test.ts`
- Modify: `packages/nextclaw-service/src/service-runtime.service.ts`

**步骤：**

1. 读取 `service-runtime.service.ts` 的 `armManagedServiceRelaunch`、`RestartCoordinator`、`RuntimeRestartRequestService` 调用关系。
2. 将 helper script 构建、launch 解析、spawn/unref 与 `selfRelaunchArmed` 状态迁入 `ServiceRuntimeSelfRelaunchService`。
3. `NextclawServiceRuntime` 只持有该 service，并在 `RuntimeRestartRequestService` deps 中调用它的意图级方法。
4. 更新现有测试，直接实例化 `ServiceRuntimeSelfRelaunchService`，删除 `RelaunchRuntime` 私有方法强转。
5. 确认生产代码没有新增第二条自重启路径。

**验证：**

```bash
pnpm -C packages/nextclaw-service exec vitest run src/shared/services/restart/service-runtime-self-relaunch.service.test.ts
pnpm -C packages/nextclaw-service tsc
pnpm lint:new-code:governance -- --files packages/nextclaw-service/src/shared/services/restart/service-runtime-self-relaunch.service.ts packages/nextclaw-service/src/shared/services/restart/service-runtime-self-relaunch.service.test.ts packages/nextclaw-service/src/service-runtime.service.ts
```

**完成标准：** 顶层 runtime 行数下降或基本持平；自重启逻辑有真实 service owner；测试不再依赖私有方法强转。

## Task 2: 瘦身 NextclawServiceRuntime Command 装配

**目标：** 让 `NextclawServiceRuntime` 不再成为所有 command 细节的总装配文件。

**Files:**

- Create or Modify: `packages/nextclaw-service/src/shared/services/runtime/service-command-registry.service.ts`
- Modify: `packages/nextclaw-service/src/service-runtime.service.ts`
- Test: 复用或新增 `packages/nextclaw-service/src/shared/services/runtime/tests/*`

**步骤：**

1. 先确认 `NextclawServiceCommands` 是否是外部公共类型；若是，保持类型出口不变。
2. 把 `createCommands` 中的命令实例创建迁入新的 command registry/service。
3. 构造参数只传稳定外部事实：`logo`、`runtimeCommandService`、`workspaceManager`、`requestRestart`、`restartBackgroundService`。
4. 保持 command 对象 shape 不变，避免 CLI 注册层连锁修改。
5. 删除 `service-runtime.service.ts` 中不再直接使用的 command import。

**验证：**

```bash
pnpm -C packages/nextclaw-service tsc
pnpm -C packages/nextclaw-service exec vitest run src/commands/restart-commands.test.ts src/cli/commands/cron/services/cron-dev-service.service.test.ts
pnpm lint:new-code:governance -- --files packages/nextclaw-service/src/service-runtime.service.ts packages/nextclaw-service/src/shared/services/runtime/service-command-registry.service.ts
```

**完成标准：** `service-runtime.service.ts` 只表达 runtime 生命周期与顶层命令表，不直接知道每个 command 的构造细节。

## Task 3: 收敛内置 Extension 清单事实源

**目标：** 消除 kernel 和 service/distribution 对内置 extension package list 的双维护。

**Files:**

- Modify: `packages/nextclaw-kernel/src/features/extension-runtime/services/extension-manifest-discovery.service.ts`
- Modify: `packages/nextclaw-kernel/src/features/extension-runtime/index.ts`
- Modify: `packages/nextclaw-service/package.json`
- Maybe Modify: `packages/nextclaw-service/src/shared/services/gateway/nextclaw-gateway-runtime.service.ts`
- Test: `packages/nextclaw-kernel/src/services/extension-runtime.service.test.ts`

**步骤：**

1. 明确 owner：service/distribution 提供内置 extension package names 或 manifest roots；kernel discovery 只消费输入和环境目录。
2. 先更新测试，表达“kernel 不再硬编码 first-party channel package list”。
3. 修改 `resolveExtensionManifestRoots` 的输入合同，允许宿主注入内置 package names 或 roots。
4. 让 `NextclawGatewayRuntime` 或 service distribution 层读取 `package.json#nextclaw.builtinExtensions` 并传给 kernel。
5. 清理 kernel package 中不再需要的 channel-extension direct dependencies。

**验证：**

```bash
pnpm -C packages/nextclaw-kernel exec vitest run src/services/extension-runtime.service.test.ts
pnpm -C packages/nextclaw-kernel tsc
pnpm -C packages/nextclaw-service tsc
pnpm dlx knip --workspace @nextclaw/kernel --workspace @nextclaw/service --include dependencies,exports --reporter compact --no-exit-code --max-show-issues 120
```

**完成标准：** 内置 extension 列表只有一个可维护事实源；kernel 不再因分发清单直接依赖具体 channel extension 包。

## Task 4: Kernel 根 Export 审计与收窄

**目标：** 把 `@nextclaw/kernel` 根出口从“内部大礼包”收敛成稳定外部合同。

**Files:**

- Modify: `packages/nextclaw-kernel/src/index.ts`
- Maybe Modify: `packages/nextclaw-kernel/package.json`
- Maybe Modify: workspace 内部调用方

**步骤：**

1. 生成当前 root exports 表，分为 `external-stable`、`workspace-internal`、`test-only`、`private-candidate`。
2. 对 knip 报出的 unused exports 做 `rg` 反查，过滤测试和文档历史记录。
3. 第一批只删除或收窄确定非公共、非动态入口、非 package exports 的私有 helper。
4. 若某 export 可能已被外部消费，先保留并在文档中标为 deprecation candidate，不直接删。
5. 对 UI 与 kernel 双写常量类问题，例如 `show_content`，判断是否应上移 shared contract，而不是继续双写。

**验证：**

```bash
pnpm -C packages/nextclaw-kernel tsc
pnpm dlx knip --workspace @nextclaw/kernel --include exports --reporter compact --no-exit-code --max-show-issues 120
pnpm lint:new-code:governance -- --files packages/nextclaw-kernel/src/index.ts
```

**完成标准：** 根出口减少，或至少产出明确的 export ownership audit；没有把内部 helper 继续扩大成公共合同。

## Task 5: Kernel Root Utils / Types 小批次清理

**目标：** 清理高置信垃圾代码候选，减少 root `utils/` 和 `types/` 杂物感。

**候选：**

- `packages/nextclaw-kernel/src/utils/ncp-session-metadata.utils.ts`
- `packages/nextclaw-kernel/src/utils/agent-run-send-payload.utils.ts` 中仅本文件使用的 export
- `packages/nextclaw-kernel/src/tools/show-content.tools.ts` 与 UI 侧 `SHOW_CONTENT_TOOL_NAME` 双写
- knip 报出的 constants/helpers，但必须逐项反查

**步骤：**

1. 对每个候选跑 `rg`，确认生产引用、测试引用、package export、文档历史记录。
2. `确定可删` 直接删除；`疑似公共合同` 保留并记录。
3. 仅本文件内部使用的 export 改成非 export。
4. 跨 UI/kernel 的协议常量若要统一，优先上移 shared/client-safe contract，不让 UI deep import kernel。

**验证：**

```bash
pnpm -C packages/nextclaw-kernel tsc
pnpm -C packages/nextclaw-kernel test
pnpm dlx knip --workspace @nextclaw/kernel --include files,exports --reporter compact --no-exit-code --max-show-issues 120
```

**完成标准：** 每个删除都有静态反查证据；没有删除公共协议、bin、registry、动态 import 或测试入口误报。

## Task 6: `nextclaw` CLI 入口只保留 Facade 职责

**目标：** 防止 `packages/nextclaw` 重新膨胀成第二个 service/runtime owner。

**Files:**

- Modify: `packages/nextclaw/src/cli/app/index.ts`
- Modify: `packages/nextclaw/src/cli/app/register-app-commands.ts`
- Maybe Modify: `packages/nextclaw/package.json`

**步骤：**

1. 先把 `nextclaw` 包的所有 direct dependencies 分为 facade 必需、runtime transitive、发布资源必需。
2. 对 knip 报出的 dependency unused 项逐个反查 build scripts、bin、resources、package files。
3. 对确实只由 `@nextclaw/service` 使用的依赖，从 `nextclaw` direct deps 移除。
4. CLI 注册层只保留 commander command shape，业务行为继续委托 service 或本包 app dev/check controller。

**验证：**

```bash
pnpm -C packages/nextclaw tsc
pnpm -C packages/nextclaw exec vitest run src/cli/app
pnpm -C packages/nextclaw build
pnpm dlx knip --workspace nextclaw --include dependencies --reporter compact --no-exit-code --max-show-issues 120
```

**完成标准：** `nextclaw` 包没有新增 runtime owner；dependency 噪声下降；bin build 仍能通过。

## 收尾验证清单

每个任务收尾至少执行：

```bash
pnpm -C <touched-package> tsc
pnpm -C <touched-package> exec vitest run <relevant-tests>
pnpm lint:new-code:governance -- --files <touched-files>
node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths <touched-files>
pnpm check:governance-backlog-ratchet
```

如果触达 runtime/CLI 可运行行为，再加最贴近链路的冒烟：

```bash
pnpm -C packages/nextclaw dev:build -- --help
pnpm -C packages/nextclaw dev:build -- app check <fixture-or-temp-app-dir> --json
```

## 文档与留痕

- 本文是 `docs/plans` 执行计划，不创建 `docs/logs`。
- 任何任务实际改动源码、测试、脚本或运行链路后，收尾阶段再按 `nextclaw-iteration-log-governance` 判断是否创建或更新 `docs/logs/v<semver>-<slug>/README.md`。
- 若某批次只做计划修订或研究补充，不需要 NPM release，也不需要 iteration log。

## 优先级与价值排序

排序维度：

- **价值：** 是否直接降低核心包维护成本、减少 owner 漂移、消除公共合同膨胀或垃圾代码。
- **风险：** 是否触达 runtime/CLI/kernel 公共 API、发布合同、动态入口或真实用户路径。
- **确定性：** 是否已有硬证据、现成测试、清晰 owner 和可观察完成标准。
- **依赖关系：** 是否必须先完成前置拆分，才能避免后续任务继续扩大坏边界。

| 优先级 | 任务 | 价值 | 风险 | 确定性 | 依赖 | 排序理由 |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | Task 1: 抽出 Service Runtime 自重启 Owner | 高 | 低-中 | 高 | 无 | 现有测试已经暴露“有 service 测试名但没有 service owner”的明确坏味道；范围局部，收益立刻体现在 `service-runtime.service.ts` 职责下降。 |
| P0 | Task 2: 瘦身 NextclawServiceRuntime Command 装配 | 高 | 中 | 中-高 | Task 1 | `NextclawServiceRuntime` 是 service 包的核心膨胀点；完成 Task 1 后再拆 command 装配，可以避免一次性动太多 runtime 细节。 |
| P1 | Task 3: 收敛内置 Extension 清单事实源 | 高 | 中-高 | 中 | Task 1-2 后更稳 | 解决 kernel/service 分发清单双事实源，产品长期价值高；但触达 extension discovery 和 package deps，必须等 service runtime 边界稍稳后再做。 |
| P1 | Task 4: Kernel 根 Export 审计与收窄 | 中-高 | 中 | 中 | 可与 Task 3 后并行研究，实施需小刀 | 这是防止 kernel 内部 helper 固化成公共合同的关键治理；第一批应先做 audit 和确定可删项，不急着大删。 |
| P2 | Task 5: Kernel Root Utils / Types 小批次清理 | 中 | 中 | 中 | Task 4 | 价值来自减少 root `utils/` 杂物和 unused exports；但必须依赖 Task 4 的出口审计，否则容易误删公共合同。 |
| P2 | Task 6: `nextclaw` CLI 入口只保留 Facade 职责 | 中 | 中 | 中 | 可在 Task 1-2 后做 | `nextclaw` 当前还算薄，治理价值主要是防回潮和 dependency 噪声；优先级低于 service/kernel 主问题。 |

## 推荐执行批次

### Batch A: 先治理最高确定性的 service runtime 膨胀

1. Task 1: 抽出 Service Runtime 自重启 Owner。
2. Task 2: 瘦身 NextclawServiceRuntime Command 装配。

完成 Batch A 后应看到的变化：

- `service-runtime.service.ts` 不再直接承载自重启 helper script。
- 自重启测试直接面向真实 service owner。
- command 装配细节从顶层 runtime 中收敛出去。
- 非测试生产代码净增应尽量 `<= 0`，至少必须有明确简化收益。

### Batch B: 再治理跨包事实源和 kernel 公共边界

3. Task 3: 收敛内置 Extension 清单事实源。
4. Task 4: Kernel 根 Export 审计与收窄。

完成 Batch B 后应看到的变化：

- 内置 extension package list 不再 kernel/service 双写。
- `@nextclaw/kernel` 根出口有明确分级：稳定 public、workspace internal、private candidate、deprecation candidate。
- 后续删除 helper/依赖时不再靠猜。

### Batch C: 最后做垃圾代码和 facade 防回潮

5. Task 5: Kernel Root Utils / Types 小批次清理。
6. Task 6: `nextclaw` CLI 入口只保留 Facade 职责。

完成 Batch C 后应看到的变化：

- 高置信 unused files/exports 被删除或降为私有。
- UI/kernel 双写协议常量被明确归属，或记录为下一批 shared contract 工作。
- `nextclaw` 包保持 CLI facade，不吸收 service/kernel runtime owner。

## 推荐第一刀

第一刀仍然推荐 **Task 1: 抽出 Service Runtime 自重启 Owner**。

原因：

- 价值高：直接减少 `NextclawServiceRuntime` 的职责密度。
- 风险低：主要是内部重构，不改变 CLI 用户行为。
- 证据硬：测试文件已经叫 `service-runtime-self-relaunch.service.test.ts`，但生产代码缺少对应 owner。
- 验证清楚：现有测试可以改成直接测新 service，再跑 `packages/nextclaw-service` 的 `tsc` 和 targeted governance。
- 对后续有铺垫：Task 2 继续瘦身 command 装配时，顶层 runtime 已少掉一块复杂生命周期逻辑。
