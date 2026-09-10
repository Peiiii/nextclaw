# 计划重启后的运行恢复设计

## 最终结果

- contract-id：`planned-restart-run-recovery-v1`
- parent-goal：NextClaw 在 AI、CLI 或 UI 发起受控重启后，自动继续被该次重启中断的运行，同时不恢复执行栈、不重放工具，也不把普通启动或崩溃误判为计划重启。
- scope-revision / scope-confirmation：`2 / user-confirmed`。第二次确认补充：AI 自更新统一使用 `nextclaw update` + `nextclaw restart`，删除 agent 专用 `gateway update.run`；验收必须覆盖本地签名更新源、真实进程退出/替换、多会话恢复和防重复更新。

## 现状与关键判断

- session journal 已能在启动时把没有终态的 run 归一为 `interrupted` 的 `RunError`。
- `AgentRunSessionCommandManager.continueRun` 已拥有同 session 续跑的标准主链路，并会保留已有进度、避免重复工作。
- service 已拥有真实退出、后台服务重启和 detached self-relaunch；现有 restart sentinel 只负责上线通知，不拥有运行恢复语义。
- 因此不增加跨进程工具调用、会话 `paused` 状态或持久 goal runtime。跨进程边界只传递一个一次性 operation id，并由 kernel 持久化精确的 active run 集合。

## Owner 与合同

### Kernel owner

新增 `PlannedRestartRecoveryManager`，唯一拥有：

- 暂停和恢复新 run admission；
- 从 `SessionRunManager` 快照当前 active run；
- 刷新相关 session event chain；
- 原子持久化、匹配、领取和清理恢复交接单；
- 启动后通过现有 `continueRun` 恢复匹配 session。

公开给 service 的边界只有：

```ts
prepare(reason: string): Promise<{ operationId: string }>;
abort(operationId: string): Promise<void>;
recover(operationId: string | undefined): Promise<RecoveryResult>;
```

service 不读取 run 列表，不判断 session 状态。

### Service owner

`ServiceRestartManager` 继续唯一拥有实际重启。它在准备退出前调用 kernel 的 `prepare`，把返回的 operation id 放入 detached relaunch helper 环境：

```text
NEXTCLAW_RESTART_OPERATION_ID=<uuid>
```

新进程完成 kernel、extension 和 channel 启动后立即调用 `recover`，随后才发送 restart wake。这样 continuation 始终有可用投递端；如果极短窗口内同一 session 已收到新的用户输入，用户输入优先，恢复项安全跳过。普通启动没有 operation id，因此不会领取恢复交接单。

CLI 无参数 `nextclaw restart` 在检测到运行中的本地 NextClaw API 时，优先请求当前进程执行统一的 restart-service 动作，使 AI exec、CLI 和 UI 共用同一个计划重启入口。只有 HTTP 404 才允许旧版 stop/start 回退；超时、网络错误和拒绝不触发第二次破坏性重启。显式 port/open/timeout 参数仍保留直接 stop/start 兼容路径，不承诺恢复。

AI 自更新不再拥有专用工具协议。删除 `gateway update.run`，自管理说明固定为先执行普通 CLI `nextclaw update`，仅在更新结果要求重启时再执行 `nextclaw restart`。更新 owner、UI 更新入口和 CLI 仍复用现有 runtime update manager；删除的是 agent 专用捷径，不删除更新能力。

## 持久协议

交接单位于 kernel data 目录，使用临时文件写入后原子 rename：

```ts
type PlannedRestartManifest = {
  version: 1;
  operationId: string;
  reason: string;
  createdAt: string;
  expiresAt: string;
  runs: Array<{
    sessionId: string;
    sourceRunId: string;
  }>;
};
```

不为每个 session 写平行暂停标记。交接单是“本次计划重启允许恢复哪些 run”的唯一事实源；session journal 仍是 run 实际是否完成或中断的唯一事实源。

## 状态与时序

### 旧进程

1. service 收到 execute restart。
2. kernel 关闭新 run admission，并等待已进入 admission 的请求完成入队。
3. kernel 快照 active runs，刷新这些 session 的 event chain。
4. kernel 原子写入交接单并返回 operation id。
5. service 把 operation id 传给 relaunch helper，随后真实退出。
6. 若重启没有被接受或拉起准备失败，service 调用 `abort`，kernel 删除匹配交接单并重新开放 admission。

当前 run 和工具调用不需要结束；退出后由新进程的既有 unfinished-run ingestion 形成 interrupted 终态。

### 新进程

1. kernel 启动并先把旧 unfinished runs 归一为 interrupted。
2. extension 和 channel 完成启动，确保 continuation 有完整工具面与投递端。
3. kernel 用环境中的 operation id 原子领取匹配、未过期的交接单。
4. 对每项检查 session 当前状态；要求 `run-interrupted` 且最后输入的 `run_spec.runId` 精确匹配交接单的 sourceRunId，才进入既有 continuation 发送链路。普通 failed/cancelled 不符合资格。
5. 已经自然完成、session 已收到新输入、标记损坏、过期或 id 不匹配均跳过。
6. 领取后不自动重试。恢复失败的 session 保持可手动继续，避免重启循环和重复副作用。
7. 如果 channel 启动后的极短窗口内已有新输入使 session 再次运行，恢复项跳过，不覆盖或排队到新输入之后。
8. 恢复 run 的隐藏 continuation prompt 明确声明“计划重启已经完成、旧工具进程不会恢复、不得重复执行 update/restart、先核验外部状态”，避免模型把旧 exec 中断误判为更新失败并进入重启循环。

## 架构不变量

- kernel 拥有恢复资格和 continuation 语义，service 只拥有进程生命周期。
- session journal 与恢复交接单各自只有一个事实：前者记录运行事实，后者记录重启意图和候选集合。
- 工具执行现场、Promise、子进程和 RPC 不跨进程恢复；新 run 必须先检查外部真实状态。
- 每个 operation id 至多领取一次。
- 普通 start、stop、crash、SIGKILL 和 OS 重启没有匹配 operation id，不自动恢复。
- 运行恢复复用现有 `continueRun`，不建设第二条 agent 执行链路。

## Active acceptance ledger

| ID | Required | 合同 | Status | 当前证据 | 失效原因 |
| --- | --- | --- | --- | --- | --- |
| PRR-1 | true | 计划重启原子记录精确 active run 集合 | passed | manager 并发 prepare、快照与 flush 测试 | - |
| PRR-2 | true | 新进程仅凭匹配且未过期的 operation id 领取一次 | passed | manager 领取测试、真实新进程重复 recover 返回 none | - |
| PRR-3 | true | 恢复复用标准 continuation，跳过已完成或不再匹配的 session | passed | session command 资格矩阵、双会话两轮进程验收 | - |
| PRR-4 | true | prepare 关闭 admission；abort 清理并恢复 admission | passed | admission drain/abort、journal 写失败禁止 restart flush | - |
| PRR-5 | true | relaunch helper 传递 operation id | passed | helper 环境断言、两轮 launcher 替换进程 | - |
| PRR-6 | true | exec、CLI 和 UI 的受控 restart 收敛到当前宿主 | passed | CLI controller、RuntimeControlHost、真实 HTTP route 与 exec 链路 | - |
| PRR-7 | true | 普通启动、错误/过期/不匹配标记和重复启动不恢复 | passed | manager 负向矩阵、内核启动失败不消费标记 | - |
| PRR-8 | true | core/kernel/service 类型检查、相关测试和进程验收通过 | passed | tsc、kernel/service build、定向 23 个 kernel 测试及进程验收 | - |
| PRR-9 | true | 用户文档、自管理资源和 changeset 同步 | passed | 中英文 commands、USAGE 资源同步、自管理 skill 与四包 changeset | - |
| PRR-10 | true | 删除 agent 专用 updater，改用普通 CLI | passed | gateway 负向工具合同与 CLI update 实测 | - |
| PRR-11 | true | 本地签名更新源、真实进程更新一次、多会话各恢复一次 | passed | 一次 update、两次 restart、三个 runtime generation、四次 recovery input 和后续普通输入 | - |

## 测试矩阵

- manager：原子 prepare、active run 去重、flush、abort、匹配 recover、过期、损坏、不匹配、重复领取、部分 session 跳过、continue 失败隔离。
- admission：prepare 与并发 send 的边界，prepare 后新请求被拒绝，abort 后恢复。
- service：只有 execute restart 准备恢复；helper 环境带 operation id；重复 restart 不生成平行交接单；准备失败不退出。
- startup：kernel/extension/channel 后立即恢复，随后 restart wake 通知；同 session 的新用户输入优先。
- CLI：运行中的 managed/foreground runtime 走本地 API；仅 404 或显式配置覆盖使用兼容 stop/start；请求超时不回退。
- 集成：用同一临时 data 目录模拟两个独立 manager 生命周期，证明旧实例写入后新实例只能领取一次，并真实触发 continuation callback。
- 进程验收：本地 HTTP 源 + 临时 Ed25519 密钥 + 签名 manifest/bundle；真实 ExecTool 调用进程级 CLI fixture，复用正式 update/restart controller、HTTP route、kernel、journal、helper 和 launcher。模型为符合 AgentRuntime 合同的确定性模拟器；native runner 仅占位验证包结构。0.1.0 更新至 0.1.1 后再做第二轮重启，证明三个 runtime generation、每轮两个会话恢复、每轮重复领取为空、更新只执行一次，最后普通输入仍正常运行。
- 模型输入：使用正式 message converter，断言持久进度和成功回执存在，tool_call/result 配对完整。它不证明任意真实模型必然遵循禁止重试的提示。
- 防循环：定向断言计划重启 continuation prompt 明确禁止重复 update/restart，并要求先检查版本、健康度及外部副作用。

## 交付边界

- 本次完成源码、测试、面向用户文档、自管理资源、changeset 和必要迭代留痕。
- 不 commit、push、发布或部署；这些动作需要用户单独授权。
- 从不具备该能力的旧版本升级发生的第一次重启无法恢复旧进程中的 active run，这是因旧进程没有快照能力形成的真实版本边界，不增加兼容守护进程补偿。
- 此次恢复宿主范围为支持本地 API 的 managed/foreground；desktop、OS supervisor 的 exit-process 不传递本协议。只承诺快照时 active runs，不扩展为任意排队输入或崩溃持久任务调度器。

## 方案裁决

- 采用一个有真实状态和生命周期所有权的 kernel manager；排除拆成 manager + store + coordinator 三层，因为当前只有一个本地 JSON consumer，会增加转发层。
- 排除纯 utils：该能力拥有 admission、持久状态和恢复生命周期，不是无状态转换。
- 排除 service owner：运行恢复是产品语义，不能下沉到宿主进程外壳。
- 保留 package `index.ts` 作为既有公共边界，只增加必要导出，不新增局部 barrel。
- 不增加 session pause 状态、goal runtime、跨进程 tool continuation、后台轮询和无限 retry。

## 当前阶段门

- 结果：设计、协议、owner、失败边界和验收 ID 已冻结。
- 保持项：单一恢复主链路、至多一次、普通启动不恢复、不重放工具。
- 方案 Review：`passed`。已修正 continuation 早于 channel 时可能缺少投递端的风险；没有其它未关闭 finding。
- 实现与定向验收完成；广域回归、Review 与交付结论见本批迭代记录。没有真实在线模型、桌面或 supervisor 自恢复的验收声明。
