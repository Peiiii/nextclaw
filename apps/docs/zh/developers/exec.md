# `nextclaw exec`

`nextclaw exec` 是面向 Shell、CI 和定时任务的一次性 headless runner。它与 Harness 共享 kernel/NCP run chain，不进入交互模式。

## 命令格式

```bash
nextclaw exec [prompt...] \
  [--agent <id>] \
  [--session <id>] \
  [--model <model>] \
  [--format text|json|jsonl] \
  [--timeout <ms>]
```

- `--agent`：选择 Agent。
- `--session`：恢复指定 session；不传时创建新的 `exec:<uuid>`。
- `--model`：本次任务的模型覆盖。
- `--format`：默认为 `text`，也可使用 `json` 或 `jsonl`。
- `--timeout`：超时后取消任务，单位为毫秒。

## 输入

有 prompt 参数时使用参数；如果同时存在 piped stdin，stdin 会作为同一次任务的追加上下文。没有 prompt 时读取 piped stdin。两者都为空会返回输入错误，不会进入交互模式。

```bash
nextclaw exec "总结这个目录"
cat context.txt | nextclaw exec "分析以下上下文"
```

## 输出

`text` 模式的 stdout 只有最终文本。`json` 模式输出一个最终 envelope：

```json
{
  "schemaVersion": "nextclaw.exec/v1",
  "status": "completed",
  "result": {
    "schemaVersion": "nextclaw.task/v1",
    "status": "completed",
    "kind": "agent",
    "agentId": "main",
    "sessionId": "exec:2c8f...",
    "runId": "run-...",
    "text": "任务已完成",
    "completedMessage": {
      "id": "assistant-123",
      "sessionId": "exec:2c8f...",
      "role": "assistant",
      "status": "final",
      "parts": [{ "type": "text", "text": "任务已完成" }],
      "timestamp": "2026-08-22T10:00:00.000Z"
    }
  }
}
```

`jsonl` 会为每个 NCP event 输出一个 event envelope，最后输出一个 result envelope。event 的 payload 由 NCP event contract 定义；CLI 不另造 event 字段。JSONL 示例：

```text
{"schemaVersion":"nextclaw.exec/v1","type":"event","event":{"type":"run.finished","payload":{"sessionId":"exec:2c8f...","runId":"run-123"}}}
{"schemaVersion":"nextclaw.exec/v1","type":"result","status":"completed","result":{"schemaVersion":"nextclaw.task/v1","status":"completed","kind":"agent","agentId":"main","sessionId":"exec:2c8f...","runId":"run-123","text":"任务已完成","completedMessage":{"id":"assistant-123","sessionId":"exec:2c8f...","role":"assistant","status":"final","parts":[{"type":"text","text":"任务已完成"}],"timestamp":"2026-08-22T10:00:00.000Z"}}}
```

机器输出的 stdout 只包含合同数据，诊断和普通日志写入 stderr。`text` 模式失败时，错误文案写入 stderr；`json` / `jsonl` 模式失败时，版本化 error envelope 写入 stdout。

## 退出码与取消

| 退出码 | 含义 |
| --- | --- |
| `0` | 任务完成 |
| `2` | 参数或输入错误 |
| `130` | SIGINT、timeout 或调用方取消 |
| `1` | 生命周期、配置、provider、runtime 或未知失败 |

timeout 和 SIGINT 都会进入同一取消路径。恢复已有对话必须显式指定 `--session`；不要依赖终端历史状态隐式复用 session。
