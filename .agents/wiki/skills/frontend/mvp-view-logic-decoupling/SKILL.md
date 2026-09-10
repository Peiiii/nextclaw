---
name: mvp-view-logic-decoupling
description: 当设计或重构前端 presenter/manager/store、Zustand 持久化、状态归属、view logic、业务组件内聚、prop drilling、复杂 hook/state-flow 或 RxJS 边界时使用。
---

# MVP View-Logic Decoupling

## Owner 模型

- store：状态形状、校验、持久化和原子 setter。
- manager/presenter：业务动作、状态转移、跨模块编排、长期协作者和意图级方法。
- business component：连接 owner/query，派生 view props。
- UI component：纯展示、业务无关、可复用。

页面和 hook 只连接 owner，不自行读取多份状态后拼业务流程。复杂状态机、streaming、跨事件顺序、取消、缓冲、fan-in/out、terminal event 和 retry 优先进入 manager；只有这些复杂性真实存在时才评估 RxJS。

## 状态与装配

- 跨导航、刷新或多组件复用的状态进入 singleton Zustand store；需要持久化时使用 `persist`，payload 小、可序列化、versioned，rehydrate 时校验。不要在组件/provider 手写 storage effect。
- 每个 store/业务能力有清晰 action owner。store 存状态，manager/presenter 负责业务转移。
- app-level presenter 是长期 manager composition root；只有产品 surface 真正独立或根 presenter 过大时才增加少数 top-level presenter。
- manager class 由文件导出，实例归 presenter 字段；实例方法使用箭头 class field。
- manager 是 presenter 下的平级 owner。稳定 manager 依赖由 presenter constructor 一次装配，并直接 typed 为 manager；不得互相创建或 lifecycle-manage，也不用 `bind/install/setXxxManager`、callback、handler object 或 local port 做二阶段 wiring。
- presenter 不做普通能力的一跳 facade；只有 top-level orchestration、跨 manager workflow 或 app-shell action 才由 presenter 暴露。

## 组件内聚

- 业务组件在最接近语义的位置订阅 store、访问 manager、派生 props；页面/layout 只负责区域组合、挂载条件和布局，不组装宽 snapshot/action prop bag。
- 同组业务状态或动作跨两层传递时，优先让最近业务 container 直接连接 owner。不要把 page selectors 机械搬进 page-owned aggregate hook。
- 真正可复用的是纯 UI 骨架；不要为“可复用”把业务组件变成宽 props API。
- UI component 不读业务 store/query、不调用 manager、不理解领域状态；business component 继续复用 UI primitive。
- 是否拆展示组件先证明变化原因、复用或主流程可见性收益大于 props、命名和跳转成本，再由本合同确定拆后职责。

## Effect 边界

- effect 只同步 DOM/browser API、订阅和 runtime resource 等外部系统，不在 render 后触发业务动作。
- 不把 query 结果镜像进 local state 或业务 store。若确有 query store，只保存 API/SDK 的原始外部事实；selected/current/filtered/label/options 等衍生值在最终组件、manager query 或纯函数现场计算。
- 语义相等的 no-op 属于写入 owner/manager；字段类别显式建模，不以字段名后缀和超长依赖数组伪装稳定。
- effect 若重置多个业务状态，把 transition 收敛为 manager 意图方法；保留的 effect body 只把外部事件交给 owner，不拼 payload 和业务分支。

## 实现与检查

按 `识别领域/状态 -> 决定 store/persist -> 决定 action owner -> presenter 装配 -> 业务组件直连 -> 收缩 effect -> 删除 plumbing` 实施。

收尾核对：

- UI component 是否仍导入业务 owner；business component/page 是否仍 relay 宽 props；
- 一个事实或 store 是否有多个 action owner；
- manager 是否导出 singleton、创建另一 manager、使用 prototype method 或二阶段 wiring；
- presenter 是否只做一跳转发；
- effect 是否镜像数据或执行业务动作；
- 可恢复状态是否 persist，query store 是否保存了派生 view model；
- 拆分是否只增加 props、参数搬运和跳转。
