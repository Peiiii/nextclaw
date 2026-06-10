---
name: kernel-branch-owner-architecture
description: 当设计或重构主干/分支架构、kernel、desktop main、runtime host、presenter-manager-store、manager/store/presenter、生命周期装配、owner 依赖、贡献点 contribution，或用户指出最小传参、上层代读、factory/create/registry 过度抽象、稳定业务依赖被过度解耦、prop 透传或链路过长时使用。
---

# Kernel Branch Owner Architecture

## 核心论述

NextClaw 的业务层不是“尽量互相看不见”，而是让稳定业务 owner 通过短链路直接协作。业务内稳定 owner 直连不是坏耦合；它的目标是降低沟通成本、减少属性透传、让对象图直接表达真实业务拓扑。

业务层和业务无关可复用层是两套范式。业务层优先真实 owner 直连、标准化生命周期和低通信成本；可复用层才优先接口、options、factory、provider、registry 和更强隔离。

判断时先问：这个对象是在编排产品业务链路，还是在提供跨业务复用的通用能力？前者用 manager/store/service/presenter 等稳定 owner 直接表达拓扑，后者才用抽象隔离变化点。

## Rulebook

规则按软件工程关注面分组；组的顺序也是判断优先级：先看架构边界，再看职责依赖，再看流程数据，再看生命周期资源，最后看扩展演进。每条规则都应覆盖一个判断面；如果一条规则只是在点名某个具体坏写法，应上提、合并或删除。例子只用于帮助理解，不应替代规则本身。

### 架构边界

- `layer-paradigm-fit`：先判断对象属于业务编排层还是业务无关可复用层；不同层级采用不同依赖、抽象和隔离范式。
  - 例子：业务 manager 可以直连 repository/config manager；通用库才更适合 options/factory。
- `product-kernel-ownership`：NextClaw 产品功能、产品语义和业务规则默认归 kernel owner；service 默认只承载进程宿主、启动停止、升级发布、远程访问、CLI/daemon 外壳和运行环境适配。
  - 例子：agent profile 的默认值、CRUD 和运行期解析归 `AgentManager`；service CLI 只解析命令参数、展示结果并调用 kernel owner。
- `ownership-topology`：架构应显式表达谁拥有谁、谁启动谁、谁协调谁；主干和分支的关系应来自真实业务拓扑。
  - 例子：runtime host 持有长期 manager，manager 再持有只服务自己的 store/service。
- `stable-collaboration-path`：稳定业务协作者之间优先短链路直连，避免用额外中介制造通信成本和不确定性。
  - 例子：不要让上层反复把 repository 读出的中间数据转交给另一个稳定 manager。
- `boundary-abstraction-fit`：接口、注册、回调、工厂和 provider 应服务真实边界，而不是默认套在所有内部协作上。
  - 例子：插件贡献点适合 registry；产品内固定分支通常不需要 registry。

### 职责依赖

- `responsibility-closure`：一个 owner 应拥有可闭合的职责、状态和协作边界；只转发、只包装或只改名的对象不是 owner。
  - 例子：只包一层 `createXxx()` 而没有真实职责的 factory 通常应删除。
- `stable-dependency-ownership`：稳定依赖应由 owner 长期持有并直接表达，调用参数只表达本次调用独有的信息。
  - 例子：`send(request)` 传 request；repository/config/eventBus 这类稳定协作者走 constructor。
  - 例子：普通函数、工具函数和 helper 不得把 kernel / runtime / manager / store / service / presenter 等稳定 owner 当 `params` 字段传来传去；应由最近的 owner constructor 持有，私有 helper 直接用 `this.xxxManager`，纯函数只接本次调用的数据快照。
- `fact-source-ownership`：事实应由最接近事实来源的 owner 读取、推导和维护；上层不应替下层预先拼装中间事实。
  - 例子：创建 session run 时，由 `SessionRunManager` 自己读取 messages，而不是调用方先读再传入。
- `semantic-role-naming`：命名应反映对象在系统中的真实角色，例如编排、边界适配、数据拥有、视图协调，而不是反映目录习惯或实现偶然性。
  - 例子：负责流程编排的对象叫 manager，比因为目录叫 services 就叫 service 更准确。
- `private-capability-containment`：只服务某个 owner 的细分能力，应默认收敛在该 owner 内部，而不是无理由提升为系统级分支。
  - 例子：某 manager 私用的小 adapter 不必挂到主干一级。
- `existing-owner-before-new-owner`：判断职责归属时，必须先评估它是否应进入已有 owner；只有已有 owner 会因此职责混杂、生命周期失真或依赖方向变坏时，才考虑新增 owner。
  - 例子：新增 manager 前先列出候选现有 manager/store/presenter，以及放入它们各自的收益和损失。

### 流程数据

- `main-flow-readability`：核心业务流程应在主流程中直接可读；拆分只应服务稳定语义、复用、隔离变化点或降低真实复杂度。
  - 例子：不要把一个很短的编排流程拆成一串只调用一次的 private 方法。
- `data-flow-locality`：数据在产生、转换、消费之间应保持短路径；避免跨层搬运 snapshot、配置、默认值或中间态。
  - 例子：默认模型配置应由负责配置策略的 owner 提供，不应在请求编排处写魔法数字。
- `boundary-normalization`：解析、防御、兼容和归一化应放在真实外部边界；内部协作依赖明确 contract。
  - 例子：event ingress 可以校验 envelope，manager 内部互调不需要每层都防一遍。
- `command-query-shape`：方法输入应反映业务意图或查询意图，不应让调用方承担被调用 owner 的内部编排步骤。
  - 例子：`createSessionRun(sessionId)` 比 `createSessionRun(sessionId, messages, defaults)` 更接近业务命令。

### 生命周期资源

- `deterministic-lifecycle`：长期 owner 的创建、启动和停止应由上级 owner 确定性管理，避免让存在性取决于调用顺序。
  - 例子：固定业务 manager 不应靠第一次调用 `ensureXxx()` 才临时出现。
- `lazy-lifecycle-justification`：懒创建只用于真实不确定性，例如可选能力、昂贵资源、异步发现、循环依赖解除或缓存收益。
  - 例子：runtime 实例可以按 runtimeId 懒取；固定的 request manager 通常不需要。
- `resource-surface-consistency`：拥有订阅、后台任务、stream、runtime 或外部资源的 owner 应提供一致的生命周期入口。
  - 例子：这类 owner 通常暴露无参数 `start()` 和 `dispose()`。
- `cleanup-ownership`：资源释放应归属清晰、集中管理；不要让清理责任按资源类型散落在多个临时字段里。
  - 例子：多个 unsubscribe/stop handle 应收敛到统一 cleanups/disposables collection。

### 扩展演进

- `extension-mechanism-fit`：贡献点、注册表和插件机制只应出现在需要多方扩展、运行时发现或静态依赖不合适的地方。
  - 例子：context/tool provider 可以注册；固定业务 manager 不应为了“可替换”硬上 registry。
- `abstraction-earns-place`：新增抽象必须减少真实复杂度、表达稳定语义、隔离真实变化点或形成复用资产。
  - 例子：resolver/adapter/factory 只有在承担稳定语义时才值得独立存在。
  - 例子：不得为了回避 helper 参数违规、owner 误判或依赖方向问题而新增一层 resolver/factory/wrapper；应先回到正确 owner。
- `evolutionary-pressure-check`：为未来演进预留结构时，必须说明预期变化压力；没有变化压力的预留通常是噪音。
  - 例子：先问未来会多 runtime、多 provider 还是多存储策略，再决定是否提前抽象。
- `review-by-concern`：review 时按架构边界、职责依赖、流程数据、生命周期资源和扩展演进逐面检查，而不是追逐零散坏味道。
  - 例子：先看 owner 和数据流是否成立，再看某个函数名是否顺眼。

## 使用方式

- 先判断当前对象属于业务层还是可复用层，再选择直连 owner 还是抽象隔离。
- 讨论方案时优先点名触发的 rule slug，例如 `fact-source-ownership`、`data-flow-locality` 或 `abstraction-earns-place`。
- 涉及前端 view/business/state 分层时，同时使用 `mvp-view-logic-decoupling`。
- 涉及目录和文件角色时，同时使用 `role-first-file-organization` / `file-naming-convention`。
- 涉及 fallback 或兼容路径时，同时使用 `predictable-behavior-first`。
- 用户指出无意义抽象、create/factory wrapper 或 owner 误判时，同时使用 `learning-from-failures`，并判断是否需要把教训继续沉淀到规则或治理脚本。
