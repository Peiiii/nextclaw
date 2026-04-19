# 前端系统状态统一收口设计

**Goal:** 为 `packages/nextclaw-ui` 建立一个唯一的“系统状态” owner，把前端与后端交互相关的全局运行状态统一收口到同一个 `manager + store` 中，避免聊天页、布局入口、runtime control、传输层与查询层各自持有一份局部解释。

**Scope:** 本次设计只覆盖“前端与后端交互所形成的系统级状态”，包括 runtime bootstrap、连接与恢复、传输失败、服务管理状态、全局可用性与面向用户的系统状态文案。聊天输入草稿、局部 loading、hover、popover 开关、某个卡片的局部 busy 态、消息列表滚动位置等纯 UI/局部业务状态，不属于本次统一范围。

**Non-goals:**
- 不把整个前端做成一个巨型全局 store
- 不把聊天领域自己的局部状态并入系统状态模块
- 不在本方案里同时重构所有 presenter / manager 组织方式
- 不在本次直接改 remote access、shared web 等其它宿主形态的完整状态合同

## 与产品愿景的关系

这次整改不是单纯的前端整理，而是在补 NextClaw 作为“个人操作层”的一个基础能力：系统必须先知道自己当前是否可用、卡在哪里、是否正在恢复、服务是否需要管理动作，用户才能通过统一入口自然地理解并掌控系统。

如果系统状态散落在聊天页、配置页、布局入口和底层 transport 各处，那么：

- 用户看到的是碎片化解释，不是统一系统认知
- 前端无法形成稳定的“自感知”
- 后续自治控制也会继续分裂

所以这次设计的核心目标不是“多加一个 store”，而是把“系统状态”真正提升为一个稳定的一等领域。

## 现状结论

当前仓库里并不是完全没有集中化，只是只有“局部集中”，还没有形成真正的系统状态总 owner。

### 已经相对集中的部分

当前 `runtime-lifecycle/` 已经具备一个较清晰的 manager/store 雏形：

- `packages/nextclaw-ui/src/runtime-lifecycle/runtime-lifecycle.manager.ts`
- `packages/nextclaw-ui/src/runtime-lifecycle/runtime-lifecycle.store.ts`
- `packages/nextclaw-ui/src/runtime-lifecycle/hooks/use-runtime-lifecycle-status.ts`

它已经在统一解释以下事实：

- bootstrap status
- websocket 连接中断与恢复
- fetch / stream / NCP request transport failure

这部分是很好的起点，但它只覆盖了“运行时生命周期”这一条线。

### 当前真正的问题

系统状态仍然分散在多个并行入口：

1. `runtime-lifecycle` 维护一份运行态解释
2. 聊天页又把 `chatRuntimeBlocked / chatRuntimeMessage` 镜像进 chat store
3. `runtime-control` 又维护一套平行的服务管理与 lifecycle 解释
4. 布局入口 `runtime-status-entry` 直接读 `useRuntimeControl()`，并不消费统一系统态
5. `runtime-control-card` 还叠加了一层本地 `localLifecycle / localServiceState / localMessage`

这意味着同一个系统事实，至少正在被三层重复解释：

- 底层 transport / bootstrap 事实
- runtime lifecycle 语义
- 页面/卡片级的二次状态拼接

## 现状中的具体扩散点

### 1. 聊天页存在系统状态镜像

当前 `NcpChatPage` 会先读取 `useRuntimeLifecycleStatus()`，再把结果同步到聊天 store：

- `packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-page.tsx`
- `packages/nextclaw-ui/src/components/chat/ncp/page/ncp-chat-derived-state.ts`
- `packages/nextclaw-ui/src/components/chat/stores/chat-input.store.ts`
- `packages/nextclaw-ui/src/components/chat/stores/chat-thread.store.ts`

`chatRuntimeBlocked` 和 `chatRuntimeMessage` 这两个字段，本质上不是聊天领域自己的状态，而是系统状态在聊天页的镜像副本。

这会导致三个问题：

- 同一事实被复制进多个 store，形成漂移风险
- 聊天 store 被迫承担本不属于它的系统语义
- 后续别的模块如果也要用，容易继续复制第三份、第四份

### 2. runtime control 与 runtime lifecycle 平行存在

当前 runtime management 相关能力来自另一条完全独立的链路：

- `packages/nextclaw-ui/src/runtime-control/runtime-control.manager.ts`
- `packages/nextclaw-ui/src/hooks/use-runtime-control.ts`
- `packages/nextclaw-ui/src/components/config/runtime-control-card.tsx`
- `packages/nextclaw-ui/src/components/layout/runtime-status-entry.tsx`

这一组代码持有的是：

- 当前环境是否支持 start / stop / restart
- 当前 serviceState / lifecycle
- pendingRestart
- runtime message

但这些内容与 `runtime-lifecycle` 一样，也是在描述“系统现在处于什么状态”，只是它们没有进入统一 owner。

### 3. 组件仍在做产品态拼接

当前多个消费方仍然自己拼系统语义，而不是只消费统一派生结果：

- 聊天页自己组合 `runtimeLifecycle.phase`、发送错误与禁发逻辑
- header / layout 自己决定 status tone
- runtime control card 自己维护“本地恢复中”“本地失败中”的临时态

这说明我们现在拥有的是“分布式解释”，不是“统一系统状态”。

## 问题本质

当前真正缺的不是某一个 hook，而是领域边界。

现在前端里混在一起的是两类东西：

1. 系统状态
   - 由后端交互、运行时连接、服务管理、恢复过程决定
   - 影响多个页面和多个入口
   - 应该有唯一 owner
2. 局部业务 / UI 状态
   - 只影响某个 feature 或某个组件
   - 不应该上升成系统级真相

只要这条边界不立起来，后面无论再写多少 hook，状态仍然会散。

## 设计原则

### 1. 系统状态必须有唯一 owner

前端里凡是描述“系统当前是否可用、为何不可用、是否在恢复、是否需要服务管理动作、是否有全局阻塞”的状态，都必须由同一个领域模块统一持有。

### 2. 系统状态不允许镜像进 feature store

聊天页、配置页、布局入口可以消费系统状态，但不能把系统状态复制进自己的 store 里保存。

允许存在 selector 级视图适配，不允许存在持久镜像副本。

### 3. 底层事实与产品态必须分层

`manager` 负责接收事实并派生产品态：

- bootstrap facts
- realtime connection facts
- transport failure facts
- runtime control facts
- service action facts

组件不负责自己解释这些事实的产品语义。

### 4. 只统一真正的系统状态

以下内容应纳入统一系统状态：

- runtime bootstrap readiness
- 全局连接 / 恢复 / 卡死状态
- 最近一次 transport 级失败
- 当前 runtime control view
- 服务启动 / 停止 / 重启 / app restart 带来的全局系统阶段
- 会影响多处交互的“系统级阻塞”与说明文案

以下内容不应纳入：

- 输入框草稿、附件、选中的模型
- 某个 popover 是否展开
- 某个按钮 hover / pressed
- 某个卡片内部 tab
- 纯展示性的 skeleton / loading 动画
- 只对单个 feature 有意义的局部表单状态

### 5. 禁止“组件先拼一版，后面再统一”

系统状态属于横切领域，一旦允许页面先自带一版临时解释，后面几乎一定会演化成新一份事实源。这个领域必须从第一步起就明确 owner。

## 方案比较

### 方案 A：继续保留 `runtime-lifecycle`，只删除聊天页镜像

做法：

- 保留现有 `runtime-lifecycle`
- 删除 chat store 中的 `chatRuntimeBlocked / chatRuntimeMessage`
- 让聊天页直接消费 runtime lifecycle selector

优点：

- 改动最小
- 能立刻止住聊天页的状态镜像扩散

缺点：

- `runtime-control` 仍然是另一套平行系统状态
- header / config / chat 之间仍缺统一真相
- 只是止血，不是收口

### 方案 B：建立统一 `system-status` feature root

做法：

- 新建一个真正的系统状态模块
- 把 `runtime-lifecycle` 视为这个模块里的一个子职责，而不是完整总 owner
- 把 runtime control、transport、bootstrap、恢复态都并入统一 manager/store
- 所有消费方只订阅系统状态 selector

优点：

- 真正形成唯一 owner
- 明确区分系统状态与 feature 状态
- 后续扩展到更多系统态时不再继续散落

缺点：

- 首次改造范围比方案 A 大
- 需要重新梳理 runtime control 的接入方式

### 方案 C：做一个 giant app store，把所有状态都丢进去

不推荐。

原因：

- 会把系统状态与业务状态重新混在一起
- 表面统一，实际只是更大的散乱
- 长期只会制造新的 God object

### 推荐结论

推荐采用 **方案 B**。

因为用户这次提的目标不是“先别让聊天页抄状态”，而是“要有统一管理系统状态的 manager 和 store，并且要收口，不要分散”。这要求的是领域重构，不是局部修补。

## 推荐架构

新增顶层 feature root：

```text
packages/nextclaw-ui/src/system-status/
├── system-status.types.ts
├── system-status.store.ts
├── system-status.manager.ts
├── system-status.selectors.ts
├── hooks/
│   ├── use-system-status.ts
│   ├── use-chat-runtime-availability.ts
│   ├── use-runtime-status-badge.ts
│   └── use-runtime-control-view.ts
└── adapters/
    ├── system-status-bootstrap.adapter.ts
    ├── system-status-transport.adapter.ts
    └── system-status-runtime-control.adapter.ts
```

说明：

- `system-status.manager.ts`
  - 唯一业务 owner
  - 接收所有后端交互事实
  - 负责状态迁移与产品态解释
- `system-status.store.ts`
  - 唯一系统状态 store
  - 只保存系统级真相与少量必要记忆
- `system-status.selectors.ts`
  - 派生不同消费视图
  - 负责“聊天可用性”“header badge”“runtime control card view”等只读视图拼装
- `hooks/`
  - 只暴露 selector 订阅读取能力
- `adapters/`
  - 负责把现有事实源接进 manager

## 状态模型设计

### Raw facts

store 内部应先保存“事实层”，而不是一上来只存 UI 文案：

- `bootstrapStatus`
- `bootstrapQueryState`
- `connectionState`
- `lastTransportError`
- `hasReachedReady`
- `lastReadyAt`
- `recoveryStartedAt`
- `runtimeControlView`
- `activeSystemAction`
- `lastSystemActionError`

这里的原则是：

- 存领域事实
- 不存组件文案拼装结果
- 不存 feature 私有局部状态

### Derived product state

在 selector 层统一派生：

- `systemPhase`
  - `cold-starting`
  - `ready`
  - `recovering`
  - `stalled`
  - `startup-failed`
  - `service-transitioning`
- `chatAvailabilityView`
  - `isBlocked`
  - `message`
- `runtimeStatusBadgeView`
  - `tone`
  - `title`
  - `description`
  - `actionLabel`
- `runtimeControlPanelView`
  - 当前可见动作
  - 当前 lifecycle 文案
  - 当前 serviceState 文案
  - busy / error / recovering 说明

重点是：这些视图都来自同一个 store，而不是来自不同模块各自加工。

## manager 职责

`SystemStatusManager` 负责四件事：

### 1. 接收外部事实

典型入口包括：

- `reportBootstrapStatus(...)`
- `reportBootstrapQueryError(...)`
- `handleConnectionInterrupted(...)`
- `handleConnectionRestored(...)`
- `reportTransportFailure(...)`
- `reportRuntimeControlView(...)`
- `startSystemAction(...)`
- `completeSystemAction(...)`
- `failSystemAction(...)`

### 2. 维护必要历史记忆

例如：

- 是否曾经 ready 过
- 最近一次 ready 时间
- 恢复从何时开始

这些历史记忆对区分“冷启动”和“运行中断开”是必要的，不能交给组件自己猜。

### 3. 派生全局系统阶段

例如：

- 未 ready 且 bootstrap 仍在进行中 -> `cold-starting`
- ready 过后发生中断 -> `recovering`
- recovering 超时 -> `stalled`
- 首次 ready 前明确失败 -> `startup-failed`
- 用户触发 start / restart / stop / restart-app 且处于执行中 -> `service-transitioning`

### 4. 管理系统动作期状态

当前 `runtime-control-card` 自己维护的本地过渡态，本质上也是系统状态的一部分，应迁回 manager/store：

- 正在重启服务
- 正在等待恢复
- 服务动作失败

这样 header、chat、config 才能看到同一份系统现实。

## consumer 规则

### 聊天域

聊天组件可以消费系统状态，但不能再存以下字段：

- `chatRuntimeBlocked`
- `chatRuntimeMessage`

聊天页应改为直接订阅 `useChatRuntimeAvailability()` 一类 selector。

chat store 只保留聊天自己的状态，例如：

- draft
- sendError
- selectedModel
- pendingSessionType
- thread display state

### 布局与头部入口

`RuntimeStatusEntry` 不再直接依赖 `useRuntimeControl()` 解释状态，而是改为消费统一 badge selector。

### 配置与系统管理页

`RuntimeControlCard` 不再本地拼一套 `localLifecycle / localServiceState / localMessage`，而是改为：

- 动作由 `SystemStatusManager` 协调
- 视图从统一 selector 获取

### 底层 transport 与 query bridge

底层层只上报事实，不自己决定产品态。

## 与现有 `runtime-lifecycle` 的关系

`runtime-lifecycle` 不应该继续作为最终总入口存在。

推荐路径是：

1. 第一阶段把它作为迁移桥接层保留
2. 第二阶段把其中状态机逻辑迁入 `system-status.manager.ts`
3. 最终删除 `runtime-lifecycle` 目录，或把它降级成 `system-status` 的内部子文件，而不是独立 feature

换句话说，`runtime-lifecycle` 是一个很好的起点，但不是最终形态。

## 命名建议

这次新模块建议弱化 `snapshot` 这个词。

原因：

- 它容易让人误解成“一次性抓拍结果”
- 这个领域本质上持有的是持续演进中的系统状态

推荐优先使用：

- `SystemStatusState`
- `SystemStatusView`
- `setStatePatch(...)` 或同等清晰命名

如果为了与现有 store 风格保持一致，短期仍保留 `snapshot` 字段，也应把它限制为 store 内部实现细节，不再把 `snapshot` 当作对外领域名词推广。

## 迁移计划

### Phase 1：建立统一模块骨架

- 新建 `system-status/` feature root
- 把现有 runtime lifecycle 状态机逻辑迁入 `SystemStatusManager`
- 保持对外兼容 selector，先不大面积改调用点

目标：

- 先建立唯一 owner
- 不再新增新的系统状态散点

### Phase 2：切断聊天镜像

- 删除 `chat-input.store.ts` 和 `chat-thread.store.ts` 中的系统状态字段
- 删除 `useNcpChatSnapshotSync(...)` 里对系统状态的同步写入
- 聊天页直接消费系统状态 selector

目标：

- 系统状态不再进入聊天 store

### Phase 3：合并 runtime control

- 让 `useRuntimeControl()` 从“直接给组件的查询 hook”退回为系统状态输入源
- `RuntimeStatusEntry`、`RuntimeControlCard` 改为读取统一 selector
- 把本地 `localLifecycle / localServiceState / localMessage` 收回 manager/store

目标：

- 服务管理态与运行时态形成同一个系统真相

### Phase 4：删掉旧入口与重复语义

- 清理旧 `runtime-lifecycle` 独立暴露层
- 清理重复的文案拼装和状态 mapping
- 为后续更多系统态扩展预留入口

目标：

- 完成真正的统一收口

## 验证计划

### 单元 / 状态机验证

至少覆盖以下场景：

- 冷启动期间 transport failure 不误判为 recovering
- ready 之后断开才进入 recovering
- recovering 超时进入 stalled
- 首次 ready 前 bootstrap 明确失败进入 startup-failed
- service restart / start / stop 期间系统态正确迁移
- service action 失败后 header / chat / control panel 看到同一错误结果

### 组件级验证

- 聊天页禁发与提示只来自统一 selector
- header badge 与 runtime control card 展示一致
- config 页动作执行中与恢复中不再依赖本地拼装状态

### 治理验证

整改完成后应能满足以下约束：

- 不再有系统状态字段出现在 chat store 中
- 不再有多个组件各自维护 runtime lifecycle 真相
- 不再有 runtime control 与 runtime lifecycle 两套平行 owner

## 风险与注意事项

### 1. 不要为了“统一”把局部 UI 状态也卷进来

这是最容易走偏的地方。系统状态统一，不等于全局状态统一。

### 2. 不要让 selector 成为新的隐藏 owner

selector 只能做派生，不应偷偷持有独立状态。

### 3. 不要保留长期双轨

如果 `runtime-lifecycle` 和 `system-status` 长期并存，只会形成新的重复解释。桥接期可以接受，长期并存不可以接受。

### 4. 不要把组件本地 optimistic 状态继续当成系统真相

只要一个状态会影响多个入口理解系统，就必须进统一 manager/store。

## 最终结论

当前前端已经有 `runtime-lifecycle` 这个较好的雏形，但它还不是“系统状态总线”，只能算“运行时生命周期局部 owner”。

真正需要的整改方向是：

- 建立唯一的 `system-status manager + store`
- 只把前后端交互形成的系统级状态收口进去
- 停止把系统状态镜像进聊天 store
- 把 runtime control 也并入同一个系统状态领域
- 让所有消费方只读统一 selector，而不是自己再拼一版

这条路径比继续局部修修补补更符合长期方向，也更符合 NextClaw 作为统一入口、自感知系统与自治控制面的产品目标。
