# OpenCode Zen 会话关联适配设计

## 背景与问题

NextClaw 将 OpenCode Zen 作为 OpenAI-compatible provider 调用，但当前请求只携带静态鉴权与用户配置的 `extraHeaders`。OpenCode 最新源码会在每次 Zen 模型请求中发送稳定的 `x-opencode-session`，并发送 `x-opencode-request`、`x-opencode-client` 与自身 User-Agent；OpenCode Go 的公开协议也要求第三方 coding agent 使用自己的 User-Agent，并为每段对话发送稳定的 `x-opencode-session`。

因此，`opencode/big-pickle` 的匿名免费请求现在会在 NextClaw 中失败为 `MissingSessionID`。根因不是 API key 或模型名，而是 NextClaw 的 NCP LLM 调用合同丢失了已经存在于 runtime 的会话关联事实。

## 目标与非目标

目标：让 Native runtime 发往 OpenCode Zen 的同一 NextClaw 会话始终携带相同的会话 ID，不同会话携带不同 ID；每次用户请求同时携带请求 ID；客户端使用 NextClaw 自己的身份标识，并保留用户显式配置 header 的覆盖能力。

非目标：不伪造 OpenCode 版本或客户端身份；不把静态随机值写入 provider 配置；不改变其它 provider 的 HTTP header；不为外部 runtime 猜造 NextClaw session；不改变模型选择、鉴权或免费额度规则。

## 主链路与 owner

唯一主链路为：

`NCP runtime / 会话辅助任务已有 session/message context` → `NcpLLMApiOptions` 或 manager 调用参数 → `LlmProviderManager` 仅对 OpenCode 路由构造关联 header → `LLMProvider` 单次请求 header → OpenAI-compatible HTTP 请求。

- runtime 是 session ID 和 message/request ID 的 information expert，负责在每一轮模型调用时传递事实。
- 自动标题生成与上下文压缩分别复用其已有 `sessionId` 和当前服务消息 ID，不建立第二套会话身份。
- `LlmProviderManager` 是 provider 路由的 owner，只有它决定某次调用是否属于 OpenCode，并把语义上下文转换成 OpenCode header。
- `OpenAICompatibleProvider` 只负责把单次请求 header 与 provider 静态 header 合并后送达 HTTP 边界，不理解 OpenCode 业务语义。
- OpenCode provider spec 提供诚实、稳定的 `User-Agent: nextclaw` 和 `x-opencode-client: nextclaw` 默认身份；用户 `extraHeaders` 继续优先于默认值。

## 合同与不变量

1. `NcpLLMApiOptions` 增加可选的 `sessionId`、`requestId`；两个 NCP runtime 均从已有运行上下文传入，不新增状态。
2. manager 层的模型调用参数增加可选关联字段；主 NCP 模型调用、自动标题生成和上下文压缩都从各自已有 owner 传入。仅当路由的 canonical provider type 为 `opencode` 且字段非空时生成 `x-opencode-session` / `x-opencode-request`。
3. 底层 `ProviderChatParams` 增加可选 `requestHeaders`。静态 provider header 先合并，单次 request header 后合并；manager 只传协议所需字段，不把任意上游输入透传为 HTTP header。
4. 同一 session 的工具循环、流式重试继续使用同一个 session/request ID；新会话自然得到新的 session ID。
5. 非 OpenCode provider 不收到 OpenCode header。没有对话语义或关联上下文的 Service App 模型调用保持当前行为，不生成假 ID；若选择只允许 OpenCode free tier 的模型，服务端仍可按自身协议拒绝。

## 抽象审计

- 过小方案：在 provider spec 静态写一个 `x-opencode-session` 会把所有用户与会话合并，破坏路由、限流与 prompt cache 语义，也无法满足“每段对话稳定”的协议。
- 平衡方案：复用 runtime 已有上下文，只给现有调用合同增加可选字段和底层单次 header 能力；没有新 service、manager 或持久状态。
- 过大方案：新增通用 telemetry/header plugin、全局 async context 或 provider hook。当前只有 OpenCode session 协议这一名真实消费者，暂不引入。
- 保留：现有 provider registry、静态 `defaultHeaders`、用户 `extraHeaders` 和 provider pool。
- 延后：其它 provider 的会话 header 映射；出现真实第二个协议消费者后再设计 registry-level correlation contract。

## 验收标准

1. 单元合同：两个 Native runtime 模型调用都把已有 session ID 和 message ID 传到 provider manager；自动标题与上下文压缩复用已有会话事实；缺失或空白值不会产生 header。
2. 路由合同：`opencode/big-pickle` 请求得到 `x-opencode-session`、`x-opencode-request`、`x-opencode-client: nextclaw` 与 `User-Agent: nextclaw`；其它 provider 不得到 OpenCode header；用户显式 header 的优先级保持不变。
3. HTTP 合同：非流式和流式 Chat Completions 都把单次 header 发送出去，且不污染后续并发请求。
4. 真实链路：使用本机真实 NextClaw 会话向 `opencode/big-pickle` 发送最小提示，服务端不再返回 `MissingSessionID` 并产生有效模型输出。若外部免费额度限流阻止输出，至少用独立请求证明携带 header 后越过 `MissingSessionID`，并明确披露额度限制。
5. 质量门：受影响 package 的定向测试、TypeScript 编译和 diff-only maintainability review 通过。

## 黄金验收

1. 在 NextClaw 新建 Native task，选择 `OpenCode Zen Free Trial / big-pickle`，发送“只回复 OK”；预期收到 `OK`，失败判定为仍出现 `MissingSessionID`、400 或没有终态。
2. 连续发送第二条消息并观察请求：两次请求的 `x-opencode-session` 相同、`x-opencode-request` 不变于同一轮工具循环且下一用户轮变化；等待成本为一次正常模型往返。
3. 运行非 OpenCode provider 回归测试；预期请求头中没有 `x-opencode-*`，失败即协议泄漏。

## 交付与兼容

这是现有开箱即用能力的 bugfix，属于用户可见修复，需要同步中英文模型选择文档并添加 patch changeset。无需迁移配置或数据；新增字段均可选，旧调用方保持源码兼容。未经授权不提交、不推送、不发布。
