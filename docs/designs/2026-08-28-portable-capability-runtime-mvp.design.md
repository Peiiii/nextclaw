# Portable Capability Runtime 愿景与 MVP 设计

## 文档状态与边界

- 日期：2026-08-28
- 状态：探索草案，待用户 Review，尚未冻结
- 角色：定义 Portable Capability Runtime 的产品愿景、首个产品切片、技术 Spike、验收标准与停止条件
- 架构 owner：[WASI Service App 运行时与现有 Mini App 体系融合设计探索](./2026-08-28-wasi-service-app-runtime.design.md)
- 全景认知材料：[NextClaw 可移植能力运行时全景说明与场景设想](../thoughts/2026-08-28-portable-capability-runtime-panorama.thought.md)
- 验证套件设计：[Portable Capability Runtime 全能力验证套件设计](./2026-08-28-portable-runtime-verification-suite.design.md)，负责机制、常见应用场景、Demo 拆分和证据标准
- 本文不是实施计划；在技术 Spike 和设计冻结前不得据此直接展开完整实现
- 本文不包含尚未收敛的 Agent OS、Node REPL 编排或新 DSL 讨论

> 2026-08-28 用户体验 Review 修正：首个实验室只构成 Action Runtime 技术垂直切片，不能凭现有按钮和方向性基准认定 MVP 已充分验证。Agent 调用、真实结构化数据、Resident、Provider、事件/调度、常见应用场景和产品内证据必须按验证套件补齐后重新过 Gate。

## 一、愿景

### 1.1 一句话愿景

> 让开发者只写一次 Service 逻辑，就能以低增量内存、安全授权、统一生命周期的方式运行在 NextClaw 支持的平台，并自然成为 Panel、Agent 和其它产品入口可以调用的 Service 能力。

可以压缩为：

> **Write once, run locally everywhere, grant only what it needs, pay only for the logic.**

中文含义：写一次，本地跨平台运行；只授予所需能力，只承担业务逻辑成本。

### 1.2 愿景不是什么

- 不追求把所有现有软件编译成 WASM；
- 不追求让所有 Python、JavaScript 代码自动变成低内存机器码；
- 不把 NextClaw 变成 Docker、Linux 或完整 POSIX 宿主；
- 不创建与现有 Mini App 平行的新 App 产品；
- 不以组件互调、Agent OS 或 Marketplace 远期潜力代替当前核心价值验证；
- 不移除 `native-process` 兼容和平台能力逃生口。

## 二、愿景希望分别改变什么

### 2.1 用户视角

用户安装一个普通 Service App 时，目标体验是：

- 不需要额外安装 Node、Python 或其它语言运行环境；
- 不需要理解 macOS、Windows、Linux artifact 差异；
- 多个小 Service 同时启用时，不为每个 App 重复承担完整 V8/Node 固定成本；
- 安装前可以看到它申请的网络、文件、Secret、数据和后台运行权限；
- 单个 App 的 trap、超时、OOM 或越权不会破坏其它 App；
- Panel 与 Agent 调用它时，不需要知道底层使用什么语言或框架；
- 安装、启用、更新、重启、撤权和卸载仍使用统一 NextClaw 产品体验。

WASM、Spin、`wash-runtime` 与 Wasmtime 都不应成为普通用户必须理解的概念。

### 2.2 App 开发者视角

开发者应该主要关注：

```text
我提供哪些 Service Actions？
我需要哪些 Capabilities？
```

而不是重复解决：

```text
怎样启动和管理后台进程？
怎样实现 MCP stdio、重连和取消？
怎样在多个平台分别构建和发布？
怎样维护日志、权限和错误外壳？
```

目标开发体验包括：

- 使用官方 SDK 与模板实现固定 Service WIT world；
- 主要构建一个通用 artifact；
- 通过标准接口使用 HTTP、KV、Secret 和日志；
- 在本地运行和测试；
- 打包进现有 `.napp`；
- 让 Panel、Agent 和未来合适入口复用同一 Service Action；
- 不自行拥有进程、重启、授权和数据生命周期。

### 2.3 NextClaw 平台视角

NextClaw 需要获得：

- 一个统一 Service 执行合同；
- 一个产品级共享 Runtime，而不是每 App 一个 Spin/Wasmtime 进程；
- 可理解、可执行、可审计的 capability 权限边界；
- 统一的启动、停止、取消、错误、更新与资源治理；
- 安全承载第三方本地代码的基础，而不是把当前用户全部权限交给黑盒进程；
- 与现有 `.napp`、AppPackageManager、ServiceAppManager 和 Service Action 主链融合；
- 可替换的内部执行实现，不让公共合同绑定 Spin、wasmCloud 或 Wasmtime。

## 三、长期目标形态

```text
Mini App
├── Panel Component
└── Service Component
    ├── portable-component
    │   ├── Action Component
    │   └── Resident Service
    │
    └── native-process
        └── OS / 旧框架 / 原生依赖兼容路径
```

长期倾向：

- 普通网络、数据和自动化 Service 优先使用 Portable Component；
- 强依赖完整 Node/Python、原生扩展、系统 API、GPU 或复杂动态库的 App 使用 `native-process` 或平台 Provider；
- 两类 Service 在产品层都表现为现有 Service App；
- Panel、Agent 和调用方不感知 executor；
- WASM 是普通便携 Service 的推荐路径，但不是唯一路径。

## 四、技术 Spike 与产品 MVP 必须分开

技术 Spike 只回答“是否值得做、哪个底座合适”，不是用户可用 MVP。产品 MVP 必须证明一个完整、真实的安装到使用闭环，不能把能运行 hello world 称为 MVP。

```text
阶段 0：同题技术 Spike
  -> 证明或否定核心价值
  -> 选择内部执行底座与约束

阶段 1：开发者预览版产品 MVP
  -> 闭合真实 .napp、授权、Action、数据和跨平台链路
```

## 五、阶段 0：同题技术 Spike

### 5.1 候选

使用同一份测试 Component 同时比较：

- Spin；
- `wash-runtime`；
- 直接嵌入 Wasmtime。

不先冻结唯一候选，也不以一个候选失败为启动另一个候选的前提。

### 5.2 测试 Component 必须覆盖

- 接收结构化输入；
- 返回结构化输出；
- 发起一次受控 HTTP 请求；
- 读写 App 私有 KV；
- 读取一个 Secret 引用；
- 输出结构化日志；
- 被取消；
- 主动触发超时、trap 与权限拒绝；
- 多个 Component 同时装载和调用。

同时实现一份行为等价的 Node Service，作为真实对照，而不是只测空 runtime。

### 5.3 必须测量的证据

- runner 基线 RSS；
- 每增加一个空闲 Component 的增量 RSS；
- 1、5、10 个 Service 的总 RSS；
- 首次调用与热调用延迟；
- 调用结束后的稳定 RSS；
- unload 后的内存回收；
- 多 App 并发行为；
- 单 Component trap、超时、OOM 与 denied 是否影响其它 Component；
- runner 崩溃后的产品错误与恢复；
- macOS、Windows、Linux 的构建、bundle 与运行情况；
- 框架是否要求公开私有 manifest、独立 daemon 或分布式控制面。

### 5.4 Spike 输出

Spike 只需要形成：

```text
是否值得继续建设
+
内部执行底座选择
+
首版必须接受的限制
+
产品 MVP 的可量化门槛
```

不是代码量最多、功能列表最长或生态想象最丰富的候选胜出，而是以最低产品耦合满足 NextClaw 合同的候选胜出。

## 六、产品 MVP 的唯一参考故事

> 一个开发者使用 Rust 编写一个带 HTTP、Secret 和持久数据的 Service Component，主要构建一次，在 NextClaw 支持的平台安装；用户完成授权后，Panel 和 Agent 都可以通过现有 Service Action 调用它；运行期间没有该 App 专属的 Node/V8 进程。

### 6.1 Reference App：GitHub Issue Watcher

建议用一个足够真实但不复杂的 Reference App 闭合产品链路。

提供三个 Actions：

```text
list-repositories
list-important-issues
refresh
```

申请四类 capabilities：

```text
outbound-http: api.github.com
secret: github-token
private-kv
logging
```

运行行为：

1. 使用 GitHub Token 请求 API；
2. 把上次同步游标保存在 App 私有 KV；
3. 返回结构化 Issue 列表；
4. Panel 展示结果；
5. Agent 通过现有 Service Action 调用 `list-important-issues`；
6. 用户撤销 HTTP 或 Secret 权限后，调用得到稳定、明确的权限错误；
7. 更新、restart 与卸载沿现有 App 生命周期执行。

选择这个案例的原因：

- 不是只能证明计算的 hello world；
- 覆盖真实网络、Secret、持久化和日志；
- 覆盖结构化 Action、Panel 与 Agent；
- 不要求首版同时解决 Resident Service、WebSocket 和长期连接。

## 七、MVP 的最小产品主链

```text
开发者
  -> 使用 Rust SDK 实现固定 Service WIT world
  -> 构建 service.wasm
  -> 放入 schema v2 .napp

用户
  -> 安装 .napp
  -> 查看 HTTP / Secret / KV 权限
  -> 批准并启用

NextClaw
  -> AppPackageManager 管理包和数据
  -> ServiceAppManager 拥有 Actions 与产品状态
  -> WASI executor 调用共享 runner
  -> runner 为 App 创建隔离 Store/instance
  -> 注入当前 App grant
  -> 调用 Component export
  -> 返回统一 Service Action result

Panel / Agent
  -> 继续调用现有 Service Action
  -> 不感知 WASM、Spin、wash-runtime 或 Wasmtime
```

## 八、MVP 必须包含的范围

### 8.1 产品合同

- schema v2 Service Component 支持 `runtime.profile = wasi` 或最终冻结的同等字段；
- 沿用现有 `.napp` 安装、启用、更新、restart 与卸载主链；
- Panel 与 Agent 继续使用统一 Service Action；
- `native-process` 行为保持不变；
- framework 私有 manifest 不进入公开包合同；
- 不新增平行 Wasm App 产品、Marketplace、registry 或数据目录。

### 8.2 Runtime

- 一个产品级共享 runner；
- 每 App 独立 Store/instance 与授权上下文；
- HTTP host allowlist；
- App 私有 KV；
- Secret 引用；
- 结构化日志；
- 超时与 cancel；
- 内存、并发和输出上限；
- trap、denied、OOM 与 timeout 的稳定错误映射；
- restart 只重建目标 App，不重启全部 Component；
- runner 故障形成明确失败，并可恢复后按需重建实例。

### 8.3 开发体验

- 一个正式推荐的 Rust SDK；
- 一个官方模板；
- 一个本地运行/测试入口；
- 一个构建和打包入口；
- GitHub Issue Watcher Reference App；
- 最小 WIT、manifest、capability 与调试文档。

`nextclaw` CLI 是一等产品入口，因此实现阶段必须评估并尽可能提供概念上等价的：

```text
nextclaw app dev
nextclaw app build
nextclaw app test
nextclaw app package
```

当前只冻结“必须有 CLI 开发闭环”，不冻结具体命令名；命令树和现有 owner 需要在实施调查后确定。

### 8.4 平台覆盖

产品 MVP 目标平台为：

- macOS；
- Windows；
- Linux。

可以先在单个平台完成开发闭环，但只有目标平台的 runner bundle、安装和 Reference App 行为验证完成后，才能宣称跨平台 MVP 完成。

## 九、MVP 明确不做

- 任意 Component 相互调用；
- Component Provider Marketplace；
- Agent OS 编排、新 DSL 或 Workflow Runtime；
- Python/JavaScript WASM 的正式支持承诺；
- 完整 POSIX、WASIX、shell 或子进程；
- GPU、摄像头、桌面自动化和其它平台专属 Provider；
- 分布式 runner、NATS、远程调度和自动伸缩；
- 本地与云端迁移执行；
- durable worker、checkpoint 与执行重放；
- 动态任意 WIT exports；
- WASM/native 双 executor 自动 fallback；
- 面向完整第三方 Marketplace 的长期兼容承诺；
- Resident Service、WebSocket、消息订阅和长期连接。

## 十、首版不做 Resident Service 的理由

第一版通过：

```text
NextClaw Scheduler
  -> 定时调用 refresh Action
```

可以覆盖大量同步、监控和刷新场景，同时避免立即解决：

- Component 内长期事件循环；
- WebSocket 生命周期；
- 实例长期共享状态；
- 并发请求与 backpressure；
- 断线重连和后台保活；
- 更新时迁移活跃连接。

Action Component MVP 已足以验证通用 artifact、低增量内存、capability 授权和统一 Service Action 四项核心价值。Resident Service 只有在真实用例证明 Scheduler + Action 不足后，才进入下一阶段设计。

## 十一、MVP 验收标准

### 11.1 用户价值

- 用户可以安装、启用和调用一个 WASI Service App；
- 权限需求清晰可见；
- Panel 与 Agent 能调用同一 Actions；
- 撤销权限后行为稳定且可解释；
- 更新、restart 和卸载不会错误破坏 App 数据；
- 用户无需理解底层执行框架。

### 11.2 开发者价值

- 开发者主要构建一个 Component artifact；
- 不实现 MCP stdio 和后台进程外壳；
- 通过 Rust SDK 使用 HTTP、KV、Secret 和日志；
- 同一个 `.napp` 在目标平台运行；
- 本地开发、测试和打包路径清晰、可重复。

### 11.3 技术价值

- 多 Component 的实际增量 RSS 显著低于等价 Node Service，具体门槛由阶段 0 基线冻结；
- 不为每个 App 启动独立 Node、Spin 或 Wasmtime 进程；
- 单 App trap、超时、OOM 和 denied 不影响其它 App；
- runner 故障能转换为明确产品失败并恢复；
- macOS、Windows、Linux 的 bundle 与 Reference App 验证闭合；
- framework 私有 manifest 和控制面没有进入 `.napp` 公共合同。

### 11.4 架构价值

- `ServiceAppManager` 继续作为 Service Action 和产品状态 owner；
- `AppPackageManager` 继续作为包、版本和数据生命周期 owner；
- 没有平行 Wasm App 产品与第二套事实源；
- Native 与 WASI Service 在调用方看来语义一致；
- 公共合同不绑定具体 runtime framework；
- 常见网络、存储和 Action 场景不需要为单个 App 增加专用宿主业务 API。

## 十二、停止与缩小条件

若 Spike 或 MVP 发现以下任一核心问题长期无法解决，应缩小范围或停止建设：

- Component 增量 RSS 相对 Node Service 没有明显优势；
- Rust/WASI 工具链无法提供稳定、可理解的开发体验；
- 三个平台的真实兼容和分发成本接近每 App 原生多 artifact；
- HTTP、KV、Secret 等基础能力需要大量 NextClaw 私有补丁才能使用；
- 框架嵌入和升级成本明显高于维护现有 Node Service；
- Action Component 无法覆盖足够多的真实 Mini App Service；
- 权限模型只是写在 manifest 中，运行时无法真正执行；
- 公共合同被迫绑定某个框架的 manifest、CLI 或控制面。

可接受的缩小结果包括：

```text
只让少数低内存、纯便携 Service 使用 WASM
+
普通或复杂 Service 继续使用 native-process
```

不能用组件组合、Agent OS、Marketplace 或其它远期想象弥补当前核心价值证据不足。

## 十三、MVP 最终摘要

> **MVP 是一个 Rust 编写、主要以单 artifact 分发、运行在共享 runner 中、拥有 HTTP/Secret/KV 权限、能被现有 Panel 与 Agent 通过 Service Action 调用的真实 `.napp`；它必须用测量证明比等价 Node Service 更低的增量内存。**

推荐首先定位为开发者预览版，不立即开放完整第三方 Marketplace。只有核心价值、开发体验、权限执行和跨平台链路得到真实证明后，才进入 Resident Service、多语言、组件组合与更大生态阶段。
