# 模型与提供方

NextClaw 可以连接云端模型、本地模型和自定义 OpenAI 兼容接口。模型负责理解和生成，Agent 的文件、浏览器、终端、Skill 与 MCP 则决定它能够怎样执行任务。

![NextClaw 模型提供方设置](/product-screenshots/nextclaw-providers-page-cn.png)

## 选择一条最容易验证的路径

- 已经有 API Key：配置对应云端提供方。
- 使用统一模型网关：填写 OpenAI 兼容地址、凭证和模型名。
- 希望模型在本机运行：使用 Ollama、vLLM 等本地服务。
- 使用不同 Agent runtime：为对应会话或 Agent 选择合适运行时。

当前界面覆盖 OpenRouter、OpenAI、Anthropic、Gemini、DeepSeek、MiniMax、Moonshot、通义千问、智谱、AiHubMix、vLLM 等提供方，也支持自定义兼容接口。实际可用模型取决于你的账号、区域和服务配置。

## 配置后怎样验证

不要只测试“你好”。创建一个需要读取材料并生成文件的短任务，确认：

- 模型名和认证有效；
- 回复可以正常流式返回；
- Agent 能调用当前任务需要的工具；
- 结果文件能在工作区打开；
- 失败时能看到明确错误。

## 多模型怎么用

只有在成本、速度、隐私或任务类型确实不同的时候才需要多个模型。可以让日常 Agent 使用稳定默认模型，为代码、长文或本地离线任务配置其他 Agent，而不是在每次消息前反复切换。

## 数据边界

发送给云端模型的消息、文件内容和工具结果会受该服务的数据政策约束。本地模型减少了外发范围，但仍要检查本地服务、MCP 和消息渠道的访问路径。

更具体的接入方式见[选择模型接入方式](/zh/guide/tutorials/provider-options)。
