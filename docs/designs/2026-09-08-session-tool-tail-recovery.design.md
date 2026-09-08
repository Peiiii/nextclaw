# 会话刷新后重复工具消息：定位与恢复方案

日期：2026-09-08。状态：修复与真实实例验证完成，用户已授权合入主干并推送。

## Active acceptance ledger

contract-id: session-tool-tail-recovery；parent-goal: 修复刷新后重复工具消息，验证通过后合入主干；scope-revision: 1（用户确认）。

| ID | Required | 合同 | Status | 当前证据 |
| --- | --- | --- | --- | --- |
| TAIL-01 | true | 原始日志恢复为正确消息，九次真实工具结果不丢失 | passed | 9419 事件、9 个保存边界；正文、思考、工具结果与耗时一致 |
| TAIL-02 | true | 活动 checkpoint、完整恢复和增量恢复等价，取消/错误/完成后不被迟到工具复活 | passed | 六轮九工具的 live/full/incremental 等价及终态迟到事件回归通过 |
| TAIL-03 | true | 旧错误投影可从 journal 重建，原始事件不变，不执行模型或工具 | passed | v7 错误投影重建回归；两个真实原会话修复，journal 哈希不变 |
| TAIL-04 | true | 匹配类型检查、回归与审查通过，真实产品链路复验 | passed | 101 项测试、两个包 tsc、治理审查；真实新会话三次请求六次工具，运行中与完成后刷新通过 |
| TAIL-05 | true | 仅本任务改动合入 origin/master，主工作区 WIP 保留 | not-run | 已创建隔离分支 codex/fix-session-tool-tail |

阶段图：实现 → 验证 → Review → 合入主干。当前阶段门是形成覆盖状态与归属根因的单一路径；上述 Required ID 全部关闭前不报告整体完成。省略与本问题无关的发布平台和视觉偏好标准。

实现学习：旧 pending 快照没有独立旧格式或完成证据，不能安全推定 final，因此保留事实，不新增猜测式 legacy 兼容。状态管理器须将活动 assistant 快照纳入 streaming 槽位，才能一致处理取消。增量 tail 出现 seed 无法归属的工具事件时，回到同一 journal replay 获取历史归属；正常活动链路仍只重放 tail。

## 目标与范围

真实用户会话回复结束后，刷新出现额外的「Use 3 tools」与等待动画。恢复后的消息身份、内容和终态必须与实际执行一致；历史读取不得启动模型或重新执行工具。

这项修复服务于 [产品愿景](../VISION.md) 中连续、可信的个人操作层。沿用 [journal 持久化设计](2026-05-14-session-journal-persistence-design.md) 的事件事实源，以及 [metadata 存储设计](2026-05-19-session-metadata-storage-design.md) 的原始事件与派生数据边界。

风险 L3；design-document: required；plan: not-required。恢复实现、派生数据版本升级及定向回归已在同一批完成。

## 已确认的证据

用户入口为 `http://127.0.0.1:5318/chat/sid_bmNwLW10c3FudTh5LTY4bTVkdjFw`，对应 session `ncp-mtsqnu8y-68m5dv1p`。真实后端为本机 18792。

- 实际页面刷新复现额外工具消息和等待动画。
- messages API 返回 session idle，但三条消息中最后一条 assistant 仍为 streaming。
- 原始 journal 共 9419 个事件，只有一次 run.started、一次 run.finished。九次工具调用全部发生于真实最终回复之前，没有回复结束后的新工具调用。
- 正常 assistant 有完整正文和九个工具结果。多余 assistant 的 ID 为 `tool-call_00_P4uwnTDvJs6DN3AKFVHw2096`，其中三个结果的 toolCallId 都已存在于正常回复，名称均为 unknown。
- 多余消息不是 journal 中发送过的消息，而是恢复器生成后写入消息投影的记录。
- 使用生产 replay 函数、真实 journal、生产投影的分段边界和 active seed 规则进行增量重放，精确复现相同的多余消息 ID、三个工具 ID 和 streaming 状态。
- 同一日志完整重放得到七个重复结果。仅在临时实验副本保留原始 pending/streaming 状态后，两种重放均得到一条用户消息和一条 final assistant，九个工具结果保留。该实验确认因果，不替代正式回归。

最初调查未重启服务、未改真实 journal 或投影、未发送新消息。最终验证已在检查会话全部空闲后重启真实 18792 服务并加载修复，沿原 5318 产品入口复验：第二个原会话由九条恢复为六条消息，第一个由三条恢复为两条，原 journal 哈希不变。另通过正常新会话 `ncp-mtssrt1o-8wjrey72` 发起三次请求，共六个只读工具调用；运行中刷新继续同一请求，完成后刷新保持六条 final 消息，消息全量哈希一致。本文不保存用户聊天正文、配置或工具结果内容。

## 生成路径与「三个／七个」差异

| Journal 序号 | 增量恢复行为 |
| --- | --- |
| 569 | 第一轮含两个工具的 assistant message.sent 本来是 streaming，却被 createReplayEvent 转成 final；activeMessageId 丢失。 |
| 956–969 | 下一段没有原 assistant seed，也没有新的 run.started。正常工具开始被 unknown-tail guard 拦截；没有 messageId 的 tool result 绕过该 guard，fallback 创建 tool-* 消息。本轮快照同时恢复正常 assistant，投影因此有两条 assistant。 |
| 1005–1032 | 下一段只以多余消息为 active seed，两个 gateway 结果继续被归入它，累计三个。 |
| 1033–5323 | 后续显式正文开始允许重新建立正常 assistant；当前 streaming 对象被切换。本段不再返回多余消息，但投影 synchronize 是增量 upsert，不能把「本段没有返回」解释为删除，于是已持久化的三个结果残留。 |
| 9418–9419 | 正常回复完成，run 结束。其 messageId 指向正常 assistant，不能结算另一个合成 ID。 |

完整重放不会在保存边界重建 replay context：第一轮被错误标记 final 后，terminalMessageIds 一直保留正常 assistant ID，后续开始事件持续被拦截，剩余七个结果均流入多余消息。

关键代码：

- `packages/nextclaw-kernel/src/utils/ncp-agent-session-replay-event.utils.ts`：createReplayEvent 无条件将 assistant pending/streaming 转为 final。
- `packages/nextclaw-kernel/src/utils/ncp-agent-session-replay.utils.ts`：terminalMessageIds、unknown-tail guard 和 bootstrap 的恢复规则。
- `packages/nextclaw-kernel/src/stores/ncp-agent-session-message-projection-persistence.store.ts`：只恢复 active seed、分段重放和增量 upsert。
- `packages/ncp-packages/nextclaw-ncp-toolkit/src/agent/agent-conversation-tool-call.manager.ts`：工具归属找不到时选择当前 streaming 或合成 tool-* ID。

## 根因判断

原设计已经要求 journal replay 与 live 状态等价；实现中的旧历史兼容把「保存过的中途消息」等同于「已完成消息」，破坏该合同。工具归属缺失时的自动合成又把恢复错误扩散成可持久化的虚假消息。增量 checkpoint 无法正确延续活动消息，使两条恢复路径产生不同结果。

范围判定为会话恢复能力面的合同缺口：涉及完整恢复、增量投影和旧数据升级，不能只改 UI。现有事件已经能够表达正确身份和状态，判别实验支持沿现有 owner 修正，无需重做 NCP 架构或新增第二套投影系统。

已有测试检查了终态后的迟到 tool start，却没有覆盖同一迟到调用的 result；增量等价测试使用 service 边界消息，没有覆盖真实 assistant 中途快照后继续调用工具。另有 legacy draft message.sent 测试明确期待转 final，因此不能把删除转换的一行实验当作完整修复。

## 解决方案

### 1. 恢复器忠实保留执行状态

kernel journal replay 负责事件适配和恢复上下文；NCP conversation state manager 继续负责消息状态迁移，projection 只存储其结果。

- 正常执行期间的 message.sent 保留消息自身状态，不能因落盘或刷新提前终结。
- 完成、错误、取消按原有权威事件作用于对应 message/run，终态后不允许迟到开始或 delta 重新建立消息。
- 宿主失去执行归属时，由现有 interruption 恢复流程产生明确中断事实；不在普通 replay 中把未完成输出伪装成成功。
- legacy draft 兼容移到明确的旧数据导入/迁移边界。不能仅凭 pending/streaming 判定旧数据：同样状态会出现在现代活动 run 中。无充分旧格式依据时保留事实并报告恢复状态，不猜测完成。

### 2. 工具结果必须有可证明的消息归属

- 正常链路按 toolCallId 关联原有 messageId，跨 checkpoint 保留活动消息及其工具关联，不靠当前屏幕最后一条消息猜归属。
- replay 对开始、参数、执行状态、结果使用一致的归属和终态判定。已存在工具的迟到结果可按原合同更新原 part，但不得复活消息或创建另一条 assistant。
- 对当前 seed 中缺失但历史中可定位的归属，使用已有 journal/消息索引恢复原消息；无法归属的事件保留在原 journal 并产生诊断，不通过 tool-* fallback 制造成功的用户历史。
- 限定在持久化恢复边界修复该问题，不未经消费者审计便全局删除 toolkit 的行为，不扩张公共协议或新增通用恢复框架。

### 3. 增量恢复与完整恢复使用同一语义

- checkpoint 保留真实活动消息和恢复所需关联；activeMessageId 不能被人为 final 清空。
- 分段仅改变执行成本，不能改变消息 ID、工具归属、内容或最终状态。
- 不将增量尾部未返回的消息视为删除；本次残留由修复后的完整重建解决，避免误删正常历史。

### 4. 修复已经受影响的历史投影

- 先修并验证完整 replay，再升级消息投影版本，使旧投影不能继续作为有效数据返回。
- 通过明确的投影升级/重建动作，从原始 journal 重建派生消息与索引；完成验证后替换派生产物。该动作不调用模型、不执行工具、不改写原 journal。
- 重建按 session 串行，以一致 journal offset 为边界，后续事件从该 offset 接续；中途失败保留 journal，可重试，不把旧错误投影宣称为健康。
- 本现场 journal 完整，实验已证明可恢复两条正确消息。若其它会话的 journal 自身就含有错误合成消息或缺失事件，需另行诊断，不能套用按 unknown 名称或 tool-* 前缀删除的规则。
- 不新增页面加载时隐式执行业务的修复逻辑；缓存版本与重建使用现有 storage owner，迁移动作和结果明确可观察。

## 状态与验证矩阵

| 场景 | 必须证明 |
| --- | --- |
| 普通最终回复 | 完整正文、工具结果、顺序与元数据不丢失，无额外 assistant。 |
| 运行中刷新 | 正常消息仍活动，继续接收同一 run 的工具和正文。 |
| 中途 assistant 快照后继续工具 | 同一消息持续累积工具，checkpoint 不改变状态和身份。 |
| 结束后刷新、分页重进、冷加载 | 消息集合及终态与 live 一致，无新增等待动画。 |
| 失败、取消、宿主中断 | 明确终态，迟到 start/result 均不复活消息；不自动重新执行。 |
| 新一轮执行/用户重试 | 新旧 message/run 归属分离，旧终态 guard 不阻断合法新 run。 |
| 旧投影升级 | 从 journal 重建消除派生重复，原始事件不变；重复重建幂等。 |
| 旧 draft 历史 | 在明确旧数据边界处理，现代活动消息不被误判。 |

正式实现应增加脱敏多轮工具事件 fixture，比较实时状态、各实际保存边界的增量投影和完整重放；断言消息 ID 集合、状态、正文、工具唯一性及结果。覆盖运行中和结束后不同切点，补迟到结果与已有取消/中断回归。

实现后执行匹配范围的 TypeScript 检查、kernel 恢复/投影与 toolkit 相关测试、diff-only review。最终沿真实产品链路验收：保留用户入口，修复后刷新此会话；另在正常会话中进行真实模型多轮工具请求，分别于运行中与结束后刷新。临时重放只作为根因与自动回归证据，不作为用户验收环境。

## 取舍与交付边界

前端隐藏 unknown 或 idle 下所有工具消息会掩盖错误历史；仅删缓存会让未修复的完整重放产生七个重复结果；仅保留 streaming 虽修复本样例，但遗漏旧历史、中断与迟到结果合同。以上均不足以交付。

保留 journal、现有 state manager 和 projection owner；删除正常重放中的无条件终态转换及无归属事件的虚假消息生成路径；不做无证据需要的协议重构和全仓状态框架调整。本次不发布 NPM；原始会话事件不改写，仅由现有投影 owner 重建派生记录。已完成上述真实链路验证，交付范围是验证后的主干集成。
