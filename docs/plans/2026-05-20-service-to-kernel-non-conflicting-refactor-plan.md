# NextClaw Service 到 Kernel 低冲突重构候选方案

## 背景与目标

当前 `@nextclaw/service` 里混有多类职责：CLI 表现层、长驻服务宿主、UI/remote/launcher 运行链路、插件/扩展加载，以及部分本应属于 kernel 的领域规则。

本轮重构的目标不是把 `nextclaw-service` 机械变薄，而是在不干扰并行 `agent runtime` / `extension` / `plugin runtime` 改动的前提下，先处理低冲突、owner 明确的候选项。

判断标准：

- `kernel` 承载 NextClaw 的长期内核事实、能力目录、运行时领域编排、自感知状态与可复用业务规则。
- `service` 保留本机进程、CLI 输出、UI host、文件监听、restart、launcher、child process、端口探测等宿主职责。
- `core/shared/openclaw-compat` 承载更底层的协议、纯类型、兼容转换或跨包通用工具。

## 当前暂避范围

因为并行改动正在触达 `agent runtime`、`extension`、`plugin runtime` 相关链路，本计划第一阶段暂不改以下路径：

- `packages/nextclaw-kernel/src/managers/agent-runtime.manager.ts`
- `packages/nextclaw-kernel/src/managers/extension.manager.ts`
- `packages/nextclaw-kernel/src/features/runtime-registry/`
- `packages/nextclaw-kernel/src/contributions/agent-runtime/`
- `packages/nextclaw-service/src/cli/commands/agent/agent-runtime.utils.ts`
- `packages/nextclaw-service/src/cli/commands/agent/cli-agent-runner.utils.ts`
- `packages/nextclaw-service/src/commands/plugin/plugin-extension-registry.ts`
- `packages/nextclaw-service/src/commands/plugin/plugin-registry-loader.utils.ts`
- `packages/nextclaw-service/src/shared/services/gateway/managers/gateway-plugin.manager.ts`
- `packages/nextclaw-service/src/shared/services/extensions/`
- `packages/nextclaw-openclaw-compat/src/plugins/`
- `packages/extensions/nextclaw-ncp-runtime-*`
- `packages/extensions/nextclaw-narp-runtime-*`

这些路径不是“不该重构”，而是当前不适合和并行改动抢同一片地。

## 第一阶段候选清单

### 1. Skill 加载能力归属收敛

候选文件：

- `packages/nextclaw-service/src/shared/services/runtime/utils/skills-loader.utils.ts`

现状：

该文件在 service 内通过 `(NextclawCore as { SkillsLoader?: ... }).SkillsLoader` 动态探测 core 是否暴露 `SkillsLoader`，再创建 workspace skills loader。

问题：

- service 不应该通过动态字段探测来判断 core/kernel 是否有 skill loader。
- skill discovery/listing 是 NextClaw 自感知与自进化能力的一部分，应由 kernel 暴露稳定入口。
- 当前写法让调用方感知 core 内部导出形态，owner 不清。

推荐方案：

- 在 kernel 的 `SkillManager` 或 `features/skills` 中提供明确 API，例如：
  - `createWorkspaceSkillsLoader(workspace: string)`
  - 或 `listWorkspaceSkills(workspace: string, options?: { filterUnavailable?: boolean })`
- service 保留 CLI/host 调用入口，只依赖 kernel 公共 API。
- 删除 service 内对 `NextclawCore.SkillsLoader` 的动态探测。

成功标准：

- service 不再直接动态访问 `NextclawCore.SkillsLoader`。
- skill 列表/加载的稳定入口归属 kernel。
- 不触碰 extension / agent runtime / plugin registry 链路。

建议优先级：最高。

原因：

文件小、边界清晰、冲突概率最低，是适合作为第一刀的低风险改动。

### 2. LLM Usage 查询能力归属收敛

状态：已完成。`LlmUsageManager` 已承接 snapshot/history/stats 查询能力，service CLI usage 命令只保留模式分派、JSON/text 输出和退出码处理；service 侧 `llm-usage-query.service.ts` 已删除。

候选文件：

- `packages/nextclaw-service/src/cli/commands/usage/services/llm-usage-query.service.ts`
- `packages/nextclaw-service/src/cli/commands/usage/services/llm-usage-command.service.ts`
- 关联 kernel：`packages/nextclaw-kernel/src/managers/llm-usage.manager.ts`
- 关联 kernel：`packages/nextclaw-kernel/src/stores/llm-usage.store.ts`

现状：

kernel 已有 `LlmUsageManager` 和 `LlmUsageStore`，但 service CLI 侧仍有 usage query/stat 能力。CLI command 既负责输出，也负责查询/统计语义。

问题：

- LLM usage 是 kernel 自感知状态，不应只存在于 CLI 命令服务里。
- UI、诊断、自动化、未来 self-manage 都可能需要同一份 usage query/stat 能力。
- CLI command 应只负责参数解析、文本/JSON 渲染与退出码。

推荐方案：

- 将 `getSnapshot`、`getHistory`、`getStats` 这类查询与统计能力收敛到 kernel。
- service 的 `LlmUsageCommandService` 保留：
  - `--history` / `--stats` / 默认模式分派
  - JSON 输出
  - 文本渲染
  - `process.exitCode`
- kernel 提供可复用查询对象，例如：
  - `LlmUsageQueryService`
  - 或扩展 `LlmUsageManager` 的 read API。

成功标准：

- usage 的数据读取和统计规则不再由 CLI command 独占。
- CLI command 只做 presentation。
- 不触碰 agent runtime / extension / plugin 相关文件。

建议优先级：高。

原因：

这项改动符合自感知主线，也天然适合 kernel；冲突面主要在 usage 命令，不会撞当前 runtime/extension 并行改动。

### 3. Gateway Config Mutation 子域拆分

状态：已完成。`ConfigManager` 已承接 gateway config snapshot/schema/apply/patch 的 hash 校验、JSON 解析、schema 校验、deep merge、reload plan 和 redacted mutation result；service `GatewayControllerImpl` 只保留 status/reload/restart/update/sentinel 等宿主行为。

候选文件：

- `packages/nextclaw-service/src/shared/controllers/gateway.controller.ts`

现状：

`GatewayControllerImpl` 同时负责：

- config snapshot/hash/redact/schema
- config apply/patch/merge/validate/reload plan
- status/reload/restart/update
- restart sentinel
- NPM runtime update
- fallback `process.exit`

问题：

- 配置读写、hash 校验、patch merge、reload plan 是 kernel/config 领域规则。
- restart sentinel、NPM runtime update、process exit 是 service host 行为。
- 当前 controller 作为 service 文件承载过多领域规则，会让 gateway tool 的语义长期依赖 service。

推荐方案：

先不整体搬 controller，只拆 config mutation 子域：

- kernel 提供 `ConfigMutationService` 或 `KernelGatewayConfigService`，负责：
  - 读取 config snapshot 所需的纯规则
  - hash 校验
  - JSON apply/patch 解析
  - `ConfigSchema` 校验
  - `diffConfigPaths`
  - `buildReloadPlan`
  - redacted result 结构
- service 保留：
  - `getConfigPath`
  - `saveConfig`
  - `requestRestart`
  - `writeRestartSentinel`
  - `updateRun`
  - `NpmRuntimeUpdateCommandService`
  - `process.exit` fallback

成功标准：

- config mutation 规则有 kernel owner。
- service controller 变成薄 host adapter。
- 不改 agent runtime / extension / plugin registry。

建议优先级：中高。

原因：

收益大，但文件较重，应在前两项完成后再做，避免第一步就引入过多调用链变化。

### 4. Cron Job 到 NCP 执行规则

候选文件：

- `packages/nextclaw-service/src/shared/services/gateway/cron-job-handler.service.ts`
- 关联 kernel：`packages/nextclaw-kernel/src/managers/automation.manager.ts`

现状：

该文件把 cron job payload 转成 NCP user message，调用 live NCP agent run API，并可选通过 `MessageBus` 发 outbound。

问题：

- “自动化任务如何转成 agent/session 执行”属于 NextClaw 自治闭环，不应长期由 service gateway 文件持有。
- cron metadata、session id、NCP message 构造规则是领域规则。
- 当前文件依赖 live agent handle，因此不能在 agent runtime 并行改动期间贸然迁移。

推荐方案：

当前阶段只记录为后续候选，不立即做。

未来可拆为两层：

- kernel 层：`AutomationExecutionManager`，负责 job -> session request / NCP message / metadata 的领域映射。
- service 层：提供 live runtime resolver、outbound bus、启动时机和错误上报。

成功标准：

- cron 执行领域规则归 kernel。
- service 只注入运行态资源。
- 在 agent runtime 并行改动稳定后再执行。

建议优先级：暂缓。

原因：

语义上值得做，但当前会与 agent runtime 线产生潜在冲突。

### 5. Workspace Bootstrap 规则拆分

候选文件：

- `packages/nextclaw-service/src/shared/services/workspace/workspace-manager.service.ts`

现状：

`WorkspaceManager` 同时负责：

- 创建 workspace 模板文件
- 创建 memory/skills 目录
- 定位模板目录
- 设置 bridge
- 复制 bridge 源码
- 执行 `npm install` / `npm run build`
- `process.exit`

判断：

不建议整体进 kernel。

可进 kernel 的只有 workspace bootstrap 的纯规则：

- 默认模板文件清单
- workspace 初始化目标结构
- 哪些路径属于 agent home / memory / skills

必须留 service 的部分：

- 模板目录定位
- 文件复制
- bridge 构建
- `spawnSync`
- `process.exit`
- CLI 提示

推荐方案：

低优先级。只有当我们要统一 workspace bootstrap 语义时，再抽出 `WorkspaceBootstrapPlan` 这种纯计划对象；当前不建议作为第一批。

成功标准：

- kernel 只持有 workspace 初始化规则，不感知 npm/bridge/进程退出。
- service 继续执行真实文件和命令操作。

建议优先级：低。

原因：

可整理，但不如 skill/usage/config 三项直接服务 kernel 边界。

### 6. Plugin Extension Snapshot 归属收敛

状态：已完成。`ExtensionManager` 已承接 plugin registry 到 extension registry、channel bindings、UI metadata snapshot 的构建与 extension manifest contribution 合并规则；service `GatewayPluginManager` 只保留加载时机、bootstrap 状态、gateway 启停、日志和热重载触发。

候选文件：

- `packages/nextclaw-service/src/shared/services/gateway/managers/gateway-plugin.manager.ts`
- `packages/nextclaw-service/src/commands/plugin/plugin-extension-registry.utils.ts`
- 关联 kernel：`packages/nextclaw-kernel/src/managers/extension.manager.ts`

现状与问题：

- `ExtensionManager` 已经是 extension registry / channel bindings / UI metadata 的事实 owner。
- 但 service gateway 侧仍自行构造 `PluginSnapshot`，并把构造结果再写回 kernel。
- service plugin command 侧曾经暴露 `toExtensionRegistry` 工具函数，导致 plugin registry -> extension registry 的领域转换不在 kernel owner 内。

完成结果：

- `toExtensionRegistry` 收为 kernel 内部 helper，不再从 service plugin index 重导出。
- registry channel 与 extension manifest channel 的去重/覆盖规则进入 `ExtensionManager.load/reloadForConfigChange`。
- service 侧删除 `plugin-extension-registry.utils.ts` 与旧 `plugin-reload` helper。
- `GatewayPluginManager` 不再持有 snapshot，只通过 `kernel.extensions` 加载和读取当前 registry、extension registry、channel bindings 和 UI metadata。

建议优先级：已完成。

原因：

插件链路并行改动窗口关闭后，这项是明确的 owner 收敛：删除 service 侧重复 snapshot owner，且不触碰 plugin install/mutation/runtime bridge。

## 不建议进入 Kernel 的服务职责

以下职责应留在 service，或者未来单独拆成 host/runtime package，而不是进入 kernel：

- `packages/nextclaw-service/src/service-runtime.service.ts`
  - CLI 总装配、restart、自启动、子进程 relaunch、命令聚合。
- `packages/nextclaw-service/src/launcher/`
  - NPM runtime bundle、更新、launcher。
- `packages/nextclaw-service/src/shared/services/restart/`
  - restart sentinel、restart coordinator、self relaunch。
- `packages/nextclaw-service/src/shared/services/ui/`
  - UI host、runtime control host、remote access、update host。
- `packages/nextclaw-service/src/shared/stores/`
  - managed service state、local UI state、pending restart、companion runtime state。
- `packages/nextclaw-service/src/shared/utils/service-port-probe.utils.ts`
  - 本机端口探测。
- `packages/nextclaw-service/src/shared/utils/cli.utils.ts`
  - CLI/host 工具函数，除非其中出现纯协议/领域规则。

## 推荐执行顺序

### Step 1：Skill Loader 收敛

目标：让 skill discovery/listing 通过 kernel 稳定 API 暴露。

验收：

- service 不再动态探测 `NextclawCore.SkillsLoader`。
- 相关 skill 命令或 agent home 初始化路径仍可列出 skills。
- `pnpm -C packages/nextclaw-service tsc`
- `pnpm -C packages/nextclaw-kernel tsc`
- 相关 targeted tests。

### Step 2：LLM Usage Query 收敛

目标：usage 查询和统计规则进入 kernel，CLI 只做展示。

验收：

- `nextclaw usage`、`nextclaw usage --history`、`nextclaw usage --stats` 行为不变。
- JSON 输出 contract 不变。
- `pnpm -C packages/nextclaw-service tsc`
- `pnpm -C packages/nextclaw-kernel tsc`
- usage 相关测试。

### Step 3：Gateway Config Mutation 子域拆分

目标：config apply/patch/hash/reload-plan 规则进入 kernel，service controller 变薄。

验收：

- gateway `config.get`、`config.apply`、`config.patch` contract 不变。
- restart-required 返回语义不变。
- sentinel/update/restart 仍由 service 处理。
- `pnpm -C packages/nextclaw-service tsc`
- `pnpm -C packages/nextclaw-kernel tsc`
- gateway controller 相关测试。

### Step 4：Cron Execution 设计确认后再做

目标：等 agent runtime 并行改动稳定后，再判断 cron job -> NCP/session request 的最终 owner。

验收：

- cron job 可继续触发 agent 执行。
- deliver outbound 行为不变。
- 不引入新的 live runtime 双路径。

## 每个子任务的完成合同

每个候选项单独执行，避免一次大搬迁。

执行前必须确认：

- 本项是否触碰当前并行 runtime/extension/plugin 改动。
- 本项是否新增用户能力；默认这些都是非功能重构。
- 非测试代码净增目标：`<= 0`。
- 是否有可删除旧 helper、重复类型、重复 owner 或 service 侧中间层。

执行后必须验证：

- 触达 TypeScript 源码时运行相关 package `tsc`。
- 运行最贴近改动链路的测试或 targeted test。
- 非功能改动运行 maintainability guard/review。
- 若需要迭代留痕，更新或创建 `docs/logs`。

## 当前推荐

当前第一阶段已完成：

- Step 1：Skill Loader 收敛。
- Step 2：LLM Usage Query 收敛。
- Step 3：Gateway Config Mutation 子域拆分。
- Plugin Extension Snapshot 归属收敛。

暂不继续推进 CLI config/secrets mutation：前次设计验证显示收益不足，会让 CLI 命令对象图变重，且 path 语法、plugin channel 投影视图、restart 提示仍属于 service 边界。

下一步建议等 agent runtime 并行线稳定后，再重新评估 `Cron Job 到 NCP 执行规则`。如果只在当前低冲突范围内继续推进，优先做已完成模块的测试补强和文档收口，而不是继续寻找“看起来应该进 kernel”的弱收益迁移。
