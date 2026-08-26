# Cron 执行领取与热重载安全设计

## 背景与证据

会话 `ncp-mt8yjtiz-70rq3wln` 中的一次性任务 `1707a266` 在 2026-08-26 09:54 至 09:57（Asia/Shanghai）之间产生了 21 个不同的 NCP run。每次 run 都继承了会话模型 `codex-sub/gpt-5.6-sol`，并实际执行了 `exec`、`manage_observations`、`cron` 等工具，因此模型选择和 agent/skill runtime 不是本次故障的第一个错误边界。

第一个错误边界位于 `CronService`：任务执行期间，agent 调用 `cron` 工具修改了同一份 `jobs.json`。文件 watcher 随后调用 `reloadFromStore()`，把尚未在 `executeJob()` 尾部结算的到期任务重新载入，并再次以零延迟触发。一次执行由此形成“执行中修改 cron -> reload -> 再次执行”的反馈环。

## 设计范围判定

这是 `CronService` 单一 owner 内的局部合同缺口：持久化热重载没有区分 owner 自己刚写出的快照，也没有保护执行中 job 的对象身份和单实例不变量。NCP transport、会话模型选择、skill 发现与 UI 展示都不需要改变。

不扩大为通用队列、分布式 lease 或跨进程调度系统。当前产品只有一个 Cron owner；多用户和多进程 claim 属于后续独立能力面。

## 不变量

1. 同一 `CronService` 实例内，同一个 job 同时最多存在一次 `onJob` 执行。
2. owner 自己写入且内容未变化的 `jobs.json` watcher 事件不得替换内存 store 或重新布置到期 timer。
3. 真正的外部 store 变化若发生在 job 执行期间，可以替换内存 store，但 timer 必须忽略执行中的 job；结算时按 job id 更新当前权威对象，不能继续修改 reload 前的旧对象。
4. `at`、`every`、`cron` 的既有到期、失败、删除和重启补跑语义保持不变。
5. cron payload 未指定模型时，继续由 NCP run owner 从目标会话读取 `preferred_model`；Cron 不新增模型字段或 fallback。

## 主链路

```text
timer / 手动 run
  -> CronService 领取 job（内存 executingJobIds）
  -> onJob -> AgentRunClient -> 目标会话 NCP run
  -> CronService 按 job id 找到当前权威对象
  -> 结算 status / lastRun / nextRun / deleteAfterRun
  -> 持久化结算状态
  -> 重新 arm timer
```

`reloadFromStore()` 先比较磁盘快照与 `lastPersistedStoreJson`，相同则直接返回。`executeJob()` 使用 job id 作为实例内领取键，重复领取返回未执行；`getNextWakeMs()` 排除执行中的 job，避免外部 reload 后对同一个到期 slot 做零延迟忙轮询。完成后不再假设入口 job 对象仍属于当前 store，而是按 id 查找并结算当前权威对象。

## 失败与恢复

- `onJob` 失败：沿用现有语义记录 `lastStatus=error` 和 `lastError`，仍结算本次 slot。
- 持久化失败：继续由 timer 安全边界记录诊断并重新 arm；不伪造成功 reload。
- 进程中断：没有新增持久化 running 状态，重启仍按既有 past-due 规则补跑。
- 外部热更新：保留外部快照；执行期间不重入，完成后只把本次执行结果结算到外部快照中的同 id job，不在下游会话或 UI 添加去重。

## 抽象审计

- 保留：现有 `CronService` 作为 schedule、store、timer、执行生命周期的唯一 owner。
- 新增：一个执行中 job id 集合，保护“单 job 不并发”并为 timer 提供最小排除事实。
- 删除/修正：owner 自己的文件写入触发无意义 reload 的路径。
- 延后：跨进程 lease、持久化 execution record、通用任务队列和分布式锁；当前没有对应消费者或部署证据。

命中的原则是 `information-expert`、`single-complete-owner`、`simple-structure-first` 和 `abstractions-pay-rent`：状态留在已有 Cron owner 内，用集合与布尔值关闭真实缺口，不新增 manager/service。

## 验证标准

1. 修前回放：一次性到期 job 的 `onJob` 内修改另一条 cron job 并触发 reload，原实现可重复执行。
2. 修后同链路：相同输入只调用一次 `onJob`，一次性 job 正确删除或禁用。
3. 外部 reload：执行中写入外部变化时不重入；完成后变化可见且结算状态不丢失。
4. 手动并发：同一 job 的重叠 `runJob()` 只有一个返回已执行。
5. 既有 past-due reload、every cadence、失败诊断测试保持通过，并运行 `nextclaw-core` TypeScript 检查。

## 非目标

- 不修改会话模型、thinking 或 agent 选择合同。
- 不修改 skill prompt、skill 发现或工具调用策略。
- 不重启当前 NextClaw 实例，不用当前真实用户任务做破坏性复验。
- 不修改 cron UI、API schema 或用户文档；这是既有“一次到期只执行一次”合同的恢复。
