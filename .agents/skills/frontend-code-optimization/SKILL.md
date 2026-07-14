---
name: frontend-code-optimization
description: 当用户要求前端代码优化、前端可维护性治理、组件拆分、逻辑拆分、视图逻辑解耦、MVP / presenter-manager-store 落地、prop 透传改造、页面/组件代码爆炸 review、React 组件职责收敛、前端重构优先级排序，或指出某个前端 Page/Component 可维护性爆炸时使用。用于把前端优化任务先诊断、排序，再按非新增功能净减约束实施。
---

# Frontend Code Optimization

## 定位

这是前端代码优化的入口 skill，负责把“这个前端代码很烂/很大/很难维护”转成可执行的 review 与重构顺序。

它不替代专项 skill，而是先做路由和优先级判断。凡是输出 review finding、改造方案或落地代码，必须在对应问题旁引用使用了哪个专项 skill 作为规范依据。

## 必须引用的规范 owner

- 架构、owner、职责边界：读取并引用 [classic-software-design-principles](../classic-software-design-principles/SKILL.md)。
- MVP、view-logic、store/manager/presenter、prop drilling：读取并引用 [mvp-view-logic-decoupling](../mvp-view-logic-decoupling/SKILL.md)。
- 组件拆分、逻辑拆分、抽象必要性、代码审美：读取并引用 [writing-beautiful-code](../writing-beautiful-code/SKILL.md)。
- 实现前删减、owner、fallback、helper/utils 越界：读取并引用 [nextclaw-clean-implementation](../nextclaw-clean-implementation/SKILL.md)。
- 样式 owner、shared UI、响应式/视觉状态：涉及时读取并引用 [frontend-style-encapsulation](../frontend-style-encapsulation/SKILL.md)。
- 交互语义、tooltip、键盘可达性、loading/disabled/empty/error 反馈：涉及时读取并引用 [frontend-interaction-quality](../frontend-interaction-quality/SKILL.md)。
- React 组件类型、key、streaming DOM 连续性、焦点/选区或 iframe/editor 实例保持：涉及时读取并引用 [react-rendering-lifecycle-safety](../react-rendering-lifecycle-safety/SKILL.md)。
- 文件新增、移动、命名、目录落位：涉及时读取并引用 [file-naming-convention](../file-naming-convention/SKILL.md)、[role-first-file-organization](../role-first-file-organization/SKILL.md)、[collapsible-feature-root-architecture](../collapsible-feature-root-architecture/SKILL.md)。
- 验证与收尾：实现后读取并引用 [nextclaw-validation-workflow](../nextclaw-validation-workflow/SKILL.md)、[post-edit-maintainability-guard](../post-edit-maintainability-guard/SKILL.md)、[post-edit-maintainability-review](../post-edit-maintainability-review/SKILL.md)。

引用方式要求：不要只写“按规范”；必须写出命中的 skill 名称和该 skill 中支撑判断的原则或规则名，例如 `mvp-view-logic-decoupling: layout/page 不要组装宽 child prop bag`。

## 核心原则

- 非新增用户能力时，排除纯格式化噪音后的非测试语义代码默认只能净减少；做不到就先说明无收益或申请豁免。
- 先删重复、合并链路、收敛 owner，再考虑新增抽象。
- 不因为文件长就机械拆分；只按变化原因、状态归属、生命周期、不变量和复用边界拆。
- 不新增 `ViewModel`、`Presenter`、`Manager`、`Hook`、`Context` 来包装混乱；新 owner 必须减少真实复杂度，并删除更多旧代码或更宽的 prop 面。
- 命名必须语义化、无歧义、清晰简洁，能直接识别职责。
- Page/Layout 默认只组合区域、路由和少量页面级状态；业务状态、动作和派生逻辑应下沉到最近业务 container、store、manager 或 presenter。

## 诊断顺序

### 1. 画清当前主链路

先用代码证据列出：

- 数据来源：query/store/props/API/local state。
- 状态 owner：哪些状态在 page、hook、component、store、manager。
- 动作流：用户点击后经过哪些函数、mutation、confirm、toast、router、doc/browser。
- 展示流：原始数据如何变成 entry、summary、badge、empty/error/loading。
- 传参面：哪些 props 只是中转，哪些 props 是真实 UI contract。

只看局部文件时只能给阶段性判断；对 owner、链路、状态归属下确定结论前，要追到生产者和消费者。

### 2. 按四类问题分类

**逻辑视图解耦（MVP）**

规范依据必须引用 `mvp-view-logic-decoupling`；涉及 owner 原则时同时引用 `classic-software-design-principles`。

- Page/hook 是否同时读多份状态后调用多个 manager/store。
- `useEffect` 是否在做业务编排、状态镜像、query 结果搬运或转移状态。
- 状态是否需要跨导航、刷新、组件复用或未来 manager 编排；需要则考虑 store/persist。
- 业务动作是否应是 manager/presenter 意图方法，而不是散落在事件 handler。

**组件拆分**

规范依据必须引用 `writing-beautiful-code`；拆出 UI/shared 组件时同时引用 `frontend-style-encapsulation`。

- 拆分依据是变化原因、复用边界、展示骨架稳定性，而不是行数。
- 纯 UI component 不读业务 store/query、不调用 manager、不内嵌业务文案。
- business component/container 可以读 store/query/presenter，并把收敛后的 view props 传给纯 UI。
- 拆分后如果只是新增名字、props 搬运和文件跳转，默认不拆。

**逻辑拆分**

规范依据必须引用 `writing-beautiful-code` 与 `nextclaw-clean-implementation`；涉及 owner 闭环时同时引用 `classic-software-design-principles`。

- 纯计算、稳定映射和排序过滤可以进入明确命名的数据 builder。
- 有状态、生命周期、请求竞态、confirm/mutation/toast、跨模块编排的逻辑不进 utils；应归业务 owner。
- 详情打开、安装管理、路由派生、列表 entry 构造等稳定业务流程，优先寻找已有 feature owner。
- 不用 helper 把业务逻辑从组件搬到另一个无 owner 的文件里。

**prop 透传改造**

规范依据必须引用 `mvp-view-logic-decoupling`；涉及父子 owner 关系时同时引用 `classic-software-design-principles`。

- 同一组状态或动作穿过两层以上，优先让最近业务 container 直接连接 owner。
- 宽 prop bag 优先收敛成语义 entry / action owner，而不是继续拆成更多小 props。
- 父组件只做区域组合，不替所有子组件组装 snapshot、计数、派生 label 和 handler。
- 不默认引入 React context；context 只用于稳定横切能力，不用于遮盖局部 prop drilling。

### 3. 按优先级排序

- P0：正确性、状态错配、竞态、合同不一致、隐藏 fallback、用户可见行为风险。
- P1：owner 泄露、page 变成业务 assembler、宽 prop bag、重复状态源、重复 action 计算。
- P2：组件/逻辑拆分收益明确，能删除重复 JSX、重复派生、重复事件处理或无意义中转。
- P3：样式/交互一致性、可访问性、tooltip、loading/empty/error 表达等体验质量问题。

每条建议必须说明命中的原则、证据位置、正确 owner、最小改法、预期删除或收敛什么。

## 实施规则

1. 一次只做一个可验证 vertical slice；每做完一个 slice 先自 review。
2. 动手前写出“删除点 / 收敛点 / 正确 owner / 验收方式”。
3. 新增文件或抽象前，必须证明它比留在原处更少、更清楚，并且不是空心中转。
4. 优先删除重复计算、重复 target id、重复 entry 构造、重复 loading/empty/error 骨架。
5. 优先把宽 props 改成更小的语义对象或让业务 container 直接连接 owner。
6. 保留可读性，不靠缩短命名、合并语句、折叠分支来凑净减。
7. 修改用户可见 UI 行为时，必须有定向测试或浏览器/DOM 验证。

## 输出合同

做 review 时输出：

- findings-first，按 P0/P1/P2/P3 排序。
- 每条包含文件证据、风险、引用的 skill/规则、正确 owner、最小修复方向。
- 给出按优先级排序的实施计划。
- 明确哪些项如果无法净减则不做。

做实现时输出：

- 本次 slice 引用了哪些 skill、命中了哪些规则、owner 判断是什么。
- 代码增减与非测试语义代码增减。
- 正向减债动作：删除 / 简化 / 复用 / 职责收敛 / 必要解耦抽象。
- 定向验证、`tsc`、governance、maintainability guard/review 结果。
- 若没有新增用户能力但非测试语义代码净增为正，结论必须是未通过，除非有明确豁免。
