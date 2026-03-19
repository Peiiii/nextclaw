# Claude Runtime Provider Routing Design

## 目标

这份文档只回答一件事：

- `NextClaw` 里的 `Claude` 会话，应该怎样在产品语境下正确接到用户已经配置好的 provider / model。

这次方案明确不再把 `Claude` 设计成“必须依赖 Claude 订阅”的独立宇宙，而是把它收回到 `NextClaw` 统一的 provider / model 心智里：

- 用户先在 `NextClaw` 里配置 provider
- 会话里仍然选择模型
- `session_type=claude` 只代表“使用 Claude Code / Claude Agent SDK 这套 runtime”
- Claude runtime 是否 ready，由“当前模型能否落到已确认的 Anthropic-compatible / gateway 路由”决定

## 已确认事实

- Anthropic 官方明确支持通过 `ANTHROPIC_BASE_URL`、`ANTHROPIC_AUTH_TOKEN` 将 Claude Code 接到 LLM gateway，官方文档直接拿 LiteLLM 举例：
  - <https://docs.claude.com/en/docs/claude-code/llm-gateway>
- Anthropic 官方明确支持通过环境变量或配置指定模型：
  - <https://docs.claude.com/en/docs/claude-code/model-config>
- MiniMax 官方明确给出了 Claude Code / Anthropic 兼容接法，Anthropic 兼容端点为 `/anthropic`：
  - <https://platform.minimaxi.com/docs/guides/text-ai-coding-tools>
- 智谱官方明确给出了 Claude Code / Anthropic 兼容接法，Anthropic 兼容端点为 `https://open.bigmodel.cn/api/anthropic`：
  - <https://docs.bigmodel.cn/cn/guide/develop/claude/introduction>
- 在本机真实验证里，`@anthropic-ai/claude-agent-sdk` 会读取用户全局 `~/.claude/settings.json`，如果不隔离 `CLAUDE_CONFIG_DIR`，就可能被现有 Claude 全局 `env` 覆盖，导致 NextClaw 当前 provider/model 与真实请求不一致。
- 在本机真实验证里，只设置隔离的 `CLAUDE_CONFIG_DIR`，并通过 NextClaw 注入 `ANTHROPIC_BASE_URL + ANTHROPIC_API_KEY/AUTH_TOKEN + model`，MiniMax Anthropic 兼容链路可以拿到真实 Claude runtime 回复。

## 明确能做什么

当前方案只承诺两类已确认路径：

1. 直连 Anthropic-compatible provider
   - 当前内置确认：`anthropic`、`minimax`、`minimax-portal`、`zhipu`
   - 这类 provider 在 Claude runtime 中直接转成 `ANTHROPIC_BASE_URL + ANTHROPIC_AUTH_TOKEN/API_KEY + model`

2. 显式声明的 Anthropic gateway provider
   - 典型场景是用户自己配置了 LiteLLM，并把某个 provider 的 `apiBase` 指到 LiteLLM 暴露的 Anthropic endpoint
   - 这类 provider 需要在 Claude 插件配置里显式声明 `gatewayProviderNames`

## 明确不能臆想承诺什么

- 不能承诺“任意 OpenAI-compatible provider 都能直接给 Claude Code 用”
- 不能承诺 `nextclaw`、`openrouter`、`dashscope` 这类现有 provider 在没有 Anthropic-compatible 包装层时可以直接给 Claude runtime 用
- 不能承诺所有第三方模型都完整支持 Claude runtime 的全部能力，例如 tools、resume、thinking、partial messages

因此本次实现不会做“看到有 API Key 就盲目 ready”的错误判断。

## 产品契约

在 `NextClaw` 里，Claude 会话的正确心智是：

- `Claude session = Claude Code runtime 壳 + 当前选中的可兼容 provider/model`

具体行为：

1. 用户切到 `Claude` 会话类型
2. 系统只暴露当前 Claude 路由确认可用的模型
3. 若当前默认模型不可用，但存在其它已配置的兼容 provider，系统自动给出一个推荐兼容模型
4. 若当前没有任何已配置兼容 provider，则 `Claude` 会话显示 `setup required`

## 路由规则

### 1. 选中模型的优先级

Claude runtime 仍优先读取：

- `sessionMetadata.preferred_model`
- `sessionMetadata.model`
- `plugins.entries.<claude-plugin>.config.model`
- `agents.defaults.model`

但在真正组装 Claude runtime 前，会先过一层 provider routing。

### 2. provider routing 优先级

按优先级从高到低：

1. 当前选中模型对应的已确认兼容 provider
2. 若当前模型不兼容，但存在其它已配置兼容 provider，则回退到推荐兼容模型所在的 provider
3. 若用户显式配置了 Claude 插件自己的 `apiKey/authToken/apiBase`，走插件显式配置兜底
4. 若用户显式启用 `settingSources` / Claude managed auth，则交给 Claude 自身鉴权
5. 以上都不满足，则 `Claude` 会话标记为不可用

### 3. baseURL 处理规则

- `anthropic`
  - 默认使用当前 provider 的 `apiBase`
- `minimax` / `minimax-portal`
  - 将 `.../v1` 转成 `.../anthropic`
- `zhipu`
  - 将 `https://open.bigmodel.cn/api/paas/v4` 转成 `https://open.bigmodel.cn/api/anthropic`
- `anthropicCompatibleProviderNames`
  - 直接使用该 provider 自己配置的 `apiBase`
- `gatewayProviderNames`
  - 直接使用该 provider 自己配置的 `apiBase`

因此，`baseURL` 是可以定制的，但必须满足一个前提：

- 该 `apiBase` 真的对 Claude Code 暴露了 Anthropic-compatible 接口

## 模型判定规则

本次不会把 Claude 支持模型写死成“全局所有 provider 模型”。

当前实现规则是：

- Claude session type 只返回当前激活 Claude 路由下的模型集合
- 若 provider 自己没显式写 `models`，则回退到该 provider spec 的 `defaultModels`
- 发送消息时，Claude runtime 使用“去掉 provider 前缀后的真实 runtime model”，例如：
  - `minimax/MiniMax-M2.7` -> `MiniMax-M2.7`
  - `zai/glm-5` -> `glm-5`
  - `anthropic/claude-sonnet-4-6` -> `claude-sonnet-4-6`

## readiness 规则

Claude session type 的 ready 判定不再是“看到 provider apiKey 就 ready”。

现在要同时满足：

1. 当前存在可解析的 Claude route
2. 该 route 具备可用 credential
3. 若开启 capability probe，则 Claude Agent SDK 的真实 probe 通过

若当前默认模型不兼容，但仓库里存在兼容 provider，则 session type 会给出：

- `ready=true`
- `supportedModels=兼容模型列表`
- `recommendedModel=推荐兼容模型`

若当前没有任何兼容 provider，则给出：

- `ready=false`
- `reason=provider_unsupported` 或 `api_key_missing`
- 明确的 setup 文案

## 用户实际使用步骤

假设用户是一个新安装的 `NextClaw` 用户：

1. 安装并启用 `Claude` runtime 插件
2. 在 Providers 页面配置一个已确认兼容的 provider
   - 推荐首批：`MiniMax` / `Zhipu` / `Anthropic`
   - 或者自己配置一个 Anthropic-compatible LiteLLM gateway provider
3. 回到会话页切换 `Session Type = Claude`
4. 模型下拉会自动收敛到 Claude 当前可用模型
5. 发送消息，Claude runtime 会通过对应 provider/model 真正执行

## 本次实现范围

- 新增 Claude provider routing helper
- 让 Claude runtime 优先跟随 `NextClaw` provider/model
- 让 Claude runtime 默认运行在 NextClaw 自己的隔离 `CLAUDE_CONFIG_DIR` 中，避免宿主机全局 Claude 配置污染
- 修正 readiness 与 supportedModels/recommendedModel 生成逻辑
- 支持内置 `anthropic/minimax/minimax-portal/zhipu`
- 支持通过插件配置显式声明自定义 Anthropic-compatible provider / gateway provider
- 做自动化测试
- 做真实 Claude 回复冒烟验证

## 暂不在本次承诺的增强

- 直接内建一层 `OpenAI -> Anthropic` 转换器
- 自动把所有 gateway provider 都视为 Claude-compatible
- 在单次 probe 里同时验证多个 provider family
- 细粒度声明每个第三方模型对 Claude tools/resume/thinking 的能力矩阵
