# 进阶配置

适用人群：已经跑通新手路径，准备做更深度定制。

## 配置文件与数据目录

- 默认配置文件：`~/.nextclaw/config.json`
- 默认数据目录：`~/.nextclaw`
- 可通过 `NEXTCLAW_HOME=/path/to/dir` 覆盖

最小配置示例：

```json
{
  "providers": {
    "openrouter": { "apiKey": "sk-or-v1-xxx" }
  },
  "agents": {
    "defaults": { "model": "minimax/MiniMax-M2.5" }
  }
}
```

## Secrets refs（OpenClaw 风格）

支持 `env` / `file` / `exec` 三类来源，推荐用 `secrets.refs` 映射敏感字段。

```json
{
  "providers": {
    "openai": { "apiKey": "" }
  },
  "secrets": {
    "providers": {
      "env-main": { "source": "env" }
    },
    "refs": {
      "providers.openai.apiKey": {
        "source": "env",
        "provider": "env-main",
        "id": "OPENAI_API_KEY"
      }
    }
  }
}
```

## 运行时热更新范围

网关运行中，通过 UI 或 `nextclaw config set` 可热应用：

- `providers.*`
- `channels.*`
- `agents.defaults.model`
- `agents.defaults.maxToolIterations`
- `agents.defaults.contextTokens`
- `agents.context.*`
- `tools.*`
- `plugins.*`

仍需重启：UI 绑定端口（`--port` / `--ui-port`）。

## 上下文预算

- `agents.defaults.contextTokens`：模型输入预算（默认 `200000`）
- 预算超限时会先裁剪工具结果，再裁剪旧历史

## 工作区模板

初始化工作区：

```bash
nextclaw init
```

常见文件：`AGENTS.md`、`SOUL.md`、`TOOLS.md`、`memory/MEMORY.md`、`skills/`。

## 多 Agent 说明（持续演进中）

多 Agent 路由能力仍在持续整理和收敛，建议仅在明确需要“多身份隔离/多工作流分流”时再启用。

- 参考：[多 Agent 路由](/zh/guide/multi-agent)

## 相关文档

- [核心命令](/zh/guide/core-commands)
- [命令索引](/zh/guide/commands)
- [运行与托管总览](/zh/guide/runtime-hosting)
- [故障排查](/zh/guide/troubleshooting)
