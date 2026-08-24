# 模型运行触发来源与后台通知设计

## 背景与真实故障

NextClaw 当前会在任意不可见会话出现 `assistant final` 消息时弹出右上角通知。通知消费者只检查消息角色、状态、隐藏标记和页面可见性，不知道这次运行由人、另一个 Agent、自动观察或系统恢复触发。

真实子会话 `ncp-mt7ex0fl-992e1c7d` 证明现有数据不足以解释运行来源：

- session metadata 只有 `parent_session_id`、`spawned_by_request_id` 和目标 session 的偏好模型；
- session-request 目标 user message 只有 `session_request_id` 与目标 run 的 `run_spec`；
- request journal 虽有 source/target session、tool call、task、notify 和状态，但没有源消息、源 run、触发模型，也没有前端投影；
- 该 run 后续产生 157 次 429 retry，最终被宿主中断。journal 能看到 retry，但前端无法从“谁触发”一路关联到“使用什么模型运行、后来为什么没有结束”。

因此这不是一个 toast 条件遗漏，而是 run trigger provenance 能力面缺失：producer 没有生成完整事实，持久化层没有稳定合同，通知与详情消费者只能各自猜测。

## 用户任务与成功条件

用户离开会话后：

1. 人直接提交、编辑或继续的会话回复完成时，仍可收到后台通知。
2. Agent 自主委派、自动观察或其它非人触发的运行完成时，不弹全局通知。
3. 用户进入会话后，可以从触发消息或回复的“更多操作”查看这次运行的 actor、入口、时间、源 session/message/run/tool call/request、触发模型和目标 run 信息。
4. 运行失败、中断或没有形成 assistant final 时，触发 user/service message 本身仍保留 provenance；session 现有 activity metadata 继续解释最近失败状态。
5. 刷新、恢复和 journal replay 后，详情与通知判定不依赖内存缓存。

## 缺口等级

按设计缺失范围判定，这是“能力面缺失”：同一个触发事实跨 session tool、session request、agent-run queue、NCP journal/replay、实时 event bus、通知和消息详情多个 consumer。只在 toast 中判断 `parent_session_id` 会错误压制人直接操作 child session，也无法解释 top-level automation。

不升级为通用审计系统：本次只覆盖“是什么触发了一次模型 run”及其直接关联，不建设任意事件图、全文 trace 搜索、诊断日志浏览器或新的数据库。

## 固定合同

### Canonical metadata

在 NCP message/run metadata 中新增 `run_trigger`，版本为 1：

```ts
type NcpRunTriggerMetadata = {
  version: 1;
  actor: "human" | "agent" | "automation" | "system";
  source: string;
  triggeredAt: string;
  targetRunId: string;
  sourceSessionId?: string;
  sourceMessageId?: string;
  sourceRunId?: string;
  sourceToolCallId?: string;
  sourceRequestId?: string;
  sourceModel?: string;
  sourceContext?: Record<string, string | number | boolean | null>;
};
```

- `actor` 决定通知资格；`source` 只用于解释入口，不能替代 actor。
- `sourceModel` 表示发起委派的模型；目标实际模型继续由现有 `run_spec` / `ai_execution` owner 表达，禁止双写同一模型事实。
- `targetRunId` 将触发消息、assistant 结果和 run lifecycle 关联到同一次运行。
- `sourceContext` 保存入口拥有的稳定标识快照，例如 channel/chat/account/sender、cron job、observation delivery/subscription；只接受标量字段，不复制无界 payload 或敏感正文。
- provenance 在 run 入队时冻结；queued、steered、retry、恢复和最终完成不改变 actor/source。
- 外部 payload 中同名 metadata 不是权威身份。Kernel 根据 ingress context、message role 或内部 session-request producer 生成 canonical trigger。

### Actor 来源

| 入口 | actor | source 示例 |
| --- | --- | --- |
| UI/API 中的可见 user message | `human` | `ui-http` |
| 渠道用户消息 | `human` | `channel:<kind>` |
| 编辑消息、点击继续 | `human` | `message-edit` / `continue-run` |
| `sessions_spawn` / `sessions_request` 工具 | `agent` | 工具名 |
| learning loop、observation delivery | `automation` | 对应 producer 名 |
| cron 定时任务 | `automation` | `cron:<job-id>` |
| 其它非 user 内部输入 | `system` | ingress source 或 `internal` |

Session request producer 必须显式提供来源；Kernel 不从 task 文本或模型名称猜 actor。

## 权威主链路

```text
用户/渠道/Agent tool/automation producer
  -> AgentRunRequest.trigger（Kernel 内部输入事实）
  -> SessionRun 入队并分配 targetRunId
  -> Kernel 规范化 NcpRunTriggerMetadata
  -> 写入触发 message.metadata.run_trigger
  -> 发布并持久化 run.metadata(run_trigger)
  -> NCP conversation state 在 assistant settlement 时附着同一 run_trigger
  -> journal replay / message projection 保留
  -> UI 消息详情与后台通知消费同一事实
```

Kernel 的 agent-run request owner 负责规范化和冻结；NCP toolkit 只负责随 run lifecycle 附着/恢复；UI presenter 只投影视图，不重算 actor。

### Session request 补充证据

Session request record 的 metadata 保存同一 source trigger snapshot；新建 child session 的 metadata 也保存创建来源 snapshot，便于在 session header 原始 metadata 中快速查看。每一次实际 target run 仍以对应 target user/service message 的 `run_trigger` 为完整历史，不在 session metadata 维护无界数组。

## 通知不变量

`ChatCompletionNotificationManager` 的判定顺序：

1. 保留现有 role/status/hidden/idempotency/visible-session 条件。
2. 有 `run_trigger` 时，只有 `actor === "human"` 才弹通知。
3. 旧消息没有 `run_trigger` 时：若 session summary 明确存在 `parent_session_id`，静默；否则保持旧的后台通知行为。

该 fallback 只服务已持久化的旧数据，不写回、不迁移、不扫描历史。新写入路径缺失 provenance 视为 producer bug，不增加多级猜测。

`notify: "final_reply" | "none"` 仍只控制 session request 是否等待/回填父工具调用，不决定全局 toast；避免把两个不同语义继续混在一起。

## 前端信息架构

复用消息现有“更多操作”入口：

- 有 trigger provenance 的 user/service/assistant message 增加“查看触发信息”。
- assistant message 同时拥有现有“查看 AI 执行信息”和新的 trigger item；不新增第二个常驻图标。
- 详情使用现有可访问 Dialog，显示结构化字段和一行格式化 raw JSON；关闭后焦点回到更多操作按钮。
- 没有 trigger 的旧顶层消息不显示空入口；旧 child 仍可从 session metadata 查看 parent/request 基础信息。

该入口是只读查看，不触发加载、修复、重试或写回。

## 状态矩阵

| 场景 | durable trigger | 通知 | 前端可查 |
| --- | --- | --- | --- |
| 人在顶层 session 发送 | `human` | 不可见时通知 | 输入与回复 |
| 人直接进入 child 后发送 | `human` | 不可见时通知 | 输入与回复 |
| Agent 创建并运行 child | `agent` | 静默 | child metadata、输入与回复 |
| Agent 请求已有 session | `agent` | 静默 | request record、输入与回复 |
| learning loop / observation | `automation` | 静默 | 输入与回复 |
| queued / steered | 原 trigger 不变 | 最终按 actor | 输入立即可查，回复后补齐 |
| retry | 原 trigger 不变 | 未 final 不通知 | trigger + 现有运行状态证据 |
| failed / interrupted | 原 trigger 不变 | 不通知 | trigger message + activity/error |
| refresh / replay | 从 journal 恢复 | 语义不变 | 语义不变 |
| 旧 top-level 无 trigger | 无 | 保留旧通知 | 无空详情 |
| 旧 child 无 trigger | 无 | 静默 | session 基础 metadata |

## 候选比较

### 只在通知层检查 child

不采用。无法区分人直接操作 child 与 Agent 委派，也遗漏 top-level automation；仍然没有可查询证据。

### 只给 session metadata 增加创建来源

不采用。一个 session 可以被多次触发，单个字段会覆盖历史或演变成无界数组；也无法与具体 assistant reply 关联。

### 只记录诊断日志

不采用。诊断日志不是用户会话的 durable 产品事实，刷新/迁移/UI 投影没有稳定合同，通知也不应依赖日志查询。

### 每个 run 的 canonical trigger + message/journal 投影

采用。它把每次触发与实际 run、输入和输出绑定，通知与前端详情只消费同一事实；不增加数据库或平行审计系统。

## 抽象审计

- 保留：`AgentRunRequestManager` 作为 run admission owner；NCP run metadata 与 conversation state 作为持久/恢复主链；现有 message more-actions primitive。
- 新增：一个小型 NCP trigger schema/reader、Kernel trigger 规范化函数、UI trigger details projector。三者分别保护协议、运行 owner 和视图边界，均有当前消费者。
- 删除：通知层“所有后台 assistant final 都等价于人请求”的隐式假设。
- 延后：全局 trace 浏览器、trigger 搜索/筛选、任意因果图、历史 backfill、诊断 retry 事件 UI。当前没有证据要求一次建设完整观测平台。
- 禁止：在 toast consumer 读取 task 文本、模型名、tool name 字符串来猜 actor；在 session metadata 保存无界 trigger history。

## 验证标准

1. 失败优先证明：当前 agent-triggered child assistant final 会弹通知，且 target message/session metadata 缺少 source model/message/run/tool provenance。
2. Kernel：direct human、channel human、agent session request、automation、edit/continue 分别生成正确 actor/source；queue/steer 不改变 trigger。
3. NCP toolkit：run metadata 在 completed、abort/error settlement 与 replay 后附着到对应 assistant message，不串到下一次 run。
4. Session request：record、child session metadata、target message 保存一致的 source snapshot；source model 来自发起 run 的 canonical `run_spec`。
5. UI 通知：human 后台 final 通知；agent/automation/system 不通知；旧 child 无 trigger 静默；旧 top-level 保留；visible/hidden/dedupe 行为不回归。
6. UI 详情：trigger-only user message 和 execution+trigger assistant message均可从更多操作查看；键盘、关闭焦点和 raw JSON 正常。
7. 相关 packages TypeScript、定向 Vitest、ESLint、governance、diff-only maintainability 通过。

## 非目标

- 不自动删除或迁移已有 child/session request。
- 不改变 parent continuation、session request notify 或 child completion card 语义。
- 不把 provenance 作为鉴权凭据；它是可解释性与通知策略事实。
- 不在本次开发 retry 历史浏览器或诊断日志查询 UI。
- 不重启、提交、推送、发布或部署当前运行实例。
