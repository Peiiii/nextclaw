# OpenCode NARP Stdio Runtime 接入设计

> 2026-06-02 修订：上一版把“裸 `opencode acp` 在人工对齐配置下可跑通”误判成“OpenCode 产品路径可用”。本版以 NextClaw 前端真实选模路径为目标重新定义方案和验收标准。

## 背景

NextClaw 的长期目标是成为 AI 时代的个人操作层。OpenCode 的价值，是作为一个外部 coding agent runtime 被 NextClaw 统一调度，而不是让用户跳出 NextClaw 去维护另一套模型和 provider 入口。

这意味着 OpenCode 接入的完成标准不是“`opencode acp` 能启动”，而是：

- 用户从 NextClaw 前端创建 `OpenCode` 会话。
- 用户在 NextClaw 模型选择器里选择 DeepSeek、MiniMax、OpenRouter、自定义 OpenAI-compatible 等任意已配置模型。
- OpenCode 自动继承该 NextClaw provider route。
- 文本回复、模型切换、工具调用和文件任务都能通过。

## 已证实的问题

用户真实前端路径中出现：

```text
[narp-stdio] ACP prompt completed without any assistant content
session/set_model modelId: "MiniMax-M2.7"
Invalid params: model not found: MiniMax-M2.7

session/set_model modelId: "deepseek-v4-flash"
Invalid params: model not found: deepseek-v4-flash
```

这说明问题不是单纯 token 过期。直接触发点是：

- NextClaw 前端选择了 NextClaw provider/model。
- `narp-stdio` 对 ACP agent 调用 `session/set_model`。
- 裸 `opencode acp` 在 OpenCode 自己的模型注册表里查找该 model id。
- OpenCode 不知道 NextClaw 的 provider registry，也不会自动消费 NextClaw 的 provider route。

因此，`model not found` 是架构合同缺失，不是 DeepSeek 或 MiniMax 单点不可用。

## 为什么 Codex / Claude Code 没有这个问题

Codex 和 Claude Code 不是直接把外部 CLI 裸接到 `narp-stdio`。它们都有专属 NARP wrapper：

- `nextclaw-codex-narp`
- `nextclaw-claude-code-narp`

这些 wrapper 承担了关键职责：

- 读取 `promptMeta.providerRoute`。
- 读取 `NEXTCLAW_MODEL`、`NEXTCLAW_API_BASE`、`NEXTCLAW_API_KEY`、`NEXTCLAW_HEADERS_JSON` 等环境兜底。
- 把 NextClaw 的 provider route 转成对应 SDK / CLI 能理解的配置。
- 必要时启动 bridge，例如 Codex Responses bridge、Claude Anthropic/OpenAI-compatible bridge。
- 把外部 runtime 事件重新映射成 NCP 事件。

所以 Codex / Claude Code 可用的原因不是通用 `narp-stdio` 自动兼容所有 agent runtime，而是它们都有 runtime-specific adapter。

OpenCode 要达到同等产品效果，也必须有自己的 adapter。

## 产品目标

OpenCode runtime 接入必须实现以下效果：

1. `OpenCode` 是 NextClaw 中正式可选的 session type。
2. 前端模型选择器仍以 NextClaw provider registry 为准。
3. 用户选择 `deepseek/deepseek-v4-flash`、`minimax/MiniMax-M2.7`、`custom-x/<model>` 等模型后，OpenCode 不要求用户另配一套模型。
4. OpenCode runtime 自动继承 NextClaw 解析出的 provider route。
5. 同一个 OpenCode 会话中切换模型不出现 `model not found`。
6. agent 文件任务能实际触发工具调用并写入隔离目录。
7. 上游鉴权失败时，错误应暴露为 provider 鉴权或上游错误，而不是 OpenCode 模型注册缺失。

## 非目标

- 不新增 `type: "opencode"`。
- 不在 core / kernel / service 里硬编码 OpenCode。
- 不在通用 `narp-stdio` host client 里写 OpenCode 分支。
- 不要求用户手工维护一套与 NextClaw provider 重复的 OpenCode 全局配置。
- 不把“人工写一份 OpenCode config 后能跑”当成产品接入完成。

## 正确架构

必须新增 OpenCode 专属 NARP launcher：

```text
NextClaw frontend
  -> selected model: deepseek/deepseek-v4-flash
  -> NextClaw resolves providerRoute
  -> narp-stdio host
  -> nextclaw-opencode-narp
  -> generate request/session-scoped OpenCode config
  -> spawn opencode acp
  -> OpenCode executes with mapped provider/model
  -> NCP stream returns text/tool/reasoning events
```

推荐 package：

```text
packages/extensions/nextclaw-narp-runtime-opencode
```

推荐 bin：

```text
nextclaw-opencode-narp
```

推荐 runtime entry：

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
            "requestTimeoutMs": 240000
          }
        }
      }
    }
  }
}
```

裸 `opencode acp` 只能作为上游 ACP 能力探针使用，不应作为正式产品 runtime entry。

## 代码组织方案

新增包与 Codex / Claude Code NARP 包同级：

```text
packages/extensions/nextclaw-narp-runtime-opencode/
  package.json
  tsconfig.json
  module-structure.config.json
  src/index.ts
  src/controllers/opencode-narp.controller.ts
  src/services/opencode-narp-runtime-wrapper.service.ts
  src/services/opencode-runtime-config.service.ts
  src/services/opencode-acp-runtime.service.ts
  src/types/opencode-narp-runtime.types.ts
  src/utils/opencode-provider-route.utils.ts
```

命名保持同族一致：

```text
nextclaw-codex-narp
nextclaw-claude-code-narp
nextclaw-opencode-narp
```

`module-structure.config.json`：

```json
{
  "contractKind": "protocol",
  "protocol": "app-l1",
  "rootPolicy": "contract-only",
  "enforcement": "error",
  "importAliasPrefixes": ["@opencode-narp/"]
}
```

`package.json` 形态对齐现有 NARP runtime 包：

```json
{
  "name": "@nextclaw/nextclaw-narp-runtime-opencode",
  "private": false,
  "description": "NARP stdio launcher for the OpenCode runtime.",
  "type": "module",
  "bin": {
    "nextclaw-opencode-narp": "dist/controllers/opencode-narp.controller.js"
  },
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsdown src/index.ts src/controllers/opencode-narp.controller.ts --dts.sourcemap --clean --target es2022 --no-fixedExtension --unbundle",
    "prepack": "pnpm run build",
    "lint": "eslint .",
    "tsc": "tsc -p tsconfig.json",
    "test": "vitest run",
    "prepublishOnly": "node ../../../scripts/release/ensure-pnpm-publish.mjs"
  },
  "dependencies": {
    "@nextclaw/ncp": "workspace:*",
    "@nextclaw/nextclaw-narp-stdio-runtime-wrapper": "workspace:*"
  }
}
```

## Owner 划分

- NextClaw service / UI：负责 session type、模型选择、provider route 解析、NCP SSE。
- `narp-stdio` host client：负责通用 ACP stdio 通信，不感知 OpenCode。
- `nextclaw-opencode-narp`：负责 OpenCode 专属 route adapter、临时 config、workspace/cwd、权限策略和 launcher。
- OpenCode：负责自身 ACP agent loop、工具执行和上游模型调用。

## 抽象与 owner 设计

### `OpencodeNarpRuntimeWrapper`

职责：

- 对标 `CodexNarpRuntimeWrapper` / `ClaudeCodeNarpRuntimeWrapper`。
- 使用 `NarpStdioRuntimeWrapper` 暴露 ACP agent。
- 在 prompt 到达时基于 `NarpStdioRuntimeWrapperContext` 创建 OpenCode runtime。

骨架：

```ts
export class OpencodeNarpRuntimeWrapper {
  constructor(
    private readonly configService = new OpencodeRuntimeConfigService(),
    private readonly createRuntime: OpencodeAcpRuntimeFactory = (
      config,
    ) => new OpencodeAcpRuntime(config),
  ) {}

  start = (): void => {
    new NarpStdioRuntimeWrapper({
      agentName: "NextClaw OpenCode NARP",
      createRuntime: (context) => this.createOpencodeRuntime(context),
    }).start();
  };

  createOpencodeRuntime = (
    context: NarpStdioRuntimeWrapperContext,
  ): NcpAgentRuntime => {
    return this.createRuntime(this.configService.resolve(context));
  };
}
```

### `OpencodeRuntimeConfigService`

职责：

- 读取 `context.modelId`、`context.cwd`、`context.promptMeta.providerRoute`。
- 生成 OpenCode provider id、OpenCode model id 和临时 config。
- 生成环境变量。
- 确保 API key 不进入日志和普通文本 config。
- 不负责启动 OpenCode 进程。

输入：

```ts
type OpencodeRuntimeConfigInput = {
  sessionId: string;
  cwd?: string;
  modelId?: string;
  providerRoute?: NcpProviderRuntimeRoute;
  sessionMetadata?: Record<string, unknown>;
};
```

输出：

```ts
type OpencodeRuntimeConfig = {
  sessionId: string;
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  opencodeModel: string;
  opencodeConfigPath: string;
  workspaceDir: string;
  cleanupDir: string;
};
```

### `OpencodeAcpRuntime`

职责：

- 实现 `NcpAgentRuntime`。
- 按 `OpencodeRuntimeConfig` 启动 `opencode acp`。
- 把用户 prompt 发给 OpenCode ACP。
- 把 OpenCode ACP updates 映射成 NCP events。
- 管理 abort / dispose / stderr 截断。

注意：如果直接复用 host-side `StdioRuntimeNcpAgentRuntime` 会形成“stdio client -> wrapper -> stdio client -> OpenCode”的双层 stdio，不够清晰。优先在 OpenCode 包里做一个窄的 OpenCode ACP runtime owner；若后续发现可稳定抽出通用 child-ACP client，再从 `nextclaw-ncp-runtime-stdio-client` 提炼 provider-agnostic 内核，而不是先为 OpenCode 复制大段实现。

### `opencode-provider-route.utils.ts`

职责：

- provider id 规范化。
- model id 规范化。
- header / api mode 判断。
- 从 NextClaw selected model 推断 provider slug 作为兜底。

示例函数：

```ts
export function buildOpencodeProviderId(params: {
  selectedModel?: string;
  providerRoute: NcpProviderRuntimeRoute;
}): string;

export function buildOpencodeModelId(params: {
  providerId: string;
  providerRoute: NcpProviderRuntimeRoute;
}): string;
```

## 复用策略

优先复用：

1. `@nextclaw/nextclaw-narp-stdio-runtime-wrapper`
   - 继续复用 NCP runtime -> ACP agent wrapper。
   - 不重写 outer ACP agent server。

2. Codex / Claude Code NARP package 形态
   - 复用 package layout、bin 命名、controller 形态、build/test/lint 脚本。
   - OpenCode 与 Codex / Claude Code 同级，而不是进 core。

3. NextClaw provider route
   - 继续由 NextClaw service 解析 provider/model/apiBase/apiKey/headers。
   - OpenCode wrapper 只消费 route，不重新做 provider registry。

4. 通用 `narp-stdio` host client
   - host client 仍只负责 ACP stdio。
   - 只允许增加 provider-agnostic 配置，不允许 OpenCode 分支。

不复用：

- 不复用用户全局 OpenCode config 作为事实源。
- 不把 OpenCode 的 provider config 回写到 NextClaw provider registry。
- 不在 frontend 为 OpenCode 做特殊模型选择器。

## OpenCode wrapper 职责

`nextclaw-opencode-narp` 至少要完成：

1. 从 `NarpStdioRuntimeWrapperContext` 读取：
   - `context.modelId`
   - `context.cwd`
   - `context.promptMeta.providerRoute`
   - `context.promptMeta.sessionMetadata`
2. 从 provider route 读取：
   - `model`
   - `apiBase`
   - `apiKey`
   - `headers`
3. 生成 OpenCode 可识别的 provider id 和 model id。
4. 生成临时 OpenCode config，不污染用户全局配置。
5. 设置 OpenCode 运行环境：
   - `OPENCODE_CONFIG`
   - `OPENCODE_CONFIG_DIR`
   - 隔离 `HOME`
   - 必要 API key env
6. 启动 `opencode acp`。
7. 固定 workspace/cwd 合同。
8. 给文件任务设置明确的权限策略。
9. 把上游缺 key / 无效 key / 模型不存在区分成可理解错误。

## 模型映射规则

NextClaw 侧有两类模型 id：

- 前端选择值：通常是 `<provider>/<model>`，例如 `deepseek/deepseek-v4-flash`。
- provider route local model：通常是 provider 内部模型名，例如 `deepseek-v4-flash`、`MiniMax-M2.7`。

OpenCode config 侧必须有一个稳定 provider id 和 model id。推荐：

```text
providerId = nextclaw-<normalized-provider>
modelId = <providerRoute.model>
opencodeModel = <providerId>/<modelId>
```

例如：

```text
NextClaw selected model: deepseek/deepseek-v4-flash
providerRoute.model: deepseek-v4-flash
OpenCode model: nextclaw-deepseek/deepseek-v4-flash
```

```text
NextClaw selected model: minimax/MiniMax-M2.7
providerRoute.model: MiniMax-M2.7
OpenCode model: nextclaw-minimax/MiniMax-M2.7
```

OpenCode 不应直接接收 `deepseek-v4-flash` 或 `MiniMax-M2.7` 作为裸 `modelId`，否则会把它当成 provider id 一起查找并报 `model not found`。

## 配置生成策略

wrapper 应为每个 session 或每个 runtime process 创建临时目录：

```text
/tmp/nextclaw-opencode-narp/<session-id>/
  opencode.json
  home/
  config/
  workspace/
```

OpenCode config 应至少包含：

- 默认 `model`
- provider 声明
- provider base URL
- API key 通过 env 引用，不明文写入可回收文件
- 模型列表
- 工具权限策略

伪形态：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "nextclaw-deepseek/deepseek-v4-flash",
  "small_model": "nextclaw-deepseek/deepseek-v4-flash",
  "provider": {
    "nextclaw-deepseek": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "NextClaw DeepSeek",
      "options": {
        "baseURL": "<providerRoute.apiBase>",
        "apiKey": "{env:NEXTCLAW_OPENCODE_API_KEY}"
      },
      "models": {
        "deepseek-v4-flash": {
          "name": "deepseek-v4-flash"
        }
      }
    }
  },
  "tools": {
    "read": true,
    "write": true,
    "edit": true,
    "bash": true,
    "grep": true,
    "glob": true
  },
  "permission": {
    "*": "allow",
    "bash": {
      "*": "allow"
    }
  }
}
```

具体字段必须以 OpenCode 当前版本真实 config schema 为准；实现前要用 `opencode run` 和 `opencode acp` 分别做最小直测。

## ACP `session/set_model` 策略

当前通用 `narp-stdio` 会把 `resolveModelId()` 的结果传给 ACP `session/set_model`。对于 OpenCode，正式方案有两种可选路径：

### 方案 A：wrapper 内部让 OpenCode 识别 NextClaw model id

wrapper 生成 OpenCode config 时，同时注册 NextClaw 传入的 `modelId` 作为 OpenCode 可识别模型。

优点：

- 不需要改通用 `narp-stdio`。

缺点：

- 需要严密处理 provider 前缀、custom provider、模型别名和 OpenCode provider id 规则。

### 方案 B：给 OpenCode runtime entry 增加跳过 `session/set_model` 的通用配置

给 `narp-stdio` 增加 provider-agnostic 配置项，例如：

```json
{
  "config": {
    "sessionModelMode": "prompt-meta"
  }
}
```

让模型选择只通过 `_meta.nextclaw_narp.providerRoute` 进入 wrapper，而不是先调 ACP `session/set_model`。

优点：

- 合同更清晰：OpenCode 模型来源是 provider route，不是 ACP client 的裸 model id。

缺点：

- 需要修改通用 `narp-stdio`，但必须保持 provider-agnostic，不能出现 OpenCode 特判。

当前推荐：先评估方案 A 是否能完全覆盖前端真实模型切换；如果做不到，再引入方案 B 的通用配置项。

## 通用化设计

OpenCode 需要 adapter，但 adapter 不应把通用层污染成 OpenCode-aware。

### 通用层允许新增

`packages/nextclaw-ncp-runtime-stdio-client` 可新增 provider-agnostic 配置：

```ts
export type StdioRuntimeSessionModelMode =
  | "set-model"
  | "prompt-meta-only";
```

配置解析：

```ts
type StdioRuntimeResolvedConfig = {
  sessionModelMode: StdioRuntimeSessionModelMode;
};
```

行为：

- 默认 `set-model`，保持 Codex / Claude / Hermes 现有行为不变。
- `prompt-meta-only` 时，不调用 ACP `session/set_model`。
- `providerRoute` 仍通过 `_meta.nextclaw_narp.providerRoute` 传给 agent-side wrapper。

runtime entry：

```json
{
  "config": {
    "wireDialect": "acp",
    "sessionModelMode": "prompt-meta-only"
  }
}
```

这不是 OpenCode 特判，而是一个通用 runtime 能力开关：有些 ACP agent 使用 client-side set_model，有些 agent 使用 prompt-scoped route metadata。

### OpenCode 层负责

- 解释 `providerRoute`。
- 生成 OpenCode config。
- 决定是否重启 OpenCode ACP session。
- 把上游 provider 错误翻译成可理解错误。

### 不做的通用化

暂时不抽 `ProviderRouteToExternalRuntimeConfig` 公共包。Codex、Claude、OpenCode 的上游协议差异很大：

- Codex 需要 Responses bridge 和 model provider config。
- Claude 需要 Anthropic/OpenAI-compatible bridge。
- OpenCode 需要 AI SDK provider config。

过早抽公共 mapper 会变成字段搬运和假通用。当前只抽通用 `sessionModelMode` 这种确实跨 runtime 成立的协议行为。

## 实现效果如何达成

### 前端选 DeepSeek

```text
UI selected model = deepseek/deepseek-v4-flash
NextClaw providerRoute.model = deepseek-v4-flash
NextClaw providerRoute.apiBase = <deepseek api base>
NextClaw providerRoute.apiKey = <deepseek key>
```

`nextclaw-opencode-narp` 生成：

```text
opencode provider id = nextclaw-deepseek
opencode model = nextclaw-deepseek/deepseek-v4-flash
```

OpenCode 实际请求上游：

```text
baseURL = providerRoute.apiBase
apiKey = env:NEXTCLAW_OPENCODE_API_KEY
model = deepseek-v4-flash
```

### 前端选 MiniMax

```text
UI selected model = minimax/MiniMax-M2.7
NextClaw providerRoute.model = MiniMax-M2.7
```

`nextclaw-opencode-narp` 生成：

```text
opencode provider id = nextclaw-minimax
opencode model = nextclaw-minimax/MiniMax-M2.7
```

如果 MiniMax token 过期，最终错误应来自上游鉴权或额度；不允许再出现 OpenCode `model not found: MiniMax-M2.7`。

### 同会话模型切换

同一个 NextClaw session 里 provider route 可能每轮变化。OpenCode wrapper 必须按 prompt-scoped route 工作。

优先策略：

1. 如果 OpenCode ACP 支持动态加载新 config 并 `set_model` 到新模型，则复用同一个 ACP session。
2. 如果不支持，则在模型/provider 变化时 dispose 旧 OpenCode child，创建新的 OpenCode child。
3. 用户侧 NextClaw session id 不变；外部 runtime session 重建是 adapter 内部细节。

### 文件任务

workspace/cwd 必须由 wrapper 固定：

- 有项目根目录时：使用 session project root。
- 无项目根目录时：使用隔离 workspace。
- smoke 一律使用 `/tmp` 绝对路径验证，避免误写仓库。

OpenCode 的工具权限策略只在该 workspace 范围内放开；后续产品化时再区分普通用户默认策略和开发者高级策略。

## 验收标准

### 1. 前端真实路径

必须人工或浏览器自动化验证：

1. 启动 NextClaw。
2. 打开前端。
3. 新建 `OpenCode` 会话。
4. 选择 DeepSeek 模型。
5. 发送：

```text
Reply exactly NEXTCLAW_OPENCODE_DEEPSEEK_OK
```

通过条件：

- UI 显示 `NEXTCLAW_OPENCODE_DEEPSEEK_OK`。
- 服务日志没有 `model not found`。
- NCP stream terminal event 为 `run.finished`。

### 2. 自动化文本 smoke

至少跑：

```bash
pnpm smoke:ncp-chat -- \
  --base-url http://127.0.0.1:<port> \
  --session-type opencode \
  --model deepseek/deepseek-v4-flash \
  --prompt 'Reply exactly NEXTCLAW_OPENCODE_DEEPSEEK_OK' \
  --timeout-ms 240000 \
  --json
```

以及：

```bash
pnpm smoke:ncp-chat -- \
  --base-url http://127.0.0.1:<port> \
  --session-type opencode \
  --model minimax/MiniMax-M2.7 \
  --prompt 'Reply exactly NEXTCLAW_OPENCODE_MINIMAX_OK' \
  --timeout-ms 240000 \
  --json
```

如果某个 provider token 失效，该 smoke 的期望错误必须是上游鉴权/额度/网络错误，而不是 OpenCode `model not found`。

### 3. 同会话模型切换

同一个 `sessionId` 里连续发送：

1. `deepseek/deepseek-v4-flash`
2. `minimax/MiniMax-M2.7`

通过条件：

- 两轮都返回 marker，或第二轮若 token 失效也必须是上游错误。
- 不出现 `session/set_model model not found`。
- wrapper 能按 prompt-scoped provider route 更新 OpenCode config 或重新建立可用 ACP session。

### 4. Agent 文件任务

使用隔离目录绝对路径：

```bash
TARGET=/tmp/nextclaw-opencode-smoke/workspace/opencode-agent-result.txt
pnpm smoke:ncp-chat -- \
  --base-url http://127.0.0.1:<port> \
  --session-type opencode \
  --model deepseek/deepseek-v4-flash \
  --prompt "Create or overwrite this exact file path: $TARGET . The file content must be exactly NEXTCLAW_OPENCODE_AGENT_FILE_OK. After writing it, reply exactly NEXTCLAW_OPENCODE_AGENT_DONE." \
  --timeout-ms 240000 \
  --json
```

通过条件：

- stream 中出现 `message.tool-call-start` 和 `message.tool-call-result`。
- assistant text 为 `NEXTCLAW_OPENCODE_AGENT_DONE`。
- `$TARGET` 存在。
- 文件内容严格等于 `NEXTCLAW_OPENCODE_AGENT_FILE_OK`。
- 仓库目录没有被误写临时文件。

### 5. 负面验证

故意配置错误 key：

通过条件：

- 错误表达为 provider 鉴权失败、上游 401/403 或等价错误。
- 不允许退化成 `model not found`。

## 实施顺序

1. 前置核对 OpenCode config schema 和 ACP set_model 行为。
2. 新增 `packages/extensions/nextclaw-narp-runtime-opencode`。
3. 新增 `nextclaw-opencode-narp` bin。
4. 用 fake provider route 写 wrapper 单测：
   - DeepSeek route -> OpenCode config。
   - MiniMax route -> OpenCode config。
   - custom provider route -> OpenCode config。
   - API key 不写入日志。
5. 接入真实 `opencode acp` smoke。
6. 更新 runtime entry 生成/repair 流程。
7. 更新 `opencode-runtime` skill 和 marketplace metadata。
8. 重新发布 marketplace skill。
9. 跑完整验收矩阵。

## 单测与集成测试设计

### `OpencodeRuntimeConfigService` 单测

必须覆盖：

- DeepSeek route：
  - input selected model：`deepseek/deepseek-v4-flash`
  - route model：`deepseek-v4-flash`
  - output OpenCode model：`nextclaw-deepseek/deepseek-v4-flash`
- MiniMax route：
  - input selected model：`minimax/MiniMax-M2.7`
  - route model：`MiniMax-M2.7`
  - output OpenCode model：`nextclaw-minimax/MiniMax-M2.7`
- custom provider route：
  - input selected model：`custom-3/mimo-v2.5-pro`
  - output provider id 稳定且符合 OpenCode provider id 规则
- headers：
  - 如果 OpenCode config 支持 headers，则写入对应字段
  - 如果不支持，则测试应明确失败并指向 sidecar bridge 缺口
- secret：
  - API key 只进入 env
  - config 文件不包含原始 API key

### `OpencodeNarpRuntimeWrapper` 单测

使用 fake `OpencodeAcpRuntimeFactory`：

- 验证 `promptMeta.providerRoute` 被传入 config service。
- 验证 `cwd` 进入 workspace 解析。
- 验证模型切换时 wrapper 能创建新 runtime config。

### 通用 `narp-stdio` 单测

如果引入 `sessionModelMode`：

- 默认模式仍调用 `unstable_setSessionModel`。
- `prompt-meta-only` 模式不调用 `unstable_setSessionModel`。
- `_meta.nextclaw_narp.providerRoute` 仍然传递。

### 真实 smoke

真实 smoke 分两类：

- direct OpenCode probe：只验证 OpenCode config schema 和 `opencode acp` 行为。
- NextClaw product smoke：验证前端/服务选择模型后真实通过。

只有第二类通过，才算产品接入完成。

## 文档和 marketplace 更新

实现完成后必须同步：

- `packages/nextclaw-core/src/features/agent/shared/skills/opencode-runtime/SKILL.md`
- `packages/nextclaw-core/src/features/agent/shared/skills/opencode-runtime/marketplace.json`
- 远端 marketplace skill `@nextclaw/opencode-runtime`

skill 中必须删除或降级“直接 `opencode acp` 即可接入”的表述，改成：

- `opencode acp` 是上游能力探针。
- 正式 runtime entry 使用 `nextclaw-opencode-narp`。
- setup/doctor 要验证 provider route 继承和真实模型 smoke。

## 需要进一步明确的问题

下面这些不是阻塞“必须做 wrapper”的方向，但在实现前要明确：

1. OpenCode 当前 config schema 对 OpenAI-compatible provider 的稳定字段到底是 `baseURL` 还是其他别名。
2. OpenCode ACP 的 `session/set_model` 是否支持同一 session 动态切换到新生成 config 中的模型。
3. 如果不支持动态切换，OpenCode runtime 是否应采用 per-prompt process，还是在模型变化时重建 ACP session。
4. NextClaw provider route 中 custom provider 的 provider id 应如何命名，避免与 OpenCode provider id 规则冲突。
5. provider headers 如何注入 OpenCode；如果 OpenCode config 不支持 headers，是否需要本地 HTTP bridge。
6. MiniMax / DeepSeek 这类 OpenAI-compatible provider 是否都能通过 OpenCode 的 AI SDK provider 直接调用；不行时是否需要 NextClaw sidecar bridge。
7. OpenCode 工具权限策略在产品里应默认多宽，尤其是 bash/write。
8. workspace/cwd 应取 session project root、用户当前工作区，还是 NextClaw runtime 临时目录。
9. 临时 config 和 key env 的生命周期如何清理。
10. 发布到 marketplace 的 skill 是只做 setup/doctor，还是也负责安装 `nextclaw-opencode-narp` launcher。

## 修订后的结论

OpenCode 可以接入 NextClaw，但不能以裸 `opencode acp` 作为完整产品方案。

完整方案必须是：

```text
agents.runtimes.entries.opencode
  -> type: narp-stdio
  -> command: nextclaw-opencode-narp
  -> wrapper converts NextClaw providerRoute to OpenCode config
  -> wrapper starts opencode acp
```

上一版验证只能证明 OpenCode 的 ACP 子进程可被 NARP host 拉起；它没有证明前端真实选模路径可用。后续只有通过前端真实路径、DeepSeek/MiniMax 自动化 smoke、同会话模型切换和 agent 文件任务后，才能称为 OpenCode runtime 接入完成。
