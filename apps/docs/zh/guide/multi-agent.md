# 多 Agent 路由

你可以在 UI（**Routing & Runtime**）或 `config.json` 中配置 OpenClaw 风格的多 Agent 运行模式。

## 关键配置

- `agents.list`：在同一个网关进程内运行多个常驻 Agent
- `bindings`：按 `channel + accountId (+peer)` 把入站消息路由到目标 `agentId`
- `session.dmScope`：私聊会话隔离策略

## 示例配置

```json
{
  "agents": {
    "defaults": { "model": "openai/gpt-5.2-codex" },
    "list": [
      { "id": "main", "default": true },
      { "id": "engineer", "workspace": "~/workspace-engineer", "model": "openai/gpt-5.2-codex" }
    ]
  },
  "bindings": [
    {
      "agentId": "engineer",
      "match": {
        "channel": "discord",
        "accountId": "default",
        "peer": { "kind": "channel", "id": "dev-room" }
      }
    }
  ],
  "session": {
    "dmScope": "per-account-channel-peer"
  }
}
```

## DM Scope 取值

> ⚠️ `session.dmScope` 仅允许以下 4 个值：

| 值 | 隔离粒度 |
|----|----------|
| `main` | 所有私聊共享一个会话 |
| `per-peer` | 每个对端一个会话 |
| `per-channel-peer` | 每个渠道 + 对端一个会话 |
| `per-account-channel-peer` | 账号 + 渠道 + 对端完全隔离 |

## bindings 匹配语义

`bindings` 按数组顺序匹配，**首个命中规则生效**。

- `match.channel` 必填
- `match.accountId`：省略 = 仅匹配 `default`；`"*"` = 匹配所有账号
- `match.peer`：省略 = 匹配全部 peer
- 无匹配 = 回退到默认 Agent

## 推荐实践

1. 保留 `main` 作为兜底默认角色
2. 按职责拆分专家 Agent（如 `engineer`、`ops`、`support`）
3. 用 `bindings` 做按渠道/账号/群组的精细路由
4. 多账号场景优先 `dmScope="per-account-channel-peer"`
