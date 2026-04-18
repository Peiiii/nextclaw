# NextClaw UI Runtime Lifecycle Coordinator Design

**Goal:** 为本地 NextClaw UI 建立统一的运行时生命周期协调层，正确区分冷启动、正常可用、运行中短暂断开后的恢复、启动失败与长时间未恢复等状态，避免前端各处各自解释连接与生命周期语义。

**Scope:** 本次先覆盖 `packages/nextclaw-ui` 当前本地 UI 主链路，包括聊天页、应用级实时连接、bootstrap status、普通 HTTP 请求、SSE/chat stream 请求，以及侧边栏连接状态展示。`remote access` 与其它运行形态暂不纳入本次统一模型，但设计上预留扩展位。

**Why now:** 当前仓库里已经存在两套平行语义：
- 一套是 `bootstrap-status`，代表“聊天能力是否已经 ready”
- 一套是 `runtime-recovery`，代表“传输层是不是刚断开”

这两套语义没有统一协调，导致前端把“冷启动尚未 ready”和“运行中断线后恢复”混成同一种“recovering”状态。结果就是：
- 刚打开页面时就会误报“正在等待 NextClaw 恢复”
- websocket / fetch / SSE / NCP request 各自上报自己的局部理解
- UI 组件必须靠局部 if 判断拼接产品语义

## 设计结论

### 统一 owner

新增一个唯一 owner：`RuntimeLifecycleManager`。

它不是单纯的 recovery helper，也不是单纯的 bootstrap hook，而是当前 UI 的运行时生命周期协调器。它统一接收三个事实源：

1. `bootstrap status`
   来自 `/api/runtime/bootstrap-status`
2. `transport connectivity`
   来自 websocket `open/close/error`
3. `request-level transport failures`
   来自普通 HTTP fetch、SSE stream、NCP agent fetch

manager 负责把这些低层事实解释成产品态；其它层只负责上报事实，不负责自己解释语义。

### 产品态模型

统一派生为以下前端产品态：

- `cold-starting`
  启动中；还没进入过 healthy/ready
- `ready`
  运行中且聊天能力可用
- `recovering`
  之前已经 ready 过，随后短暂断开，目前正在等待恢复
- `stalled`
  进入恢复后等待超时，说明不是瞬时抖动
- `startup-failed`
  从未 ready 过，但 bootstrap 已明确失败

关键原则：
- **只有“之前已经 ready 过”才允许进入 `recovering`**
- 第一次加载期间的连接未建立、health 未 ready、chat capability 未 ready，都只能算 `cold-starting`
- transport 层事件不能直接决定产品文案

### 生命周期记忆

协调器必须记住两个关键历史事实：

1. `hasReachedReady`
   当前页面生命周期里是否曾经进入过 ready
2. `lastReadyAt`
   最近一次进入 ready 的时间

这两个记忆是区分“冷启动”与“运行后中断”的关键。如果没有它们，系统永远会把初次连接失败误解释成恢复。

## 目录结构设计

本次新增一个明确的 feature root：

```text
packages/nextclaw-ui/src/runtime-lifecycle/
├── runtime-lifecycle.types.ts
├── runtime-lifecycle.store.ts
├── runtime-lifecycle.manager.ts
├── use-runtime-bootstrap-status.ts
└── use-runtime-lifecycle-status.ts
```

角色说明：

- `runtime-lifecycle.manager.ts`
  业务 owner，统一解释 lifecycle 语义
- `runtime-lifecycle.store.ts`
  UI 可消费的状态快照
- `runtime-lifecycle.types.ts`
  生命周期状态与派生 view 的纯类型
- `use-runtime-bootstrap-status.ts`
  仅承担 bootstrap 查询，不再自己定义产品态
- `use-runtime-lifecycle-status.ts`
  读取 store，输出给 UI 组件的轻量入口

目录治理判断：
- 这是一个新的稳定主 feature，适合顶层 feature root，而不是继续散落到 `hooks/`、`stores/`、`lib/`。
- `manager` 与 `store` 保持在 feature root 内，不额外再套假层级。
- 旧的 `runtime-recovery/` 将被删除并并入 `runtime-lifecycle/`，避免两个平行 feature 同时解释同一领域。

## 事件与职责边界

### 1. bootstrap hook 只上报事实

`use-runtime-bootstrap-status.ts` 的职责：
- 查询 `/api/runtime/bootstrap-status`
- 保持 polling 策略
- 不再自己定义“chat blocked / initializing / error / ready”这类产品语义

它只把后端事实送给 manager。

### 2. realtime bridge 只上报传输事件

`use-realtime-query-bridge.ts` 的职责：
- 处理 query cache invalidation
- 在 websocket `open/close/error` 时调用 manager

它不再自己持有“connection status = connected/disconnected/connecting”的产品态解释。

### 3. transport/request 层只上报短暂传输失败

普通 HTTP、SSE、NCP fetch 在遇到 transport 级失败时，调用 manager 的 `reportTransportFailure()`。

但 manager 只把它当作低层事实，不保证一定进入 `recovering`。是否进入恢复态由统一状态机判断：
- 若尚未 `hasReachedReady`，则保持 `cold-starting`
- 若已经 ready 过，则进入 `recovering`

### 4. UI 只消费派生状态

聊天页、侧边栏、输入框不再各自拼接 transport + bootstrap if 判断，而是只消费 manager 派生出的状态：

- 聊天区消息
- 输入框是否禁发
- 连接状态徽标
- 恢复类错误是否需要翻译成人类文案

## UI 派生规则

### 聊天页

- `cold-starting`
  显示“聊天能力正在初始化”
- `startup-failed`
  显示“聊天能力启动失败”
- `recovering`
  显示“NextClaw 正在恢复连接”
- `stalled`
  显示“NextClaw 恢复时间过长，请检查服务状态”
- `ready`
  不显示生命周期阻塞提示

发送规则：
- `cold-starting` / `startup-failed` / `recovering` / `stalled` 均禁发
- 但 `cold-starting` 允许继续编辑输入内容

### 侧边栏状态徽标

从统一生命周期派生：
- `ready` -> `connected`
- `cold-starting` / `recovering` -> `connecting`
- `startup-failed` / `stalled` -> `disconnected`

这样侧边栏状态不再与聊天页语义脱节。

### 全局恢复横幅

本次不重新引入全局“正在恢复”横幅。

原因：
- 现阶段它的产品价值不如聊天区本地语义明确
- 它更容易放大生命周期误判
- 等统一状态模型稳定后，再决定是否需要全局横幅，以及它应该只在 `recovering` 且 `hasReachedReady=true` 时出现

## 实施步骤

1. 新建 `runtime-lifecycle/` feature root，定义类型、store、manager
2. 把现有 `runtime-recovery` 逻辑迁入新 manager，并删除旧目录
3. 将 `use-runtime-bootstrap-status.ts` 移入新 feature root，并让其只负责查询
4. 改造 `use-realtime-query-bridge.ts`，把 websocket 事件交给 manager
5. 改造 `raw-client.ts`、`local.transport.ts`、`ncp-app-client-fetch.ts`，统一上报 transport failure
6. 聊天页改为消费统一 lifecycle 状态，不再平行拼 `chatRuntimeBootstrapStage + recoveryPhase`
7. 侧边栏状态徽标改为消费统一 lifecycle 派生值，去掉 `ui.store` 里的连接状态 owner 角色
8. 删除未再使用的 recovery banner 与相关旧实现

## 验证策略

### 定向测试

- 新增 manager 状态机测试：
  - 冷启动失败不进入 recovering
  - ready 后断线才进入 recovering
  - recovery timeout -> stalled
  - bootstrap error before first ready -> startup-failed
- 新增连接状态派生测试：
  - `cold-starting` -> sidebar 显示 connecting
  - `ready` -> connected
  - `stalled` -> disconnected
- 更新聊天页相关测试：
  - 冷启动时显示 initializing 文案，不显示 recovering 文案

### 类型与定向 lint

- `pnpm -C packages/nextclaw-ui tsc`
- 触达文件级 `eslint`

### 真实问题验收

1. 刚打开 NextClaw UI，服务仍在启动中
   预期：显示初始化中，不显示“正在恢复”
2. UI 已经正常可用后，执行服务重启或模拟短暂断开
   预期：进入 recovering，恢复后自动可用
3. 若恢复超时
   预期：进入 stalled，而不是无限闪烁

## 这次不做什么

- 不把 remote/shared-web 生命周期一并纳入
- 不重做 `runtime-control` 产品流
- 不引入第二套更重的全局 event bus
- 不保留 `runtime-recovery` 与 `runtime-lifecycle` 双 feature 并存
