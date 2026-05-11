---
name: nextclaw-clean-implementation
description: Use when implementing or refactoring code in this repository, especially if a task could add fallback-heavy logic, duplicate branches, weak abstractions, unclear file placement, ad-hoc helpers, or patch-style fixes that would turn into garbage code.
---

# NextClaw Clean Implementation

## 概述

这个 skill 用来在写代码之前先拦住“垃圾代码”。

这里的“垃圾代码”不是指风格不好看，而是指：

- 用兜底、特判、双路径把问题糊过去
- 该有 owner 的业务逻辑没有 owner
- 该删除的旧路径没删，只是在外面再包一层
- 抽象、目录、命名、边界都说不清
- 明明能复用，却继续复制一份
- 代码虽然能跑，但复杂度、分支数、文件数和理解成本一起上涨

目标不是“先写出来再靠 review 收尸”，而是默认在动手前就把这些风险压下去。

## 何时使用

在本仓库里，只要要写或改下面这些内容，默认都该先用这个 skill：

- 源码
- 脚本
- 测试
- 会影响运行链路的配置

尤其当任务包含以下信号时，更应该先过这个 skill：

- 想加 fallback / compatibility / rescue path
- 准备新增 helper / util / adapter / wrapper
- 觉得“先这样 patch 一下”
- 目录落点或文件角色拿不准
- 业务逻辑开始散落到组件 / hook / effect / 多个函数里
- 准备复制一段相似实现再小改
- 准备为一个字段或局部状态新增跨层参数、回调、wrapper、proxy 或接口转发对象
- 改动不大，但会继续推高复杂度
- 准备把一个领域 owner 改成只接收 `createXxx` / `resolveXxx` / `getXxx` 参数的空心壳
- 准备为了迁移方便保留旧 manager、旧入口、alias、adapter、`asXxx()` 或双路径

如果讨论重点已经进入 owner、生命周期、模块边界、职责对象、状态归属或经典编程最佳实践，先联动 `classic-software-design-principles`，用 GRASP / SOLID / Tell Don't Ask / Law of Demeter 校准后再写代码。

## 写代码前固定要回答的问题

### 1. 这次真的是要新增代码吗

先回答：

- 这次是在新增用户能力，还是只是在修结构/修 bug/修链路
- 如果不是新增能力，什么旧代码可以直接删
- 如果当前改动点删不动，能不能在同一责任链、同一问题域或本批次相关路径里删旧实现、收敛分支或回收中间层
- 能不能通过删路径、删分支、删中间层解决，而不是继续加逻辑
- 如果这不是新增能力，最终能不能做到“排除测试后的非测试代码净增 <= 0”

只要删得掉，默认先删，不要先加。
如果当前方案做不到最后一条，默认说明方案还不够好，先不要开写。
这里的“做到”不要求净减只发生在当前文件或当前几行；允许通过相关链路的真实重构、删除和职责收敛来达成。
禁止靠缩变量名、合并语句、折叠空白、把复杂度藏进别处或临时 hack 来硬凑 `<= 0`。

### 2. 这段逻辑的 owner 是谁

先回答：

- 这段逻辑是不是业务规则或业务编排
- 它的状态、上下文、生命周期由谁拥有
- 主流程现在是在一个清晰 owner 里，还是散落在函数 / hook / effect / action 中
- 这个 owner 是否完整覆盖领域闭环，还是核心能力仍由上层通过 factory/deps 临时塞进来
- 这个 owner 的职责边界、感知范围、最小依赖和合理自定义表面分别是什么

如果答案说不清，先收敛 owner，再写增量逻辑。

默认倾向：

- 业务主干进 class owner
- 使用箭头函数 class field 表达实例方法时，不给函数属性额外加 `readonly`；`readonly` 保留给真实不可重绑定的数据字段，避免把方法签名写成噪音。
- 普通函数只保留给纯工具、纯计算、纯无状态辅助
- 字段和派生状态归属数据生成者或视图生成者，不能归属路过的装配层、bridge、router 或 callback
- 领域 owner 要自己拥有创建、缓存、状态恢复、reload、dispose 等领域闭环；上层只传它无法自知的外部事实，例如配置快照、用户输入、路径、观测端口或明确策略
- `responsibility-surface-minimization`：owner 自己能推导或决定的内部实现细节不外传；只有跨边界外部事实、明确策略、用户选择、测试替身或真实扩展点才进入参数表面

### 2.1 这是语义建模还是结构搬运

先回答：

- 这次新增的是一个新语义，还是只是把一个字段从 A 搬到 B
- 中间层是否拥有决策、生命周期、权限、协议转换或持久化责任
- 是否正在手写接口 proxy、wrapper、adapter，只为了改其中一个方法
- 是否只是把一个问题类型、参数对象、contract 或 wrapper 换了一个新名字，却没有删除重复字段清单、重复 owner 或重复装配链路
- 是否只是把核心职责外包给上层传入的 `createXxx` / `resolveXxx` / `getXxx`，导致新类只有名字像 owner、能力却不内聚
- 是否把不同层级的信息混进同一个 options，比如让下级 owner 同时感知 `homeDir/workspace/configPath/sessionsDir/factory`，导致职责边界失真
- 是否有一个现成的数据生成者 / summary builder / view service 可以自然加上这个字段

默认原则：

- 在语义 owner 上加字段或行为，而不是在路由、启动参数、bridge、controller 里穿针引线
- 事件名如果声明承载某个既有协议事件，payload 必须保持该协议事件本体；路由、权限、展示上下文、派生 metadata 属于独立 owner 或独立事件，不能混进同名协议事件里
- 不用“原样转发整个接口 + 改一个方法”的方式解决局部问题
- 不用 getter / alias / proxy 冒充删除重复入口。`get oldName() { return this.newName; }` 只有在明确保留兼容 contract 时才允许；重构收敛场景必须继续改调用方或改 contract，让公共入口真的只剩一个。
- Owner 状态只能由 owner 自己改变。普通函数、helper、service、callback 不得出现 `params.owner.xxx = ...`、`runtime.xxx = ...`、`gateway.xxx = ...` 这类从外部改 owner 字段的写法；它们只能返回结果，或调用 owner 暴露的明确业务方法。若方法只是 setter 包装且没有业务语义，也应继续收回 owner 内部。
- 清晰性本身是重要原则。不要为了机械消灭 `null` / `undefined`、减少一行判断或追求形式统一，把真实状态改成 no-op、假默认值、哨兵对象或更隐晦的间接表达；只有半初始化、职责逃逸或 contract 不确定时才应收敛掉可空状态。
- 禁止用重命名替代结构修复；如果旧类型和新类型承载同一批字段或同一段装配职责，必须删除重复 contract，让字段回到真正 owner，而不是引入 `XxxHost`、`XxxRuntime`、`XxxGateway`、`XxxOptions`、`XxxProps` 这类换皮中间名
- 新命名只有在引入了新的语义 owner、生命周期、权限边界、协议转换或持久化责任时才成立；否则默认是结构搬运，必须回退
- 若一个字段需要经过 `3` 层以上且多数层只是透传，必须先停下重新找 owner
- 若确实需要 adapter，必须有真实语义转换；没有语义转换的 adapter / proxy 默认删除
- 只负责 `subscribe(handler)` / `onXxx(handler)` / 调用转发、没有协议转换或生命周期决策的 bridge / listener wrapper 默认删除；订阅、退订和状态归属应回到真实 runtime / manager owner。
- 不用空心依赖注入冒充职责收敛。除非依赖代表外部系统边界、测试替身、权限边界或用户可配置策略，否则 owner 的核心创建/路由/缓存/生命周期逻辑应回到 owner 内部。

### 3. 这是不是在制造隐藏路径

先回答：

- 这条 fallback 会不会掩盖真实缺陷
- 这是正式主路径，还是事故补丁
- 如果删掉这段 fallback，是否更应该修上游合同或边界映射

只要工作涉及 fallback、兼容、环境探测、just-in-case 逻辑，立即联动 `predictable-behavior-first`。

### 4. 这是单一路径还是多路径继续膨胀

先回答：

- 当前实现能否收敛成一条显式主路径
- 是不是只因为“稳妥”就在保留旧实现
- 新旧两条路是否真的都还有长期价值
- 如果新 owner 已经确定，旧 owner、旧入口、兼容 adapter、alias、`asXxx()` 的删除点是什么

不要把“暂时先留着”当默认答案。

### 5. 这段代码真的该放在这里吗

先回答：

- 当前目录是不是正确的 feature root / 角色目录
- 文件主职责是什么
- 有没有现成位置可以直接复用，而不是新增散点
- 如果这是跨 workspace package 依赖，是否只通过对方 package 根公共入口导入，而不是 deep import 对方内部文件
- 依赖方向是否符合产品分层：前端/UI 不得依赖 kernel、core、runtime、service 这类后端/内核包；跨端契约、事件 key、纯类型和 UI 可消费常量应放在 `@nextclaw/shared`、client SDK 或专门的浏览器安全契约入口
- 如果 host/service 负责管理插件或 extension，包依赖只能服务分发、安装和 manifest 发现；host/service 禁止 import 具体插件/渠道的业务导出。静态能力读 manifest，动态能力走通用协议通信。
- 如果只是为了拿一个事件 key、类型或常量而引入更底层 package，必须先停止；这通常是严重边界错误，不是可接受的“更窄 import”问题
- 修复浏览器依赖错误时，禁止通过给前端补 Node polyfill、继续加 alias、或改成 kernel 子路径来绕过；应把契约移回真正共享层，或让前端使用已有 shared/client SDK
- 调整导航、侧边栏、菜单或入口时，默认保留既有可用入口和用户已接受的命名；除非用户明确要求删除或改名，否则只能新增/合并入口，不能顺手移除顶栏入口或擅自换标签；改完必须核对同一组既有入口，避免只恢复一个入口却漏掉相邻入口。

目录结构不清时联动 `collapsible-feature-root-architecture`。  
角色和命名不清时联动 `role-first-file-organization` 与 `file-naming-convention`。

### 6. 这是不是重复实现

先回答：

- 仓库里是否已经有可复用的 class / helper / component / primitive
- 如果不能直接复用，是否应该抽一个稳定共享核心
- 现在的实现是不是只比旧实现改了 10%，却复制了 90%

默认优先级：

- 直接复用
- 抽稳定共享核心
- 最后才是新增平行实现

### 7. 这是不是 effect / helper / util 越界

先回答：

- `useEffect` 是在同步外部系统，还是在偷偷做业务编排
- 普通函数有没有原地改入参
- helper / utils 里是不是偷偷长出了状态、缓存、重试、流程控制

如果有，先把逻辑收回 owner 层。

改完后必须用搜索检查是否出现外部 owner 赋值：`rg "params\\.[a-zA-Z0-9_]*(runtime|Runtime|gateway|Gateway|owner|Owner)\\.[a-zA-Z0-9_]+\\s*=" <touched paths>`。命中时默认未完成，除非该文件本身就是 owner class 且赋值发生在 `this.*` 上。

### 8. 最小可信验证是什么

先回答：

- 这个改动最贴近真实风险的验证路径是什么
- 如果这是 bugfix，怎么证明它真的解决了原问题
- 如果做不到真实链路验证，最小替代验证是什么

不要把“代码改了 + lint 绿了”当完成。

## 垃圾代码高频形态

以下模式默认都应视为危险信号：

- `if/else` 越补越多，但没人能说清主路径
- 为了通过当前 case，增加事故特判或日志关键字分支
- 业务逻辑散在组件、hook、effect 和 helper 之间，没有 owner
- 为了“先快一点”复制一份旧实现
- 为了一个字段手写完整接口 proxy，绝大多数方法只是原样转发
- 删除重复字段时只改成 getter alias，导致两个名字继续长期存在
- 导出 `createXxx()` 但函数体只是 `return new Xxx(...)` 或 `=> new Xxx(...)`，没有缓存、依赖注入、环境选择、异步初始化、权限封装等真实语义
- 新增 `XxxManager` / `XxxOwner`，但核心能力靠上层传 `createXxx` / `resolveXxx` / `getXxx` 完成，自己不持有领域闭环
- 为了迁移省事长期保留 `asOldXxx()`、旧 manager、旧 registry、旧 getter、旧入口和新入口并存
- 为了一个 UI 状态让 runtime、shell、server、router、controller 多层新增同名参数
- 为了一个新领域词发明一个新目录或新角色
- 用 `utils`、`helpers`、`common` 掩盖真实业务职责
- 这不是新增能力，但排除测试后的非测试代码净增还是正数
- 目录已经很平，但继续往里扔文件

## 决策顺序

在这个仓库里，默认按这个顺序做设计决策：

1. 先删减
2. 再简化
3. 再收敛 owner 和边界
4. 再判断这是语义建模还是结构搬运
5. 再决定目录落点和命名
6. 最后才是新增实现

如果当前方案跳过了前四步，直接来到“加一个新东西”，大概率就是风险信号。

## 需要联动的 skill

- fallback / compatibility / rescue path：`predictable-behavior-first`
- 目录结构 / 文件落点：`collapsible-feature-root-architecture`
- 文件角色 / 假目录 / barrel：`role-first-file-organization`
- 文件命名：`file-naming-convention`
- 复杂 debug：`long-chain-debugging`
- 复杂任务过程笔记：`iteration-work-notes`
- 改后主观可维护性复核：`post-edit-maintainability-review`

## 输出要求

使用这个 skill 时，在真正开始写代码前，至少先写清：

1. 这次准备删什么 / 不删的原因是什么
2. 这段逻辑的 owner 是谁
3. 这次是在语义 owner 上建模，还是在做结构搬运；若不是结构搬运，证据是什么
4. 是否引入或改名了类型 / 参数对象 / wrapper；如果是，它删除了哪个重复 contract 或新增了什么真实语义 owner，证据是什么
5. 新 owner 是否完整内聚；如果依赖上层传入 factory/deps，为什么这是必要外部边界而不是空心注入
6. 新 owner 的职责边界、感知范围、最小依赖和可配置/自定义表面分别是什么
7. 主路径是什么，为什么不是双路径；如果保留兼容路径，删除点是什么
8. 为什么这不是隐藏 fallback 或补丁式修复
9. 文件为什么放在这里
10. 最小可信验证是什么
11. 如果这不是新增能力，为什么最终能保证 `非测试代码净增 <= 0`
   同时说明准备在哪个相关责任链、旧实现或冗余路径上完成这次减债；若答案只是“我会把代码写得更紧一点”，说明方案仍不合格。

如果这些问题里有 2 个以上答不清，先不要写代码。

## 完成标准

只有同时满足以下条件，才算这次没有写出垃圾代码：

1. 旧路径、重复路径或无意义中间层已经优先评估过能否删除
2. 业务主逻辑有清晰 owner，而不是散落拼接
3. 没有为了“稳妥”保留无退出条件的 fallback / 双路径
4. 目录、文件角色与命名都能自解释
5. 改动后的复杂度增长已被压到最小
6. 验证方式能证明真实风险被覆盖
7. 如果这次不是新增用户能力，排除测试后的非测试代码净增已经小于等于 `0`
