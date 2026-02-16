# OpenClaw 插件兼容计划（.plan）

## 背景与目标
- 目标：兼容 OpenClaw 插件生态，避免生态割裂，同时保证 NextClaw 的可维护性、可演进性与稳定性。
- 原则：兼容层只做“适配”，不侵入核心业务与架构；能力缺失要显式暴露、可诊断。

## 非目标
- 不复刻 OpenClaw 的内部实现细节，仅兼容公开插件接口与配置契约。
- 不保证所有插件都能立即运行；分阶段覆盖关键能力。
- 不在核心配置中引入 OpenClaw 特有结构，插件配置仅在 `plugins` 命名空间内。

## 架构边界（强约束）
### 1) NextClaw Core
- 负责：核心会话、消息、工具、通道等领域模型；配置与运行时的基础设施。
- 禁止：直接依赖 OpenClaw SDK 或插件实现；不得引入 OpenClaw 专有配置结构。

### 2) Compat Host（兼容主机）
- 负责：插件发现/加载/注册生命周期；配置校验与诊断输出；插件能力注册到统一 Registry。
- 禁止：直接改写 Core 内部状态；只能通过 Registry/API 与核心交互。

### 3) Compat SDK Shim（SDK 映射层）
- 负责：对 `openclaw/plugin-sdk` 提供映射实现（最小可用 + 可扩展）；缺失能力统一返回 `NotSupported` 并产生日志诊断。
- 禁止：隐式兜底；不做“猜测式”兼容。

### 4) Capability Registry（能力注册表）
- 负责：统一抽象 Channel/Provider/Tool/Command/Service/Hook/Http/Gateway/CLI；将插件注册转换为 NextClaw 内部可调用能力。
- 禁止：跨能力重复实现；同类能力只能有一个权威入口（避免重复功能）。

### 5) Config & UI Schema Merge（配置与 UI 合并层）
- 负责：合并插件 `configSchema` 与 `uiHints` 到 NextClaw 配置树 `plugins.entries.<id>.config`；严格校验配置。
- 禁止：插件配置与核心配置字段混用；不允许污染 `channels`/`providers` 等核心节点。

### 6) Runtime Adapter（运行时适配层）
- 负责：把 NextClaw 的运行时能力（工具、通道、日志、存储等）映射为 OpenClaw 期望的 runtime 接口。
- 禁止：暴露不受控的系统能力；必须遵守安全/权限/资源约束。

## 兼容矩阵（长期最佳 + 约束）
支持级别：
- Must = 长期必须支持（生态与产品核心价值）
- Should = 建议支持（生态完整性与体验提升）
- Optional = 可选支持（扩展能力，需谨慎）
- Deferred = 可延后（先解析或占位，不阻断核心）
- No = 不支持（显式拒绝 + 诊断）

| 能力域 | OpenClaw 机制 | NextClaw 目标实现 | 支持级别 | 备注/限制 |
| --- | --- | --- | --- | --- |
| 插件发现 | `.openclaw/extensions` + `plugins.load.paths` | 兼容同路径 + NextClaw 扩展目录 | Must | 需支持 workspace/global/config 三种来源 |
| Manifest | `openclaw.plugin.json` | 完整解析 + 校验 | Must | `id` + `configSchema` 必须 |
| 插件加载 | jiti TS/ESM 动态加载 | 等价加载器 + 缓存策略 | Must | 先支持 TS/JS 基本场景 |
| 配置校验 | `configSchema` JSON Schema | 合并到 `plugins.entries.<id>.config` | Must | 校验失败必须阻断加载 |
| UI Hints | `uiHints` | 合并到 UI hints | Should | 先支持 label/help/advanced/sensitive/placeholder |
| registerTool | Tool 注册 | 映射为 NextClaw Tool | Must | 先支持基础工具接口 |
| registerProvider | Provider 插件 | 映射为 Provider 管理器 | Must | 需定义 auth/模型/别名映射规则 |
| registerChannel | Channel 插件 | 映射为 BaseChannel 适配器 | Must | 需要通道生命周期与配置适配 |
| registerCommand | 命令插件 | 映射为命令路由 | Should | 支持最小命令模型 |
| registerService | 常驻服务 | 映射为服务管理器 | Should | 需要启动/停止钩子 |
| registerCli | CLI 子命令 | 挂载到 CLI | Optional | 命令冲突需显式拒绝 |
| registerHttpHandler | HTTP 处理 | 接入 Gateway | Optional | 需设定路径前缀与访问控制 |
| registerGatewayMethod | 网关方法 | 接入 Gateway RPC | Optional | 必须可追踪、可审计 |
| registerHook | 生命周期 Hook | 接入 Hook 总线 | Optional | 仅在语义对齐与安全隔离后开放 |
| skills 字段 | manifest.skills | 兼容为提示词/技能引用 | Deferred | 先只解析清单，不自动注入 |

## 阶段里程碑与验收标准
### 阶段 P0：基础兼容骨架
交付物：
- 插件发现 + manifest 解析 + 配置校验 + diagnostics 输出
- SDK Shim 最小实现（仅提供必要类型与 NotSupported）
验收标准：
- 能加载至少 1 个空插件（仅 manifest + 空 configSchema）
- 校验失败时输出明确诊断
- 配置 UI hints 能合并并被 UI 读取

### 阶段 P1：工具/Provider/Command 兼容
交付物：
- `registerTool` / `registerProvider` / `registerCommand` 映射
- 最小工具执行链路 + Provider 可被模型选择
验收标准：
- 选 1 个工具插件 + 1 个 provider 插件跑通最小链路
- 失败场景可诊断（缺能力/配置错误）

### 阶段 P2：Channel 兼容
交付物：
- `registerChannel` 映射，通道生命周期对齐
- 配置注入 + outbound/inbound 适配
验收标准：
- 至少 1 个主流 channel 插件跑通收发
- 配置与权限校验能阻断错误加载

### 阶段 P3：高级能力扩展
交付物：
- `registerService` / `registerHttpHandler` / `registerGatewayMethod` / `registerCli`
- Hook 语义对齐方案与（可选）试点支持
验收标准：
- 每个能力域至少 1 个插件跑通
- Hook 若启用则事件可追踪与回放（至少日志层面）

## 风险与应对
- 风险：SDK 兼容面过大导致维护成本上升
  - 应对：先做“最小可用 + 显式不支持”，再逐步扩展
- 风险：Channel 兼容引入核心耦合
  - 应对：所有通道通过统一适配器层注入，禁止直连 Core
- 风险：配置结构污染
  - 应对：所有插件配置仅在 `plugins.entries.<id>` 下合并

## 可维护性控制（强约束）
- 强制隔离：兼容层独立模块，Core 不直接依赖 OpenClaw SDK/插件实现
- 最小支持面：仅实现 Must + UI hints，其它能力统一 `NotSupported` + 诊断
- 单一入口：所有插件注册必须通过统一 Registry，禁止旁路注入
- 诊断驱动：加载/配置/注册/冲突必须产出可定位 diagnostics
- 配置隔离：插件配置仅位于 `plugins.entries.<id>`，不污染核心配置树
- 冲突拒绝：同名工具/通道/Provider 默认拒绝后加载并告警
- 渐进扩展：新增能力必须补齐边界/诊断/测试/风控说明
- 护栏测试：固定试点插件集做回归，建立启动耗时/内存预算阈值

## 开放问题（需要确认）
- NextClaw 是否接受新增 `plugins` 顶层配置节点？
- 是否允许插件覆盖内置通道/Provider 的同名能力？冲突优先级如何定义？
- 兼容层是否独立包（`nextclaw-compat-openclaw`）还是核心内置模块？
