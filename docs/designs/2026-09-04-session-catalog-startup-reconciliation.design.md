# 会话目录启动对账设计

## 背景与问题

NextClaw 启动时会先初始化 NCP 会话目录，完成后才把 `ncpAgent` 标记为 `ready`。左上角版本号右侧的连接状态直接消费这个状态；因此会话目录初始化过慢时，用户会长期看到旋转中的“连接中”。

当前本机数据包含 1,381 个 journal、约 2.3 GB。即使 SQLite 目录已经完成迁移，启动逻辑仍逐个读取所有 journal 的摘要或完整内容；随后，为恢复上次异常中断的运行，又从头解析所有 journal。真实开发实例从 `running` 到 `ready` 用时约 179 秒，正式版实例也曾用时约 224 秒。

第一轮 catalog 增量对账把同一真实目录的 catalog 初始化降到 90 ms，但隔离冷启动仍需 26.6 秒。分段 trace 证明其中 18.3 秒属于 `sessionManager.start()` 的 unfinished-run 全量扫描，因此只修 catalog 对账仍会让状态明显久转。

## 根因与范围

这是会话目录 owner 内的启动恢复能力缺口：已有 SQLite catalog 是运行期列表事实源，但启动对账没有区分“首次迁移”和“已迁移后的崩溃恢复”；unfinished-run 恢复只需要最近一次 run 生命周期，却顺序回放完整历史。两条路径都让每次启动重复支付与历史总量成正比的成本。

本次只修复 NCP 会话 SQLite catalog 的启动初始化、对账与 unfinished-run 恢复读取，不改变左上角状态组件、不隐藏真实启动状态，也不改变 journal、message projection、会话列表或中断事件的公共合同。

## Owner 与主链路

- Producer：`.ncp-agent-journal/*.jsonl` 会话 journal。
- Owner：`NcpAgentSessionSummaryIndexStore` 持有的 SQLite catalog，包括正常记录与软删除 tombstone。
- Boundary：`NextclawKernel.start()` 等待 catalog 初始化，随后服务把 `ncpAgent` 标记为 `ready`。
- Consumer：会话列表读取 catalog；界面系统状态把 `ready` 映射为左上角绿色连接状态。

采用以下单一路径：

1. 初始化 SQLite schema 后先读取 `migration_status`。
2. 尚未完成迁移时，保留完整 journal 扫描，建立初始 catalog 与诊断记录。
3. 已完成迁移时，从 SQLite 读取全部已知 session ID，包括软删除 tombstone。
4. 目录扫描只为未知 session ID 加载摘要并写入 catalog；已知 journal 不读取正文。
5. 新 journal 若来自“journal 已落盘、catalog 尚未写入”的中断窗口，仍在下一次启动恢复；软删除 session 因 ID 已知而不会被复活。
6. SQLite `run_recovery` 表持有每个会话已检查到的 journal 字节偏移和当时的 active run；它是 journal 的派生检查点，不取代 journal 事实源。
7. 首次升级对旧 journal 做一次反向生命周期扫描并写入检查点；之后启动只 `stat` journal，大小未变时直接复用检查点，变大时只顺序解析新增尾部。
8. 正常写入 `run.started`、`run.finished`、`run.error` 或 `message.abort` 后同步推进检查点；若 journal 已落盘但进程在 SQLite 更新前崩溃，下一次启动仍会从旧偏移补扫该尾部。
9. 检查点判定仍有未完成 run 时，继续沿现有入口追加标准 `run.error`；已终止则不写入。

## 状态与失败矩阵

| 场景                                    | 行为                                             |
| --------------------------------------- | ------------------------------------------------ |
| 全新目录或未完成迁移                    | 完整扫描 journal，写入 catalog，最后标记迁移完成 |
| 已迁移、没有新 journal                  | 只读取目录项与 SQLite ID，不读取 journal 正文    |
| 已迁移、存在未知 journal                | 只解析未知 journal 并补入 catalog                |
| 已迁移、存在 tombstone 对应残留 journal | 视为已知，不解析、不复活                         |
| 未知 journal 损坏                       | 保留现有 unreadable 诊断语义，不阻塞其它会话恢复 |
| 旧 journal 没有恢复检查点                | 一次性反向查找最近 run，随后保存文件末尾偏移       |
| 已有检查点且 journal 未变化              | 不读取正文，直接复用 active run                   |
| 已有检查点且 journal 尾部增长            | 仅回放检查点之后的生命周期事件并推进偏移           |
| journal 写入后、SQLite 更新前进程退出    | 下次启动从旧偏移补扫，保持中断恢复                |
| journal 最近一次 run 已终止              | 返回无未完成运行                                  |
| journal 最近一次 run 未终止              | 沿现有恢复链追加中断错误                          |
| journal 尾部存在超大事件或损坏行         | 跨分块继续查找生命周期；损坏行保持忽略             |

## 取舍与边界

不采用“让 UI 提前显示已连接”，因为这会掩盖 kernel 尚未可用的真实状态。不采用后台全量重扫，因为 catalog 的运行期写入已经维护已知会话；本次需要恢复的真实中断窗口只是“目录中出现 SQLite 未知 ID”。

第一轮只做反向扫描的方案在真实副本上仍需约 21 秒：大量旧 journal 从未包含 run 生命周期事件，必须读到文件开头才能证明“不存在”。因此采用持久化派生检查点，并明确处理 journal/SQLite 之间的崩溃窗口。检查点可丢弃重建，journal 继续是单会话事件与 run 生命周期事实源。

## 验收契约

- contract-id：`session-catalog-startup-reconciliation-v1`
- parent-goal：历史会话规模增长后，NextClaw 启动不再因重复全量解析而让版本旁连接状态长期旋转，同时保持中断恢复与删除语义。
- scope-revision：1（初始范围）

| ID       | Required | 合同                                                                                          | Status  | 当前证据                                        |
| -------- | -------- | --------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------- |
| SCAN-001 | true     | 已迁移目录重启时不调用任何已知 session 的摘要或完整 journal loader                            | passed  | 定向测试证明 full/summary loader 均为 0         |
| SCAN-002 | true     | 已迁移后新增的未知 journal 会在下次初始化恢复到 catalog                                       | passed  | catalog 定向恢复测试通过                         |
| SCAN-003 | true     | tombstone 对应残留 journal 不会复活                                                           | passed  | tombstone 定向测试通过                           |
| SCAN-004 | true     | 首次迁移仍可从 journal 重建会话摘要                                                           | passed  | 首次迁移定向测试通过                             |
| SCAN-005 | true     | 受影响 TypeScript package 类型检查通过，真实大目录的隔离实例及时进入 `ready`                  | passed  | kernel tsc 通过；隔离实例二次启动 981 ms 进入 ready |
| SCAN-006 | true     | unfinished-run 首次建立检查点后，未变化 journal 不再读取正文，增长 journal 只读取新增尾部     | passed  | 真实副本首次 7.9 秒、二次 90 ms                  |
| SCAN-007 | true     | 已终止、未终止、多 run 与 run ID 不匹配场景保持原有恢复语义                                  | passed  | journal 定向测试通过                             |

契约 Review：删除了“固定毫秒阈值”和“UI 必须立即变绿”两类噪声标准；机器负载与后续 kernel 阶段会影响绝对时间，真正不变量是已知 journal 零正文读取和服务可及时完成真实初始化。

## 实施与验证边界

`design-document: required`。该修复跨 journal/SQLite 持久化边界，设计留在本文件。实现为单批、单 owner，可直接由定向测试和真实目录副本验证，`plan: not-required`。

最小验证包括：首次迁移、未知 journal 恢复、tombstone 保留、已知 journal loader 零调用；unfinished-run 的已终止、未终止、多 run、ID 不匹配与大尾部事件；kernel package `tsc`；以及对真实目录结构的隔离副本进行完整启动耗时对比。不会重启或修改用户当前运行实例。
