# Issue #73：会话持久化失败边界

## 用户结果、来源与现状

来源与 active contract `JRN-20261114` 归[本批日志](../logs/2026-11-14-session-journal-write-failure/README.md)。用户要求先复现、修复、充分验证后发布新 stable，全平台沿本 chat 已明确的 Desktop 范围。

0.59.4 真实 journal + coordinator + SessionRun 复现：将目标 journal 临时替换为目录，真实文件访问失败后 actor 仍新增消息，而恢复文件并冷加载只有先前内容；50 次后续事件触发50次报错，锁存 stack 不展示原 cause/code。原机0.59.1与其原始JSON触发未取得，不能把合成磁盘故障等同原机根因。锁存是 ingestion 内 per-session Map，非持久状态；原文日志并不会因为锁存本身被删除，未写入内容则无法在重启后重建。

现有链：native/external runtime → SessionRun.applyEvents → actor；运行观察器广播 ncp event → ingestion 的异步 append → journal/派生 projection/catalog/preview。只有压缩终态在 actor 之前等待 persist。此为同一持久化能力的边界缺口，不需要第二套日志、后台重试器或新 runtime。

## 冻结主路径与不变量

1. **确认写入再提交 actor**：SessionRun 对所有 durable 事件调用已有 persistSessionEvent，ContextWindowUpdated 仍为非持久事件。沿用 ingestion WeakMap 去重和有界100ms/16KiB流式 delta 合并；这是有界的暂态流，不承诺硬件故障期间仍能保存新内容。非delta终态必须先排空之前delta，避免最终成功先于落盘。
2. **首个故障唯一归 ingestion**：首次非预期持久化异常转为内部 `SessionJournalWriteError`，保留原 cause。每会话保存同一个首次异常并只通知一次，不用后续锁存 wrapper 覆盖原因。显式取消/压缩 stale 属于 rejected commit，不进入磁盘故障；真实写入失败即使成功回滚也必须停止运行，因此 rollback 标明 journalWriteFailed，区分合法拒绝。
3. **停止与通知**：coordinator 使用已有 RunError 事件发布一次明确的存储失败通知（独立的临时 source，不能冒充已持久事件，也不回流写入）；原活动 runtime observer 订阅该 source，通知对应 SessionRun abort active controller、清空待运行输入、停止状态，并在 run finally 解除监听。SessionRun 的直接 persist 异常同样关闭该 actor，防止启动前/离线调用漏通知。其它会话不受影响。此通知明确当前运行无法保存，不制造成功 checkpoint 或虚假的历史。
4. **原运行错误路径不递归写坏盘**：运行观察器与启动失败处理识别存储异常，不再尝试把同一错误再持久化为新的事件。finally 仍结算/释放 claim/capacity、清理 runtime；队列已清空，不自动开启下个运行。observer 发布正常事件时使用既有 persisted source，避免完成消息的 UI 投影 clone 被再次写成第二个完成事件；所有既有运行 producer 已通过 SessionRun.applyEvents。
5. **诊断与恢复**：日志只输出首个原因链的 name/message/stack/code/errno/syscall/path，不输出整个用户事件/供应商配置。锁存在 dispose/restart 时清除；恢复后从已保存 journal 重建，已有 torn-tail 隔离保留路径继续有效。真实 chmod 复现确认 loader 把 EACCES 错当不存在返回 null；只在 ENOENT 返回缺失，权限/IO 异常保持原 code 显式失败，避免把存在的历史当作新会话。原始坏记录/原用户未落盘内容不伪称修复，不做无证据的历史删除或自动覆盖。

沿用现有 EventBus、ingestion、SessionRun、运行请求与 observer owner。只新增内部错误类型/格式化 utils，不新增服务、公共 NCP variant、持久 schema、配置开关、备用存储或自动重试。正确性优先于悄悄重试坏事件；实际故障解除后按明确提示重启恢复写入口。

## 黄金验收与矩阵

- 正常用户发送 → 原 native runtime 调用真实可用模型 → delta有界合并/终态落盘 → 完整回复 → 冷重启可读；UI投影不二次写入或覆盖完整来源。
- 当前会话写盘失败 → 原因一次记录、用户看到RunError、controller停止、待运行队列清空 → 后续事件/发送明确失败 → 不出现持续内存成功；另一会话能继续并冷加载。
- 恢复文件访问并冷启动 → 已有消息与会话目录仍在、未完成运行成为明确中断 → 正常新消息可保存。坏行/尾部已有来源保留，不能通过删除session冒充恢复。
- 大于20MiB历史、多轮压缩、高频文本/推理/Unicode/tool参数 → 成功结束后完整冷回放；注入 write/open/metadata/flush失败、正常取消、stale压缩冲突覆盖相邻边界。
- 匹配 tsc/lint、定向集成、真实模型及原公开安装升级流程；设计不改变界面布局，错误沿现有 RunError 展示，必要文档说明停跑与恢复操作。新 stable NPM/Runtime/Desktop 全平台由原父流程完成。

## 方案审查

design-document: required；plan: not-required（单批修复原链路，状态沿活跃日志）。

## 发布兼容与时序补充（scope revision 2）

0.44旧壳在Node20.18.1加载candidate时，history preparation明确失败于缺失 `@libsql/win32-x64-msvc`；candidate新壳已成功读出原消息。上一任务同路径同位置失败。冻结增量：沿原native resource owner复制目标平台libSQL binding，原bundle资产合同验证实际`.node`文件；不新增数据库fallback或整目录依赖复制。Windows smoke只对显式queued/preparing有界等待，失败立即保留原因。由Node20真实隔离bundle读写冷开与Windows focused原升级链证明。

父流程在NPM artifact先就绪后启动Runtime promotion，原selector仅接受整条prepare成功，精确源仍运行即失败，prepare随后真实成功。冻结增量：同selector优先已成功，否则只选精确源active run，Actions owner等其成功再promotion；其它source/失败cell不接受，不增加Agent轮询。0.59.5 NPM已不可变，新增兼容修复以0.59.6 patch交付。补充设计Review passed：两项分别归既有packaging/runtime orchestration owner，缺binding和准备失败均fail closed。

mode=design：从原 issue 反查“只加日志”仍会允许内存会话，故 gate 必须在 actor 之前；只在后台发错误则挂起 provider 仍可能继续，所以要联动真实 AbortController；只改 gate 则 observer/startup catch 会再次写故障盘，需同一故障分支收敛；只按事件 WeakMap 去重不够，完成消息 UI clone 需 persisted source。取消/stale 不得锁死、timer失败不得等下一条token才通知；上述均进入矩阵。未引入并行持久 owner，无未关闭设计 finding，design-review: passed。

维护性复审：首次 diff 检查发现 AgentRunRequest 594→602 超过600、SessionRun628→646继续增长。故将故障监听收回本就拥有活动 runtime 生命周期的 observer，随该 run 开始订阅、finally 解除，不让请求管理器增加全局监听；启动前写失败仍由 actor 的直接 gate 处理。原有 SessionPendingInputs 已是独立队列状态 owner，把原类及其请求类型原样移到同目录独立 manager，原 SessionRun 类型出口继续 re-export，保持调用合同，避免队列状态和运行/持久化继续混放。不是新增转发层，也不按行数压缩逻辑。补充方案Review passed，原队列/取消/steering与native故障集成复验。
