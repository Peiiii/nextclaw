# WASI Service App 运行时与现有 Mini App 体系融合设计

## 文档状态

- 日期：2026-08-28；2026-08-30 完成 Spin-first Review、判别性 Spike 与正式执行器迁移
- 状态：**Spin-first 执行底座已冻结并完成本机迁移验证**；跨平台发布矩阵仍是交付门
- 文档层级：稳定设计；实施顺序由总体阶段计划负责，本文不构成发布承诺
- 当前目的：冻结 Service App 内存、跨平台分发、WASM/WASI、Spin、可安装宿主能力、外部资源绑定与原生逃生路径的统一架构
- 配套认知材料：[NextClaw 可移植能力运行时全景说明与场景设想](../thoughts/2026-08-28-portable-capability-runtime-panorama.thought.md)，保存完整比喻、端到端解释、场景、生态潜力、多语言边界与长期推演；本文继续作为架构决策 owner
- 愿景与首版范围：[Portable Capability Runtime 愿景与 MVP 设计](./2026-08-28-portable-capability-runtime-mvp.design.md)，负责技术 Spike、Reference App、明确不做项、验收与停止条件
- 完整验证范围：[Portable Capability Runtime 全能力验证套件设计](./2026-08-28-portable-runtime-verification-suite.design.md)，负责三种组件角色、常见应用场景、Demo 拆分和用户可核验证据
- Design Ready：是，适用于正式 Spin runner、依赖就绪模型与开发者闭环；进程内第三方 Factor ABI 和外部资源自动配置仍未冻结
- Implementation Plan：[Portable Capability Runtime 总体阶段计划](../plans/2026-08-28-portable-capability-runtime-overall.plan.md)；直接 Wasmtime 已完成对照使命并从正式实现移除

## 一、问题起点

当前 Mini App 可以包含 Panel Component 与 Service Component。Service App 使用 JavaScript/Node 时，即使不考虑源码和安装包大小，单个 V8/Node 运行实例本身也会带来不可忽略的常驻内存。当前 Service 已经按 discover/invoke 按需启动，因此问题重点不是“未使用的 Service 是否常驻”，而是：

> 一个正在运行的 JavaScript Service 自身内存成本较高；当多个 Service 同时活跃时，运行时固定成本会持续累积。

改用 Rust 原生进程可以降低单 Service 的运行成本，但会把复杂度转移到发布侧：每个 App 都要分别构建和分发 macOS、Windows、Linux、不同架构及 Linux ABI artifact。

本次讨论要解决的核心矛盾是：

1. Service 逻辑是否可以保持低内存；
2. App 是否可以只构建和发布一个跨平台 artifact；
3. Service App 是否仍能保持接近现有原生进程的扩展能力；
4. NextClaw 宿主是否能以有限、稳定、不过度业务化的技术能力合同承载这类 App；
5. 是否应复用现有 WASI/Component Model 框架，而不是自行重新实现一个运行时平台。

## 二、与 NextClaw 产品愿景的关系

这项能力的目标不是增加第三套 App 类型，也不是把 NextClaw 变成通用容器平台，而是增强个人操作层的生态底座：

- App 开发者用一个可移植 Service artifact 覆盖多桌面平台；
- 用户继续从统一的 Apps、Panel、Agent 与 Service Action 入口使用能力；
- 包、组件、数据、权限、更新和卸载仍由 NextClaw 统一管理；
- 扩展能力优先进入稳定内核和生态，不让主产品通过硬编码业务功能持续膨胀；
- `native-process` 继续作为真实系统能力的逃生路径，但不再是每个普通 Service 的默认成本。

因此，本设计探索遵守一个上位判断：

> WASM/WASI 不应成为新的平行产品，而应成为现有 Service App 的一种一等执行方式。

### 2.1 核心价值：不是让代码“能做更多”，而是让平台“能承载更多代码”

必须把本方案的价值与单个 App 的功能价值分开：JavaScript、Rust、Python 和原生进程本来就可以实现网络、文件、数据库、模型和系统调用。WASM Component 不创造新的计算能力，也不是因为“现有代码做不到”才存在。

> **本方案真正要解决的是：让大量第一方或第三方 Service 代码能够以统一、低增量成本、跨平台、可授权、可治理的方式进入 NextClaw。**

可以压缩为：

```text
普通代码
  = 业务功能

受 NextClaw 管理的 Portable Component
  = 业务功能
  + 通用 artifact
  + 明确接口
  + capability 权限边界
  + 统一生命周期与资源治理
```

它首先是生态承载与运行治理方案，其次才是组件组合技术。单个 App 能否实现某项业务，不是判断它是否有价值的依据。

### 2.2 四项一等价值

#### 价值一：把多平台构建复杂度从每个 App 集中到宿主一次

原生 Rust Service 需要每个 App 分别处理多个操作系统、CPU 架构、ABI、签名和更新 artifact。Portable Component 让 NextClaw 为每个平台分发一次 runner，普通 App 主要发布一个通用 artifact。

```text
原生模式：App 数量 × 平台/架构数量
Component 模式：App 数量 × 通用 artifact + NextClaw × 平台 runner
```

这不是消除平台差异，而是把不可避免的平台差异收敛到有能力长期维护它的宿主 owner。

#### 价值二：降低多个活跃 Service 的运行时固定成本

多个 Node Service 会分别承担 V8、GC、事件循环、模块加载和进程固定成本。共享 Component Runtime 可以复用 Engine、编译缓存、调度与 host capability，只为每个 App 增加相对隔离的 Store、线性内存和业务状态。

这项价值必须用真实 RSS、启动延迟、调用后稳定内存和 Resident Service 成本证明；“WASM 理论上更轻”不能替代测量。如果增量内存优势不显著，本方案最初的技术动机即不成立。

#### 价值三：把第三方黑盒进程变成可授权、可解释的能力模块

普通进程通常继承当前用户的大量系统权限，NextClaw 很难准确说明它会访问哪些域名、文件、Secret 和设备。Component imports 与 App grant 可以让平台在安装和执行时明确：

- 组件申请什么能力；
- 用户实际批准什么范围；
- 单次调用能使用多少 CPU、内存、并发和时间；
- 失败是权限拒绝、超时、trap、OOM 还是外部服务错误。

对于少量完全可信的官方代码，这项收益有限；对于第三方 Mini App 生态，它是安全运行本地扩展的关键基础。

#### 价值四：统一不同语言和实现方式的接入与生命周期

如果没有统一 Component 合同，每种语言和 App 都要重复处理启动、通信、schema、断线、取消、日志、更新和错误映射。WIT 与统一 Service executor 让 Rust、Go、Python、Native Process 或远程 provider 在产品层呈现一致 Service Action 与生命周期，减少每个 App 重复维护运行外壳。

### 2.3 二等价值与非核心理由

以下方向有潜力，但不是首版必须建设本方案的理由：

- Component 相互调用和复用 provider；
- Agent 自动发现和编排所有能力；
- Marketplace 中间件组合；
- 本地与云端之间迁移执行；
- durable worker、执行重放或新的脚本体系。

第一版即使完全不支持任意组件互调，只要证明“通用 artifact + 低增量内存 + capability 授权 + 统一 Service Action”成立，就已经形成完整价值闭环。反过来，不能因为远期组合设想丰富，就跳过对核心价值的验证。

### 2.4 不值得建设的条件

本方案不是必然正确。若真实场景主要满足以下条件，继续使用 Node 与少量原生进程更简单：

- 只有少数官方 Service，没有丰富第三方本地生态；
- 多 Service 内存成本可接受；
- 大多数 App 强依赖完整 Node/Python/POSIX/OS API；
- 没有精细权限和资源治理需求；
- 跨平台多 artifact 的发布成本可接受。

因此，只有技术 spike 至少证明以下判据，本方案才应进入正式实现：

1. 多个活跃 Component 的实际增量 RSS 显著低于对应 Node Service；
2. 一个主要 artifact 能覆盖目标桌面平台，且工具链和依赖兼容成本可接受；
3. 权限、Service Action、启停、错误、取消和更新接入比原生进程更统一，不能只是把复杂度转移到另一套 framework manifest；
4. 常见网络、存储、事件类 Service 可以依赖有限根能力完成，不要求 NextClaw 为每个 App 增加专用底层 API。

任一核心判据长期无法成立时，应缩小范围或停止建设，而不是用组件组合、Agent OS 或 Marketplace 的远期想象弥补当前价值不足。

## 三、仓库中已经存在的历史基础

这条路线不是从零开始，仓库在 2026 年 4 月已经设计并实现过独立 NApp WASM runtime：

- [NextClaw Wasm Apps 模型设计](../plans/2026-04-18-nextclaw-wasm-apps-model-design.md)
- [NextClaw Wasm Apps 方案冻结稿](../plans/2026-04-18-nextclaw-wasm-apps-freeze.md)
- [NApp WASI Component TS HTTP 方案](../plans/2026-04-23-napp-wasi-component-ts-http-plan.md)
- [`@nextclaw/app-runtime`](../../packages/nextclaw-app-runtime/README.md)

旧链路已经实际完成：

```text
NApp UI
  -> 同源 /api/*
  -> NApp Host
  -> wasmtime serve
  -> WASI HTTP Component
  -> guest /data
  -> host App data directory
```

当时已验证 Todo 示例能把数据写入 guest `/data/todos.json`，并映射到宿主指定的数据目录。包格式、安装目录、数据目录、权限词汇、registry 和 `.napp` 分发也都已形成实现。

但旧实现与当前 Mini App 主链存在三个关键断点：

1. 旧 `napp run` 只运行 schema v1 独立 App，并明确拒绝 schema v2 组合包；
2. 当前 schema v2 Service Component 只支持 `command/args` 启动宿主进程；
3. schema v2 虽然已经预留 `runtime.profile = wasi`，但在真实执行器落地前会主动拒绝该 profile。

相关现状可见：

- [`RunCommand` 对 schema v2 的拒绝](../../packages/nextclaw-app-runtime/src/controllers/run.controller.ts)
- [`AppManifestService` 对 `wasi` profile 的预留与拒绝](../../packages/nextclaw-app-runtime/src/services/app-manifest.service.ts)
- [App Platform 产品化设计中的目标态](./2026-08-14-app-platform-productization.design.md)

这说明当前缺失的不是一个新 App 平台，而是：

> 把既有 WASI 经验提升为 schema v2 Service Component 的正式执行合同，并接回现有 Service App 产品主链。

与此同时，第二轮 Review 发现：如果只把这项工作定义为“WASM Service executor”，会被最初的 JS 内存问题锚定得过窄。更完整的长期北极星应是：

> 建设 NextClaw/NCP 的 Portable Capability Runtime（可移植能力运行时）：应用以强类型、可组合、权限受控的能力组件运行；WASM Component 是主要承载格式，Service App 是产品形态，Spin、`wash-runtime` 与 Wasmtime 都只是可替换的执行实现。

## 四、核心设计判断

### 4.1 WASI 是 Service App executor，不是新 App 类型

目标模型：

```text
Mini App Package
├── Panel Component
└── Service Component
    ├── native-process executor
    └── wasi-component executor
```

Panel、Agent 和其它调用方继续只理解统一 Service Action：

- action id；
- input/output schema；
- discover 与 invoke；
- grant 与 revoke；
- running/failed/stopped 等状态；
- restart、更新和卸载。

调用方不应感知执行器是 Node、Rust 原生进程还是 WASI Component。

### 4.2 ServiceAppManager 继续作为产品语义 owner

推荐主链：

```text
Panel / Agent
  -> ServiceAppManager
  -> Service runtime executor
     -> native: 现有 MCP stdio runtime
     -> wasi: 共享 NextClaw WASM runner
        -> Spin execution context / Wasmtime
        -> WASI Component
```

Owner 边界：

| Owner | 负责 | 不负责 |
| --- | --- | --- |
| `AppPackageManager` | `.napp`、安装、版本、启用、数据实例与包生命周期 | 解释 WASM action |
| `ServiceAppManager` | action、授权、调用、产品状态和领域错误 | 直接管理 Wasmtime Store 内部状态 |
| Service runtime executor | 将统一 Service 调用映射到具体执行协议 | 决定 Marketplace、包版本和用户授权策略 |
| 共享 WASM runner | Component 装载、WIT linking、资源预算、实例启停 | 成为第二套 App registry 或产品控制面 |
| Spin/Wasmtime | WASI/Component Model 执行与标准 capability 实现 | 拥有 NextClaw App 身份、数据生命周期和 UI |

真实的多执行协议已经成立，因此在 Service runtime 边界形成一个最小 executor contract 是合理变化点；不得因此新增平行 `WasmAppManager`、`WasmMarketplace` 或第二套 App registry。

### 4.3 WASM 不应伪装成 MCP stdio 子进程

不推荐：

```text
WASM -> 模拟 stdin/stdout -> JSON-RPC -> MCP -> ServiceAppManager
```

这会重新引入进程/transport 成本，并丢失 Component Model 的直接、类型化调用优势。

推荐：

- Native Service 继续使用 MCP stdio；
- WASI Service 直接通过一个稳定 WIT world 暴露 Service Action；
- executor 在 WIT 与现有 Service Action contract 之间做唯一映射；
- 外部产品语义保持等价，内部 transport 不强行相同。

概念接口如下，字段和编码方式尚未冻结：

```wit
interface service {
  list-actions: func() -> result<list<action>, service-error>;
  invoke: func(
    action-id: string,
    input: list<u8>
  ) -> result<list<u8>, service-error>;
}
```

首版还需裁决 action schema 是否完全来自 `service-app.json`，或允许 runtime discovery 提供受约束补充；不能同时维护两份相互覆盖的事实源。

### 4.4 从“省内存执行器”升级为“可移植能力运行时”

最初问题可以类比为：每个 JavaScript Service 为了运行一件小应用，都自行携带一台 Node/V8“发电机”。共享 WASM Runtime 则像大楼统一供电：

| 概念 | 类比 | 真实职责 |
| --- | --- | --- |
| WASM Component | 电器 | 业务逻辑与可移植实现 |
| WIT | 插头规格 | 强类型 imports/exports 与版本合同 |
| WASI | 标准电网 | 文件、网络、时间、随机数、I/O 等通用能力 |
| NCP Technical WIT | 楼宇扩展插座 | KV、Secret、事件、调度、可观察性等稳定技术能力 |
| Capability Provider | 电源适配器 | 将抽象能力绑定到本地、远端或平台实现 |
| NextClaw | 配电与物业 owner | App 身份、授权、资源、生命周期与用户体验 |
| Spin / `wash-runtime` / Wasmtime | 发动机与配电设备 | Component 装载、执行、实例与 host linking |

Docker 更像给每个应用提供一整套房间和操作系统。本方案只提供经过授权的能力，不承诺完整 POSIX/Linux 用户空间，因此不是轻量 Docker，也不应朝完整容器兼容层演变。

### 4.5 应用开放性来自“任意逻辑 × 有限外部效果”

一个应用可以抽象为：

```text
应用 = 任意计算逻辑 + 与外部世界交互
```

任意计算逻辑包括数据转换、规则判断、文本处理、协议解析、状态机、工作流编排、AI 前后处理、搜索与领域业务，原则上没有产品数量上限。需要宿主提供的只是有限类别的外部效果：网络、文件、数据、Secret、时间、事件、设备与系统能力。

因此，“可实现几乎任意产品行为”和“原封不动运行任意既有软件”必须严格区分：

- 前者可以通过有限根能力和组件组合达到很高上限；
- 后者需要完整 POSIX、动态链接、子进程与平台 API，会逐渐逼近 WASIX/容器，不是本方案默认目标；
- 无法移植的旧软件和系统能力继续走 `native-process` 或 Native Provider。

### 4.6 WIT 是能力合同，不只是 RPC 编码

WIT world 同时描述组件向外提供什么，以及必须由宿主或其它组件满足什么。概念示例：

```wit
world mail-watcher {
  export actions;
  export event-handler;

  import outbound-http;
  import secrets;
  import key-value;
  import scheduler;
  import logging;
}
```

这份合同可被用于：

- 生成 Rust、Go、Python 等语言绑定；
- 安装前计算权限需求；
- 运行时只链接获准能力；
- 测试时注入固定时间、模拟网络和临时存储；
- 让一个组件的 export 满足另一个组件的 import；
- 对接口和依赖独立做语义版本管理。

参考：

- [Component Model Worlds](https://component-model.bytecodealliance.org/design/worlds.html)
- [WIT Reference](https://component-model.bytecodealliance.org/design/wit.html)
- [Composing Components](https://component-model.bytecodealliance.org/composing-and-distributing/composing.html)

如果 WASM 侧永远只暴露 `invoke(actionId, bytes/json)`，虽然仍可获得隔离和便携性，但会损失强类型组合、静态权限分析与跨语言 ABI 的主要价值。首版可以保留统一 Action envelope 以控制范围，但公共架构不得封死任意版本化 WIT exports；Service Action、Agent Tool、CLI、HTTP 和 UI 应被理解为 WIT 能力在不同产品入口上的投影。

### 4.7 组件角色与生命周期不应被单一“常驻 Service”限制

长期模型至少包含三种组件角色和一个兼容逃生口：

| 角色 | 生命周期 | 适用场景 |
| --- | --- | --- |
| Action Component | 调用时激活，可池化、缓存和回收 | 查询、转换、Agent Tool、一次事件处理 |
| Resident Service | 长期存在，显式管理状态、连接与并发 | WebSocket、目录监听、消息订阅、长期同步 |
| Component Provider | 被其它组件组合，不直接成为产品 App | 协议 adapter、解析器、中间件、通用能力实现 |
| Native Provider / Process | 平台相关生命周期 | 摄像头、GPU、系统自动化、原生依赖与旧框架 |

公共合同声明需要的语义，不把“每调用新实例”“全局常驻单例”或“一个 App 一个进程”写成产品合同。运行时可以根据工作负载、安全域和资源预算选择按需实例、实例复用、有限池或长期实例。

### 4.8 稳定合同应归 NCP，产品投影应归 NextClaw

按照“平台 SDK 化”的长期目标：

- 稳定的 Service、Runtime、Capability、Tool 与 Provider WIT 应优先沉淀为 NCP/kernel 公共合同；
- NextClaw 自身通过这些合同消费组件，不建立仅第三方使用的平行 SDK；
- `.napp`、安装、授权、Panel、Marketplace、状态和用户体验继续归 NextClaw；
- 框架私有 manifest、trigger 与部署模型不得成为对外事实源。

## 五、运行时进程与内存模型

### 5.1 旧实现只用于证明模型，不应原样恢复

当前 `WasmtimeWasiHttpComponentService` 会为单个 NApp 启动一个独立 `wasmtime serve` 子进程，同时 `napp` 自身仍是 Node Host。它证明了 WASI HTTP 与 `/data` 挂载可行，但没有关闭“多个 App 重复宿主固定成本”的问题。

### 5.2 推荐共享 runner

```text
NextClaw Host
  -> 一个 nextclaw-wasm-runner
     -> 一个共享 Engine
     -> App A Store / Component instance
     -> App B Store / Component instance
     -> App C Store / Component instance
```

约束：

- runner 是 NextClaw 产品级基础设施，每个平台只构建和分发一次；
- App 发布者只发布通用 WASM artifact；
- 每个 App/Service 使用独立 Store、内存上限、调用超时和 capability grant；
- 一个 App 崩溃、超时或耗尽预算不能破坏其它 App；
- `disconnect/restart` 卸载或重建目标 Component instance，不杀死共享 runner；
- runner 故障时，Kernel 必须把受影响 Service 状态统一转换为可恢复失败，并可重启 runner 后重建按需实例；
- 不允许通过“每 App 执行一次 `spin up`”形成新的重复进程模型。

### 5.3 语言选择与内存目标

旧 NApp 方案曾主推 TypeScript/JavaScript 编译进 WASM，以降低创作门槛。但如果本轮首要目标是降低 Service 运行内存，就不能默认认为“JS 编译成 WASM”等于消除了 JS runtime 成本。

当前推荐倾向：

- Panel：继续使用 HTML/CSS/JavaScript/TypeScript；
- 低内存 Service 主路径：Rust -> WASI Component；
- 其它语言只有在真实测量证明运行成本与工具链可接受时再列为官方推荐；
- JavaScript/TypeScript -> WASM 可以保留为开发体验选项，但不能未经测量宣称解决内存问题。

### 5.4 多语言支持必须区分“可移植”与“低内存”

建议建立经真实测量的语言支持分级，而不是笼统宣称“任何语言都一样”：

| 支持层级 | 候选语言/形态 | 产品承诺倾向 |
| --- | --- | --- |
| 低内存推荐层 | Rust，验证后的 Go 等 | 跨平台、低增量内存、正式 SDK |
| 可移植兼容层 | Python、JavaScript/TypeScript 等 | 合同与分发便携，但不承诺低内存 |
| 原生兼容层 | Node Service、FastAPI/Uvicorn、OS 程序 | 最大既有生态兼容，保留多平台 artifact/运行时成本 |

Python 的 `componentize-py` 可以把 Python 应用封装为 Component，但不是把 Python 变成类似 Rust 的轻量机器码；它会把 CPython 解释器、应用代码和依赖一起打包，因此解决的是可移植和统一能力合同，不天然解决内存。参考：[componentize-py 对打包模型的说明](https://github.com/bytecodealliance/componentize-py/issues/98)。

FastAPI 也不能通常意义上“原封不动编译成 WASM”：FastAPI 应用依赖 ASGI Server（例如 Uvicorn）监听和处理连接，而 Component Runtime 倾向由宿主直接调用 handler。迁移时可以复用纯业务函数、数据模型与兼容依赖，但 HTTP Server 外壳、原生扩展和部分事件循环假设需要适配。参考：[FastAPI ASGI 部署模型](https://fastapi.tiangolo.com/deployment/manually/)。

这不是缺陷，而是支持目标的分层：新 Service 生态优先获得可移植能力模型；未经修改的既有框架继续走原生兼容路径。

### 5.5 共享 runner 不等于所有 App 共享内存与故障域

推荐一个产品级 runner，是为了共享 Engine、编译缓存和宿主固定成本，不是让所有 App 处在同一个无隔离对象图中。每个实例仍应拥有独立 Store、线性内存、权限上下文、超时、资源限制与错误边界。

同时，不应把“永远只有一个 OS 进程”冻结为公共合同。首版可以使用单 runner；当真实证据显示单点崩溃影响过大时，可以按信任等级、权限等级或资源等级形成有限 runner pool。产品语义不感知该拓扑变化。

Wasmtime pooling allocator 可以提升实例化速度和密度，但会预留较大虚拟地址空间，也可能保留已使用 slot 的常驻内存；桌面端需要针对 RSS、虚拟内存、空闲回收和跨平台差异实测，不能直接照搬服务端默认值。参考：[Wasmtime PoolingAllocationConfig](https://docs.wasmtime.dev/api/wasmtime/struct.PoolingAllocationConfig.html)。

## 六、有限的基础 capability 集合

### 6.1 可以冻结有限版本，不能穷举未来所有需求

正确目标不是预知未来所有 App，而是冻结一个有限、版本化、可组合的 `nextclaw-service` world。有限原语可以组合出开放数量的上层应用，类似有限 CPU 指令和系统调用支持大量软件。

建议按能力族而不是业务 API 管理：

1. `io`：stream、buffer 与受控标准 I/O；
2. `filesystem`：App 私有目录和用户授权目录；
3. `network`：DNS、TCP/UDP、HTTP，WebSocket 通过可证明的标准能力承接；
4. `time-and-random`：时钟、计时、随机数；
5. `storage`：KV、Blob、SQLite 等通用持久化接口；
6. `config-and-secrets`：普通配置与按 capability id 获取的秘密；
7. `scheduling-and-events`：定时触发、事件订阅和取消；
8. `observability`：日志、指标与结构化错误；
9. `service-actions`：NextClaw action discover、invoke、stream 与 cancel。

这九项是候选能力族，不是已冻结函数清单。

### 6.2 新 capability 准入规则

只有同时满足以下条件，能力才可以进入宿主稳定合同：

- 不能由既有原语合理组合；
- 多种不同 App 都有重复需求；
- macOS、Windows、Linux 可以维持一致语义；
- 可以显式授权、限额、取消和审计；
- 属于技术原语，而不是某个业务应用能力；
- 宿主实现比每个 App 重复携带更能降低总体复杂度或风险。

应拒绝进入底层的例子：

- `todo.create`；
- `notes.search`；
- `notion.sync`；
- 针对某一个社区 App 的专用业务操作。

可以优先使用标准或候选标准接口的能力，不应由 NextClaw 重命名再造：

- WASI filesystem、sockets、HTTP、clocks、random；
- WASI/Component Model 生态中的 key-value、blobstore、logging 等 WIT；
- 已有框架提供且语义适合本地 App 的 SQLite、config 与 secrets 接口。

### 6.3 自由度边界

WASI 可以覆盖大量便携 Service，但不能在保持轻量、单 artifact 和强隔离的同时，无条件获得原生进程的全部系统自由：

- 任意 `fork/exec`；
- 任意动态链接库和原生 addon；
- OS 专属 API；
- GPU、USB、驱动和桌面自动化；
- 不可编译到 WASI 的既有语言依赖。

无法合理进入通用 capability 的需求继续使用 `native-process`。WASI 是默认便携运行层，不是唯一运行层，也不是 Docker 替代品。

### 6.4 能力供给采用四层模型，避免宿主无限膨胀

| 层次 | 谁提供 | 典型内容 | 是否进入 NextClaw 稳定底层 |
| --- | --- | --- | --- |
| 内置宿主 Factor | NCP/NextClaw Runtime | WASI、KV、SQLite、Secret、HTTP、日志、资源控制 | 是，但只收录高频、跨应用、可审计的有限集合 |
| 可安装 Capability Provider | NextClaw、第三方或用户自己的 AI | Redis、PostgreSQL、MQTT、企业系统、Agent/模型桥接 | 不进入默认 runner；通过稳定 Provider/Action 合同独立安装和版本化 |
| 可移植组件能力 | App 或第三方 WASM Component | Markdown/PDF 解析、OAuth、协议 adapter、中间件、数据转换 | 否，随组件依赖分发和组合 |
| 平台专属能力 | Native Provider | macOS Accessibility、Windows UI Automation、GPU、摄像头、硬件 | 否，只有最后一段按平台构建 |

这个结构改变了“底层不支持就必须等待 NextClaw 产品发版”的假设。纯逻辑和协议能力由组件生态自行补充；需要原生 SDK、重客户端或外部服务的能力，由用户或其 AI 通过公开 Provider/Action 合同构建、安装和管理；真正需要操作系统参与的能力使用 Native Provider。NextClaw 团队不再是每个新能力的交付瓶颈。

Spin Factor 是与 runner 一起编译的可信宿主代码，不是普通沙箱 App。Spin 4 的 Runtime Factors 是静态 Rust 类型，本身不提供稳定的任意动态插件 ABI；因此首版只允许随 NextClaw 签名 runtime 发布的内置 Factor，普通 `.napp` 不得静默携带或加载任意 Factor。生态自定义能力走已存在的通用 `component-call(providerId, action, json)` 桥：Provider 可以是可移植 Component，也可以是 `native-process` Service，从而无需修改 NextClaw 产品源码，同时避免把未经信任的原生库注入共享 runner。若未来开放真正的进程内第三方 Factor，必须先完成稳定 ABI、签名、崩溃隔离和跨平台兼容合同，不能把设计愿景冒充为当前能力。

### 6.4.1 App 分发与运行依赖必须解耦

`.napp` 继续是可复制、可上传、可安装的应用 artifact，但“可分发”不等于“离线自包含所有外部世界”。包只声明它需要什么，不携带用户的连接实例和秘密：

产品默认和推荐路径仍然是 **自包含、安装后可直接运行**。只有无法合理内嵌、真实依赖用户既有基础设施或需要专有系统连接时，才允许声明外部 Factor/资源；它是兼容与特殊需求逃生口，不是与自包含 App 平级的推荐形态。App 作者和生成 App 的 AI 必须先证明不能由包内 Component、内置 Factor 或宿主管理的本地资源关闭需求，才选择外部依赖。

```text
.napp
  -> 声明 capability id + API 版本范围
  -> 声明 external resource binding 的类型与用途
  -> 安装器解析本机 Factor 是否满足
  -> 缺 Factor：给出可安装来源或本地构建入口
  -> 缺配置：引导绑定 endpoint、账号和 Secret
  -> 满足后才允许 enable
```

依赖分为三类，不能混写：

1. **包内依赖**：Panel、WASM Component、纯资源和可移植组件依赖，随 `.napp` 分发；
2. **宿主能力依赖**：内置能力由 runtime Factor 提供；生态能力由 Capability Provider catalog 独立安装和版本化；
3. **外部资源依赖**：例如用户自己的 Redis、PostgreSQL 或企业 API，由安装实例绑定，endpoint 与凭据不进入公开包。

同一个 `.napp` 因而仍可跨平台分发。目标设备缺少 Factor 或资源配置时，应用可以完成安装，但状态必须明确停在 `needs-capability` 或 `needs-configuration`，不得伪装为已可运行，也不得在第一次调用时才暴露模糊错误。补齐后状态进入 `ready`，再由用户启用。

安装详情、Marketplace 卡片和确认页必须在安装前醒目标出“需要额外组件”或“需要外部服务”，说明是否收费、是否离开本机、需要哪些账号/授权，以及能否由 NextClaw 自动完成。默认排序、推荐和“一键安装”资格应优先给自包含 App；外部依赖 App 不能使用与开箱即用 App 相同的无差别展示。

### 6.4.2 外部依赖必须由 AI 操作

外部依赖不能把 README、命令、连接字符串和排障步骤交给用户。NextClaw/Agent 必须能通过同一个结构化控制面完成：

1. 检测本机缺少的 Factor、服务或配置；
2. 解释影响并请求最小必要授权；
3. 自动选择兼容 artifact、安装或连接资源；
4. 安全采集账号/Secret，不在聊天、日志和 artifact 中回显；
5. 运行连接、权限和代表性 Action 验证；
6. 失败时给出结构化原因并自动执行可恢复修复；
7. 卸载 App 时说明外部资源是否保留，并按用户选择清理绑定。

用户只承担不可代理的决定，例如确认安装可信宿主扩展、登录外部账号或批准付费；不要求非技术用户理解 Redis、端口、连接池或命令行。CLI、UI 与 Agent 复用同一个 dependency readiness/operation owner，不能分别复制安装语义。

### 6.4.3 自定义能力的分发合同

应用只依赖稳定 capability id 和 WIT/API 版本，不依赖某个 Factor 文件名或安装路径。Runtime catalog 负责把 capability 解析到兼容实现：

```text
capability request
  -> catalog resolution
  -> compatible built-in Factor or external Provider implementation
  -> platform artifact (macOS / Windows / Linux)
  -> user trust and grant
  -> resource binding
```

这使用户自己的 AI 可以在不修改 NextClaw 产品源码的情况下：生成 Component Provider 或 Native Provider 工程、实现既定 Action/WIT 合同、构建 artifact、运行兼容测试并发起本地安装。若要分发 Native Provider，仍需为目标平台产出 artifact，并通过签名或显式本地信任流程；跨平台成本只属于这个 Provider，不会扩散到所有依赖它的 `.napp`。真正的内置 Factor 仍随 runtime 发布，不伪装成动态生态插件。

默认 runner 不预装重型集成。Redis、PostgreSQL、MQTT 等默认由独立 Capability Provider 承载；只有高频、跨应用且包体和内存证据合理的能力才可能在未来进入官方内置 Factor。未安装的 Provider 不创建 client、连接池、timer 或常驻进程。

### 6.4.4 外部依赖产品功能地图

用户任务是：用户从 Marketplace 或本地 artifact 安装一个 App，在不学习底层技术的情况下提前知道额外要求，由 NextClaw AI 完成可代理步骤，并看到可验证的可用结果。

| 场景 | 用户看到什么 | 可执行动作 | 状态 owner | 失败或返回路径 | 验证证据 |
| --- | --- | --- | --- | --- | --- |
| 浏览 App | 默认 App 显示“开箱即用”；外部依赖 App 显示醒目标识、数据位置和可能费用 | 查看依赖说明或继续安装 | Marketplace/App metadata | 信息不可解析时禁止宣称一键可用 | 卡片与详情来自同一声明 |
| 开始安装 | AI 先检查 capability、资源和账号状态，列出能自动完成与必须用户确认的项目 | 授权 AI 配置、取消 | AppPackageManager + readiness owner | 取消后不安装宿主扩展、不留下半配置 Secret | 操作记录包含每一步结果 |
| 缺能力实现 | 显示 Provider 来源、签名、权限和平台兼容，不展示手工命令 | 批准安装或选择兼容实现 | Capability Provider catalog/operation owner | 无可信实现时保持 `needs-capability`，允许卸载 App | 安装后运行 Provider 自检 |
| 缺外部资源 | AI 引导登录或选择现有资源，不要求输入底层连接参数；高级用户可展开手动配置 | 登录、选择资源、批准费用 | Resource binding owner | 连接失败保持 `needs-configuration`，Secret 不回显 | 连接测试 + 代表性只读/写入 smoke |
| 已就绪 | 显示“可以启用”及实际绑定摘要 | 启用 App | App lifecycle owner | enable 失败返回结构化原因和 AI 修复动作 | 真实 enable + Action 成功 |
| 运行中失效 | 显示受影响能力、数据安全和 AI 正在执行的恢复 | 重试、换绑定、撤销授权 | readiness operation owner | 不静默 fallback，不无限重试 | PID/服务稳定、故障操作可追踪 |
| 卸载 | 明确 App 数据、Factor 与外部资源是否共享 | 保留或删除 App 数据；解绑外部资源 | App removal + binding owner | 不删除共享服务或其它 App 使用的 Factor | 引用计数、解绑与残留检查 |

默认界面不显示 Redis、端口、TLS、连接池等实现术语；这些只在高级详情和诊断中出现。AI、CLI 与 UI 必须消费同一 operation/status contract，保证 Agent 能完成的动作不是一套隐藏旁路。

### 6.5 邮件/GitHub 监控 Service 的端到端示例

```text
安装 .napp
  -> 读取 WIT imports
  -> 展示精确授权：目标域名、指定 Secret、私有 KV、定时频率、通知
  -> 用户批准
  -> Scheduler 触发 event-handler
  -> Component 调用 outbound-http（宿主校验域名授权）
  -> Component 读取 Secret 引用与上次同步游标
  -> 业务逻辑计算新增事件
  -> 导出结构化结果
  -> NextClaw 投影成通知、Service Action 或 Agent 事件
```

如果该任务从桌面迁到家庭服务器，Component、WIT 和产品身份可以保持不变，只需把 Secret、KV、HTTP 和通知重新绑定到目标宿主的 provider。这里实现的是“能力可移植”，不只是“二进制可运行”。

### 6.6 可自然生长的功能与产品场景

| 场景 | 组件形态 | 主要能力组合 | 价值 |
| --- | --- | --- | --- |
| 文本、数据与文件转换 | Action Component | 文件、Blob、日志 | 小工具无需常驻 JS runtime |
| GitHub、邮箱、RSS 监控 | Resident Service | HTTP、Secret、KV、调度 | 低成本长期自动化 |
| Agent 工具包 | Action Component | 强类型输入输出、网络、数据库 | 同一能力投影到 Tool/Action/CLI |
| 本地知识索引 | Resident Service | 文件事件、存储、模型 provider | 隐私数据留在本地 |
| API/协议适配器 | Component Provider | HTTP、配置、缓存 | 由生态扩展，不膨胀宿主 |
| 自动同步与备份 | Resident Service | 文件、网络、Secret、调度 | 跨设备统一逻辑 |
| 系统操作工具 | WASM 核心 + Native Provider | Accessibility、系统 API | 大部分逻辑跨平台，末端适配平台 |
| Marketplace 中间件 | Component Provider | 过滤、转换、脱敏、限流 | 形成可组合能力图 |
| 本地/云端迁移执行 | 同一 Component + 不同 Provider | 同一 WIT，不同后端绑定 | 根据隐私、在线状态与算力选择位置 |
| 持久个人 Agent | 未来 Durable Worker | 事件、状态、恢复、调度 | 长期自治与跨设备连续性 |

强类型 export 可以被 NextClaw 投影成 Agent Tool、Service Action、CLI 命令、HTTP endpoint 或 UI 操作。同一业务能力不应为每个入口复制实现。组件依赖和 WIT 包也已有基于包名、语义版本与 OCI registry 分发的标准化工具路径，可作为未来 Marketplace 的基础，而不是首版自行发明第二套 registry。参考：[Distributing Components and WIT](https://component-model.bytecodealliance.org/composing-and-distributing/distributing.html)。

### 6.7 可重复测试、权限解释与执行审计

因为时间、随机数、网络、存储和事件都通过 imports 进入组件，测试可以注入固定时间、模拟 HTTP、临时 KV、故障 provider、超时和限流；安装器也可以从 imports 和 manifest 生成可解释的权限摘要。

这一结构为以后回答以下问题提供基础：

- 组件为什么在某个时间被唤醒；
- 它当时拥有哪些权限；
- 调用了哪个 provider；
- 消耗了多少资源；
- 失败来自权限拒绝、超时、trap、OOM 还是外部服务；
- 同一输入在模拟外部世界下能否重复执行。

更远期的 durable worker、执行恢复和事件重放可以从这里生长，但会改变状态与恢复 owner，必须作为独立未来设计，不能隐式塞入首版 runtime。

### 6.8 必须长期管理的五组架构张力

| 张力 | 当前倾向 |
| --- | --- |
| 通用产品行为 vs 旧代码原样兼容 | 优先让新组件表达广泛行为；旧框架走 native，不追求完整 POSIX |
| 强隔离 vs 长期状态与性能 | 同时提供 Action 与显式 Resident 生命周期，状态不依赖偶然实例复用 |
| 有限宿主能力 vs 无限扩展 | 精选内置 Factor + Component Provider + Native Provider |
| 强类型 WIT vs 动态 Service Action | WIT 是底层合同；Action/MCP/Tool 是产品投影，首版允许受控动态 envelope |
| 复用生态 vs 框架锁定 | Spin-first，但 NCP 拥有 WIT、包和 adapter 合同；Spin 不成为产品事实源 |

## 七、数据库与持久化

### 7.1 两种可行路径

路径 A：App 自带可编译到 WASI 的 SQLite，在授权 `/data` 中维护数据库文件。

- 优点：宿主接口小，App 完全拥有 schema 和查询逻辑；
- 缺点：每个 App 重复携带数据库引擎，迁移、配额和备份约束分散。

路径 B：宿主管理 SQLite，WASM 通过稳定 WIT capability 使用独立数据库。

- 优点：数据库引擎共享，WASM 产物更轻，权限、配额、备份和数据生命周期可以统一；
- 缺点：SQLite WIT 会成为长期公共合同，需要认真冻结参数化查询、事务、错误和迁移边界。

### 7.2 当前推荐倾向

长期倾向路径 B：

```text
WASM Component
  -> storage.sqlite.open(namespace)
  -> execute/query/transaction
  -> Host 映射 appId + instanceId
  -> App 私有数据库
```

宿主不得向 WASM 暴露真实数据库路径；Service 的数据仍归现有 App instance/storage owner。外部 PostgreSQL、MySQL、Redis 等允许三种明确路径：轻量、可移植客户端可直接随 Component 分发；已有或用户安装的 Factor 可提供共享客户端、连接池和统一权限；无法进入 WASI 或需要完整既有框架的应用继续使用 `native-process`。选择哪条路径由应用需求决定，平台不得强迫所有数据库访问都经过 Factor。

首版是否直接提供 SQL，还是先提供更小的 KV/Blob，并让 App 自带 SQLite，仍需通过真实 Personal Organizer 等案例验证后冻结。

## 八、框架复用判断

### 8.1 不重新实现 WASI

WASI 本身就是跨平台基础系统接口标准，已经覆盖或推进 filesystem、sockets、HTTP、clocks、random、CLI/I/O 和 key-value 等能力。NextClaw 应跟随标准接口与版本，而不是创建同义私有 API。

参考：

- [WASI 官方介绍](https://wasi.dev/)
- [WASI Releases 与接口状态](https://wasi.dev/releases)
- [WASI 0.3](https://wasi.dev/releases/wasi-p3)

### 8.2 Spin：生产执行底座的首选

Spin 更接近 NextClaw 当前的单机、本地 WASM Service Runtime 需求：

- 基于 Wasmtime 与 Component Model；
- 已提供 HTTP、KV、SQLite、PostgreSQL、MySQL、Redis、配置变量、MQTT、Cron 等 runtime 能力；
- 支持自定义 trigger；
- 支持嵌入式执行，并可不使用公开 `spin.toml` 构造运行上下文。
- Spin 4 基于 WASI 0.3 支持 async export、stream/future、单实例多并发调用与实例复用。

参考：

- [Spin API Support Overview](https://spinframework.dev/v4/api-guides-overview)
- [Extending and Embedding Spin](https://spinframework.dev/v4/extending-and-embedding)
- [Spin 4.0 与 WASI 0.3 instance reuse](https://spinframework.dev/blog/announcing-spin-4-0)

2026-08-30 Review 后，架构推荐从“直接 Wasmtime MVP 继续扩张”调整为 **Spin-first**。Spin 底层仍是 Wasmtime；变化的是不再自行维护完整的 component host 框架，而复用 Spin 的 Trigger、Factor、装载、链接、资源上下文与 SDK 生态。

推荐复用：

- Component 装载和 Wasmtime linking；
- 标准/通用 runtime factors；
- capability 注入；
- 资源预算与执行上下文基础；
- Rust/Go 等语言 SDK 生态。

NextClaw 增加一个自己的 Service Action Trigger，并只组装当前产品需要的 Factors。首批目标是 WASI、variables/secrets、KV、SQLite、outbound HTTP、observability，以及 NextClaw Service/Agent 自定义 Factor；Redis、PostgreSQL、MQTT、MySQL 和 LLM 等不得因为 Spin 已提供就默认进入 runner。

禁止让 Spin 成为第二产品 owner：

- 不以 `spin.toml` 替代 `.napp`/component manifest；
- 不把 Spin CLI 暴露为普通用户主入口；
- 不使用 Spin 自己的 App 安装、发布或部署模型管理 NextClaw App；
- 不让 Spin 决定 NextClaw App 身份、grant、数据生命周期或 Marketplace 策略。

正确定位是：

> Spin 可以是内部执行发动机，NextClaw 仍是产品和 runtime lifecycle owner。

判别性 Spike 已于 2026-08-30 关闭本机四项核心风险，并迁入正式 runner：

- 原有五个 Guest、WIT 与 NDJSON `0.1.0` 合同不变；Action、KV、权限拒绝、Resident、Provider、Composition、停止与同进程统计通过自动 smoke；
- Kernel 原有共享 runner、超时重建、持久角色恢复和权限隔离测试复用通过；迁移时发现并修复了 Factor 配置缓存未纳入授权/数据边界的问题；
- macOS arm64 release 二进制约 31 MiB，直接 Wasmtime 基线约 25 MiB；Spin 空载/1/5/10 Component RSS 为 9.89/40.28/48.92/56.36 MiB，直接 Wasmtime 为 7.70/34.84/42.94/49.16 MiB；额外固定成本约 6–7 MiB，但 5 个 Component 仍显著低于 5 个独立 Node Service 的约 203 MiB；
- Spin 首个 `list-actions` 70.09 ms、热 `counter_read` 中位数 0.11 ms，未见相对直接 Wasmtime 的有意义延迟退化。

因此正式 artifact 继续沿用 `nextclaw-wasmtime-runner` 文件名以保持分发合同兼容，但内部实现已是嵌入式 Spin Runtime Factors，不长期保留第二 executor。Linux musl、Windows 和双架构 macOS 仍必须通过现有发布矩阵，不能用本机证据替代。

### 8.3 `wash-runtime`：从“借鉴对象”升级为必须对比的嵌入式候选

wasmCloud 的 WIT capability/provider 模型与本设计高度接近，支持可替换 KV、Blob、Messaging、Secrets、HTTP 与数据库 provider。新的 `wash-runtime` 是可嵌入 Rust crate，内含 Wasmtime、WASI 0.2/0.3、host plugin 和 host component plugin；wasmCloud 也已经明确区分 invocation-based Component 与长期、带状态的 Service。

但完整平台长期服务于分布式 host、Kubernetes/edge、NATS/wRPC、provider 独立伸缩和多主机控制面。这些目前会扩大 NextClaw 本地 Mini App 的依赖和生命周期边界。

参考：

- [wasmCloud Capabilities](https://wasmcloud.com/docs/v1/concepts/capabilities/)
- [wasmCloud Providers](https://wasmcloud.com/docs/v1/concepts/providers/)
- [wasmCloud Runtime](https://wasmcloud.com/docs/runtime/)
- [wasmCloud Services](https://wasmcloud.com/docs/wash/developer-guide/create-services/)

当前倾向：

- 复用标准 WIT 与 capability/provider 设计经验；
- 不引入 lattice、NATS、operator、wadm 或完整部署模型；
- 真实验证 `wash-runtime` 能否在不要求 NATS/控制面的前提下嵌入 NextClaw；
- 因其 host plugin 与长期 Service 模型更贴近完整 Portable Capability Runtime，必须与 Spin 和直接 Wasmtime 进行同题基准比较，不能再只把它列作 Spin 失败后的被动备选。

### 8.4 Extism：低层插件参考，不作为完整 App runtime

Extism 提供跨语言 WASM 插件和 Host Functions，适合参考宿主函数设计，但不会直接替 NextClaw 提供完整 storage、scheduling、App lifecycle 和 Service Action 产品合同。

参考：[Extism Host Functions](https://extism.org/docs/concepts/host-functions/)

### 8.5 WASIX、WasmEdge 与 durable runtime：扩大上限但不污染核心 profile

WASIX 与 WasmEdge extensions 可以通过额外 syscall、host function 和 plugin 提高旧程序、POSIX、AI、媒体及硬件兼容性，但这些扩展通常不是统一 WASI/Component Model 公共标准，且平台覆盖不完全。它们可以未来作为显式兼容 profile 或 Native Provider 参考，不应混入核心 `wasi-component` 合同。参考：[WASIX](https://docs.wasmer.io/runtime/wasix/) 与 [WasmEdge Extensions](https://wasmedge.org/docs/category/wasmedge-extensions/)。

Golem 等 durable runtime 展示了带身份、持久状态、日志重放和故障恢复的长期 Worker/Agent 方向。这对 NextClaw 的自治和连续性有启发，但它会把状态、恢复和调度 owner 上移到 runtime，远超本次低内存 Service 执行层；保留为未来独立探索，不作为首版依赖。

## 九、推荐主链与备选

### 方案 A：NextClaw 自行直接嵌入 Wasmtime

优点：控制力最高，依赖最小化可控。

问题：需要自行实现 Component 装载、WASI linking、数据库、配置、资源预算、trigger 和大量已有基础设施。

结论：既是最小依赖退路，也是判断 Spin/`wash-runtime` 额外价值与成本的必要基线。

### 方案 B：嵌入 Spin 执行层，增加 NextClaw Service Action trigger

优点：最贴近单机 Service 场景，复用能力充分，同时可让 NextClaw 保持产品 owner。

问题：Spin 嵌入 API、实际内存、长期 Component instance、资源隔离和 Desktop 多平台 runner 分发仍需真实验证。

结论：**正式首选**。以嵌入式 Spin + NextClaw Trigger/Factor 进入判别性 Spike；不运行每 App 一个 `spin up`，不暴露 `spin.toml`。

### 方案 C：嵌入 `wash-runtime`，不采用完整 wasmCloud 平台

优点：capability/provider、host plugin、WASI 0.2/0.3 与长期 Service 模型更贴近完整 Portable Capability Runtime。

问题：需要证明嵌入式路径可以不引入 NATS、分布式控制面、transport 和额外产品生命周期复杂度，并测量其本地 Desktop 固定成本。

结论：把 `wash-runtime` 与 Spin、直接 Wasmtime 同题比较；明确排除完整 wasmCloud 平台与控制面。

### 方案 D：继续只支持 JS 与多平台原生进程

优点：现有链路成熟，无新 runtime。

问题：无法同时关闭 JS 固定内存与每 App 多平台构建的矛盾。

结论：继续作为兼容与逃生路径存在，但不足以解决本次问题。

## 十、Manifest 与包模型方向

运行协议字段保持现有方向；能力与资源依赖新增独立概念层，具体 JSON 字段在实现前由 schema 设计冻结：

```json
{
  "id": "nextclaw-personal-organizer-data",
  "executor": {
    "kind": "wasi-component",
    "entry": "service.wasm"
  },
  "actions": [
    {
      "id": "todo-list",
      "inputSchema": {},
      "outputSchema": {}
    }
  ],
  "requires": {
    "capabilities": ["key-value@1", "redis@1"],
    "resources": [{ "binding": "cache", "type": "redis", "required": true }]
  }
}
```

上述名称只表达设计语义，不是已经发布的 schema。关键不变量是：capability 表示宿主接口，resource 表示该 App instance 需要绑定的外部实例；Secret 只保存为本机绑定，绝不写回 `.napp`。

约束倾向：

- 一个 Service Component 首版只能选择一个 executor；
- 同一 action 不配置 WASI/native 双 fallback；
- package 可以组合 Panel + WASI Service；
- 一个包若未来包含不同安全等级 Service，安装展示与审核按最高权限等级收敛；
- WASM artifact 属于 `universal` 分发；
- Spin manifest 不进入公开包合同；
- `.napp` 不内嵌任意原生 Factor，Factor 通过独立 catalog 和信任流程解析；
- 缺 Factor 或配置时允许安装完成但禁止 enable，并返回稳定 readiness 状态与修复动作；
- 顶层 package runtime/security 只表达或派生包级摘要，实际 entry 与 action 属于 Service Component 事实源，避免重复定义。

## 十一、生命周期与失败边界

### 普通路径

```text
安装 App
  -> 读取 component 与 capability 声明
  -> 用户授权
  -> 首次 discover/invoke
  -> 确保共享 runner 可用
  -> 为目标 Service 创建 Store/instance
  -> 注入该 App 的 capability grant
  -> 调用 WIT export
  -> 返回统一 Service Action result
```

### Restart

- 释放目标 Component instance/Store；
- 不杀死共享 runner；
- 下一次调用按当前 active package version 和 grant 重新实例化。

### App 更新

- 候选 artifact 校验与数据迁移仍归 AppPackageManager；
- 停止旧版本目标 instance；
- 在候选上下文 probe；
- 健康后原子切换；
- 失败恢复旧版本与旧数据 checkpoint，不保留两个活跃 runtime owner。

### Runner 故障

- 所有受影响 Service 进入结构化可恢复失败；
- runner owner 统一重启，不由每个 App 各自启动并竞争；
- 后续调用按需重建目标 instances；
- 不把 runner 崩溃转换为空 actions 或静默 fallback 到 native executor。

### 资源违约

- 内存、执行时间、输出大小、并发和 capability 使用必须有限额；
- 超时、取消、trap、OOM 和 capability denied 映射为稳定 Service App 错误；
- 失败不得修改 package active version，也不得删除 App data。

## 十二、抽象审计

### 保留

- 现有 `.napp`、schema v2 Package/Component、AppPackageManager、ServiceAppManager 和 Service Action 产品合同；
- `native-process` 作为 OS/原生依赖逃生路径；
- 旧 NApp WASI 代码与文档作为证据和可复用材料。

### 新增但必须付租金

- 一个共享 WASM runner：隔离真实 Rust/Wasmtime 执行边界并消除每 App 重复宿主进程；
- 一个 WASI Service executor：隔离真实 WIT 与 MCP stdio 多实现；
- 一个 NextClaw Service Action WIT world/trigger：让现有产品合同进入 Component Model；
- capability grant 映射：把现有 App 授权转换为 runner 可执行权限。

### 删除或迁移

- 若正式主链落地，旧 schema v1 `napp run` 的独立产品地位应进入迁移评估，不继续发展为第二套主运行时；
- 不保留每 App `wasmtime serve` 作为正式正常路径；
- 不新增 `WasmAppManager`、第二 Marketplace、第二 registry 或第二数据目录；
- 不让 Spin/wasmCloud manifest 成为新的公开事实源。

### 延后

- 任意未签名 Factor 的静默加载与公共市场；首期先完成官方 Factor 和显式本地信任安装；
- 分布式 runner、NATS/wRPC、远程调度与自动伸缩；
- 任意 shell、进程和 OS API 的 WASI 暴露；
- JavaScript/TypeScript WASM 的官方低内存承诺；
- 多 executor fallback 与自动降级；
- 完整 Docker/POSIX 兼容层。

## 十三、进入冻结设计前必须验证的证据

不得只凭框架文档宣布选型完成。最小技术验证应使用同一组 Personal Organizer Service actions，对比当前 Node Service 与候选共享 WASM runner：

1. 一个 runner 同时承载多个长期 Component instance；
2. 自定义 Service Action trigger 完成 discover、invoke、结构化错误和 cancel；
3. App 私有 SQLite/数据目录、HTTP 和 Secrets 能由现有 NextClaw 上下文注入；
4. runner 不要求公开 `spin.toml`，执行配置可由 `.napp`/Service manifest 派生；
5. macOS、Windows、Linux runner 构建与 Desktop/runtime bundle 分发可闭合；
6. 测量而不是推测：
   - runner 基线 RSS；
   - 每新增一个空闲 Component 的增量 RSS；
   - 调用后稳定 RSS；
   - 首次启动与热调用延迟；
   - 多 App 并发行为；
7. 单 App trap、超时、OOM 和 capability denied 不影响其它 App；
8. runner 崩溃后 Kernel 能恢复并按需重建实例；
9. 使用同一测试比较 Spin 与直接 Wasmtime 基线；`wash-runtime` 不再阻塞本轮选择，只有 Spin 无法满足硬门时才重新进入候选；
10. 验证 WASI 0.2 既有工具链兼容与 WASI 0.3 async/stream/instance reuse 主路径如何共存。

Spin 同时通过功能、内存、包体和三平台门后替换直接 Wasmtime 主链；任一硬门失败则保留直接 Wasmtime 并记录证据。公共 `.napp`、Service Action、capability id 与 WIT 合同不依赖 Spin 私有产品模型。

## 十四、待用户 Review 的关键问题

1. 是否确认把 WASI 定义为 Service App 的一等 executor，而不是新的 App 类型？
2. 是否确认 `native-process` 长期保留为少数逃生路径？
3. 首版是否以 Rust -> WASI Component 作为低内存官方主路径？
4. 数据库首版采用宿主 SQLite capability，还是 App 自带 SQLite + `/data`？
5. actions 的 schema 唯一事实源放在 `service-app.json`，还是允许 runtime discovery 拥有部分动态事实？
6. 是否接受一个 NextClaw 共享 runner，而不是每个 App 一个 Spin/Wasmtime 进程？
7. Spin 正式 runner 是否在不暴露 `spin.toml` 的前提下持续满足 Action、Resident、Provider、Capability Provider 与 Desktop 内存合同？
8. 旧 schema v1 NApp 在新主链成立后的迁移、兼容和删除边界是什么？

## 十五、当前推荐摘要

当前冻结的推荐是：

> 将 WASI/Component Model 接入现有 schema v2 Service App，并以嵌入式 Spin 作为生产执行底座；由产品级共享 runner 或有限 runner pool 承载 Action Component、Resident Service 与 Component Provider。NextClaw 继续拥有包、授权、数据、依赖就绪状态和产品生命周期，NCP/kernel 拥有稳定 WIT/capability 公共合同。默认 runner 只内置精选 Factors，Redis 等重能力由独立 Component/Native Provider 承载；用户或其 AI 可以通过稳定 Provider/Action 合同扩展，而不必把任意原生插件注入共享 runner。无法合理跨平台抽象或需要完整既有框架的能力继续走 Native Provider 或 `native-process`。

本文已经完成本轮用户 Review。Spin 判别性 Spike、本机密度对照和正式 runner 迁移已完成；生产交付仍以三平台构建、真实 HTTP enable、开发者闭环和发布产物验证为门，不以本机偏好代替跨平台证据。
