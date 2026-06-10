---
name: mvp-view-logic-decoupling
description: 当设计或重构前端 MVP / presenter-manager-store 架构、Zustand store / persist、前端状态归属、view-logic 解耦、页面刷新状态恢复、localStorage/sessionStorage 替代、减少 prop drilling、业务组件内聚、自包含业务容器、业务编排层、多组件状态/动作协调、复杂 React hook/component 状态机、streaming/data-flow 协调或 RxJS 评估时使用。
---

# MVP View-Logic Decoupling

## 目标

用 Presenter / Manager / Store 结构让前端业务逻辑有清晰 owner，避免组件、hook、effect 和 prop 链条承载长期业务编排。

核心判断：

- store 拥有状态形状、持久化、校验和原子 setter。
- manager / presenter 拥有业务动作、跨模块编排、长期协作者依赖和意图级方法。
- business component 连接 store/query/presenter/manager，并派生 view props。
- UI component 保持纯展示、业务无关、可复用。
- 简单优先，但简单不等于把无关职责塞进一个对象。
- 简化原则：page/hook 只连接 owner，不决策业务转移；看到 page/hook 读多份状态后再调用多个 manager/store，优先收敛成一个 manager 意图方法。

## 状态与数据流归属

- 复杂业务逻辑、状态机、streaming flow、跨事件顺序控制默认进入 manager / store / presenter，优先进入 manager。
- hook 和组件主要连接 React 与 owner：订阅 store/query、调用 manager/presenter、承接轻量本地 UI 状态。
- 需要跨导航、刷新、跨组件复用或未来 manager 编排的前端状态，应进入 Zustand store，不应只放在 component/provider local state。
- 需要持久化的前端状态，默认使用 Zustand `persist`；不要在 provider/component 里手写 ad hoc `localStorage` / `sessionStorage` effect。
- 每个持久 store 应有对应 manager/presenter action owner：store 管状态，manager/presenter 管业务转移。
- 需要取消、缓冲、fan-in/fan-out、terminal event、retry 或严格顺序保证时，可以评估 RxJS；简单局部状态、一两个 effect 或纯视图交互不要引入 RxJS。

## 目标结构

1. 模块状态进入 `stores/` 下的 singleton Zustand store。
2. 每个稳定 store 或业务能力对应一个 manager class。
3. manager 暴露意图级 action 和必要的非订阅读取方法。
4. app-level presenter 作为长期 manager 装配根，镜像 backend kernel composition root。
5. 只有产品 surface 真正独立或根 presenter 过大时，才拆少数 top-level presenter。
6. 业务组件直接调用 presenter/manager 并订阅 store，避免深层业务 prop drilling。

## 组件边界

- `UI components`：纯展示、可复用；只接收 view props；不读业务 store/query，不调用 manager，不包含业务规则。
- `Business components`：连接 presenter/manager/store/query；派生 view props；按业务语义组织。
- `Business orchestration layer`：组合多个业务模块，让高层流程可读。
- `Feature implementation modules`：实现单个 feature 内部的稳定业务能力。

## 业务组件内聚

- 业务组件应在最贴近业务语义的位置自行订阅 store、读取 presenter、派生 view props，并只把收敛后的展示数据传给纯 UI 组件。
- 页面级或布局级父组件只负责区域组合、挂载条件和布局模式，不应成为为所有子组件装配 snapshot 字段、计数、派生状态和 presenter action 的参数中转站。
- 不要把 page 里的 store selector 原样搬进 page-owned aggregate hook；状态应下沉到最终消费它的业务组件/container，除非该 hook 本身就是这个业务组件的私有连接层。
- 当同一组业务状态或动作需要跨两层以上传递时，优先新增或收敛到业务 container，让该 container 直接连接 presenter/store，而不是继续向下传参。
- 不要为了“看起来可复用”把业务组件改成宽 props API；真正可复用的是纯 UI 组件，业务组件的可维护性来自明确 owner 和内聚的数据/动作访问。
- 简单优先不能成为职责混杂的理由；当一个 owner 同时承担多个独立变化原因时，应按真实职责拆分并解耦，而不是把所有逻辑塞进最近的现有对象。

## 纯展示组件边界

- MVP 只定义前端 `business component` 与 `UI component` 的职责边界，不单独决定“该不该拆”。
- 是否拆出纯展示组件，先按 `writing-beautiful-code` 的 `split-pays-for-itself` / `split-by-change-reason` 判断收益与损失，再按本 skill 确认拆出后是否仍满足 UI 组件业务无关、business component 连接 owner 的边界。

## Effect 边界

- `useEffect` / `useLayoutEffect` 只用于同步外部系统，例如 DOM/browser API、事件订阅、runtime resource setup/teardown。
- 不要用 effect 把 query 结果镜像进 store 或 local state。
- 如果确实建立 query store，只允许保存 query hook / SDK / API 返回的原始外部事实对象；禁止在 query sync hook 里拆字段、投影 view model、计算 selected/current/filtered 值后再写入其他 store。
- query store 的消费者应在最终业务组件、manager query method 或纯 utils 中现场计算衍生值；默认不得把 `selectedSession`、`modelOptions`、`sessionTypeLabel`、`childSessionTabs`、`isProviderResolved` 这类可由原始 query 推导的值同步回 interaction/thread/input store。
- query store 同步如果需要避免 React Query wrapper identity 造成重复写入，应把语义相等 no-op 放在写入 owner / manager 内；字段类别必须显式建模，禁止用字段名后缀、字符串约定或大段 hook 依赖数组来伪装稳定。
- 不要用 effect 在 render 后触发业务动作。
- 如果 effect 在重置多个业务状态，先把这个 transition 移到 manager method 或 presenter flow。
- 如果 effect 必须存在，应只把外部事件或 React 生命周期接入 owner；effect body 内不要展开业务分支、构造协议 payload 或直接写 store。

## 强制规则

1. manager / presenter 实例方法使用箭头函数 class field。
2. manager 文件导出 manager class，不导出 singleton instance；长期实例归 presenter 字段持有。
3. manager 是 presenter 下的平级业务 owner；manager 可以依赖另一个 manager，但不能创建、拥有或 lifecycle-manage 另一个 manager。
4. 稳定 manager-to-manager 依赖应由 presenter 通过 constructor injection 一次性装配；不要用 `bindXxxManager`、`installXxx`、`setXxxManager`、`afterXxx` callback、handler props 或 local port object 做二阶段 wiring。
5. 稳定 manager 依赖应直接 typed as manager itself；只需要一个方法通常也应直接依赖 manager。callback/function injection 只用于真实外部事件、可复用 library hook 或明确 pluggable boundary。
6. presenter 不做普通能力的一跳转发 facade。除非某方法是真正 top-level orchestration、跨 manager workflow 或 app-shell action，否则最近的业务 container 直接调用真实 manager owner。
7. 业务组件优先直接访问 presenter/manager/store，避免深层业务 prop drilling。
8. layout/page 不要组装宽 child prop bag；业务数据/action selection 下沉到最近业务 container。
9. 复杂 state-flow/data-flow 不留在 hook/component；进入 manager/store/presenter 后再考虑 RxJS。
10. reload-restorable frontend state 使用 Zustand `persist`，payload 必须小、可序列化、versioned，并在 rehydrate 时校验。

## 实现流程

1. 识别业务域和状态归属。
2. 判断状态是否需要 store，是否需要 `persist`。
3. 判断业务动作和跨模块协作的 manager owner。
4. 在 app-level presenter 中一次性装配稳定 manager 依赖。
5. 让业务组件直接连接 owner，删除不必要的 props 转发。
6. 收缩 effect 到外部系统同步。
7. 纯 UI 组件拆分先按 `writing-beautiful-code` 判断是否值得，再按 MVP 边界落位。
8. 删除重复的数据/action plumbing。

## 重构检查

1. UI component 是否仍然导入 presenter/manager/store。
2. business component 是否还在做无意义 prop relay。
3. 每个 store 是否只有一个清晰 manager/action owner。
4. manager/presenter 方法是否是箭头函数。
5. manager 文件是否导出了 singleton manager instance。
6. manager constructor 是否只接收稳定 manager/infra 依赖，并由 app-level presenter 装配。
7. presenter 是否存在普通一跳 forwarding facade。
8. 每个 touched owner 是否只有一个清晰职责或紧密内聚的职责集。
9. 是否出现 `bindXxx`、`installXxx`、`setXxxManager`、`afterXxx`、handler object 或 local port 来连接稳定内部 manager。
10. business component 是否用 effect 镜像 query/store 数据或触发业务动作。
11. layout/page 是否收集宽 snapshot/action prop bag。
12. 纯展示组件拆分是否已按 `writing-beautiful-code` 判断收益大于成本。
13. reload-restorable frontend state 是否使用 Zustand `persist`。
14. store selector 是否只是从 page 搬进 page hook；如果是，必须继续下沉到最终消费的业务 component/container。

## 反模式

- 把业务逻辑放进 UI component。
- 同一能力在多个 manager 里重复实现。
- 多层传递业务 action/state，而最近业务 container 本可以直接连接 owner。
- page/layout 变成手动 props assembler。
- 为了“可复用”把业务组件改成宽 props API。
- 每个 domain 都创建 feature-level presenter。
- 为了统一调用面，把普通 manager 能力包到 presenter 转发方法里。
- 把“简单”理解成“所有东西塞进一个 owner”。
- manager 创建或拥有另一个 manager。
- 用 callback、local port、handler object 或二阶段 bind 隐藏稳定 manager 协作。
- 用 prototype method 写 manager/presenter 实例方法。
- 用 effect 作为业务补丁点。
- 绕过 `writing-beautiful-code` 的拆分收益判断，为了理论洁癖拆纯展示组件，结果只新增 props 搬运和阅读跳转。
- 用手写 storage effect 持久化共享/可恢复前端状态。
