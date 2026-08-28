# Portable Runtime MVP 与验证套件实施计划

> 本计划执行 [Portable Capability Runtime 全能力验证套件设计](../designs/2026-08-28-portable-runtime-verification-suite.design.md)。它按可独立体验和 Review 的阶段拆解，不要求一次性完成所有远期能力。

## 一、目标与交付形态

把现有 Action Runtime 技术垂直切片升级为一套可以回答以下问题的产品 MVP：

1. Panel、Agent 和适用 CLI 能否调用同一 Portable Service 能力；
2. 结构化数据能否真实读写，并跨 Component、runner、Host 重启和 App 更新保持；
3. Action Component、Resident Service、Component Provider 三种角色能否在同一产品体系中成立；
4. 常见数据、API、Agent Tool、定时、事件、长任务、流、文件、AI 和组合场景是否可以由有限基础能力表达；
5. 权限、故障、资源、隔离、恢复和内存优势是否有用户可见、可重复的证据。

最终交付不是一个塞满技术按钮的 App，而是：

- 四个普通用户能直接理解和使用的场景 Panel；
- 一个后置的 Portable Verification Center；
- 一组通用 runtime/kernel 能力；
- 一组自动验证、真实 UI 验证和可导出的证据；
- 一份明确说明“已验证、未验证、不适合 WASM”的结论。

## 二、工作区与授权边界

- 产品源码、测试和资源继续在隔离 worktree `/Users/peiwang/Projects/nextbot-worktrees/portable-capability-runtime-demo`、分支 `codex/portable-capability-runtime-demo` 中修改；
- 设计与计划文档保存在主工作区 `docs`，不修改主工作区产品源码；
- 不重启用户已有 NextClaw 实例，只使用独立 `NEXTCLAW_HOME` 和独立端口验证；
- 未经用户明确要求，不 commit、push、建 PR、发布或部署；
- 不恢复 Spin / wasmCloud 平行 executor，当前唯一实现候选继续使用直接 Wasmtime shared runner。

## 三、阶段 A：证据骨架、结构化数据与 Agent Tool

### A1. 冻结统一产品合同

目标：让 Service Action 不再只有 Panel caller，并成为 Panel、Agent、CLI 可复用的公共产品能力。

改动重点：

- 扩展 `ServiceActionCaller`，加入 `agent` caller 和稳定 subject；
- 让 capability grant 继续拥有授权事实，不在 Tool adapter 里旁路授权；
- 新增通用 Service Action `NcpTool` adapter/provider，按当前 Agent 与 App grant 筛选并执行；
- 设计稳定、唯一、符合模型工具名约束的 Action → Tool 命名和冲突规则；
- Agent 工具调用进入现有 NCP tool invocation 与 observation 主链；
- 评估并提供 `nextclaw service-actions list/invoke` 或等价 CLI；若当前授权模型无法安全支持，记录明确不适用并延后，不复制产品语义。

主要代码区域：

- `packages/nextclaw-kernel/src/types/service-app.types.ts`
- `packages/nextclaw-kernel/src/managers/service-app.manager.ts`
- `packages/nextclaw-kernel/src/services/service-action-grant.service.ts`
- `packages/nextclaw-kernel/src/contributions/tool-provider/`
- `packages/nextclaw-kernel/src/tools/`
- `packages/nextclaw-kernel/src/app/nextclaw-kernel.ts`
- `packages/nextclaw-server/src/features/service-apps/`
- `packages/nextclaw-client-sdk/src/services/service-apps.service.ts`
- 适用的 `packages/nextclaw/src/cli/` 与中英文命令文档

测试重点：工具发现、命名冲突、Agent grant、拒绝、调用结果、MCP/WASM executor 一致性和 NCP tool timeline。

### A2. 结构化数据能力与 Action/Data App

目标：从“计数器”升级到真实数据型应用，并形成可核验的持久化证据。

改动重点：

- 扩展最小 KV 合同，支持 delete/list 或以版本化 document collection 合同承载结构化记录；
- 保持数据 owner 在现有 App storage instance，不暴露宿主路径；
- Rust Action Component 实现 create/list/get/update/delete/statistics/transform；
- 同一 Action 被 Panel 与 Agent 调用；
- 保存数据版本、变更记录和内容 hash；
- 验证 Component、runner、隔离 Host 重启和 App 更新后的数据一致性。

主要代码区域：

- `apps/nextclaw-wasmtime-runner/wit/`
- `apps/nextclaw-wasmtime-runner/src/`
- `apps/nextclaw-wasmtime-runner/guests/`
- `packages/nextclaw-kernel/src/services/portable-service-*.ts`
- `packages/nextclaw/resources/apps/portable-action-data-lab/`（最终命名在首次创建前预检）

### A3. Verification Center 与统一证据

目标：把真实验证事实汇总成用户可阅读的控制台。

改动重点：

- 定义 verification run 的内部记录格式；
- 从标准 action/lifecycle/observation 事实生成证据，不向普通 runtime 注入 Demo 业务语义；
- 提供覆盖、数据、调用、权限、运行、事件和性能视图；
- 支持单项运行、阶段运行和导出报告；
- 初版只显示已真实接通的能力，其余明确显示等级和缺口。

主要资源区域：

- `packages/nextclaw/resources/apps/portable-runtime-verification-center/`（最终命名在首次创建前预检）
- 现有 Panel bridge 与 Service Action 公共 client；只有确有通用观测缺口时才扩展 Kernel/server contract。

### A4. 阶段 A 验收

- Panel 创建三条记录，Agent 查询并修改其中一条；
- UI 显示相同 actionId、trace/call ID 和数据版本；
- Agent 必须产生真实 tool invocation；
- runner 被杀死后自动恢复，记录 hash 一致；
- 隔离 NextClaw 重启和 Demo App 更新后数据一致；
- 未授权 Agent 看不到工具或调用得到明确授权结果，不得静默旁路；
- 1/5/10 Action Component 与等价 Node workload 保存原始性能样本。

## 四、阶段 B：Resident Service、事件与调度

### B1. 生命周期合同

目标：在不把进程拓扑暴露给 App 的前提下，增加显式 Resident 语义。

候选合同：

- Service manifest 声明 `lifecycle.mode = action | resident`；
- Resident WIT export `start / stop / status / handle-event` 或等价强类型接口；
- runner 持有 Resident instance，不依赖 Action 调用时偶然复用；
- Kernel/ServiceAppManager 继续拥有产品启停状态，runner 只拥有实例执行；
- App disable、uninstall、restart 和 runner failure 有确定状态转换。

在设计阶段必须裁决：使用同一 world 的可选接口，还是独立 `resident-service` world；不得靠 action 名称约定生命周期。

主要代码区域：

- `packages/nextclaw-kernel/src/types/service-app.types.ts`
- `packages/nextclaw-kernel/src/utils/service-app-manifest.utils.ts`
- `packages/nextclaw-kernel/src/services/service-app-runtime.service.ts`
- `packages/nextclaw-kernel/src/services/portable-service-*.ts`
- `apps/nextclaw-wasmtime-runner/wit/`
- `apps/nextclaw-wasmtime-runner/src/`

### B2. Event / Scheduler 根能力

目标：让后台推进来自宿主而不是 Panel。

- 使用现有 Kernel scheduler/event owner，避免 runner 自建第二控制面；
- 事件包含稳定 ID、sequence、occurredAt、payload 和 ack/cursor；
- 定时触发在 Panel 关闭后继续；
- stop/disable 后不再派发；
- 失败采用有限、可观察的 retry/backoff；
- runner 恢复后从持久 cursor 继续，至少一次投递下由 guest 幂等去重。

### B3. Resident & Event App

- Resident start/stop/status；
- heartbeat 与可注入事件；
- 最近事件、ack、cursor、重试和连接状态时间线；
- 模拟断线/恢复；
- runner crash/recovery 与停用停止验证；
- 测量 1/5 Resident 实例的内存与空闲 CPU。

主要资源区域：

- `packages/nextclaw/resources/apps/portable-resident-event-lab/`（最终命名在首次创建前预检）
- `apps/nextclaw-wasmtime-runner/guests/resident-event-lab/`

### B4. 阶段 B 验收

- Panel 关闭至少三个调度周期后，重新打开能看到连续时间线；
- stop 后事件计数冻结；start 后恢复；
- runner 被杀死后 PID 改变，cursor 连续且已 ack 事件不重复生效；
- App disable/uninstall 后没有残留后台活动；
- Resident 失败不影响 Action/Data App。

## 五、阶段 C：Provider 组合与常见能力补齐

### C1. Component Provider

- 冻结版本化 Provider WIT；
- runner 支持由 Provider export 满足 Consumer import；
- Provider 不注册为产品 Action；
- 安装/启动前诊断缺失与版本不兼容；
- 一个 Action Consumer 与一个 Resident Consumer 使用同一 Provider；
- 兼容 Provider 升级无需修改 Consumer。

主要资源区域：

- `apps/nextclaw-wasmtime-runner/wit/providers/`
- `apps/nextclaw-wasmtime-runner/guests/component-provider-lab/`
- `packages/nextclaw/resources/apps/portable-composition-lab/`

### C2. 常见能力补齐

按一个机制覆盖一类应用的原则，依次补齐：

1. Secret 引用、缺失、撤权和日志脱敏；
2. Blob/file 导入、转换和导出；
3. 长任务 job ID、progress、cancel 和最终状态；
4. stream/backpressure 的最小真实链路；
5. model provider 最小调用；
6. Component → Agent 请求与结果事件，和 Agent → Component Tool 严格区分。

这些能力进入稳定 NCP/kernel contract；Demo 只消费合同，不拥有宿主实现。

### C3. Capability Boundary App

- 每种 capability 的 allowed/denied；
- trap、timeout、cancel、response-too-large、内存预算；
- 多 App 数据、权限和错误隔离；
- Secret、宿主路径和内部异常脱敏；
- runner crash 后受影响状态与恢复证据。

主要资源区域：

- `packages/nextclaw/resources/apps/portable-capability-boundary-lab/`
- 相关 Rust guest fixtures 与 Kernel 集成测试。

### C4. 阶段 C 验收

- 常见应用场景矩阵中除平台原生类外至少达到 L4；
- Provider 缺失/不兼容在链接或启动阶段可诊断；
- Agent 入站、模型调用和 Agent 出站在证据中可明确区分；
- Blob、长任务和流具有真实数据、进度、取消与边界结果；
- 任一失败不会破坏其它 Demo App。

## 六、阶段 D：产品生命周期、性能与采用 Gate

- 多个 Demo App 的安装、启用、授权、撤权、restart、更新、迁移、卸载和数据保留；
- 等价 Node workload 与 Component 的 1/5/10 Action、1/5 Resident 多轮测量；
- 冷启动、热调用、空闲、unload、恢复、RSS、CPU、P50/P95；
- macOS 主平台完整验证，Windows/Linux runner 和通用 artifact 单独形成证据；
- 自动验证、真实 UI 验证和主观体验 Review；
- 输出正式适用规则：哪些 App 推荐 portable-component，哪些使用 native-process/provider；
- 更新面向用户的文档站说明、必要的 changeset/迭代记录判断仅在用户要求交付时执行。

## 七、验证策略

### 7.1 迭代证据

- Rust guest/runner：定向 `cargo check/test` 和协议 fixture；
- Kernel：manifest、runtime client、Service Action/Agent Tool、lifecycle 和 grant 定向测试；
- App Runtime：安装、更新、数据和 component projection 定向测试；
- UI/Panel：只验证真实 bridge 与数据状态，不用 snapshot 代替交互；
- TypeScript 改动每阶段运行匹配 package `tsc`。

### 7.2 阶段收尾证据

- 自动测试 + 类型检查 + Rust build；
- diff-only maintainability Review；
- 隔离实例中的真实 Panel/Agent/生命周期验证；
- 原始性能数据和统计脚本；
- `git diff --check` 与治理检查；
- 明确披露未覆盖平台、能力和恢复路径。

## 八、当前执行状态（2026-08-28）

阶段 A、阶段 B 与阶段 C1 的核心链已经进入可体验状态，并在一个验证中心中以五个职责独立的 WASM Component 呈现：

1. Service Action → Agent Tool 公共适配、Agent caller 与显式授权已完成；
2. Rust 结构化数据 CRUD、revision/hash 和跨 runner/Host/版本持久化已完成；
3. Resident 的 start/handle-event/stop、宿主 timer、内存连续性、durable cursor 与停启恢复已完成；
4. Provider 注册、Consumer 显式依赖、宿主校验、跨 Component 调用和越权拒绝已完成；
5. 共享 runner 超时后会按 Provider→Resident 顺序自动恢复长期角色，Action 数据保持；
6. Apple Silicon + Node 22.16 的 1/5/10 三轮密度测量已完成并展示在 Panel 中；
7. 隔离实例当前安装并启用了「日常小工具箱」v0.5.2，包含「今日清单」「灵感便签」「专注小钟」「联系人整理」四个产品场景、一个开发者验证台和五个 Service Component；共 10 个组件可直接体验。
8. 最终自动验证为 78 个定向测试通过；相关 TypeScript 类型检查、Rust 构建、资源静态校验、`git diff --check` 通过，diff-only maintainability 为 0 error。
9. 最终真实实例复验保持结构化数据 hash/revision，Resident 在同一 epoch 中持续递增，Provider 组合经 `host.component-call` 成功。
10. 产品展示层已从“抽象机制按钮集合”纠偏为“普通日常任务入口”：清单实际完成 CRUD，便签与清单复用同一数据 Component，专注小钟在 Panel 关闭后从 `00:04` 连续推进到 `00:42`，并在宿主重启后保留 `14:55:44` 的完成点；联系人整理经独立 Provider 输出规范化联系人；技术证据仅在折叠说明和开发者验证台中展示。

当前不是完整阶段 C：Secret、Blob/file、长任务、stream、model provider 与 Component→Agent 请求尚未实现；Capability Boundary 也仍缺多 App 数据隔离、内存预算与取消。下一批应从这些缺口中选择一条具有代表性的场景闭环，而不是把设计表中的每个名词做成浅按钮。

阶段 D 已验证的子集是启用、停用、Host/runner 恢复、版本更新和 1/5/10 Action 密度；卸载/数据保留、rollback/migration、Resident 密度、CPU/延迟和跨平台仍未完成。完整证据见[全能力验证套件设计](../designs/2026-08-28-portable-runtime-verification-suite.design.md)顶部的实施快照。
