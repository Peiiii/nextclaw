# QQ 消息交付可靠性设计

## 背景与证据

QQ 用户反馈偶发消息无响应。单实例真实验证已经得到以下边界证据：

- 正常连接下，单条消息与五条快速连续消息均严格一进一出，没有丢失或重复。
- 暂停 QQ 渠道进程直到 WebSocket 重连，在断线窗口发送的消息可见于 QQ 客户端，但没有进入 NextClaw 入站 journal；重连后的下一条消息正常进入并回复。
- 原依赖 `qq-official-bot@1.0.12`。该版本在 WebSocket close 时同时触发 receiver 内部重连和 session close 重连；上游 1.2.4 修复了重复重连路径，但对未枚举 close code 仍固定新建 session。
- QQ 扩展当前在调用 `publishInbound` 前写入已处理集合；若提交失败，QQ 使用同一 message id 重投时会被误判为重复。
- QQ 扩展在 bot 暂不可用时直接返回，出站调用表现为成功但实际没有发送。

这些证据确认了三类不同问题，不能用一个通用“重试”混在一起：网关断线空窗、入站提交事务边界、出站连接状态。

## 目标与非目标

目标：

- 单实例正常链路保持一条 QQ 消息只触发一次 NextClaw 入站。
- `publishInbound` 失败时不提交去重状态，允许同一 message id 后续重投。
- bot 不可用时禁止出站静默成功。
- 使用已修复重复重连的 QQ SDK，并用真实 QQ 复验断线窗口是否能通过 session resume 补投。
- 连接断开、恢复和消息提交失败必须产生不包含消息正文或凭据的结构化诊断信号。

非目标：

- 不假设用户运行多个实例；多实例仅作为本地测试污染隔离。
- 不建设第二套消息总线、QQ 历史轮询或自定义持久消息队列。
- 不承诺恢复 QQ 平台在无有效 session 时从未投递给客户端的事件；若升级后仍无法补投，必须如实披露协议边界。
- 不修改其它渠道的交付语义。

## 方案选择

### 方案 A：只升级 SDK

优点是改动最小，并直接获得上游重复重连修复。缺点是无法修复 NextClaw 自身已经通过故障注入证明的提前去重和静默出站问题，也缺少边界诊断。

### 方案 B：升级 SDK，并收紧 QQ 扩展的交付合同

采用此方案：

1. 将 `qq-official-bot` 升级到当前稳定版本 1.2.4，获得上游的单一重连路径。
2. 对 1.2.4 保留一个 pnpm 依赖补丁：未知传输断开时，只要 `session_id` 仍有效就按最后 `seq` 发起 RESUME；`INVALID_SESSION` 会先清空 session，因此仍安全回落到新建会话。补丁同时向 session manager 透出 `RESUMED` 诊断事件。
3. QQ 入站 message id 使用 `processing -> processed` 两阶段状态：并发处理中拒绝重复，只有 `publishInbound` 成功后才提交 processed；失败时释放 processing。
4. bot 未连接时，`send` 抛出明确错误，交给现有 NCP event 错误边界处理，不伪造发送成功。
5. 订阅 QQ session 生命周期，在 ready/resumed/disconnect/dead 和入站提交失败时输出结构化、无正文诊断；不记录 app secret、access token、用户消息正文。
6. 用同一套真实 QQ 探针验证正常、突发、断线窗口和重连后恢复。

它保持 QQ 扩展为唯一 provider owner，不新增平行 transport；每个失败都有明确状态和信号。

### 方案 C：在 NextClaw 内建设持久重放队列

暂不采用。队列只能重试已经到达 NextClaw 的事件，不能恢复 QQ 网关从未投递的 `R01`；同时会引入跨 package 的持久化、过期、幂等和补偿合同，不能用来掩盖上游 session resume 是否工作的未知项。

## 状态与不变量

### 入站

```text
QQ event
  -> processing(messageId)
  -> publishInbound
     -> success: processed(messageId)
     -> failure: release processing(messageId), propagate error
```

不变量：

- 同一 message id 在并发处理中最多只有一个提交调用。
- 只有得到 kernel `accepted` 响应后才可视为 processed。
- 无 message id 的事件不做持久幂等推断，仍按现有单次事件处理。

### 连接与出站

- `bot !== null` 只表示 SDK 已 ready，可用于发送。
- session disconnect/dead 时产生诊断信号；SDK 负责协议级 resume/reconnect，QQ 扩展只在 SDK 宣告 dead 后重建 bot，避免第二条竞争重连路径。
- `bot === null` 时发送必须失败，不返回伪成功。

### 诊断

- 记录事件类型、close code、连接代次、重连尝试、message id 和错误摘要。
- 禁止记录 secret、token、消息正文和完整用户身份信息。
- 诊断是观察路径，不触发重连、提交或发送副作用。

## 验证标准

自动验证：

- QQ 扩展定向测试覆盖并发重复、提交失败后重投、断线发送失败和生命周期信号。
- QQ 扩展测试、匹配范围 TypeScript 类型检查通过。
- SDK 锁文件实际解析到目标版本。

真实验证：

- 单实例基线：1 发、1 入站、1 回复。
- 快速连续：至少 5 发、5 入站、5 回复，编号和顺序可核对。
- 断线窗口：记录断线前后 socket/session 行为；窗口消息若被 Resume 补投则必须只处理一次。
- 重连后：下一条探针正常入站和回复。

若断线窗口消息仍不补投，结论必须限定为 QQ 平台或 SDK 的恢复边界，不能以正常链路测试通过宣称问题完全修复。

## 实测结果

- 单实例基线 1/1/1 通过，五条快速连续消息 5/5/5 通过，每个 message id 只有一次入站。
- 仅升级到 1.2.4 时，75 秒进程冻结窗口内的 `QFR1RFQ` 未进入 journal，恢复时观察到新 `READY`，证明 SDK 仍放弃原 session。
- 加入依赖补丁后，同样的 75 秒冻结实验连续两次补投成功；最终组 `QFR5RFQ` 恢复时明确记录 `RESUMED`，入站一次、回复一次。
- 恢复后新消息 `QFR6RFQ` 继续正常入站并回复，连接未停留在一次性恢复状态。
