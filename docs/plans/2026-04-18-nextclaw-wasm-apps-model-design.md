# NextClaw Wasm Apps 模型设计

## 这份文档回答什么

这份文档用于把本轮关于“新型微应用形态”的讨论，正式收敛到一个更具体、更可执行的方向：

**不是做一个通用的可移植微应用标准，而是先定义一类只服务于 NextClaw 的应用形态：`NextClaw Wasm Apps`。**

它重点回答下面几个问题：

1. `NextClaw Wasm Apps` 到底是什么。
2. 为什么我们先不追求通用标准，而是先绑定 NextClaw 宿主。
3. 为什么这件事不是为了“主打安全”，而是为了让 AI 时代产出的微应用真正能安装、运行、分享和复用。
4. 为什么技术上推荐走 `NextClaw Host + Wasmtime 执行层`，而不是 Docker、裸 Node 后端、或完全自研 runtime。
5. 第一阶段哪些边界应该先定死，哪些能力故意不做。

这是一份上层设计文档，用来统一产品定位与技术方向，不是实现计划本身。更具体的冻结结论见：

- [2026-04-18-nextclaw-wasm-apps-freeze.md](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-18-nextclaw-wasm-apps-freeze.md)
- [2026-04-18-nextclaw-wasm-apps-mvp-implementation-plan.md](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-18-nextclaw-wasm-apps-mvp-implementation-plan.md)

## 长期目标对齐

这件事和 `docs/VISION.md` 的关系非常直接。

NextClaw 想成为 AI 时代的个人操作层，就不能只做一个聊天入口，也不能只靠“用户自己跑仓库、装脚本、起 Docker”来承载生态。对于普通用户来说，AI coding 产出的能力如果不能被：

- 安装
- 理解
- 授权
- 运行
- 分享
- 卸载

那生态就很难真正盘活。

所以这次设计的本质不是“再造一个插件系统”，而是在补：

**AI 时代的微应用应该以什么形态进入 NextClaw。**

## 问题重新定义

这个问题很容易被讨论偏：

- 不是“Wasm 能不能替代 Docker”
- 不是“我们要不要做一个通用容器平台”
- 不是“我们要不要自己发明一套新的 runtime”

更准确的问题是：

**我们能不能在 NextClaw 里定义一种足够轻、足够可安装、足够可分发、又带受控执行模块的微应用形态，让 AI web coding 产出的东西真正可以被别人拿来用。**

这里有三个关键词：

1. `在 NextClaw 里`
2. `微应用形态`
3. `能被别人直接使用`

这意味着我们当前追求的不是通用性最大化，而是：

- 先在一个统一宿主里把模型做对
- 先把安装、权限、运行、分享这一套做顺
- 先服务真实用户和真实创作者，而不是先定义行业标准

## 结论先行

本文档的核心结论是：

**第一阶段应该定义 `NextClaw Wasm Apps`，而不是继续停留在泛泛的“可移植微应用”概念上。**

这类应用的本质可以定义为：

**一种运行在 NextClaw 宿主中的轻量微应用形态，它由 `main`、`ui`、显式权限声明和少量宿主 API 组成。**

它的目标不是替代所有现有应用模型，而是解决一个更现实的问题：

**让 AI 生成的小应用，能以更自然、更可信、更低门槛的方式被别人安装和使用。**

## 为什么先不做通用标准

这是本轮最重要的收敛之一。

### 1. 我们不需要一开始就覆盖所有宿主

如果一开始就想定义“任何产品都能用的 Wasm App 标准”，会立刻引入大量不必要问题：

- 不同宿主的权限语义怎么统一
- 不同宿主的 UI 装载模型怎么统一
- 不同宿主的身份和数据模型怎么统一
- 不同宿主对文件、网络、任务调度的 API 怎么统一

这些都不是第一阶段必须解决的问题。

### 2. 先绑定 NextClaw，反而更容易把体验做顺

绑定 NextClaw 的好处是：

- 有统一入口
- 有统一 UI 壳
- 有统一权限中心
- 有统一模型与工具能力
- 有统一分发和安装路径

这比先做通用格式更容易落地。

### 3. 产品先成立，再考虑外溢

如果这套模型后来真的成立，再把它抽象成更通用的宿主协议也不晚；反过来，一开始就追求通用，通常只会把产品做空。

## 它不是什么

为了避免误解，需要先把边界写清楚。

### 它不是 Docker 替代品

我们不追求：

- 跑任意现有全栈应用
- 提供完整 Linux 用户态
- 兼容任意现有 Node/Python 后端
- 承载复杂守护进程和基础设施服务

Docker 更适合“把现有世界直接装进去”，而 `NextClaw Wasm Apps` 更适合“定义一种新的小应用形态”。

### 它不是通用 Wasm marketplace 标准

第一阶段只服务于 NextClaw，自定义包格式、权限模型和 UI 装载方式完全合理。

### 它不是“安全卖点产品”

安全和隔离是必要条件，但不是外层主叙事。

用户真正关心的是：

- 这个应用能做什么
- 安装难不难
- 我敢不敢装
- 分享给别人后别人能不能直接用

## 为什么选 Wasm，而不是别的

当前我们要的不是“完整容器环境”，而是“受控逻辑执行单元”。

Wasm/WASI 在这个方向上的优势很明显：

- 比 Docker 轻
- 比裸跑本地后端更可控
- 比纯前端更有逻辑承载能力
- 比任意脚本执行更容易做显式授权

但必须明确：

- 我们不是“只要是 Wasm 就行”
- 我们不是“只要编译成 Wasm 就天然安全”
- 真正成立的是：**Wasm + 成熟 runtime + 宿主权限模型 + 宿主 API 收口**

## 为什么推荐 Wasmtime

当前最符合我们诉求的成熟方向，是直接使用现成 runtime，而不是自己造引擎。

推荐 `Wasmtime` 的原因：

1. 它本身就是成熟的 Wasm runtime。
2. 方向上明确支持 capability-based 的能力暴露。
3. 适合作为嵌入式执行引擎或 sidecar runner。
4. 比起依赖 `node:wasi`，它更接近“可信执行层”。

所以技术上更准确的表述应该是：

**我们不自研 runtime，我们是做 `NextClaw Host + Wasmtime Sidecar`。**

## 为什么不推荐以 node:wasi 作为底座

这个结论也需要写死。

`node:wasi` 可以作为本地实验工具，但不应该作为 `NextClaw Wasm Apps` 的正式执行底座。

原因不是它完全不能用，而是：

- Node 官方并不把它定义为运行不可信代码的安全沙箱
- 文件系统沙箱语义不够强
- 这条路会把“可信宿主”问题重新带回 Node 主进程里

所以我们的方向应该是：

- 产品壳仍然可以是 Node/TypeScript
- 但真正执行 Wasm 模块时，要走独立 `Wasmtime Sidecar`

## 推荐的总体架构

第一阶段推荐采用三层结构。

### 第一层：NextClaw UI / Host

职责：

- 应用入口
- 应用安装与卸载
- 权限展示与授权
- 应用页面装载
- 与 Wasm 模块通信

这一层是产品层。

### 第二层：NextClaw Host API

职责：

- 把宿主能力收口成一组有限 API
- 做权限校验
- 做调用映射
- 管控应用的数据和资源边界

这一层是控制层。

### 第三层：Wasmtime Sidecar

职责：

- 加载应用的 Wasm 模块
- 注入被允许的 host functions
- 执行 action
- 返回结果与日志

这一层是执行层。

## UI 与执行模块关系

`NextClaw Wasm Apps` 不应把 UI 和执行模块混在一起。

推荐的关系是：

- UI 负责交互与展示
- Wasm 模块负责业务执行
- UI 不直接访问高权限宿主能力
- UI 只能通过 NextClaw Host 发起请求
- Wasm 模块也不能直接访问机器资源
- Wasm 模块同样只能通过宿主暴露的能力边界行事

也就是说，统一链路应该是：

`App UI -> NextClaw Host -> Host Bridge -> Wasmtime Sidecar -> Main Module`

## 开发者体验建议

这是本轮收敛里另一个很关键的点。

如果我们把第一版应用逻辑要求成：

- 必须 Rust
- 必须自己编译 Wasm
- 必须理解 WASI 细节

那它和“AI web coding 时代的小应用”天然就不匹配。

因此更合理的路线是：

### 架构上预留双轨

- 高阶开发者可以写 `Rust -> Wasm`
- 普通开发者和 AI 生成流程优先支持 `JS/TS -> Wasm`

### MVP 明确走 JS-first

也就是：

- UI：普通 Web 技术
- Main：JS/TS 编译进 Wasm
- 宿主：NextClaw
- 执行：Wasmtime Sidecar

这样更符合 AI web coding 产出的小应用形态。

## 权限模型应该长什么样

第一阶段权限必须极简。

推荐先只支持下面五类能力：

1. `storage`
   - 应用私有存储
2. `documentAccess`
   - 仅用户授权目录
   - 区分只读和读写
3. `allowedDomains`
   - 仅 manifest 声明的域名白名单
4. `capabilities.llm`
   - 可选
   - 通过 NextClaw 提供
5. `capabilities.hostUi`
   - 通知、打开页面、刷新状态等宿主界面动作

暂时明确不做：

- 任意 shell
- 任意进程管理
- 系统级自动化
- 原生数据库服务
- 完整后端环境

## 第一阶段最适合的应用类型

最适合 `NextClaw Wasm Apps` MVP 的，不是复杂系统软件，而是：

- 文档整理器
- 文件夹摘要器
- 受限网络采集器
- API 驱动的小面板
- 小型 CRM/知识卡片/运营工具

这些应用的共性是：

- UI 不复杂
- 逻辑相对清晰
- 文件、网络、LLM 三类能力就足够承载
- 很适合 AI web coding 生成

## 第一阶段明确不做什么

为了防止方向失控，下面这些不应该放进第一阶段：

1. 不做通用宿主标准
2. 不做 Docker 替代
3. 不做任意 Node/Python 项目迁移
4. 不做完整 Linux 语义
5. 不做大而全 marketplace 协议
6. 不做系统级长驻服务承载

## 设计结论

本轮设计最终收敛为：

1. 第一阶段产品定义为 `NextClaw Wasm Apps`
2. 第一阶段只服务于 NextClaw，不追求通用标准
3. 技术路线选择 `NextClaw Host + Wasmtime Runner`
4. 开发者体验选择 `JS-first`，架构上预留未来 `Rust -> Wasm`
5. 权限模型极简收口，不把复杂系统能力提前放进来
6. 第一阶段优先验证“AI 生成的小应用能不能真的被别人装起来并且用起来”

后续更具体的冻结内容见：

- [2026-04-18-nextclaw-wasm-apps-freeze.md](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-18-nextclaw-wasm-apps-freeze.md)
