---
name: opencode-runtime
description: 当需要把 OpenCode/opencode 接入为正式 NextClaw runtime，尤其是通过 narp-stdio(acp) 配置 runtime entry、安装或诊断 opencode acp、修复 OpenCode provider 配置、做真实模型回复和 agent 文件任务 smoke 时使用。
description_zh: 用于将 OpenCode/opencode 接入为正式 NextClaw runtime，覆盖 narp-stdio(acp) runtime entry、opencode acp 安装诊断、OpenCode provider 配置、真实模型回复与 agent 文件任务验收。
metadata: {"nextclaw":{"emoji":"⌘"}}
---

# OpenCode Runtime

使用此 skill 时，目标是把 OpenCode 作为正式 NextClaw 会话类型接入，而不是新增 core runtime kind 或旧插件注册路径。

## 主合同

首选产品路径：

- runtime entry id：`opencode`
- runtime label：`OpenCode`
- runtime type：`narp-stdio`
- wire dialect：`acp`
- launcher：`opencode acp`

禁止：

- 不要新增 `type: "opencode"`。
- 不要在 `narp-stdio` host client 里写 OpenCode 特判。
- 不要在 core / kernel / service 里硬编码 OpenCode。
- 不要把 OpenCode 接回旧 agent-runtime plugin 注册路径。

## 推荐 runtime entry

```json
{
  "agents": {
    "runtimes": {
      "entries": {
        "opencode": {
          "enabled": true,
          "label": "OpenCode",
          "type": "narp-stdio",
          "config": {
            "wireDialect": "acp",
            "processScope": "per-session",
            "command": "opencode",
            "args": ["acp"],
            "env": {},
            "startupTimeoutMs": 15000,
            "probeTimeoutMs": 5000,
            "requestTimeoutMs": 180000
          }
        }
      }
    }
  }
}
```

如果使用隔离 OpenCode 配置，给 entry 增加：

```json
{
  "config": {
    "env": {
      "OPENCODE_CONFIG": "/tmp/nextclaw-opencode/opencode.json",
      "OPENCODE_CONFIG_DIR": "/tmp/nextclaw-opencode/config",
      "HOME": "/tmp/nextclaw-opencode/home"
    }
  }
}
```

不要输出 API key、Bearer token 或 extra headers。

## 冷启动流程

1. 先检查 `opencode`：

```bash
command -v opencode
opencode --version
opencode acp --help
```

2. 如果缺失，安装 OpenCode CLI。临时验证可用隔离 prefix：

```bash
npm_config_prefix=/tmp/nextclaw-opencode-smoke-bin npm install -g opencode-ai
export PATH=/tmp/nextclaw-opencode-smoke-bin/bin:$PATH
```

3. 准备隔离 `NEXTCLAW_HOME`，写入 `agents.runtimes.entries.opencode`。

4. 准备隔离 OpenCode config。OpenCode 不会自动消费 NextClaw 注入给 NARP 子进程的 `NEXTCLAW_MODEL`、`NEXTCLAW_API_BASE`、`NEXTCLAW_API_KEY`、`NEXTCLAW_HEADERS_JSON`；若要复用 NextClaw provider route，需用薄 launcher 把 route 转成 OpenCode 可消费的 config 或环境变量。

## 验收

必须实际验证，不要只说明配置看起来正确。

### Session type readiness

启动 NextClaw 服务后检查：

```bash
curl -s http://127.0.0.1:<port>/api/ncp/session-types
```

`opencode` 必须存在且 `ready: true`。

### 真实文本 smoke

```bash
pnpm smoke:ncp-chat -- \
  --base-url http://127.0.0.1:<port> \
  --session-type opencode \
  --model <nextclaw-provider>/<model> \
  --prompt 'Reply exactly NEXTCLAW_OPENCODE_TEXT_OK' \
  --timeout-ms 240000 \
  --json
```

通过条件：

- `ok: true`
- assistant text 为 `NEXTCLAW_OPENCODE_TEXT_OK`
- stream 中出现 `message.text-delta`
- terminal event 为 `run.finished`

### 真实 agent 文件任务 smoke

使用隔离目录绝对路径，不要依赖相对 cwd：

```bash
TARGET=/tmp/nextclaw-opencode-smoke/workspace/opencode-agent-result.txt
pnpm smoke:ncp-chat -- \
  --base-url http://127.0.0.1:<port> \
  --session-type opencode \
  --model <nextclaw-provider>/<model> \
  --prompt "Create or overwrite this exact file path: $TARGET . The file content must be exactly NEXTCLAW_OPENCODE_AGENT_FILE_OK. After writing it, reply exactly NEXTCLAW_OPENCODE_AGENT_DONE." \
  --timeout-ms 240000 \
  --json
```

通过条件：

- `ok: true`
- stream 中出现 `message.tool-call-start` 和 `message.tool-call-result`
- assistant text 为 `NEXTCLAW_OPENCODE_AGENT_DONE`
- `$TARGET` 存在
- 文件内容严格等于 `NEXTCLAW_OPENCODE_AGENT_FILE_OK`

## 什么时候需要薄 launcher

第一阶段可以直接使用 `opencode acp`。出现以下需求时，再新增 `nextclaw-opencode-narp` 这类薄 launcher：

- 要开箱即用安装或 repair OpenCode CLI。
- 要把 NextClaw provider route 稳定继承给 OpenCode。
- 要固定和验证 workspace/cwd 合同。
- 要统一 doctor、readiness、真实首条消息 smoke。

薄 launcher 仍然只属于 OpenCode 接入边界；不要改通用 `narp-stdio` host client。
