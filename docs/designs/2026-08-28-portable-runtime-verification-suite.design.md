# Portable Capability Runtime 全能力验证套件设计

## 文档状态

- 日期：2026-08-28
- 状态：产品场景版核心 MVP v0.5.2 已可体验；本文继续作为完整能力 Gate，不把未实现能力记为已支持
- 角色：定义“Portable Capability Runtime 到底需要证明什么”、用哪些代表性 App 证明、每条链路需要留下什么证据
- 上位愿景：[NextClaw 产品愿景](../VISION.md)
- 架构 owner：[WASI Service App 运行时与现有 Mini App 体系融合设计探索](./2026-08-28-wasi-service-app-runtime.design.md)
- 总体阶段 owner：[Portable Capability Runtime 总体阶段计划](../plans/2026-08-28-portable-capability-runtime-overall.plan.md)
- 当前能力闭合与稳定验收 ID owner：[Portable Runtime 能力闭合设计](./2026-08-30-portable-runtime-capability-closure.design.md)
- 本文不是生产协议定稿，也不是一次性 UI 展示清单；正式实现前仍需形成文件级实施计划

> 2026-08-30 起，本文继续拥有场景全集与 L0–L5 成熟度定义；稳定 `PRT-*` 验收编号、能力 owner、完成判定与发布门以“能力闭合设计”为准。下方 2026-08-28 表格是历史实证快照，不是当前版本的动态状态事实源。

### 2026-08-28 实施与实证快照

隔离 worktree 已形成「日常小工具箱」v0.5.2：四个面向普通用户的场景 Panel、一个后置的开发者验证台与五个真实 Rust/WebAssembly Component，共用一个 Rust/Wasmtime runner，并沿现有 App Package、Service App、Service Action、授权与 Agent Tool 主链运行。

| 能力/场景 | 当前等级 | 已取得的真实证据 | 仍缺什么 |
| --- | --- | --- | --- |
| Action + 结构化数据 | L5 | Rust Guest 完成 seed/list/upsert/delete；revision、record count 与 content hash 跨 runner 超时、Host 重启和 Demo 0.3→0.4.2 更新保持 | 统一 trace/call ID、并发冲突合同 |
| Agent Tool 入站 | L4 | Main Agent 实际调用 State Component 完成 seed→upsert→list，结果写入同一 KV 数据；授权按 Agent caller 显式保存 | 当前免费模型对 Resident/Composition 的两次后续会话意外中断；CLI 投影未实现 |
| Resident + timer/event | L5 | 同一实例内存计数连续；Panel 关闭后宿主每秒继续投递；durable cursor 跨 Host/runner 恢复；应用停用后冻结、启用后继续 | 外部事件总线、ack/retry/去重与真实流重连 |
| Component Provider + Consumer | L5（MVP 合同） | 独立 Provider 实例被 Consumer 经 `host.component-call` 调用；manifest 未声明时返回 `PROVIDER_DENIED`；runner 超时后先恢复 Provider 再恢复 Resident | 版本化 WIT 解析、安装期缺失/不兼容诊断、Resident Consumer、递归 Provider |
| HTTP 与能力拒绝 | L4 | HTTPS allowlist 内成功、白名单外明确拒绝，Guest 不持有原生 socket | Secret、重定向/大响应、撤权热生效的完整矩阵 |
| 故障与恢复 | L5（当前故障型） | 1200ms 超时杀死共享 runner；KV hash 不变；Provider/Resident 自动重注册并继续；结构化 Guest 错误不杀 runner | fuel/epoch 内部中断、内存上限、OOM、取消 |
| App 生命周期 | L5（启停/更新） | v0.5.2 安装到现有 App 列表；停用 2 秒事件完全冻结；启用后只创建一个新实例并从 cursor 继续；授权和数据保留 | 卸载/保留数据、rollback/migration 的完整产品演练 |
| 内存密度 | L4（单机方向性） | Apple Silicon、Node 22.16、三轮中：10 个独立路径 Component 总 RSS 50.84–53.17 MiB；10 个独立 Node Service 为 399.25–399.47 MiB | 等价业务 workload、Resident 密度、CPU/P50/P95、Windows/Linux |

最终收尾证据：App Runtime 8 个、Kernel 55 个、Server 12 个、UI 3 个定向测试，共 78 个测试通过；相关 TypeScript package 类型检查、Rust release build/Component build、资源 JSON/Panel JavaScript 校验与 `git diff --check` 通过；diff-only maintainability 为 0 error。隔离实例最后一次实测中，Resident 在 2.2 秒内从 2732 增至 2734 且 instance epoch 保持 28，Provider 组合返回 `Grace Hopper <grace@example.com>`，持久数据仍为 revision 2、4 records 和原 content hash。

以下内容仍只是本设计的下一阶段范围，**不能从当前 Demo 推导为已经支持**：Secret、Blob/file、长任务 progress/cancel、stream/backpressure、模型调用、Component 主动请求 Agent、多 App 数据隔离、完整 CLI、统一可导出验证记录、三平台 artifact 与生产资源治理。

## 一、为什么需要重新设计 Demo

首个「Portable Runtime 实验室」已经证明了一个真实 Rust/WASM Component 可以沿现有 App、Panel、Service Action、Kernel 和共享 runner 主链运行，也取得了 KV、HTTP allowlist、超时、结构化失败、runner 恢复和方向性内存证据。

但它仍然只是一个技术垂直切片，不能回答“这套运行时是否足以承载常见应用”这一更重要的问题：

1. 页面展示的是若干离散按钮，没有形成可核验的数据集、事件时间线、运行记录和前后状态；
2. Agent 不能发现和调用同一 Service Action，统一入口没有闭合；
3. 只验证了 Action Component，没有验证 Resident Service 的后台监听与长期状态；
4. 没有验证 Component Provider 的强类型组合价值；
5. 没有覆盖定时、事件、长任务、实时连接、文件/Blob、Secret、AI 等常见应用开发范式；
6. “验证过”主要存在于开发过程和测试记录中，用户无法在产品内看到证据；
7. 一个 App 内的多个 Component 不能充分证明跨 App 数据隔离、权限隔离和故障隔离。

因此，后续不再把“能够点击几个能力按钮”称为完整 Demo。新的目标是建设一套**可操作、可观察、可重复、可判伪**的验证套件。

### 1.1 产品展示原则纠偏

验证套件必须同时服务两类体验者，但入口顺序不能颠倒：

1. 普通用户首先看到一个能解决日常问题的小产品，理解“它能做什么”；
2. 技术人员可在同一场景的折叠说明或独立开发者验证台中理解“它如何做到”；
3. 不用 Action、Resident、Provider、Component 等机制名称充当产品场景；
4. 每个抽象机制至少映射到一个完整的小任务，不以一组孤立按钮代替应用体验；
5. 技术控制台继续保留，但只能作为证据层，不能再充当默认主入口。

当前采用的四个切口是「今日清单」「灵感便签」「专注小钟」和「联系人整理」。它们分别承载持久数据、跨 Panel 能力复用、Panel 关闭后的 Resident 连续运行，以及 Provider/Consumer 组合调用；主入口为「今日清单」。

## 二、验证套件的核心目标

验证套件需要同时证明两层事实：

### 2.1 机制层成立

Portable Runtime 是否具备承载应用所需的基础机制：

- 多种组件角色与生命周期；
- 数据、网络、Secret、文件/Blob、时间、事件、调度和日志等根能力；
- Panel、Agent、CLI 等统一产品投影；
- 安装、授权、启停、更新、卸载和数据保留；
- 隔离、超时、取消、恢复、资源限制和可观察性；
- Component 之间的强类型组合。

### 2.2 常见应用开发场景成立

开发者是否能用上述有限机制自然实现常见 App，而不需要 NextClaw 为每个业务新增专用内核 API：

- 数据型应用；
- 外部 API 集成；
- Agent Tool Pack；
- 定时自动化；
- 事件监听与消息订阅；
- 长任务与进度；
- 实时连接与流；
- 文件和内容处理；
- AI/Agent 增强应用；
- 多组件组合应用；
- 需要原生设备或平台 API 的应用。

验证套件的最终问题不是“WASM 能不能执行代码”，而是：

> **一组有限、稳定、可授权的基础机制，是否足以覆盖大多数普通 Service App；不能覆盖的部分，是否有清晰而受控的 Provider 或 native-process 逃生路径。**

## 三、什么才算“支持”

每项能力使用统一成熟度等级，避免把设计设想、单元测试或静态 UI 当成产品支持：

| 等级 | 含义 | 可以对外声称什么 |
| --- | --- | --- |
| L0 概念 | 只有讨论或接口设想 | 不支持 |
| L1 Artifact | Component 可以构建，WIT 可以生成绑定 | 工具链可行 |
| L2 Runtime | 独立 runner/harness 中真实执行 | 运行时可行 |
| L3 Kernel | 沿正式 Kernel owner、授权和错误链路执行 | 已接入产品内核 |
| L4 Product | 用户可从 Panel、Agent 或 CLI 操作并看到真实结果 | 可体验支持 |
| L5 Resilient | 经过重启、失败、撤权、升级、隔离和资源边界验证 | 可信产品能力 |

本验证套件中：

- 核心能力至少达到 L4 才能显示“通过”；
- 数据、Resident、权限和恢复等关键能力必须达到 L5；
- L0-L3 只能显示“设计中”“仅 harness”或“内核已接入”，不得使用绿色通过状态；
- 每个状态必须来自最近一次真实验证记录，不能写死在前端。

## 四、有限基础能力集合

下面的集合不是承诺完整操作系统，而是用于判断“普通应用是否可表达”的基础能力基线。

### 4.1 执行与类型合同

- Rust 构建为 WASM Component；
- WIT imports/exports 是强类型边界；
- Component 校验、版本和兼容错误可诊断；
- 一个共享 runner 复用 Engine 与编译缓存；
- 每 App/Component 使用独立 Store、授权上下文和资源预算。

### 4.2 三种组件角色

| 角色 | 必须验证的语义 | 代表场景 |
| --- | --- | --- |
| Action Component | 调用时激活；短任务；可池化、缓存、超时和回收 | 查询、转换、CRUD、Agent Tool |
| Resident Service | 显式 start/stop/status；后台接收事件；长期连接或状态机；恢复游标 | WebSocket、目录监听、消息订阅、同步循环 |
| Component Provider | 通过版本化 WIT export 满足其它 Component import；不直接成为产品 App | 协议 adapter、解析器、中间件、通用能力 |

`Native Provider / Process` 是第四条兼容逃生路径，不是 WASM 组件角色。验证套件只需要证明路由边界明确，不需要把摄像头、GPU、任意系统自动化伪装成 WASM 基础能力。

### 4.3 宿主根能力

| 能力域 | 最小合同 | 验证重点 |
| --- | --- | --- |
| KV / structured data | get、set、delete、list/query、版本 | 隔离、持久化、并发与升级后数据 |
| Blob / file | 受控读写、元数据、临时文件 | 不暴露任意宿主路径，处理真实内容 |
| outbound HTTP | HTTPS、域名 allowlist、大小和超时限制 | 成功、拒绝、重定向和大响应边界 |
| Secret | 以引用/句柄读取，不暴露宿主文件 | 授权、缺失、撤销和日志脱敏 |
| time / random | 宿主提供可测试接口 | 定时、幂等键和可替换测试时间 |
| event | publish、subscribe/handler、游标或 ack | 不丢失、去重、顺序、失败重试 |
| scheduler | one-shot、interval/cron trigger | Panel 关闭后仍运行，停用后停止 |
| log / metric / trace | 结构化记录、调用关联 ID | 用户可看到动作、能力和错误链路 |
| model / agent provider | 受控模型调用或 Agent 请求 | App 可构建 AI 场景；权限和预算明确 |

设备、原生窗口、GPU、摄像头、任意进程和完整 POSIX 不进入这组根能力，统一走 Native Provider / Process。

### 4.4 产品投影

同一稳定 Component export 至少需要验证以下投影不会复制业务语义：

```text
Component export
  ├─ Service Action
  ├─ Agent Tool
  ├─ Panel operation
  └─ nextclaw CLI（适用时）
```

HTTP endpoint、事件 trigger 和自动化编排可以后续继续投影，但不能各自重写业务实现。

## 五、常见应用场景覆盖矩阵

| 应用原型 | 所需机制 | 验证套件中的代表行为 | 验收证据 |
| --- | --- | --- | --- |
| 数据型 App | Action + structured data | 创建、修改、查询、删除记录 | 数据表、版本、重启前后 hash |
| 外部 API 集成 | HTTP + Secret + KV | 带凭据同步远端数据并保存游标 | 请求域、状态码、游标、脱敏日志 |
| Agent Tool Pack | Agent Tool 投影 | Agent 发现并调用与 Panel 相同 Action | 工具调用卡片、参数、结果、调用 ID |
| 定时自动化 | scheduler + Action/Resident | Panel 关闭后按计划增加计数或同步 | 触发时间线、计划 ID、实际执行时间 |
| 事件监听 | Resident + event | 订阅测试事件并更新聚合状态 | start/stop、事件序号、ack、游标 |
| 消息/实时连接 | Resident + stream/network | 维持模拟或本地测试流并处理消息 | 连接状态、重连次数、消息时间线 |
| 长任务 | async job + progress + cancel | 分批处理数据，可查看进度并取消 | job ID、进度、取消点、最终状态 |
| 文件/内容处理 | Blob/file + Action | 导入文件、转换、导出结果 | 输入/输出大小、hash、导出 artifact |
| AI 增强 App | model provider + data | 对数据进行分类/摘要并保存结构化结果 | 模型、预算、输入引用、结果记录 |
| Agent 协作 App | agent provider + event | Component 请求 Agent 完成子任务并接收结果 | 请求 ID、会话/任务关联、完成事件 |
| 多组件应用 | Provider composition | 两个消费者复用同一强类型 Provider | import/export 图、Provider 版本、输出 |
| 平台原生应用 | Native Provider / Process | 明确转交原生能力，不做虚假兼容 | 路由类型、权限边界、不可移植说明 |

这张表是“常见应用能否开发”的主要判据。后续新增能力时，优先判断它是否补齐一个普遍场景，而不是为某个 Demo 增加专用接口。

## 六、Demo 套件结构

不把所有验证揉进一个 App。多个 App 是必要的，因为跨 App 隔离、授权、生命周期和共享 runner 本身就是需要验证的事实。

### 6.1 Portable Verification Center

定位：统一验证控制台和证据阅读器，不拥有各 Demo 的业务语义。

主要能力：

- 显示能力矩阵及当前 L0-L5 等级；
- 运行单项验证或一组验证；
- 展示结构化数据、事件时间线、Agent 调用、权限决策、runner/instance 信息和性能样本；
- 对每项结果提供“查看证据”，而不是只显示绿色勾；
- 导出一次验证报告；
- 标记哪些结果需要宿主重启、撤权、升级或用户确认后才能完成。

控制台不能伪造结果，也不能用前端 `setInterval` 伪装 Resident。它只编排标准产品入口并读取标准观测数据。

### 6.2 Portable Action & Data Lab

定位：验证最常见的短任务、数据型应用和多入口调用。

Component：

- 一个 Action Component；
- 一个等价 Node Service fixture，仅用于同题性能基线。

代表行为：

- 创建带 `id/title/status/tags/version/updatedAt` 的结构化记录；
- list、get、update、delete 和批量统计；
- 对输入数据执行确定性转换；
- Panel 和 Agent 调用同一 Action；
- CLI 调用同一公共 contract（若本轮 CLI 基础入口可复用）；
- 重建 Component、重启 runner、重启隔离 NextClaw 后数据仍一致。

它必须展示真实记录表和变更历史，不能只展示一个计数器。

### 6.3 Portable Resident & Event Lab

定位：验证真正的后台生命周期、事件处理、调度和恢复。

Component：

- 一个 Resident Service；
- 可选一个 Action Component，用于查询状态和注入测试事件。

代表行为：

- 显式 start、stop、status；
- 宿主 scheduler 在 Panel 关闭时仍触发 heartbeat/tick；
- 接收带序号的事件，保存 ack 和 durable cursor；
- 记录最近事件、处理次数、失败次数和最后活动时间；
- 模拟连接断开并验证重连/退避；
- runner 重建后从持久游标恢复，不重复提交已 ack 事件；
- App 停用后后台活动真实停止。

最小真实性要求：后台推进必须发生在 host/runtime 层；关闭 Panel 后继续，停止 Resident 后冻结。前端轮询只能读取状态，不能制造状态。

### 6.4 Portable Composition Lab

定位：验证 Component Model 不只是 JSON Action envelope，而能形成强类型组合。

Component：

- 一个不直接暴露为 App Action 的 Component Provider；
- 一个 Action Consumer；
- 一个 Resident Consumer。

代表行为：

- Provider export 一个版本化的 normalize/score 或 transform 接口；
- 两个 Consumer 通过 WIT import 使用同一 Provider；
- UI 展示实际 import/export 图、包版本和调用结果；
- Provider 缺失或版本不兼容时，安装/启动阶段给出诊断，而不是运行到任意 JSON 错误；
- 在可控升级测试中替换兼容 Provider，Consumer 不修改仍可运行。

### 6.5 Portable Capability Boundary Lab

定位：集中验证权限、资源、错误和隔离，不污染业务 Demo。

代表行为：

- storage、HTTP、Secret、event、model 分别允许与拒绝；
- trap、timeout、取消、超限响应和 OOM/内存预算；
- 一个 App 失败时其它 App 继续工作；
- runner 被终止后自动恢复，持久数据不丢失；
- 撤权后下一次调用立即失败，恢复授权后可恢复；
- 日志和错误不得泄露 Secret 或宿主真实路径。

## 七、必须留下的数据和证据

### 7.1 统一验证记录

每次真实操作至少记录：

```text
verificationRunId
scenarioId
startedAt / completedAt / durationMs
entrySurface            # panel | agent | cli | scheduler | event
appId / componentId
componentRole           # action | resident | provider
runnerPid / instanceId
actionOrEventName
capabilitiesUsed
inputSummary / outputSummary
dataVersionBefore / dataVersionAfter
result                   # passed | failed | blocked
errorCode / recoveryResult
evidenceRefs
```

记录归验证系统或通用 observation owner，不把验证专用字段塞进普通 App 核心合同。普通 runtime 只提供稳定的调用、生命周期、capability 和 trace 事实。

### 7.2 用户可见证据面

- **数据页：** 当前结构化记录、版本、最近变更、重启前后校验；
- **事件页：** Resident 状态、事件序号、ack、游标、重试和心跳；
- **调用页：** Panel/Agent/CLI/调度入口、输入、输出、耗时和调用关联 ID；
- **权限页：** 请求的 capability、授权状态、允许/拒绝结果；
- **运行页：** runner PID、Component/instance、共享与隔离关系、重启次数；
- **性能页：** Node 与 Component 同题 workload 的原始样本和统计口径；
- **覆盖页：** 每项能力的等级、最近验证时间、证据链接和未完成原因。

### 7.3 数据持久化证明

数据链路至少完成以下序列：

```text
创建 3 条结构化记录
  -> 修改其中 1 条并删除 1 条
  -> 记录数据版本与内容 hash
  -> 重建目标 Component
  -> 再读并校验
  -> 杀死并恢复共享 runner
  -> 再读并校验
  -> 重启隔离 NextClaw Host
  -> 再读并校验
  -> 升级 Demo App
  -> 再读并校验或执行显式 migration
```

每一步都必须留下 before/after 数据，不接受只看“调用成功”。

## 八、关键端到端验收链路

### 8.1 Action 与统一入口

```text
Panel 创建记录
  -> Agent 查询并修改同一记录
  -> CLI（适用时）读取同一结果
  -> 三个入口显示相同 actionId、数据版本和 traceId
```

Agent 验证必须出现真实工具调用，不接受模型根据提示词模拟结果。

### 8.2 Resident 与事件

```text
启动 Resident
  -> 关闭 Panel
  -> Scheduler/事件源继续产生事件
  -> Resident 处理并持久化 cursor
  -> 重新打开 Panel 看到连续时间线
  -> 杀死 runner
  -> 自动恢复并从 cursor 继续
  -> stop Resident
  -> 验证事件计数停止增长
```

### 8.3 Provider 组合

```text
解析 Consumer imports
  -> 链接兼容 Provider export
  -> Action Consumer 调用 Provider
  -> Resident Consumer 调用同一 Provider
  -> 升级兼容 Provider 后重新验证
  -> 注入不兼容版本并得到安装/启动诊断
```

### 8.4 权限与故障隔离

```text
App A 获准 api.example.com
App B 未获准
  -> A 成功、B 被拒绝
  -> B trap/timeout
  -> A 仍可继续读写数据
  -> 撤销 A 权限后立即拒绝
  -> 恢复授权后重新成功
```

### 8.5 性能与密度

同一 workload 至少测量：

- 空 runner；
- 1 / 5 / 10 个 Action Component；
- 1 / 5 个 Resident Service；
- 对应数量的 Node Service；
- 冷启动、热调用、空闲、停止、unload 和恢复；
- RSS、虚拟内存、启动耗时、P50/P95 调用耗时和 CPU；
- 至少三轮，保存原始样本、环境和统计口径。

## 九、实现阶段拆解

每个阶段是一个可独立 Review 的中大型任务，不把所有能力一次性塞进单次实现。

### 阶段 A：证据骨架与 Action/Data 闭环

- 建立 Verification Center 和统一验证记录；
- 用真实结构化数据替换计数器式展示；
- 增加 Agent Tool 投影与 Agent caller 授权；
- Panel、Agent 和适用的 CLI 调用同一 Service Action；
- 完成 Component/runner/Host 重启与 App 更新后的数据证明；
- 形成 1/5/10 Action 与 Node 等价 workload 基线。

退出条件：数据型 App 和 Agent Tool Pack 达到 L5，用户能在产品内查看证据。

### 阶段 B：Resident、事件与调度

- 冻结 Resident 生命周期和 event/scheduler WIT；
- 实现真正由 runtime/host 驱动的 Resident Service；
- 完成 start/stop/status、事件 ack/cursor、断线恢复和停用停止；
- 展示后台时间线和 Resident 资源成本。

退出条件：Panel 关闭后后台链路继续，runner 恢复后从 cursor 继续，停止后不再推进。

### 阶段 C：Provider 组合与常见能力补齐

- 冻结最小 Provider import/export 与版本诊断；
- 完成 Action/Resident Consumer 复用同一 Provider；
- 补齐 Blob/file、Secret、长任务 progress/cancel、stream/backpressure；
- 增加最小 model/agent provider 验证，区分 Agent 调入与 Component 调出。

退出条件：常见应用场景矩阵中除平台原生场景外均至少达到 L4，关键数据和恢复能力达到 L5。

### 阶段 D：生命周期、隔离与采用决策

- 安装、授权、撤权、restart、更新、迁移、卸载和数据保留闭环；
- 多 App 权限/数据/故障隔离；
- 等价 workload 性能与资源测量；
- 跨平台 artifact 和 runner 分发验证；
- 输出 portable-component 与 native-process 的正式适用规则。

退出条件：验证套件能够重复执行，失败项可定位，证据足以支持继续产品化、缩小范围或停止的决策。

## 十、明确不采用的做法

- 不用静态“支持/不支持”卡片代替真实验证记录；
- 不用前端定时器制造 Resident 心跳；
- 不为每个 Demo 场景增加一个宿主专用业务 API；
- 不让 Agent 通过浏览器点击 Panel 来冒充原生 Tool 调用；
- 不把多个组件塞进同一权限和数据上下文后宣称跨 App 隔离成立；
- 不把 JSON Action envelope 当成 Component Provider 组合证据；
- 不用“WASM 理论上可以”代替平台内真实链路；
- 不为了覆盖设备和完整系统 API，把 runtime 演变成 Docker/POSIX 兼容层；
- 不在验证阶段并行维护 Spin、wasmCloud 和直接 Wasmtime 三套产品 executor。

## 十一、当前结论与 Gate 修正

首个「Portable Runtime 实验室」应重新定性为：

> **Action Runtime 技术垂直切片，已提供方向性证据，但不是完整能力 Demo，也未关闭 Gate 1。**

下一步不应直接宣布进入生产 MVP，也不应只继续增加按钮。应先执行“阶段 A：证据骨架与 Action/Data 闭环”，再逐步完成 Resident 与 Provider 验证。

只有当用户能亲自看到以下事实，才可以称为“麻雀虽小、五脏俱全”：

1. 有真实业务数据，并能跨重启和更新保持；
2. Panel、Agent 和适用 CLI 调用同一能力；
3. Action、Resident、Provider 三种角色均有真实样例；
4. 常见应用场景能映射到有限基础能力；
5. 权限、错误、资源、恢复和隔离可以被观察和重复验证；
6. 性能优势来自等价 workload 和原始数据，而不是理论或单点数字；
7. 不适合 WASM 的平台原生场景有明确逃生路径。
