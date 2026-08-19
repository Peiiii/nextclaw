# NextClaw 运行故障排查

当用户反馈消息未收到、Agent 未回复、扩展退出、配置未生效、定时任务未执行或其他“偶发”运行问题时，按本流程排查。不要先猜根因或直接修改代码。

## 1. 确认实例和当前状态

```bash
nextclaw status --json
nextclaw doctor --json
nextclaw channels status
nextclaw logs path
```

- 以 `status --json` 返回的 PID、endpoint 和日志路径为准；
- 如果本机有多个非预期实例，先报告，不把多个实例当成普通用户前提；只有用户授权时才停止多余实例；
- `doctor` 说明“现在是否健康”，日志说明“时间窗内发生过什么”，两者不能互相替代。

## 2. 确定最小时间窗

优先使用用户给出的大致发生时间。没有时间时，先查最近 2 小时：

```bash
nextclaw logs query --since 2h --level warn,error,fatal --json
nextclaw logs query --since 2h --outcome cancelled --json
nextclaw logs query --since 2h --reason-code network_timeout --json
```

如果结果太多，按诊断域缩小：

```bash
nextclaw logs query --since 2h --domain channel.delivery --json
nextclaw logs query --since 2h --domain extension.lifecycle --json
nextclaw logs query --since 2h --domain agent.run --json
nextclaw logs query --since 2h --domain tool.execution --json
nextclaw logs query --since 2h --domain transport.request --json
nextclaw logs query --since 2h --domain config.apply --json
nextclaw logs query --since 2h --domain automation.execution --json
nextclaw logs query --since 2h --domain runtime.lifecycle --json
```

查询结果中的 `invalidLines` 不为 0 时，明确说明日志中存在无法解析的旧格式或损坏行；不要把查询不到结构化事件写成“没有发生”。`truncated=true` 时缩小时间窗或增加 `--limit`。

## 3. 按 correlation 还原单次操作

从相关事件的 `context.correlationId` 取得关联 id，再查询整个操作：

```bash
nextclaw logs query --correlation-id <id> --since 2h --json
```

按时间排序后写出：

1. 已观察到的入口；
2. 最后一个成功或 accepted 事件；
3. 第一个 failed/rejected/cancelled/unavailable 事件；
4. 本应出现但缺失的下一阶段；
5. 当前证据等级和最小复验动作。

## 4. 症状到诊断域

| 用户症状 | 先查 | 再查 |
| --- | --- | --- |
| 渠道没收到消息、没回复、重复或延迟 | `channel.delivery` | `extension.lifecycle`、对应 correlation 的 `agent.run` |
| Agent 没完成或报错 | `agent.run` | 同 correlation 的入口域、runtime 状态 |
| 工具没执行、被取消或执行报错 | `tool.execution` | parent correlation 对应的 `agent.run`、必要时 `transport.request` |
| network error、请求超时、限流或远端不可用 | `transport.request` | 同 correlation 的业务域与 `runtime.lifecycle` |
| 扩展反复退出或渠道离线 | `extension.lifecycle` | `runtime.lifecycle`、channel 当前状态 |
| 配置保存后没生效 | `config.apply` | 当前 config 与相关 owner 状态 |
| 定时任务没执行或没通知 | `automation.execution` | 同 correlation 的 `agent.run` / `channel.delivery` |
| Service 启动、退出或健康异常 | `runtime.lifecycle` | `doctor --json`、error/fatal 日志 |

所有关键 owner 都应形成 started 到终态的闭环。`cancelled` 是独立终态，不要解释成系统失败。常见安全 `reasonCode` 包括 `operation_cancelled`、`network_timeout`、`network_dns_failure`、`network_connection_refused`、`network_connection_reset`、`network_unreachable`、`network_tls_failure`、`http_rate_limited`、`http_remote_unavailable` 和 `unexpected_error`。日志只能用这些分类和 HTTP 状态判断边界，不能要求或回显 URL、请求正文、响应正文、header 或凭据。

`tool.execution` 只记录工具名、tool call correlation、Agent parent correlation、时长和结果分类，不包含参数与结果。若看到 `tool.started` 后没有任何终态，先判断进程是否崩溃或日志是否截断；不要直接认定工具仍在运行。

## 5. 渠道投递阶段

典型事件顺序：

`inbound.observed -> inbound.submit.started -> inbound.submit.succeeded -> inbound.accepted -> route.resolved -> agent.run started/completed -> reply.queued -> outbound/provider send succeeded`

- `inbound.rejected`：查看 `reasonCode`，例如 allowlist、duplicate、identity_missing；
- `observed` 后无 submit success：扩展或 extension transport 边界；
- `accepted` 后无 Agent completion：路由或 Agent 执行边界；
- Agent completed 后 send failed：回复回发边界；
- 网关 disconnect/dead 窗口内没有 inbound trace：只能证明本地在该窗口不可用；
- 网关健康但完全没有匹配 trace：本地无证据，不能证明外部平台是否投递。请用户提供大致时间，或发送一条新的唯一测试消息进行复验。

## 6. 结论格式

使用以下三档结论，不越过证据：

- **已证明**：存在明确 failed/rejected/cancelled/unavailable 事件，或完整成功链；
- **阶段性判断**：相邻阶段缺失且生命周期事件支持某个边界，但诊断链不完整；
- **证据不足**：本地没有匹配入口、日志超出保留窗口、结果被截断或存在解析失败。

最终说明实际查询的时间窗、实例 PID、诊断域、correlation id（如有）、最后证据和复验结果。日志默认不应包含正文、用户身份、凭据或 provider message id；发现这些内容时不要在回复中回显，并把它报告为日志隐私缺陷。
