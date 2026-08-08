---
name: nextclaw-clean-implementation
description: 在本仓库修改源码、脚本、测试或运行链路配置前使用；用于阻止补丁式分支、重复路径、错误 owner、空心抽象、不必要兼容和文件落点错误，并以最少问题完成实现前判断。
---

# NextClaw 干净实现

## 定位

本 skill 是实现前的短检查，不是架构原则全集。只回答与当前 diff 有关的问题；专项规则按触达面加载，不重复抄写 AGENTS 或其它 skill。

## 五个问题

### 1. 能删或复用什么

- 是否已有主路径、组件、contract、owner 或工具可以直接使用？
- 是否能删除旧分支、重复入口或无意义中间层后完成目标？
- 若没有真实可删项，直接实现最小清晰改动，不向无关模块扩张来抵消行数。

必要、安全、清晰的代码增长允许存在。行数是观察信号，不是普通 bugfix 的硬目标；禁止用压行数、弱化命名、移除类型/协议保护或无关重构制造“净减”。

### 2. 正确 owner 是谁

- 业务规则、状态、不变量和生命周期应归拥有这些事实的 class/manager/service/store/presenter。
- 路由、bridge、组件、hook 或 helper 只是路过数据时，不应承接跨域业务编排。
- owner 自己能稳定推导的创建、缓存、恢复、reload、dispose 等职责不能被拆成 create/resolve/get 参数从上层注入。
- 普通函数只保留纯工具和纯计算；状态与生命周期回到 owner。

涉及 owner、生命周期或架构边界时加载 classic-software-design-principles；涉及 kernel/manager/service/store/presenter 主干关系时加载 kernel-branch-owner-architecture。

### 3. 是语义建模还是结构搬运

- 新类型、参数对象、wrapper、adapter、factory 或 service 是否新增真实语义、协议转换、策略、状态或生命周期？
- 若只是转发字段、改名、包装 new、代理一个方法或让目录看起来合规，默认删除并回到现有 owner。
- 新增公共 API、类型或 export 后必须确认本次主路径或明确外部 contract 有调用方。

### 4. 是否保持单一路径

- 同一事实、事件、状态变化或传输语义只保留一个标准入口。
- fallback/compatibility/rescue path 仅在真实外部边界、明确迁移窗口或运行态缺失存在时成立，并写清可观察错误和删除条件。
- 上游 contract 错误不能靠下游 alias、normalize 或静默 fallback 掩盖。

涉及 fallback、兼容或恢复时加载 predictable-behavior-first。

### 5. 文件是否放对位置

- 只有新增、重命名、移动文件或改变角色/目录边界时，才加载 file-naming-convention、role-first-file-organization、collapsible-feature-root-architecture、file-organization-governance 并运行 planned-path preflight。
- 局部修改现有文件不重复加载整套目录治理。
- 跨 workspace 依赖只走公共入口或 exports；前端不依赖 kernel/runtime/server 内部实现。
- 前端用户文案走 i18n owner；基础组件保持展示与业务解耦；React effect 只同步外部系统。

## 实现要求

- 先让主流程可见，再决定是否需要抽象。
- 不新增平行 helper、wrapper、proxy、publisher 或重复组件。
- 不原地修改普通函数入参；owner 状态通过 owner 的意图方法改变。
- 对象合同保持直接、稳定，不用条件 spread 隐藏形状变化。
- 目标外公共 contract、命名、格式和目录保持不动，除非当前目标确实需要。

## 输出与完成

动手前只需用短句说明：

- 可删/复用项；
- owner；
- 主路径；
- 文件落点；
- 最小可信验证。

只有出现新增抽象、兼容路径、跨层传递或结构变化时才展开理由。普通局部改动不得输出十二项问卷。

完成标准：

- 没有新增不必要路径或抽象；
- owner 和文件角色清楚；
- 必要增长保持最小、清晰、安全；
- 验证覆盖本次真实风险。
