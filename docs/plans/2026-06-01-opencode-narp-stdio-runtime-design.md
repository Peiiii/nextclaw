# OpenCode NARP Stdio Runtime 接入设计

## 背景与目标

NextClaw 的长期目标是成为 AI 时代的个人操作层。OpenCode 是一个外部 coding agent runtime；把它接入 NextClaw 的价值，不是给系统再堆一个孤立功能点，而是让用户能在 NextClaw 的统一入口里选择更多真实可执行的 agent 后端。

本设计目标：

- 把 OpenCode 接成正式 NextClaw runtime entry。
- 首选路径使用现有通用 `narp-stdio`，内部 wire dialect 为 `acp`。
- 不在 core、kernel、service 里新增 `opencode` 特判。
- 先跑通真实模型与真实 agent 任务，再决定是否产品化成 marketplace skill / installer / launcher。

## 外部事实

OpenCode 官方 ACP 文档说明，兼容 ACP 的编辑器应启动：

```json
{
  "command": "opencode",
  "args": ["acp"]
}
```

该命令会把 OpenCode 作为 ACP-compatible subprocess 启动，并通过 stdio JSON-RPC 与客户端通信。官方 CLI 文档也把 `acp` 列为 OpenCode CLI 命令之一。

这与 NextClaw 现有 `narp-stdio` 的 `wireDialect: "acp"` 主路径匹配，因此第一阶段不需要新增 runtime family。

参考：

- <https://opencode.ai/docs/acp/>
- <https://opencode.ai/docs/cli/>
- <https://opencode.ai/docs/config/>

## 产品判断

OpenCode 接入增强的是 NextClaw 的统一入口和能力编排：

- 用户仍从 NextClaw 发起任务。
- OpenCode 只是统一 runtime registry 下的一个外部执行后端。
- NextClaw 不复制 OpenCode 的 agent 能力，而是通过协议编排它。
- 接入方式应类似 Hermes，而不是回到旧 agent-runtime plugin 扩张路径。

这符合 `统一入口、能力编排、生态扩展` 的产品方向，也避免把 NextClaw 主体做成越来越厚的 agent runtime 集合。

## 架构合同

### 第一阶段：直接 runtime entry

第一阶段只要求 OpenCode 作为正式 session type 可见、可探测、可真实回复。配置形态：

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

此阶段的 owner 划分：

- NextClaw：runtime registry、session type、NCP SSE、用户入口。
- `narp-stdio` client：通用 ACP stdio host client。
- OpenCode：ACP agent subprocess、模型调用、工具执行、项目规则读取。
- 用户或安装流程：OpenCode 自身安装与 provider 配置。

禁止事项：

- 禁止新增 `type: "opencode"`。
- 禁止在 `narp-stdio` client 里写 OpenCode 分支。
- 禁止在 core/kernel/service 注入默认 `opencode` 条目。
- 禁止让旧 plugin 注册路径承担 OpenCode runtime 接入。

### 第二阶段：OpenCode NARP launcher

如果要把 OpenCode 产品化为开箱即用 runtime，应新增薄 launcher 或 marketplace skill，而不是改 core。

推荐形态：

- package 或安装产物：`nextclaw-narp-runtime-opencode`
- bin：`nextclaw-opencode-narp`
- 内部执行：启动 `opencode acp`
- 配置写入：创建或修复 `agents.runtimes.entries.opencode`

第二阶段的主要价值：

- 安装/修复 `opencode` 二进制。
- 写入 runtime entry。
- 做 `opencode acp` readiness probe。
- 准备隔离的 OpenCode config。
- 做真实首条消息 smoke。
- 在需要时把 NextClaw provider route 显式转成 OpenCode 可消费的 provider config。

关键边界：OpenCode 不天然消费 NextClaw 当前传给 NARP 子进程的 `NEXTCLAW_MODEL`、`NEXTCLAW_API_BASE`、`NEXTCLAW_API_KEY`、`NEXTCLAW_HEADERS_JSON`。因此第一阶段可以证明 ACP runtime 接通；如果要复用 NextClaw provider route，则第二阶段需要 launcher/bridge 将 route 转成 OpenCode config 或环境变量。

## 配置与安装策略

### 冷启动检查

1. 检查 `opencode` 是否存在。
2. 不存在时安装 `opencode-ai`。
3. 执行 `opencode --version`。
4. 执行 `opencode acp --help` 或通过 NARP probe 验证 ACP subprocess 可启动。

### OpenCode provider 配置

真实模型 smoke 必须用隔离配置，避免污染用户全局 OpenCode 配置。推荐使用：

- `OPENCODE_CONFIG`
- `OPENCODE_CONFIG_DIR`
- `OPENCODE_CONFIG_CONTENT`
- 隔离工作目录

OpenCode config 至少需要：

- `model`
- `provider`
- 必要 provider credential 或 environment variable
- 工具权限策略

### NextClaw runtime 配置

真实 NextClaw smoke 使用隔离 `NEXTCLAW_HOME`。可以复制用户现有 provider 配置到临时目录，但不得输出 API key、bearer token 或 extra header。

## 验收标准

第一阶段完成必须同时满足：

1. `opencode` 命令可执行。
2. `opencode acp` 可作为 ACP stdio 子进程启动。
3. 隔离 `NEXTCLAW_HOME` 中存在 `agents.runtimes.entries.opencode`。
4. `/api/ncp/session-types` 返回 `opencode`，且 ready 为 `true`。
5. 通过 `pnpm smoke:ncp-chat -- --session-type opencode ... --json` 获得真实模型回复。
6. 至少一次 agent 任务要求 OpenCode 使用工具修改隔离工作目录里的文件，并验证文件内容。

## 真实 smoke 设计

### 文本 smoke

Prompt：

```text
Reply exactly NEXTCLAW_OPENCODE_TEXT_OK
```

判定：

- NCP stream 出现 assistant text。
- 最终文本包含 marker。
- 不出现 runtime error / message failed。

### Agent 文件任务 smoke

隔离 workspace：

```text
/tmp/nextclaw-opencode-agent-smoke-<timestamp>/
```

Prompt：

```text
Create or overwrite this exact file path:
/tmp/nextclaw-opencode-agent-smoke-<timestamp>/opencode-agent-result.txt
The file content must be exactly NEXTCLAW_OPENCODE_AGENT_FILE_OK.
After writing it, reply exactly NEXTCLAW_OPENCODE_AGENT_DONE.
```

判定：

- NCP stream 最终文本包含 `NEXTCLAW_OPENCODE_AGENT_DONE`。
- 隔离 workspace 中出现 `opencode-agent-result.txt`。
- 文件内容严格等于 `NEXTCLAW_OPENCODE_AGENT_FILE_OK`。

说明：第一阶段不要把“相对当前工作目录写入”作为硬验收条件。真实 smoke 发现，OpenCode ACP 的工具相对路径可能受宿主服务进程目录、ACP session cwd 或 OpenCode 自身 workspace 解析共同影响。为了避免污染仓库，首轮 agent 任务验收必须使用隔离目录的绝对路径。后续如果产品化成 `nextclaw-opencode-narp` launcher，再由 launcher 固定和验证 OpenCode workspace/cwd 合同。

## 风险与后续产品化

### 风险

- OpenCode 的 provider 配置模型与 NextClaw provider route 不同，直接 runtime entry 不能自动继承 NextClaw 的所有 provider 配置。
- OpenCode 的权限策略如果保持默认，文件任务可能需要交互确认；真实 smoke 应在隔离目录内显式允许安全写入。
- ACP 支持由 OpenCode 上游演进，必须以真实 `opencode acp` probe 和 agent 任务验证为准。

### 后续建议

如果真实 smoke 稳定通过，下一步应做一个 OpenCode runtime marketplace skill：

- skill description 覆盖 `OpenCode`、`opencode`、`narp-stdio`、`ACP`、runtime setup。
- skill body 承担安装、配置、repair、readiness、first-message smoke。
- marketplace metadata 声明 external runtime、ACP、agent task 能力。

如果需要 NextClaw provider route 完整继承，再新增薄 launcher：

- launcher 从 NextClaw 注入的 route env 读取模型、base URL、key、headers。
- launcher 生成临时 OpenCode config。
- launcher 启动 `opencode acp`。
- launcher 不改变 `narp-stdio` host client。

## 本次落地记录

本设计文档创建后，本轮会继续执行：

1. 安装或定位 OpenCode CLI。
2. 建立隔离 OpenCode 配置与隔离 NextClaw 配置。
3. 启动 NextClaw 服务。
4. 跑通文本 smoke。
5. 跑通 agent 文件任务 smoke。
6. 根据真实结果决定是否需要进入第二阶段 launcher。

## 本轮验证结论

已在隔离目录完成第一阶段真实验证：

- OpenCode CLI：临时安装 `opencode-ai@1.15.13`，`opencode --version` 返回 `1.15.13`。
- ACP 启动：`opencode acp --help` 可执行。
- OpenCode 直连模型：使用隔离 OpenCode config 与 `custom-3/mimo-v2.5-pro`，返回 `NEXTCLAW_OPENCODE_DIRECT_ROUTE_OK`。
- NextClaw session type：隔离 `NEXTCLAW_HOME` 中 `opencode` 显示为 ready。
- NCP 文本 smoke：`session-type=opencode` 返回 `NEXTCLAW_OPENCODE_TEXT_OK`，并收到 `reasoning-delta`、`message.text-delta`、`run.finished`。
- NCP agent 文件任务：`session-type=opencode` 触发工具调用，把 `/tmp/nextclaw-opencode-smoke.jXuEqW/workspace/opencode-agent-result.txt` 写成 `NEXTCLAW_OPENCODE_AGENT_FILE_OK`，最终回复 `NEXTCLAW_OPENCODE_AGENT_DONE`。

因此第一阶段结论是：OpenCode 可以通过 NextClaw 现有 `narp-stdio(acp)` 主链路接入并运行真实模型 + agent 任务。下一步若要产品化和开箱即用，应新增 OpenCode runtime skill 或薄 launcher 来承接安装、配置、provider route 继承与 cwd 合同，而不是改通用 `narp-stdio` host client。
