---
name: opencode-runtime
description: 当需要把 OpenCode/opencode 接入为正式 NextClaw runtime，尤其是通过 nextclaw-opencode-narp 继承 NextClaw provider route、配置 narp-stdio(acp) runtime entry、安装或诊断 opencode acp、修复 OpenCode provider 配置、做真实模型回复和 agent 文件任务 smoke 时使用。
description_zh: 用于将 OpenCode/opencode 接入为正式 NextClaw runtime，覆盖 nextclaw-opencode-narp provider route 继承、narp-stdio(acp) runtime entry、opencode acp 安装诊断、真实模型回复与 agent 文件任务验收。
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
- launcher：`nextclaw-opencode-narp`
- `nextclaw-opencode-narp` 内部生成 prompt/session-scoped OpenCode config，再启动 `opencode acp`

裸 `opencode acp` 只能作为上游 ACP 探针。它不会自动消费 NextClaw `providerRoute`，不能作为正式产品 runtime entry。

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
            "command": "nextclaw-opencode-narp",
            "args": [],
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

4. runtime entry 必须指向 `nextclaw-opencode-narp`。OpenCode 不会自动消费 NextClaw 注入给 NARP 子进程的 `NEXTCLAW_MODEL`、`NEXTCLAW_API_BASE`、`NEXTCLAW_API_KEY`、`NEXTCLAW_HEADERS_JSON`；必须由该 launcher 把 `promptMeta.providerRoute` 转成 OpenCode 可消费的临时 config 和环境变量。

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

## Launcher 合同

`nextclaw-opencode-narp` 仍然只属于 OpenCode 接入边界；不要改通用 `narp-stdio` host client。

launcher 必须：

- 读取 `promptMeta.providerRoute` 和会话 metadata 中的 NextClaw 选模信息。
- 生成隔离 `OPENCODE_CONFIG`，把 NextClaw provider/model 映射成 OpenCode `provider` / `model`。
- API key 和 custom header 值必须通过环境变量注入，不写入 config 明文。
- 子进程使用当前源码构建出的 launcher 和本机 `opencode acp`。
- 真实 smoke 必须覆盖文本和 agent 文件任务，不接受只验证 `opencode acp --help`。
