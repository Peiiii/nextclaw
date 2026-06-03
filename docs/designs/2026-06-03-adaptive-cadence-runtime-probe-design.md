# Adaptive Cadence Runtime Probe 设计

## 背景

NextClaw 在本地服务 restart、短暂断联、服务未启动或服务彻底失败时，前端看到的直接现象都是 runtime bootstrap/status 请求不可达或未 ready。业务层无法也不应该仅凭一次 `fetch failed` 区分这是 restart 还是未启动。

真正需要解决的是：发送按钮、右下角运行状态和 runtime status probe 都应消费同一个 readiness 状态；readiness 探测本身需要有可配置、通用、可复用的节奏策略，避免长期失败时固定高频请求，也避免刚断联时恢复太慢。

## 目标

- 抽出业务无关的 `AdaptiveCadence`，专门控制重试/探测节奏。
- `AdaptiveCadence` 不知道 runtime、chat、restart、bootstrap，只知道 success、failure、manual trigger 和时间阶段。
- `SystemStatusManager` 继续作为 runtime 状态 owner，负责把 bootstrap/status 结果映射成 `ready/recovering/stalled/startup-failed`。
- Chat 继续只消费 runtime readiness，不直接参与 backoff 或 probe 调度。

## 非目标

- 不在 `/send` 上做透明自动 retry。没有后端幂等合同前，POST 自动重试可能重复创建用户消息和 agent run。
- 不尝试识别“这次断联是不是 restart”。访问不可达就是不可达，系统只做 readiness probe。
- 不引入 chat 专属发送队列。本次只解决 readiness 探测节奏和发送禁用解除来源。

## 职责边界

### AdaptiveCadence

通用节奏策略 owner。

职责：

- 记录连续失败轮次、当前轮开始时间、最近成功/失败时间、manual trigger。
- 根据配置化 stage 计算下一次 delay。
- 成功后按策略停止或重置。

不负责：

- 发请求。
- 解释请求结果。
- 更新 UI 状态。
- 识别 runtime phase。

### SystemStatusManager

runtime 状态 owner。

职责：

- 接收 bootstrap/status 成功、失败、transport failure、connection open/close 信号。
- 更新 `SystemStatusState`。
- 把 readiness success/failure 信号喂给 `AdaptiveCadence`。
- 给 React Query 暴露下一次 bootstrap probe interval。

不负责：

- 直接控制 chat 发送。
- 在状态迁移里手写指数退避公式。

### useSystemStatusSources

probe executor。

职责：

- 运行 bootstrap/status query。
- 把 query 结果交给 `SystemStatusManager`。
- 使用 `SystemStatusManager.getRuntimeBootstrapPollInterval()` 作为 refetch interval。

### Chat

readiness consumer。

职责：

- 只根据 `ncpAgent.state === "ready"` 和输入内容决定是否允许发送。
- 不知道 backoff，不知道 cadence，不自己 ping runtime。

## Runtime readiness 默认策略

```ts
{
  idleDelayMs: 1000,
  manualTriggerDelayMs: 0,
  successDelayMs: false,
  stages: [
    { untilElapsedMs: 30_000, delaysMs: [500, 1000, 2000, 4000, 5000] },
    { untilElapsedMs: 5 * 60_000, delaysMs: [10_000, 15_000, 30_000] },
    { delaysMs: [60_000] },
  ],
}
```

含义：

- 初始未 ready 但还没有失败历史时，每 1 秒探测。
- 刚断联或刚失败的 30 秒内快速探测，最高 5 秒。
- 超过 30 秒进入低频恢复探测，最高 30 秒。
- 超过 5 分钟认为长期不可达，最高 60 秒。
- 用户打开右下角非健康 runtime 状态入口，或系统动作进入恢复期时，可以触发 immediate probe，不等待下一轮 interval。
- ready 后停止轮询。

## 验收条件

- `AdaptiveCadence` 单测覆盖阶段退避、长期失败、success stop、manual trigger。
- `SystemStatusManager` 单测覆盖 bootstrap 非 ready/错误/transport failure 后的 cadence interval，以及 ready 后停止轮询。
- `RuntimeStatusEntry` 组件测试覆盖非健康状态点击触发 immediate probe，healthy 状态不触发额外请求。
- Chat 的发送禁用来源不变，仍只消费 runtime readiness。
- 功能验证证明：连续失败会从热恢复阶段退到长期低频，ready 后解除轮询并保持 chat 可随 readiness 自动解除禁用。
