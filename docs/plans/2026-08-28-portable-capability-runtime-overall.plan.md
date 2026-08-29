# Portable Capability Runtime 总体阶段计划

> **执行约束：** 本文是项目级阶段计划，不是可以直接逐条编码的文件级实施清单。每个阶段启动前必须在隔离 worktree 中单独形成可执行实施计划，并按该阶段的真实代码证据冻结文件、测试和验证范围。

**Goal：** 分阶段证明并交付一个 Rust-first、低增量内存、单主要 artifact、可授权并接入现有 Service App 主链的 Portable Capability Runtime，让用户尽早体验真实 Demo，再逐步推进到产品 MVP、跨平台开发者预览和生产化决策。

**Architecture：** 现有 `.napp`、AppPackageManager、ServiceAppManager 和 Service Action 继续拥有产品语义；嵌入式 Spin 已成为正式执行底座，直接 Wasmtime 只保留历史测量证据；Rust Component 通过稳定 WIT 使用精选内置 Factor，并通过 Component/Native Provider 扩展生态能力；`native-process` 长期保留为旧框架、重依赖和平台能力逃生口。

**Tech Stack：** Rust、WebAssembly Component Model、WASI 0.2/0.3、WIT、Spin Runtime Factors/Triggers、Wasmtime 基线、现有 NextClaw TypeScript/kernel/App Platform、`.napp` schema v2。

---

## 一、计划状态与关联文档

- 日期：2026-08-28
- 状态：总体计划执行中；直接 Wasmtime 核心 MVP v0.5.2 与全平台发布基线已完成，2026-08-30 冻结 Spin-first、可安装 Capability Provider、外部资源绑定与 native-process 并存模型；Spin 判别性 Spike 已过本机功能/密度门并迁入正式 runner
- 计划粒度：四个主阶段；每个阶段约等于一个普通中大型开发任务
- 架构 owner：[WASI Service App 运行时与现有 Mini App 体系融合设计探索](../designs/2026-08-28-wasi-service-app-runtime.design.md)
- 愿景与 MVP owner：[Portable Capability Runtime 愿景与 MVP 设计](../designs/2026-08-28-portable-capability-runtime-mvp.design.md)
- 完整验证 owner：[Portable Capability Runtime 全能力验证套件设计](../designs/2026-08-28-portable-runtime-verification-suite.design.md)
- 认知与场景材料：[NextClaw 可移植能力运行时全景说明与场景设想](../thoughts/2026-08-28-portable-capability-runtime-panorama.thought.md)

本计划只编排已经收敛的 Portable Capability Runtime 主线，不纳入尚未收敛的 Agent OS、Node REPL 编排、新 DSL、任意组件互调或多语言生态讨论。

### 1.2 2026-08-30 Spin-first 与依赖模型决策

本轮后续执行拆成五个有依赖顺序的部分；每部分完成后保留可恢复入口，不以“整体还很大”为由重复运行完整矩阵：

| 部分 | Owner 与输入 | 交付结果 | 最小验证与继续条件 |
| --- | --- | --- | --- |
| A. Spin 判别性 Spike | runtime runner；复用现有五个 Guest 与 Wasmtime 基线 | 嵌入式 Spin runner、NextClaw Trigger/Factor adapter、同场景测量 | Action/Resident/Provider、KV/HTTP、故障恢复、RSS/包体、macOS/Linux/Windows 构建均达到门槛 |
| B. 正式执行器迁移 | Kernel portable executor；输入 A 的通过结论 | 保持 runner protocol 与 `.napp` 不变，Spin 替代直接 Wasmtime内部实现 | 现有 HTTP enable、Panel、Agent Tool、CLI、持久化与发布 smoke 全部复用通过；删除长期双实现 |
| C. 依赖就绪模型 | AppPackageManager + capability grants；复用上位设计 | `ready`、`needs-capability`、`needs-configuration`、`incompatible` 状态，capability/resource 声明和结构化修复动作 | 可安装但不可误启用；补齐 Provider/配置后原地进入 ready；Secret 不写回 artifact |
| D. Capability Provider 扩展闭环 | Provider catalog + CLI/Agent；输入 C 的稳定合同 | Component/Native Provider 注册、显式本地信任安装、SDK/template、AI 可执行 detect/build/install/configure/verify/uninstall 路径 | 用一个非默认重 Provider 做从零闭环；除授权、登录或付费确认外不要求用户执行技术步骤；无 NextClaw 产品源码改动 |
| E. 开发者与发布闭环 | CLI、文档、发布 workflow；复用 A-D | create/doctor/build/check/test/pack/install/configure/enable 全链路与自动发布门 | 干净环境、三平台 artifact、真实 HTTP enable、代表性 action、缺依赖错误均有自动证据 |

恢复入口：每部分只以其产物、定向测试和设计中的稳定合同作为输入。A 未通过时不得启动 B；C/D 可以在 A 后按独立 owner推进，但不得在 schema 未冻结前实现通用动态加载。任何 Spin 私有 manifest 都不得上浮为 `.napp` 事实源。

### 1.1 2026-08-28 阶段 1 实施记录

阶段 1 已在隔离 worktree `codex/portable-capability-runtime-demo` 中形成一套可体验实现：

- 新增 Rust/Wasmtime 共享 runner 与最小 `service-app` WIT；
- 新增两个真实 Rust/WASM Component，分别覆盖状态和受控能力；
- 将 `wasi-component` 作为现有 Service App 的执行协议接入 Kernel，没有创建平行 App 类型；
- 新增内置「日常小工具箱」，可从现有应用列表启用，并通过清单、便签、专注计时和联系人整理四个普通场景体验；
- 实际验证了同 runner 多 Component、宿主 KV、允许/拒绝网络、结构化失败、1200ms 超时、runner 自动重建和完整 NextClaw 重启后的状态持久化；
- 定向单元/集成测试、相关 TypeScript 类型检查、Rust 构建和本地 UI 主链均已通过。

首个 Action 垂直切片曾因 Agent、真实数据证据、Resident、Provider 与常见应用场景覆盖不足而重新打开 Gate 1。当前这些核心缺口已经完成补证，但结论仍是“核心 MVP 可体验”，不是“完整应用平台”或“生产就绪”；后续能力与边界继续由[全能力验证套件](../designs/2026-08-28-portable-runtime-verification-suite.design.md)约束，不直接跳到生产化结论。

#### Gate 1 补证进展

上述缺口中的核心部分现已在隔离实现中补齐：Service Action 可显式授权给 Agent；State Component 提供真实结构化 CRUD；Resident 由宿主在 Panel 关闭后持续投递事件；Provider 与 Consumer 通过宿主中介进行跨 Component 调用；共享 runner 超时后长期角色会按依赖顺序恢复。当前可体验包为 v0.5.2，共四个日常场景 Panel、一个开发者验证台和五个 Rust/WASM Service Component。产品入口先回答“能做什么”，底层机制只在第二层展示。

Gate 1 仍不等于完整阶段 2。Secret、Blob/file、长任务、流、模型/Agent 出站、多 App 隔离、三平台分发与生产资源限制仍在后续 Gate；详细成熟度与实证见[全能力验证套件设计](../designs/2026-08-28-portable-runtime-verification-suite.design.md)。

#### 内存方向性基准

在同一台 Apple Silicon macOS 开发机、Node.js v22.16.0 上运行三轮可重复脚本；每个点取五次 OS RSS 采样的中位数：

| 指标 | 三轮观测范围 |
| --- | ---: |
| 空 Wasmtime runner | 7.70–7.73 MiB |
| runner + 1 个独立路径 Component | 34.17–36.77 MiB |
| runner + 5 个独立路径 Component | 43.86–44.72 MiB |
| runner + 10 个独立路径 Component | 50.84–53.17 MiB |
| 1 个最小 Node Service 进程 | 39.88–39.91 MiB |
| 5 个最小 Node Service 进程合计 | 199.61–199.70 MiB |
| 10 个最小 Node Service 进程合计 | 399.25–399.47 MiB |

这份证据支持一个阶段性判断：共享 runner 的首个 Component 会承担 Wasmtime/Component 装载成本，但后续 Component 的固定成本能够被共享；10 个独立路径 Component 的总 RSS 仍约为 10 个独立最小 Node Service 的八分之一。它直接验证了本方案最关心的“多 Service 固定成本是否能被共享”方向。

边界必须保留：当前 Component 与 Node fixture 不是等价业务 workload，三轮样本也只覆盖 Apple Silicon 和 Action Component；因此它是 Gate 1 的强方向性证据，不是生产结论。后续仍需完成 Resident 密度、CPU/P50/P95、首次/热调用、unload 回收和跨平台测量。可重复脚本位于 `apps/nextclaw-wasmtime-runner/tools/runtime-memory.tools.mjs`。

## 二、已经冻结到计划层的硬约束

### 2.1 Rust-first，不建设多语言 MVP

- 官方 SDK、模板、Reference App、文档和验收只覆盖 Rust；
- Runtime 接收符合 WIT 的 Component artifact，不在 manifest 中记录源语言；
- 不研究 Python、FastAPI、JavaScript/TypeScript 或 Go 的 Component 兼容；
- 不把“支持任意语言”作为产品宣传或验收条件；
- AI 编程用于降低 Rust 开发成本，产品优先追求运行效率、类型安全和部署稳定性。

### 2.2 Action-first，但完整验证套件必须覆盖 Resident Service

- 第一条已实现链路仍是按调用激活或可回收复用的 Action Component；
- 用户 Review 已证明只验证 Action 无法判断运行时能否承载常见 Service App；
- Gate 1 补充验证必须加入最小但真实的 Resident Service：显式 start/stop/status、由 host/runtime 驱动的事件或调度、持久游标与 runner 恢复；
- WebSocket、消息订阅和长期同步先用一个代表性真实机制验证，不在同一阶段产品化所有协议；
- Resident 的生产资源治理、广泛协议支持和跨平台稳定性仍由后续阶段冻结。

### 2.3 保留现有产品 owner

- `.napp`、安装、版本、更新、卸载与数据生命周期归 AppPackageManager；
- Actions、授权、调用和产品状态归 ServiceAppManager；
- runner 只拥有 Component 执行、WIT linking、Store 与资源预算；
- 不新增 Wasm App 产品、第二 Marketplace、第二 registry 或第二数据目录；
- Panel 和 Agent 不感知具体 executor。

### 2.4 框架是实现，不是合同

- Spin 是首选执行底座，直接 Wasmtime 是判别性 Spike 基线；`wash-runtime` 只在 Spin 无法通过硬门时重新进入候选；
- 对外 `.napp`、WIT、Service Action 和 grant 不包含框架私有 manifest；
- Spike 决策后主线只保留一个正式 runtime 实现，不长期维护双 executor；
- `native-process` 与新的 portable executor 并列存在，不做隐式 fallback。

### 2.5 分发不等于所有依赖都内嵌

- 默认和推荐路径是自包含、安装后直接可运行；外部 Provider/资源只作为特殊需求逃生口，不与默认路径平级宣传；
- `.napp` 始终可以独立复制、上传和安装；包内只包含 Panel、Component 与可移植资源；
- 生态 Capability Provider 独立版本化，App 只声明 capability id/API 范围；真正的进程内 Spin Factor 仍随签名 runtime 发布；
- Redis、PostgreSQL 等外部服务通过 App instance resource binding 配置，endpoint 与 Secret 不进入公开包；
- 缺 Factor 或资源配置时安装成功但禁止 enable，必须返回结构化 readiness 和一键/CLI 修复动作；
- Marketplace、安装确认和应用详情必须在安装前醒目标识额外组件、外部服务、数据离机和可能费用，并降低非自包含 App 的默认推荐优先级；
- AI 必须能自动完成检测、安装、配置、Secret 采集、连接验证、修复和解绑；用户只做不可代理的授权、登录或付费决定；
- 默认 runner 只编译精选 Factors；重型集成使用按需安装的 Provider，未安装时不得产生连接池、timer、常驻进程或内存成本；
- 需要完整 Node、Python、原生 SDK 或 OS 权限的应用继续选择 `native-process`，不强制迁移到 WASM。

## 三、总体路线图

| 阶段 | 名称 | 用户能看到什么 | 阶段结束时的核心决策 |
| --- | --- | --- | --- |
| 1 | 可体验 Demo 与技术选型 | 在现有 NextClaw 中调用一个真实 Rust Component，并看到持久数据与内存对照 | 继续、缩小或停止；选定唯一宿主实现 |
| 2 | 单平台产品 MVP | 安装真实 `.napp`，授权 HTTP/Secret/KV，Panel 与 Agent 调用同一 Actions | 产品主链是否成立，是否值得跨平台投入 |
| 3 | 跨平台开发者预览 | 用官方 Rust 模板构建一次，在 macOS/Windows/Linux 安装和运行 | 合同与工具链是否足以开放给早期开发者 |
| 4 | 生产化与正式采用决策 | 稳定升级、资源治理、故障恢复和安全证据 | 是否成为普通 Service 的推荐执行方式 |

```text
阶段 1：先证明并让用户看到
       ↓ Gate 1
阶段 2：闭合真实产品 MVP
       ↓ Gate 2
阶段 3：闭合跨平台和开发者路径
       ↓ Gate 3
阶段 4：安全、稳定、升级与正式采用
       ↓ Gate 4
后续扩展：只按真实需求单独立项
```

阶段之间不默认连续执行。每个 Gate 都要求用户 Review 体验、证据、范围变化和下一阶段成本，再决定是否继续。

## 四、阶段 1：可体验 Demo 与技术选型

### 4.1 阶段目标

用最小但接近正式架构的垂直切片同时回答两件事：

1. Rust Component 在 NextClaw 内是否真的能低成本、受控地运行；
2. 用户是否能在现有产品入口中体验到它，而不只是运行一个独立 WASM hello world。

### 4.2 主要工作包

#### 工作包 A：现状切片与基线

- 切清旧 NApp WASI runtime、schema v2 Service、ServiceAppManager、Panel/Agent Action 调用与 Desktop/runtime bundle 主链；
- 冻结一份等价 Node Service 基线 workload；
- 明确当前进程、内存、启动、数据、权限和错误观测方式；
- 确认哪些旧实现可以复用，哪些只能作为证据。

#### 工作包 B：Spin 与直接 Wasmtime 的判别性实验

- 使用现有五个 Rust Component 和同一 host capability 对比 Spin 与直接 Wasmtime基线；
- 实现一个 NextClaw Service Action Trigger 和最小自定义 Factor，验证现有 WIT 可兼容；
- 只组装 WASI、variables/secrets、KV、SQLite、outbound HTTP、observability 与 NextClaw 自定义 Factor，不默认编译 Redis 等重能力；
- 测量 runner 基线、每 Component 增量 RSS、首次/热调用、回收和隔离；
- 审查嵌入 API、WASI 版本、跨平台构建、私有 manifest 与升级耦合；
- Spin 通过全部硬门后替换正式实现；否则保留直接 Wasmtime并记录失败证据。

#### 工作包 C：体验型垂直切片

- 在预期的 Service executor 边界接入选定候选；
- 提供一个简单 Rust Demo Component，至少包含一个结构化 Action、私有 KV 和一次受控 HTTP；
- 使用一个最小 Panel 调用该 Action，展示结果和持久数据；
- 证明 Component trap、timeout 或 denied 能转成可理解错误；
- 提供 Node 对照与多 Component 内存观测结果。

### 4.3 用户体验检查点

阶段结束时，用户应能亲自完成：

```text
打开 Demo
  -> 调用一个真实 WASM Service Action
  -> 写入并重新读取持久状态
  -> 发起受控网络请求
  -> 触发一个可理解的权限或超时错误
  -> 对比一个和多个 Component 与 Node Service 的内存表现
```

Demo 可以使用开发安装路径，不要求完整 Marketplace、更新或三平台正式 bundle，但调用链不得绕开未来 Service executor 主边界。

### 4.4 阶段产物

- 一个可运行、可操作的 Demo；
- 一份 Node、直接 Wasmtime 与 Spin 的同题证据；
- 一个正式宿主结论及其迁移或保留理由；
- 最小 WIT、runner adapter 与 capability linking 结论；
- 一份进入产品 MVP 的风险和范围修正；
- 阶段 2 的文件级实施计划草案。

### 4.5 Gate 1：继续条件

只有同时满足以下条件才进入阶段 2：

- 多 Component 增量 RSS 相对 Node Service 显示出明确、可重复的优势；
- 一个 Rust Component artifact 至少在目标平台工具链上具备可移植性证据；
- HTTP、KV、取消、错误与资源限制不要求把完整 OS 暴露给 guest；
- 选定 runtime 可以嵌入 NextClaw，而不要求第二产品控制面；
- Demo 使用了未来主链的核心边界，不是纯一次性 harness；
- 用户体验后认为这条能力值得继续产品化。

若 Gate 1 不成立，允许直接停止，或缩小为少数内部低内存任务使用的实验 runtime。

## 五、阶段 2：单平台产品 MVP

### 5.1 阶段目标

在主要开发平台先闭合一个真实 `.napp` 的安装、授权、Action、数据和生命周期，让它成为可持续演进的产品 MVP，而不是实验 Demo。

### 5.2 Reference App

使用愿景设计中的 GitHub Issue Watcher：

```text
Actions:
- list-repositories
- list-important-issues
- refresh

Capabilities:
- outbound-http: api.github.com
- secret: github-token
- private-kv
- logging
```

Reference App 同时包含最小 Panel，并允许 Agent 通过现有 Service Action 调用同一 Actions。

### 5.3 主要工作包

#### 工作包 A：schema v2 与 Service executor 正式接入

- 冻结 portable executor manifest 最小字段；
- 让 schema v2 Service Component 进入正式 discover/invoke 主链；
- ServiceAppManager 继续拥有产品 Actions、状态、授权和错误；
- 取消独立 schema v1 产品路线或保留范围在本阶段形成迁移判断。

#### 工作包 B：共享 runner 与最小 capability

- 形成一个产品级共享 runner；
- 每 App 使用独立 Store、授权上下文、内存、超时和取消；
- 正式提供 HTTP host allowlist、私有 KV、Secret 引用与结构化日志；
- restart 只重建目标实例；
- runner 故障映射为可恢复产品失败。

#### 工作包 C：完整 App 生命周期与体验

- 安装、启用、权限展示、调用、撤权、restart、更新和卸载沿现有 `.napp` 主链闭合；
- Panel 与 Agent 调用同一 Service Actions；
- 权限撤销、HTTP 失败、Secret 缺失、trap、timeout 与 OOM 有稳定行为；
- App 数据由现有 instance/storage owner 管理，不暴露宿主真实路径。

### 5.4 用户体验检查点

用户应能：

```text
安装 GitHub Issue Watcher .napp
  -> 查看并批准精确权限
  -> 在 Panel 中刷新和查看结果
  -> 从 Agent 调用同一 Action
  -> 撤销权限并看到明确失败
  -> restart 后保留持久数据
  -> 更新或卸载 App
```

### 5.5 阶段产物

- 单平台可安装的产品 MVP；
- 正式的最小 portable Service contract；
- 选定 runtime 的唯一产品实现；
- Rust Reference App；
- 产品权限、错误、资源与恢复行为；
- Node/WASM 实际产品链内存对照；
- 阶段 3 跨平台和开发者工具范围。

### 5.6 Gate 2：进入跨平台条件

- 产品 MVP 的安装到卸载链路完整；
- Panel 与 Agent 不感知 executor；
- 权限不是文档声明，而是 Runtime 真正执行；
- 内存优势在真实产品链路中仍然存在；
- Reference App 不依赖专用宿主业务 API；
- 公共合同没有泄漏选定 framework 的 manifest 和控制面；
- 用户认为体验已经证明“它是 NextClaw Service App”，而不是技术演示。

## 六、阶段 3：跨平台开发者预览

### 6.1 阶段目标

证明 Portable Component 的分发和开发者价值：同一主要 artifact 在 macOS、Windows、Linux 的 NextClaw 中运行，外部早期开发者可以依赖官方 Rust 路径完成一个 App。

### 6.2 主要工作包

#### 工作包 A：三平台 runner 与 bundle

- 闭合 macOS、Windows、Linux runner 构建；
- 集成 Desktop/runtime bundle、安装、升级和恢复；
- 验证不同 CPU 架构与必要 ABI 边界；
- 不让每个 App 按平台携带普通 Service artifact。

#### 工作包 B：Rust 开发者闭环

- 发布或内置一个 Rust SDK、模板和 Reference App；
- 提供本地 dev、build、test、package CLI 路径；
- AI 编程环境可以基于模板、WIT 和编译错误生成并修正 Component；
- 文档只承诺 Rust，不为其它语言建立兼容矩阵。

#### 工作包 C：合同兼容与早期反馈

- 冻结开发者预览版本的 WIT/package 兼容规则；
- 建立 Component 校验、权限预检和错误诊断；
- 使用至少一个非 Reference App 的第二真实案例验证合同不过拟合；
- 收集早期开发者的构建、调试、依赖和能力缺口。

### 6.3 用户与开发者体验检查点

- 从同一 Rust 源码和主要 Component artifact 在三个平台安装运行；
- 开发者从模板创建一个新 App，不手写 MCP/daemon 外壳；
- `nextclaw` CLI 可以完成开发、测试、构建和打包主流程；
- AI 可以根据模板完成一个小型 Service，并由编译器和测试校验；
- 用户在三个平台看到一致权限与 Action 行为。

### 6.4 Gate 3：进入生产化条件

- 三平台 artifact、bundle 和升级链路闭合；
- Rust 开发体验足够稳定，不依赖核心团队口头指导；
- 第二个真实 App 不要求破坏公共合同；
- 版本、权限、数据与错误在平台间保持一致；
- Runtime 固定成本和每 App 增量成本仍符合目标；
- 早期开发者价值足以支撑长期兼容承诺。

## 七、阶段 4：生产化与正式采用决策

### 7.1 阶段目标

把开发者预览提升为可以长期承载第三方本地 Service 的稳定基础，并决定它是否成为普通 Service 的推荐执行方式。

### 7.2 主要工作包

#### 工作包 A：安全与资源治理

- 完整威胁模型和调用链授权审计；
- CPU、内存、并发、输出、HTTP、Secret 和数据配额；
- trap、OOM、timeout、cancel、denied 的结构化稳定合同；
- Component 校验、签名/来源与供应链边界；
- runner 高权限能力与普通能力的隔离策略。

#### 工作包 B：稳定性、升级与恢复

- runner 崩溃、Component 泄漏、长时间运行和高并发验证；
- App 更新、WIT 版本、数据迁移和回退；
- runner/runtime 自身升级与兼容；
- 可观察性、诊断、用户可理解错误和支持工具；
- Desktop/runtime release 与恢复合同。

#### 工作包 C：正式采用范围

- 定义哪些新 Service 推荐 portable-component，哪些仍推荐 native-process；
- 冻结公开 SDK 与兼容周期；
- 形成开发者文档、示例、审核和支持边界；
- 根据真实证据决定是否开放更广泛第三方分发；
- 清理或迁移旧 schema v1 WASI 产品路径，保持单一 owner。

### 7.3 Gate 4：正式采用决策

阶段结束必须在三个结果中明确选择一个：

1. **正式推荐：** 普通便携 Service 默认采用 Portable Component；
2. **有限采用：** 仅特定低内存、低权限 Service 使用，native-process 仍是普通默认；
3. **停止产品化：** 保留技术证据和必要内部用途，不承担第三方公共合同。

不能以“已经投入很多”为理由自动选择正式推荐。

## 八、当前计划明确排除的后续方向

以下方向不属于四阶段主计划。只有主线证明价值且真实需求出现后，才分别立项：

- Resident Service、WebSocket、消息订阅和长期连接；
- Component-to-Component 动态组合；
- Provider Marketplace；
- Python、JavaScript、Go 或其它语言官方支持；
- WASIX、完整 POSIX、shell 和子进程；
- GPU、摄像头、桌面自动化与平台专属 Provider；
- 分布式 runner、云端迁移和自动伸缩；
- Agent OS、Node REPL capability 编排或新 DSL；
- durable worker、checkpoint、重放和跨设备连续执行。

排除不代表永远不做，而是防止它们在核心价值尚未证明前拖大当前任务。

## 九、项目管理与阶段控制

### 9.1 每个阶段单独启动

每个阶段启动时都必须：

1. 重新读取当前代码和上一阶段证据；
2. 在隔离 worktree/branch 工作；
3. 形成该阶段独立的文件级实施计划；
4. 明确成功条件、真实验证、文档和不做项；
5. 用户确认阶段范围后再开始实现。

总体计划不预先决定未来阶段的文件和函数，因为前一 Gate 的结果会改变后续实现路径。

### 9.2 每个 Gate 只需要用户关注五件事

- 我现在能体验到什么；
- 核心指标和失败证据是什么；
- 本阶段新增了哪些长期公共合同；
- 下一阶段需要承担什么复杂度；
- 推荐继续、缩小还是停止，以及为什么。

### 9.3 不并行跨 Gate 建设

- 阶段 1 未选定 runtime，不建设完整产品主链；
- 阶段 2 未证明产品价值，不建设三平台 SDK 承诺；
- 阶段 3 未证明开发者价值，不承担生产级生态兼容；
- 主线未完成，不启动 Resident、多语言、组件组合和 Agent OS 扩展。

## 十、全局停止条件

任一阶段若出现以下事实且没有可接受的缩小方案，应停止主线：

- Rust Component 相对 Node Service 没有显著内存和运行治理优势；
- 跨平台 Component 实际仍需要每 App 大量平台构建和兼容工作；
- 常见 Service 需要不断向宿主增加专用业务能力；
- capability 权限无法真正落到 runtime enforcement；
- framework 必须接管 App 身份、包、数据或产品生命周期；
- Runtime、SDK 和升级复杂度超过它替代的 Node/原生成本；
- 真实用户和开发者体验没有证明存在足够价值。

允许的缩小结果：

```text
少数内部或高价值低内存 Service 使用 Portable Component
+
普通 Service 保持 native-process
```

## 十一、计划完成的最终结果

若四个阶段全部通过，最终应得到：

- 一个由 NextClaw 管理、框架实现可替换的 Portable Capability Runtime；
- 一个 Rust-first 的官方开发路径；
- 一个主要 artifact 覆盖 macOS、Windows、Linux 的普通 Service；
- 真实执行的 HTTP、KV、Secret、日志和资源权限；
- Panel 与 Agent 共用的现有 Service Action 主链；
- 多 App 低增量内存和故障隔离证据；
- 稳定的安装、更新、卸载、诊断和恢复能力；
- 对 portable-component 与 native-process 适用范围的明确产品规则。

若计划在任一 Gate 停止，也必须留下可复用的 benchmark、技术结论、适用边界和架构决策，避免以后重复探索同一问题。
