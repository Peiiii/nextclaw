# 会话 Journal 增长治理与升级可靠性设计

## 决策

- 日期：2026-09-29；风险：L3（持久化、恢复、升级）；目标：让长会话持续可用，并减少逐 token 事件造成的文件与索引写入放大。
- **继续使用 NCP v1 JSONL，不引入新磁盘格式。** 普通升级不迁移、不重写任何旧 journal。新旧记录由同一 reader 顺序读取。
- 在线运行保持 runtime、live reducer、模型输入和 UI 的逐 token 语义；只在 kernel 的 `SessionEventIngestionService` 进入 journal 写链前合并相邻 delta。这个位置避免改变工具调度时序和流式显示。
- 已有大文件使用显式离线维护命令处理。它只合并相邻 delta，不删除完整消息快照、推理正文、工具结果、图片或运行状态事件。所有使用同一 `NEXTCLAW_HOME` 的写者必须先停止；默认命令只预览，`--apply --writers-stopped` 才切换。
- 原稿曾建议在此次优化中新增用户输入、工具执行和终态的 persist-first/fsync 保证。代码追踪发现工具已在 runtime 内触发，kernel 事件订阅者无法在执行前拦截。该建议不作为本次实现或对外承诺；若要增强断电事务语义，需独立设计 runtime 到 journal 的确认边界。本优化只保证不降低现有确认语义。

依据：[产品愿景](../VISION.md)、[原始 Journal 合同](./2026-05-14-session-journal-persistence-design.md)、[上下文压缩与投影合同](./2026-08-08-codex-aligned-context-compaction.design.md)、[共享 HOME 约束](./2026-08-22-session-interruption-projection-integrity.design.md)。原有 append-only 约束继续覆盖在线运行和普通升级；显式离线维护是所有写者停止时的窄例外。

## 事实与方案审查

用户提供的两日会话统计为 1,003,611 行、488.6 MB；`reasoning-delta` 205 MB、`tool-call-args-delta` 83 MB、`message.sent` 147 MB；图片 base64 约 71 MB，是 `message.sent` 的子集。尚未获得该文件，不能把这些类别总量当作实际节省量。

另在一份本机冻结的真实会话副本上测得：178,436,341 字节、434,835 行；三类可合并 delta 的正文合计约 2.2 MB，重复 JSON 外壳是主要增量。该样本旧文件已有 366 次相同 `seq` 和 212 次倒退 `seq`；现有 reader 按文件顺序重放，故维护器不能用严格单调序号检查误拒旧数据。该样本也含一条未终结 run；由于维护器不删任何事件，只合并可证明为串接语义的相邻 delta，未终结 run 仍保留且纳入冷重放等价校验。

方案 Review 的关键反例：在 runtime 前合并会改变工具参数接收和 UI 时序；在在线路径删除重复 `MessageSent` 会破坏同一 assistant ID 多轮快照的续聊事实；新格式会影响旧版读取与回退；直接改写在线文件会使 projection 与 run recovery 的 byte offset 失效；删除整个共享 SQLite catalog 会复活其它会话的 tombstone。现方案将合并限制在 journal ingress，离线切换后只失效目标会话的派生状态，并保留其它会话的 catalog 行和 tombstone。

## 在线写入合同

只合并相邻、同一 `type`、同一 payload 非 `delta` 字段的 `message.text-delta`、`message.reasoning-delta`、`message.tool-call-args-delta`。字符串按原顺序连接，不 trim、不解析 token；第一条事件的 `occurredAt` 保留。任何其它事件、消息 ID、工具 ID、correlation 字段或 payload 变化都先冲刷 pending，再按原顺序入写链。UTF-8 chunk 最多 16 KiB，从第一条起最多等待 100 ms；超大单条事件原样写入。`flushSession` 与正常重启 `flush` 必须冲刷 pending；append 失败后同一 session 拒绝后续追加并向调用方报错，不能在可能截断的尾行后继续写。

合并前的 live/UI 事件仍逐条流动。100 ms 是合并等待上限，不是断电可丢内容的固定上限；排队与文件系统延迟仍可能扩大未确认尾部。计划重启与普通 kernel 关闭均先冲刷待写增量。每次追加前检查旧文件是否以完整换行结尾；发现截断尾行就停止该会话后续写入，避免把下一条接到坏行上。既有 journal append 不提供每条事件的断电 fsync 确认，本次不将 `appendFile` resolve 宣称为断电持久。不同会话仍使用各自写链，不新增全局锁；同一 HOME 多进程同时写同一会话的既有并发风险不被本改动冒称已修复。

SQLite summary 不再为上述每个 delta 执行完整 upsert；非 delta 边界继续更新。`message_count` 的既有首条事件初始化与同 ID 快照计数问题在代码审查中被发现，但本次不更改其合同：简单替换为 projection 总数会漏计未完成 assistant，属于独立正确性修复，必须有自己的冷/热场景测试。博客不得宣称已修复该问题。

## 显式离线维护合同

入口：`nextclaw sessions compact-journal <session-id>` 默认 dry-run；应用需停止全部共享 HOME 的实例并显式传入 `--apply --writers-stopped`。布尔确认是操作前提声明，不是跨进程独占检测；操作者不能在有写者时使用。该命令在本次开发中只对冻结副本执行真实切换，用户原件未改。

维护器流式读取旧 v1 文件，拒绝损坏的尾行和不合法记录；保留所有非 delta 事件及其相对顺序，按相同规则合并 delta 并重新连续编号。候选文件完整写入并同步，然后旧文件和候选文件分别绕过 projection 冷重放，比对完整消息对象。原件的大小、mtime、inode 在验证前后也要一致，作为“写者已停止”之外的二次检查。若等价不成立，正式文件保持不变。

应用阶段先复制并同步 `<session>.jsonl.backup`，写入维护标记并同步目录，再将同目录候选文件原子重命名为正式文件。之后只删除目标会话的 message projection、SQLite summary 行与 run recovery checkpoint；其它会话的 catalog 行及 tombstone 保留。启动时在打开 catalog 前检查维护标记：若切换未完整结束，从 backup 恢复原 journal，再失效目标派生状态；备份保留。显式 `--restore --writers-stopped` 会重新生成切换时的 compacted 内容，与当前 journal 比较字节摘要；若已追加任何新事件则拒绝覆盖，只有没有后续写入时才回退。应用过程不自动删除 backup，也不自动在普通升级中运行。

回退到不认识维护标记的旧版本前，必须先用新版本完成维护恢复；若已成功切换，v1 文件可被旧 reader 理解，但应先运行 `--restore` 重建派生状态并保留原逐 token 轨迹。Windows 的目录同步与文件占用行为需在对应安装包上单独验证，不能用 macOS 测试代替。

## 验收合同与证据门

| ID | Required 结果 | 证明方式 |
| --- | --- | --- |
| JG-01 | 旧 v1 会话普通升级可打开、分页、续聊，原 journal 不变 | 冻结旧样本、安装版/真实实例升级前后对照 |
| JG-02 | 合并后 canonical 消息、推理、工具参数和运行状态等价 | 同序列旧/新事件重放、边界测试、冻结样本冷重放 |
| JG-03 | append 失败、截断尾行和维护中断不造成静默丢失或错误确认 | 故障注入、冷启动恢复、备份与回退演练 |
| JG-04 | 同 HOME 不增加全局锁或破坏其它会话/tombstone | 双实例/双会话与 catalog 保留测试 |
| JG-05 | 文件收益明确且流式体验不退化 | 同轨迹字节/行数对照、p95 流式延迟与内存测量 |
| JG-06 | 离线维护可预览、显式应用、冷启动和回退 | 冻结副本真实切换、分页与追加、异常切换恢复 |

目标门槛：目标 delta 行数下降至少 80%，同轨迹在线 journal 总字节下降至少 30%，流式可见延迟 p95 增量不超过 150 ms；冻结历史的离线文件至少下降 50%。未获得的安装版、跨平台或实时延迟证据不能以单元测试代替，须在交付报告中逐项披露，不以未发布草稿暗示线上已生效。

## 本次验证记录与剩余门槛

- 真实冻结副本：178,436,341 → 45,655,999 字节，434,835 → 12,476 行，冷重放消息相等；切换后分页取得 159 条消息，追加验证消息并冷启动后取得 160 条。该副本还用 CLI 执行回退，恢复文件与备份的 SHA-256 完全一致，恢复为 434,835 行。原始用户文件未改动。
- 隔离源码实例：一次真实回复的 SSE 发出 598 条正文 delta，journal 写入 13 条；合并正文与 `message.completed` 正文逐字相同，`run.finished` 存在。重启后 API 仍能返回该会话的 2 条消息。此次 SSE 间隔 p95 为 15.7 ms，但没有改造前的同条件基线，不能据此宣称达成延迟增量门槛。
- 自动化：相邻/边界/失败/双会话、截断尾行、普通关闭冲刷、离线切换、维护中断、tombstone 和有新事件时拒绝回退均有定向测试；kernel 完整测试 146 个文件、721 项通过，CLI 命令文档同步测试 2 项通过。kernel 与 CLI 范围的 TypeScript 编译、文档构建和治理检查通过。
- 尚未完成安装版升级前后、Windows 文件切换、双实例同 HOME、同条件流式 p95 差值及内存对照。JG-01、JG-04、JG-05 因此仍是发布前开放门槛；本次只交付已验证的源码与文档站草稿，不宣称正式发布验收完成。

## 交付与公开表述

本次不自动处理用户现有 488.6 MB 文件，不把另一份样本的节省比例推广成所有会话的保证。文档站博客只用已完成的冻结副本实测数字，并明确这是待发布源码验证结果。正式发布前仍须完成安装包升级、停写应用、回退与对应平台验证；若任一 Required 门未满足，不宣称完整可靠性验收通过。

### 2026-09-30 beta 发布后事实更新

上述“待发布源码”描述的是设计评审时点。此后 `nextclaw@0.59.0-beta.0`、其依赖闭包及四平台 Runtime beta 已发布，隔离目录的真实 NPM 安装与公开 API smoke 通过；双语博客已在全球与国内文档站上线，两站部署校验通过。冻结副本的应用、冷启动与回退证据仍有效。普通升级不会自动改写旧 Journal，用户原始文件未被本任务维护命令触达。

这次 beta 没有补齐同条件流式 p95 增量、内存、Windows 文件切换、双实例同 HOME 和全部旧版安装升级矩阵；JG-01、JG-04、JG-05 仍只能按已测子集报告，不能表述为完整可靠性门槛已通过。发布过程的耗时、失败恢复与漏执行复盘见[beta 发布复盘](../logs/2026-09-30-session-journal-beta-release/README.md)。
