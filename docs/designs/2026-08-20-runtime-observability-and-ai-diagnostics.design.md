# NextClaw 运行可观测与 AI 自诊断设计

## 问题定义

QQ “偶发丢消息”只暴露了一个系统级缺口：NextClaw 目前没有统一、可关联、可查询的运行证据模型。`service.log` 能持久化主进程的 `console`，但大量日志仍是自然语言；后台 Service 丢弃标准输出，扩展和其他子进程的输出不保证落盘；`doctor` 只做当前状态检查；内置 AI skill 也没有从症状到日志证据的排查合同。

因此不能把本任务实现为 QQ 专用日志。目标是建立全局诊断基础设施，并让渠道投递成为第一个端到端验证域。

## 成功标准

用户描述“消息没到”“Agent 没回复”“扩展反复退出”“配置改了没生效”“定时任务没执行”等症状时，AI 应能：

1. 找到唯一运行实例、权威日志路径和正确时间窗；
2. 通过结构化事件定位最后一个成功阶段和第一个失败或缺失阶段；
3. 用 correlation id 还原跨组件、跨进程的单次操作；
4. 区分已证明事实、基于窗口的推断和本地不可证明的外部状态；
5. 默认不读取或记录消息正文、用户身份、凭据和任意业务 payload；
6. 给出可执行的下一步复验，而不是直接修改一个猜测点。

## 当前证据

- 主进程已有 JSONL `service.log`、`crash.log`、轮转和 `console` mirror；可复用，不应新增平行日志系统。
- 整个核心运行面只有少量代码直接使用结构化 `AppLogger`，其余大量 `console` 只能得到 `scope=console` 的自然语言。
- 后台 Service 使用 `stdio: "ignore"`；扩展进程继承该输出目标，所以正式运行中的扩展日志可能消失。
- `nextclaw logs` 只有 `path` 和 `tail`，缺少时间、scope、事件和 correlation 查询。
- `nextclaw doctor` 能检查进程、端口、provider 和 extension 当前状态，但不能读取一段时间内发生过什么。
- `nextclaw-self-manage` 没有运行故障的证据等级、事件域和日志查询流程。

## 范围判定

这是“系统模型缺失”：缺口横跨主进程、子进程、transport、持久化、CLI 和 AI consumer。只给 QQ 加日志会在 Agent、自动化、扩展和配置链路重复失败。

本批建立最小完整能力面：统一事件合同、跨进程上报、只读查询、AI 排查 reference，以及高价值主链路的结构化覆盖。它不是一次性迁移全部 `console`，也不建设远端日志平台。

## 统一模型

### 1. 唯一 owner

`DiagnosticRuntime` 归 core logging 模块，是结构化诊断事件校验、脱敏和写入的唯一 owner。它复用现有 `LoggingRuntime` / `FileLogSink`，所有事件仍写入权威 `service.log`，error/fatal 按现有规则进入 `crash.log`。

- 领域 owner 只上报自己亲眼观察到的事实；
- kernel 拥有跨入口的产品运行语义和 correlation 传播；
- service/CLI 只查询、投影，不复制事件事实；
- skill 只解释证据，不生成系统状态。

不得新增 QQ 日志文件、扩展日志数据库、第二套 logger 或独立故障排查 skill。

### 2. 事件合同

每条诊断记录使用 scope `diagnostics.<domain>`，message 为稳定 event，context 至少包含：

- `schemaVersion`：当前为 `1`；
- `domain`：稳定诊断域；
- `event`：稳定事件名；
- `component`：事实 producer；
- `outcome`：`observed | started | accepted | succeeded | rejected | cancelled | failed | unavailable | suppressed`；
- `correlationId` / `parentCorrelationId`：单次操作关联，可选；
- `durationMs`、`attempt`：有限数值事实，可选；
- `facts`：经过 key/value 限制和脱敏的低基数事实，可选。

全局禁止字段包括正文、prompt、response、payload、token、secret、authorization、cookie、sender/chat/user 标识和附件内容。字符串有长度上限，对象深度和总字段数有上限；拒绝循环结构和任意 Error/payload 直写。错误统一经过安全分类器转换为稳定 `reasonCode`、可选 `providerCode` 和低基数事实；不把任意 Error、堆栈或错误消息直写诊断事件。

事件合同不是一张固定事件名白名单，而是所有关键 owner 的共同状态机：入口先记录 `observed/started/accepted`，终点必须落在 `succeeded/rejected/cancelled/failed/unavailable/suppressed` 之一。未知异常也必须以 `unexpected_error` 收口，不能因为尚未识别错误类型而没有日志。

错误分类覆盖取消、超时、DNS、拒绝连接、连接重置、网络不可达、TLS、HTTP 鉴权/权限/限流/服务端不可用、输入错误与未知异常。HTTP 只允许记录状态码；网络请求不得记录完整 URL、query、header、body 或响应内容。

### 3. 诊断域与覆盖优先级

本批必须覆盖以下 P0 域：

| domain | 起点 | 成功终点 | 关键失败 |
| --- | --- | --- | --- |
| `runtime.lifecycle` | serve/service 启动 | healthy/stop | startup、lease、crash |
| `extension.lifecycle` | discover/spawn | ready/stop | timeout、exit、restart limit |
| `config.apply` | 配置变更观察 | 各 owner apply 完成 | reload rollback/fail |
| `channel.delivery` | 平台/扩展观察到消息 | provider send success | filter、ingress、route、Agent、send |
| `agent.run` | 请求 accepted | completed/failed | queue、runtime、abort、missing completion |
| `tool.execution` | runtime 调用任意工具 | succeeded/cancelled/failed | validation、abort、工具异常 |
| `transport.request` | owner 发起外部请求 | succeeded/cancelled/failed | timeout、DNS、connect、TLS、HTTP、retry exhausted |
| `automation.execution` | trigger | completed/failed | schedule、dispatch、delivery |

`tool.execution` 在 kernel 汇总所有 ToolProvider 后统一包装，因此覆盖 core、MCP、消息、项目、会话和后续新增工具；不依赖每个工具作者手工记日志。它只记录工具名、时长、结果分类和关联 id，不记录参数或结果。

`transport.request` 由真正拥有请求语义的边界记录，不通过全局 monkey patch 拦截 `fetch`。P0 owner 的异常统一使用同一错误分类器；后续 update、App、MCP、remote 等 P1 域接入时沿用该合同和分类器，不另造错误格式。

### 4. 跨进程上报

扩展通过认证的通用 ingress `extension.diagnostic.emit` 上报结构化事件。kernel 从认证上下文注入 `extensionId` 和 `generation`，不信任扩展自报身份；payload 受相同字段、长度和隐私规则约束。

诊断失败不能阻断业务主链路。SDK `emit` 使用有界超时并返回是否成功；渠道在串行后台队列中上报以保持顺序，业务调用不等待该队列。队列失败不写入第二份文件；相邻成功事件缺失时，AI 必须标注“观测不完整”，不能把日志缺口直接当业务失败。

子进程任意 stdout/stderr 仍不是权威诊断事件。通用捕获可另行建设用于开发辅助，但不能绕过结构化合同和隐私边界。

### 5. correlation

kernel 在操作入口创建或接收 correlation id，并通过现有 metadata/envelope 贯穿下游；各层读取同一 id，不自行生成同一操作的第二身份。

- 渠道消息：扩展基于 `domain + channel + provider message id` 生成固定长度摘要；provider id 不落日志；无稳定 id 时随机生成。
- Agent/自动化/配置：优先复用已有 requestId/runId/job run id；日志只保存对应关联 id，不记录业务正文。
- 工具：`toolCallId` 是工具执行 correlation，Agent run correlation 是 parent；即使同一 run 并行调用多个工具也可分别还原。
- 回复沿入站 correlation id 传播，streaming/typing 控制消息不作为最终成功证据。

### 6. 查询面

扩展现有 `nextclaw logs`，增加只读结构化查询能力，至少支持：

- `--since` / `--until`；
- `--level`；
- `--scope` 或 `--domain`；
- `--event`；
- `--outcome` / `--reason-code`；
- `--correlation-id`；
- `--json` 与结果上限；
- 当前日志和命中时间窗的 archive。

查询解析失败行需要计数并报告，不得静默把“日志损坏”表现为“没有事件”。该命令只读取日志，不改变运行状态。

`doctor --json` 继续负责当前健康快照，不承担历史事件真相；AI 先用 doctor 确认现在，再用 logs query 解释过去。

### 7. AI 自诊断

扩展现有 `nextclaw-self-manage`，新增条件 reference `runtime-diagnostics.md`。它按症状映射诊断域，执行：

1. `status --json` / `doctor --json` 确认实例和当前状态；
2. 询问或推定最小时间窗；
3. 查询相关 domain，按 correlation 聚合；
4. 输出“已观察阶段、最后成功、失败/缺失下一跳、证据等级、复验动作”；
5. 外部事件从未到达本地时明确说“本地无证据，不能证明外部平台是否投递”。

AI 不直接先修代码。只有真实复现或日志指向稳定失败边界后，才进入代码调查与修复。

## QQ 作为首个端到端验证域

QQ 接入 `channel.delivery`，覆盖网关 connect/ready/resume/disconnect/dead/reconnect、消息 observed/rejected/submit、kernel accepted/route、Agent started/completed/failed、reply queued/suppressed 和 provider send success/fail。所有阶段使用同一 correlation id。

这证明全局模型能跨扩展进程和 kernel 工作，但 QQ 不拥有日志基础设施。

## 失败与恢复语义

- 全链路事件完整：可证明本地链路完成；
- started 后出现 cancelled：可证明 owner 观察到明确取消；取消不伪装成失败；
- started 后出现 failed：可证明对应 owner 失败；
- failed 的稳定 `reasonCode` 可进一步区分网络、权限、限流、输入与未知异常；
- 相邻阶段缺失且诊断上报本身健康：定位到边界级故障；
- 诊断事件缺口：标记观测不完整，重新故障注入；
- 外部输入无任何本地 observed：只能结合 lifecycle 窗口判断本地是否可用，不能证明外部平台行为；
- 日志轮转/损坏/时间窗外：查询结果必须披露覆盖范围和解析失败数。

## 迁移与删除

- 将本批触达 owner 的自然语言 `console` 迁移到 `DiagnosticRuntime`，不双写同一事件；
- 将已开始的渠道专用 `ChannelDeliveryDiagnostics` 收敛为全局 `DiagnosticRuntime`；
- 将 `extension.channel.diagnostic.emit` 收敛为通用 `extension.diagnostic.emit`；
- 保留 console mirror 作为未迁移代码的兼容捕获，但它不是结构化诊断事实；随着 P0 owner 迁移逐步减少 `scope=console`。

## 非目标

- 不在本批一次性替换仓库全部 console；
- 不上传远端、不新增 telemetry 服务、不做日志 UI；
- 不记录敏感业务内容以换取排查便利；
- 不宣称本地日志能证明从未到达本地的外部事件；
- 不为 P1 域制造空事件或无真实 owner 的 wrapper。

## 验证标准

1. `DiagnosticRuntime` 的 schema、脱敏、大小限制、level 映射和 JSONL 写入测试；
2. 通用 extension ingress 的鉴权、身份注入、非法字段拒绝和 best-effort 测试；
3. logs query 对当前/归档、时间、domain/event/correlation、坏行的测试；
4. P0 owner 的正常、失败、恢复事件测试与匹配 package `tsc`；
5. 唯一实例下做 QQ 正常消息、提交失败、gateway dead 和 send failure 故障注入；
6. 只用 `status/doctor/logs query` 与 self-manage reference 还原故障层；
7. 抽查实际日志，确认不含正文、用户身份、凭据和 provider message id。
