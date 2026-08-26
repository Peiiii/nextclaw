# 运行时成本失控三项治理设计

## 背景与证据

本设计关闭同一类用户问题：一个无人值守或长链路任务可以在用户没有继续输入时重复执行、无限启动工具调用，并因压缩估算偏离真实模型输入而过早反复压缩，最终造成异常额度消耗。

本次真实会话调查得到三条端到端证据：

1. 同一个 cron 计划槽在两个共享 `NEXTCLAW_HOME` 的 NextClaw 进程中被重复领取；现有 `executingJobIds` 只能防止单进程重入，不能建立跨进程所有权。
2. `agents.defaults.maxToolIterations` 已存在并默认是 `1000`，但没有进入冻结的 run spec，也没有被 native runtime 消费；目标会话实际启动了 1371 次工具调用。
3. 压缩预检使用 `toLegacyMessages()`，真实模型输入使用 `ncpMessageToOpenAiMessages()`；legacy 投影同时保留 `ncp_parts` 和展开后的工具结果，使同一结果被重复估算，出现约 64 万至 69 万估算 token 对应约 19 万真实可用输入的偏差。

## 目标与非目标

### 目标

- 同一 session 的 active run、同一 cron job 的同一计划槽，在共享本地数据目录的多个进程之间只有一个执行 owner。
- `maxToolIterations` 成为每个 run 的冻结硬上限，按真正开始的工具调用数计数，并覆盖同一模型轮次中的并行工具调用。
- 压缩预检、压缩计划和压缩后校验使用与真实模型请求一致的 NCP → provider message 投影，不再估算 legacy-only 字段或重复工具结果。
- 所有拒绝、超限和恢复路径均可观察且 fail-fast，不把所有权冲突伪装成成功。

### 非目标

- 不把本地文件 claim 扩展为跨主机分布式锁；不同主机共享网络文件系统不是当前合同。
- 不在本批引入新的 token、运行时长或压缩次数配置。当前已有且已向用户承诺的 `maxToolIterations` 先成为可信硬边界；新增预算需要独立确定默认值、交互和迁移政策。
- 不迁移 Chat Completions 到 Responses API，也不增加语义去重或成本看板。
- 不承诺进程在工具产生外部副作用后立刻崩溃时的 exactly-once；本设计保证正常并发下 single-owner，并将可恢复范围明确为本地 owner 崩溃后的再次领取。

## 统一模型与 owner

### 1. 本地执行 claim

`LocalExecutionClaimService` 是共享本地文件 claim 的唯一 owner。它放在 core 的稳定公共入口中，由 cron 和 kernel 直接依赖，不增加 factory、registry 或第二套锁实现。

claim 使用 root 目录和业务 key 的 SHA-256 文件名。获取通过 exclusive create 建立原子胜者；文件记录 claim id、业务 key、进程 pid、创建时间和状态。调用方只能通过返回的 handle 完成或释放自己的 claim，handle 在修改前校验 claim id，不能删除后来 owner 的文件。

状态与不变量：

- `active`：owner pid 仍存活时，其他进程得到明确的 `active-owner`，不得执行。
- `completed`：用于 cron 计划槽的 durable terminal marker；其他进程不得再次执行，但可以用其中的完成结果推进仍滞后的 cron store。
- malformed/incomplete：exclusive create 后短暂未写完时按 active 处理；超过宽限期且没有可验证活 owner 时才原子搬走并重试。
- dead owner：仅同一主机上确认 pid 不存活后，竞争者通过原子 rename 淘汰旧 claim；rename 的唯一胜者才可重试获取。
- release：session run 正常 settle 或启动失败后删除自己的 ephemeral claim。

不保留 legacy fallback。claim root 不可创建、claim 不可解析且未满足恢复条件时均 fail-fast。

### 2. session active run 所有权

kernel 的 `AgentRunRequestManager` 仍是 run 启动生命周期 owner。它在持久化用户消息和 `RunStarted` 之前，用 `session:<sessionId>` 获取 ephemeral claim：

```text
agent-run.send
  -> SessionRun.beginNextRun
  -> acquire session claim
  -> persist message/trigger
  -> start runtime
  -> runtime settled / startup failed
  -> release claim
  -> start next local queued request
```

获取失败时不调用模型、不执行工具，并为已经进入本地 active 状态的请求生成明确 startup failure，使本地状态终结。活跃 owner 不自动排队到另一个进程，因为当前没有跨进程队列事实源；隐藏重试会重新引入重复执行。

claim root 固定在该 kernel 的 `sessionsDir/.execution-claims/session-runs`，因此共享 session journal 的进程必然竞争同一 owner。

### 3. cron 计划槽所有权

cron claim key 是 `cron:<jobId>:<scheduledNextRunAtMs>`，而不是只有 job id；这样长任务不会永久阻塞未来计划槽，同一槽又不会被多个进程领取。

执行路径：

```text
due job
  -> acquire durable slot claim
     -> active-owner: skip
     -> completed: apply recorded settlement to stale store, save, skip execution
     -> acquired: execute onJob
  -> record completed settlement in claim
  -> settle current authoritative job by id and exact scheduled slot
  -> save store
```

settlement 携带 `scheduledAtMs`、`startedAtMs`、`lastStatus` 和 `lastError`。store 只在其当前 `nextRunAtMs` 仍等于该计划槽时推进，防止旧 owner 覆盖已被更新的未来状态。先写 completed marker、后写 store，使进程在两步之间崩溃时，其他进程可以推进滞后 store 而不重复执行。

### 4. 工具调用硬上限

`AgentRunSpec` 新增必填 `maxToolIterations`，值来自最终 resolved agent profile，并写入消息 run-spec metadata。它随 run 冻结，运行中配置热更新只影响后续 run。

native runtime 为整个 run 创建一个共享 `RuntimeToolIterationBudget`。每个 `RuntimeToolCallExecutor` 在接受 `MessageToolCallEnd`、真正排入执行队列之前调用 budget owner：

- 尚有额度：原子递增 started count 并执行。
- 已达上限：不启动该工具，立即终止当前模型轮并让 run 进入 `RunError`，错误包含配置上限和已启动数量。
- 同轮并行工具也逐个扣减，因此永远不会多启动一个。
- model stream retry 在可见工具调用前可重试；已经扣减的工具调用不因 retry 退还，避免失败重试绕过总上限。

计数语义与现有配置帮助文案保持一致：一次真正开始的 tool call 计一次，不以模型轮数、tool result 数或循环次数代替。

### 5. 模型输入一致投影

压缩预检删除 `toLegacyMessages()` 路径，直接复用 `ncpMessageToOpenAiMessages()`。为压缩计划保留用户消息边界时，只附加内部 `ncp_message_id`；token 估算前删除该内部字段，保证估算对象等于 provider 实际可见字段。

三处必须统一：

- `preview` 的窗口占用估算；
- `begin` 的触发判断与 compaction plan；
- `finish` 的 checkpoint 可安装校验。

context blocks 和 tools 继续由各自现有唯一 builder 估算。本批删除 preflight 对 legacy bridge 的依赖，不修改 legacy bridge 的其他兼容消费者。

## 关键取舍

### 保留

- 保留 `AgentRunRequestManager`、`CronService`、`ContextCompactionPreflightService` 各自现有业务生命周期 owner。
- 新增一个共享 claim service，因为两个真实消费者需要完全相同的原子获取、owner 校验和死进程恢复不变量；这个抽象消除了两套高风险文件锁实现。
- 保留现有 provider message converter 作为模型输入形状的唯一事实源。

### 删除或合并

- 删除 cron 的进程内 `executingJobIds` 平行所有权；跨进程 claim 同时覆盖同进程重入。
- 删除 context compaction preflight 的 `toLegacyMessages()` 估算路径。
- 不再让 runtime 自行读取可变 agent config；只消费 kernel 冻结后的 run spec。

### 延后

- token、时长、压缩次数预算及其产品默认值。
- 跨主机 lease、续租心跳和分布式 fencing token。
- 历史 completed cron claim 的周期清理；其 key 是短哈希、文件很小，先保留审计与幂等价值，待有真实体量证据后设计保留政策。

## 场景矩阵

| 场景 | session run | cron slot | 工具预算 | 压缩估算 |
| --- | --- | --- | --- | --- |
| 普通 | 单 owner，settle 后释放 | 单 owner，完成后留 terminal marker | 每次真实启动扣减 | provider 投影 |
| 并发第二进程 | startup failure，不调用模型 | active 时跳过 | 同一 run spec 上限 | 无额外路径 |
| owner 崩溃 | pid 死亡后可重新领取 | pid 死亡后可重新领取；completed 可推进 store | 新 run 重新计数 | checkpoint 持久事实不变 |
| 配置热更新 | 当前 run 不变 | 不适用 | 只影响后续 run | 后续 profile 生效 |
| 达到上限 | 释放 claim，继续本地队列 | job 记录 error 并推进槽 | RunError，零个额外工具启动 | 最终消息按既有错误链路处理 |
| 旧 session / cron store | 无需迁移 | 无 claim 时首次执行创建 | 缺失旧 metadata 不影响读取 | 旧 checkpoint 继续投影 |

## 最小充分验证

1. claim service：两个实例竞争只有一个胜者；活 pid 不可抢占；死 pid/malformed 超时可恢复；非 owner 不能 release；completed 可被读取且不可再次获取。
2. cron：两个 `CronService` 指向同一 store，同一计划槽只调用一次 `onJob`；completed marker 能推进模拟崩溃后滞后的 store；未来计划槽仍可执行。
3. session：两个 request manager 共享 claim root 时，第二个 active run 在消息持久化和 runtime start 前失败；第一 run settle 后可再次获取；启动失败必释放。
4. runtime：上限为 2 时，串行和同轮并行都只启动 2 个工具，第 3 个产生 terminal error；不同模型轮共享同一预算；默认/agent override 正确进入 run spec metadata。
5. compaction：含同时具有 `result` 与 `resultContentItems` 的工具结果只估算一次；preview/begin/finish 与 model-input builder 对相同投影的估算一致；现有压缩、summary budget 和 mid-run 测试保持通过。
6. 对所有触达 TypeScript package 运行定向测试和对应 `tsc`；稳定后运行 diff-only maintainability 检查。

## Design Ready

主链路、唯一 owner、失败/恢复边界、删除点和验证标准已经冻结。新增抽象只包含两个当前消费者共同需要的本地原子 claim，不引入 registry、通用 DSL、跨主机 lease 或未来预算框架。
