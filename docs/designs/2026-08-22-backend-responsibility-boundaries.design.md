# NextClaw 后台职责边界设计

日期：2026-08-22

## 1. 文档定位

本文定义 NextClaw 后台长期演进所依据的职责模型。它不是当前所有文件的搬迁清单，也不试图一次性冻结最终包结构。

需要长期稳定的是：

- 每一层拥有什么事实、状态、业务语义和生命周期。
- 一段能力应归属 CLI、service、kernel、NCP、runtime、server 还是 SDK 的裁决方法。
- 包之间允许的依赖方向。
- 触达历史混乱代码时，怎样以纵向能力切片逐步收敛。

允许持续演进的是：

- 具体 package 数量和名字。
- 某个 public API 的最终命名与参数。
- feature root 的细粒度划分。
- 每批迁移的顺序和范围。

因此，后续出现新事实时可以修订包形态，但不能在没有新设计证据的情况下破坏本文的单一 owner、依赖方向和宿主/产品语义分离原则。

## 2. 当前问题

仓库已经形成 NCP、core、kernel、runtime、service、server、CLI 和多个 SDK，但它们来自不同阶段，局部设计分别正确，整体仍有以下混乱：

1. 同一产品能力可能在 CLI、service、core 和 kernel 中各保留一部分判断。
2. CLI 中混有命令交互、运行时装配、服务生命周期和产品语义，导致“只服务命令”和“只是从命令进入”难以区分。
3. service 既承担宿主和进程管理，又容易吸收 kernel 应拥有的领域规则。
4. `@nextclaw/core` 与 `@nextclaw/kernel` 在 agent、session、config、provider、channel 等领域存在历史重叠，名字无法再可靠表达 owner。
5. `@nextclaw/kernel` 虽然已是公开包，但根入口包含大量不同稳定性的导出，“能 import”不等于“稳定 SDK contract”。
6. 具体 runtime、channel、provider 或宿主实现仍可能进入 kernel 主干依赖，削弱可嵌入性。
7. 局部重构往往先讨论文件放哪，而没有先判断事实 owner、生命周期和依赖方向。

这些问题的根因不是目录不整齐，而是缺少统一的职责判定模型。

## 3. 核心原则

### 3.1 产品语义只有一个中心：kernel

凡是定义“NextClaw 应当如何工作”的长期产品行为，默认归 `@nextclaw/kernel`：

- agent、session、run、context、tool、skill、provider、automation、channel、project 等领域行为。
- 跨 CLI、UI、Desktop、远程 API 和 extension 都必须一致的状态与不变量。
- 产品级创建、修改、运行、取消、恢复、诊断和状态查询语义。
- 稳定领域 owner 之间的编排。

kernel 拥有产品语义，不等于 kernel 自己实现所有协议、宿主和具体扩展。kernel 应通过稳定 contract 使用下层能力，通过 contribution / registry 等真实多实现边界接入可替换分支。

### 3.2 入口不拥有产品行为

CLI、HTTP API、Desktop、UI、channel 和 automation 都是入口或宿主，不因为某个行为首先从这里出现，就自动成为该行为的 owner。

当多个入口需要语义等价时，应让它们调用同一个 kernel intent / manager，而不是在每个入口复制参数默认值、校验、状态迁移和错误处理。

### 3.3 宿主拥有环境事实，owner 拥有业务事实

service / runtime host 可以知道：

- 当前进程、端口、PID、signal、child process、launcher 和文件监听状态。
- 操作系统、安装位置、环境变量、远程连接和升级执行环境。
- 某个宿主资源是否成功启动、停止、释放或重连。

kernel 可以知道：

- 某个产品能力应不应该启动、处于什么业务状态、状态变化意味着什么。
- agent/session/run 等领域对象的有效状态与不变量。
- 产品动作成功、失败、取消和恢复后应产生什么领域结果。

宿主把必要环境事实和能力句柄交给 kernel；kernel 不读取 CLI 参数、拼终端文案或直接管理 OS 进程。

### 3.4 协议、实现和产品语义分离

- NCP 定义跨 runtime 的协议、事件、能力接口和运行时中立 contract。
- runtime / extension 实现具体 provider、agent backend、channel 或外部协议适配。
- kernel 使用协议并赋予其 NextClaw 产品语义。
- service / server / CLI 把 kernel 装配到具体宿主和入口。

协议层不吸收 NextClaw UI、CLI、权限展示或具体 provider 的私有字段；kernel 也不反向依赖可替换实现的内部类型。

### 3.5 公共入口不是内部 barrel

一个包的根 `index.ts` 只能代表经过选择的公共能力面，不能默认 `export *` 所有内部 manager、store、service 和 utils。

公共能力至少要区分：

- `stable`：外部可依赖，遵守 semver、迁移说明和 contract tests。
- `experimental`：允许外部试用，但可按明确政策调整。
- `internal`：仅包内实现，不因 workspace 消费方便而导出。

SDK 化的目标是减少且稳定公共面，不是提高 export 数量。

### 3.6 同一能力只保留一条主链路

迁移完成后，CLI、service、server 和 SDK 不得保留功能等价的平行产品实现。允许存在的 adapter 只能隔离真实边界，例如 CLI 参数、HTTP、WebSocket、stdio、OS service 或第三方 provider 协议。

内部重构默认直接迁移和删除旧入口；只有已发布的外部 contract 确实需要兼容时才保留临时 adapter，并写明退出条件。

## 4. 各层职责定位

### 4.1 `nextclaw` / CLI package

拥有：

- 命令定义、参数解析、交互式 prompt。
- 用户输入到应用 intent 的转换。
- 终端输出、进度呈现、JSON/text 格式、退出码。
- CLI 启动装配与一次性命令上下文。

不拥有：

- agent、session、provider、skill、channel 等产品规则。
- 跨入口必须一致的默认值、校验和状态迁移。
- 长驻服务、child process、端口和 launcher 的底层实现。
- HTTP / WebSocket API 的领域 contract。

判断句：**删除 CLI 之后仍然成立的产品行为，不属于 CLI。**

### 4.2 `@nextclaw/service`

拥有：

- 本机长驻服务和宿主生命周期。
- start / stop / restart、signal、PID、端口、launcher、autostart、child process。
- 文件监听、宿主健康、升级执行、远程访问宿主和环境适配。
- kernel、server、runtime 和 extension 的进程级装配与资源释放。

不拥有：

- NextClaw 领域对象的业务状态和规则。
- 因为 CLI 需要就复制的产品操作。
- 只为隐藏 kernel 调用而存在的同名 facade。

判断句：**如果职责描述里没有进程、宿主、系统、网络监听或生命周期资源，它通常不属于 service。**

### 4.3 `@nextclaw/kernel`

拥有：

- NextClaw 产品领域 owner、跨入口状态、不变量和业务生命周期。
- agent/session/run/context/tool/skill/provider/automation/channel/project 等领域能力。
- 产品动作的统一 intent、结果和错误语义。
- 可替换能力的 contribution contract 和组合规则。

不拥有：

- CLI、HTTP、WebSocket、Electron、system service 等入口细节。
- 具体 provider/channel/runtime 的不可替换实现。
- 为宿主方便而添加的进程控制代码。

判断句：**多个入口都需要一致、并且决定 NextClaw 产品行为的事实，默认归 kernel。**

### 4.4 `@nextclaw/core`

`core` 是当前历史迁移层，不再作为新的产品语义 owner，也不是“不知道放哪”的默认落点。

长期处理原则：

- 产品行为迁入 kernel。
- runtime-neutral 协议迁入 NCP。
- 具体 provider/channel/runtime 装配迁入 runtime 或 extension。
- 真正跨产品、无 NextClaw 语义的基础能力迁入 shared 或独立轻量 package。
- 仍服务旧数据或旧协议的内容明确标记 legacy / compat，并随着消费者清零删除。

在分流完成前，core 可以继续承载已有调用方所需能力，但原则上只减不增；不得再与 kernel 新增并列 manager 或状态 owner。

判断句：**新代码不能仅因为“比较底层”就进入 core；先回答它最终属于哪个稳定 owner。**

### 4.5 `@nextclaw/ncp` 与 NCP packages

拥有：

- runtime-neutral 的 agent/session/event/toolkit 协议。
- backend/runtime 能力接口、事件 envelope、流式和取消等跨实现语义。
- 不依赖 NextClaw 产品入口的组合积木。

不拥有：

- NextClaw 专属产品策略、UI projection、CLI 默认值或宿主管理。
- 某个 provider、SDK 或 transport 的私有行为。

判断句：**如果 Codex、Claude、HTTP agent 或未来 runtime 都必须遵守，而且不需要知道 NextClaw 产品形态，它适合归 NCP。**

### 4.6 `@nextclaw/runtime` 与具体 runtime / extension packages

拥有：

- 具体 provider、channel、agent backend 和外部协议的实现或装配。
- 把第三方 SDK / protocol 映射到 NCP 或 kernel contribution contract。
- 实现私有的配置解释、连接、重试和资源释放。

不拥有：

- 跨所有实现的产品规则。
- kernel 主干状态和入口行为。

判断句：**换掉具体 provider、channel 或 backend 后会消失的逻辑，属于实现分支，而不是 kernel 主干。**

### 4.7 `@nextclaw/server`

拥有：

- HTTP / WebSocket server、router、controller 和 transport 生命周期。
- 请求解析、transport auth、序列化、状态码和 API contract。
- 把外部 request 映射为 kernel intent，把领域结果映射为 response/event stream。

不拥有：

- 为某个 UI 页面定制的产品规则或聚合状态。
- agent/session/config 等领域事实的第二套存储和业务判断。
- CLI 或 service 生命周期。

判断句：**去掉 HTTP / WebSocket 后仍然成立的业务规则，不属于 server。**

### 4.8 Client / Extension / App SDK

拥有：

- 对稳定远程、extension 或 app contract 的类型化访问。
- transport adapter、领域化 client API 和开发者错误语义。
- 不依赖仓库内部路径的公共消费体验。

不拥有：

- kernel 产品规则的复制实现。
- UI state、store、query cache 和页面编排。
- 宿主进程生命周期。

判断句：**SDK 描述怎样稳定地使用能力，不重新决定能力本身怎样工作。**

### 4.9 `@nextclaw/shared`

拥有无产品 owner、无副作用生命周期、被多个稳定包真实复用的基础类型和小型机制。shared 不是历史代码垃圾桶，也不承载 agent/session/provider 等完整领域能力。

## 5. 目标依赖方向

长期允许的主方向：

```text
shared / NCP contracts
        ↑
runtime implementations / extensions
        ↑
kernel product owners
        ↑
server / service host
        ↑
CLI / desktop / other product entrypoints

server API contract
        ↓
client SDK
        ↓
UI / companion / external clients
```

图中的箭头表达“上层依赖下层”。特殊装配发生在 composition root，由上层把具体实现注入稳定 contract。

硬约束：

1. kernel 不依赖 CLI、service、server、UI 或 desktop。
2. kernel 主干不直接依赖具体 channel/provider/runtime 实现；具体实现通过稳定 contract 注册。
3. CLI 不通过 deep import 访问 service/kernel 内部文件。
4. server/controller 不绕过 kernel 直接修改领域 store。
5. client SDK 不依赖 server/kernel 内部实现，只依赖发布的 contract。
6. core 不再成为新增反向依赖的中转站。
7. sibling package 若需要彼此实现细节，优先回到共同 contract owner，而不是互相 deep import。

## 6. 归属判定流程

每次触达混乱代码，按以下顺序裁决：

1. **写出事实与动作**：这段代码创建、读取、修改或释放什么？
2. **找 information expert**：谁拥有完成判断所需的事实和不变量？
3. **做删除入口测试**：删除 CLI / HTTP / Desktop 后，这个行为是否仍应成立？成立则不属于入口。
4. **做多入口一致性测试**：如果 CLI、UI、remote 都要相同行为，规则进入 kernel，入口只做映射。
5. **做宿主测试**：它是否主要处理进程、端口、文件系统、signal、launcher 或环境？是则进入 service/host。
6. **做可替换实现测试**：换 provider/runtime/channel 后逻辑是否消失？是则进入具体实现分支。
7. **做协议中立测试**：多个 runtime 必须共同遵守且无 NextClaw 产品语义？是则进入 NCP。
8. **确定唯一 owner 和公共 contract**：上层传入 owner 无法自知的外部事实，不把 owner 拆成 callback、path、getter/setter 参数包。
9. **删除旧路径**：切换全部当前消费者后，删除等价 wrapper、proxy、旧 manager、重复类型和 deep import。

如果证据不足，先保持现状并记录待验证点；不以 `shared`、`core`、`utils`、`support` 等模糊位置代替设计判断。

## 7. 渐进迁移机制

### 7.1 以纵向能力切片，不以包为批次

每批选择一条能端到端证明的能力，例如：

```text
CLI command / HTTP request
  -> host adapter
  -> kernel intent / owner
  -> NCP or runtime implementation
  -> persistence / event
  -> response / output
```

一次收敛这条链上的 owner、contract 和调用方；不发起“先把整个 CLI 搬空”或“先把整个 core 拆完”的长期半成品工程。

### 7.2 主线触达驱动，热点审计补充

- 产品主线触达某个领域时，顺带按本文修正最近一层职责债务。
- 未被主线触达但持续制造高冲突、高故障或公共 API 泄漏的热点，可单独进入治理批次。
- 与当前能力无关的历史债务不搭车，避免迁移范围失控。

### 7.3 每个切片的完成合同

1. 记录当前 producer、owner、consumer 和依赖方向。
2. 指定唯一目标 owner 和稳定 contract。
3. 让现有入口切到新主链路，优先让 NextClaw 自身 dogfood 公共入口。
4. 删除旧 owner、同名转发、重复类型和过期兼容。
5. 对公共 contract 补类型检查、定向行为测试和必要文档。
6. 搜索旧符号和 deep import，证明旧主链路不可达。

只新增 facade 而不删除旧路径，不算完成迁移。

### 7.4 设计如何持续变化

本文维护原则和职责定位；具体切片另写短 design / plan，并链接回本文。只有出现以下证据时才修改上位职责：

- 某类事实无法由现有 owner 完整维护。
- 出现真实的新宿主、协议或可替换实现边界。
- 当前依赖方向导致不可避免的循环或跨层泄漏。
- 外部 SDK 用例证明现有公共面无法形成稳定最小闭环。

单个文件不好放、某次 import 不方便、测试 fixture 难写，都不足以推翻上位职责。

## 8. 方案取舍

### 采用：原则模型 + 纵向切片迁移

优点：

- 能适应代码和产品持续变化。
- 每一批都有可观察的结构收益和删除结果。
- 与平台 SDK 化、kernel 单一 owner 和主线交付相互增强。
- 不需要提前猜中最终所有 package 和 API。

### 不采用：一次性精细化文件归属表

原因：当前范围过大，很多 owner 仍会随 NCP、runtime 和产品能力演进；逐文件冻结会迅速过时，并诱导机械搬迁。

### 不采用：新建一个大而全的 Platform SDK 吞并现有层

原因：它会把协议、产品语义、宿主和 client access 再次混在一起，只是换一个更大的包名。

### 不采用：只靠目录和命名治理

原因：目录只能检测形状，无法决定事实、状态、生命周期和业务语义归谁；先有 owner，后有目录。

## 9. 非目标

- 本文不决定所有历史文件的最终路径。
- 本文不授权立即拆除 `@nextclaw/core` 或改变已发布 API。
- 本文不要求每个功能迭代都做跨包重构。
- 本文不新增兼容层、facade 或 platform package。
- 本文不替代各能力切片的实现设计和验证计划。

## 10. 架构演进验收信号

长期观察以下结果，而不是用“移动了多少文件”衡量：

1. 一个领域事实只有一个 manager/store owner。
2. CLI、server、UI 和 automation 对同一动作收敛到同一 kernel intent。
3. service 中产品规则持续减少，宿主生命周期边界更清晰。
4. core 的新增业务 owner 为零，存量职责持续流向明确目标层。
5. kernel 对具体 runtime/channel/provider 实现的直接依赖持续减少。
6. workspace deep import、重复 contract 和同名 proxy 持续减少。
7. public API 能明确归类为 stable / experimental / internal。
8. headless 外部消费者可以只用公开 packages 完成 Agent 平台最小闭环。

## 11. 与平台 SDK 化路线的关系

后台职责收敛是平台 SDK 化的前置条件：只有产品语义集中在 kernel、协议集中在 NCP、宿主集中在 service/server、入口保持轻薄，才可能对外暴露稳定且可组合的 SDK。

反过来，外部 headless 示例也是职责设计的验证器：任何必须 deep import CLI/service 内部实现才能完成的能力，都说明公共 contract 或 owner 仍有缺口。

关联文档：

- [NextClaw Platform SDK 公共能力面设计](./2026-08-22-platform-sdk-public-surface.design.md)
- [项目路线图](../ROADMAP.md)
- [NextClaw Client SDK 方案设计](../plans/2026-05-06-nextclaw-client-sdk-design.md)
- [NextClaw Extension SDK 方案设计](../plans/2026-05-08-nextclaw-extension-sdk-design.md)
- [CLI Command Boundary Refactor Plan](../plans/2026-04-19-cli-command-boundary-refactor-plan.md)
- [Service 到 Kernel 低冲突重构候选方案](../plans/2026-05-20-service-to-kernel-non-conflicting-refactor-plan.md)
- [Kernel Session Manager 收敛方案](../plans/2026-05-28-kernel-session-manager-consolidation.md)
