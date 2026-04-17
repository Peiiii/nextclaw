# Hermes ACP 请求级临时 Agent 方案

## 背景与根因

Hermes ACP 上游的 `set_session_model(model_id)` 只接收模型名，不接收完整
provider route，因此跨 provider 切换时只能用旧 agent 上残留的
`provider/base_url/api_mode` 重新建 agent。对 NextClaw 来说，这会把“当前
用户选中的 providerRoute”与“Hermes 会话里残留的 provider 状态”混成两个真相，
导致以下问题：

- 切模型时只切了 `modelId`，但真实请求仍可能打到旧 provider。
- 路由错误只在切换后才暴露，行为不纯粹、难排查。
- Hermes session 常驻 agent 会保留 provider/base_url/header/client 等执行态，
  与 NextClaw 侧 prompt 级路由透传冲突。

## 边界约束

- 不直接修改 Hermes 上游源码。
- 只允许在 NextClaw 侧 bridge / stdio runtime / 文档层做适配。
- `providerRoute` 是 Hermes ACP 的唯一执行真相。
- Hermes ACP prompt 失败必须显式结束，不能出现前端一直 thinking 但没有终止事件。

## 目标方案

采用“每次请求临时创建 Hermes 执行 Agent”的模型。

- ACP session 长期只保留：
  - `history`
  - `cwd`
  - 当前模型快照与必要元数据
  - 轻量工具面信息
- 每次 `prompt` 到来时：
  - 从 `nextclaw_narp.providerRoute` 解析当前请求的完整执行路由
  - 用该路由临时创建 Hermes `AIAgent`
  - 用这个临时 agent 执行本次 prompt
  - prompt 结束后立即销毁，并把 session 恢复为不含凭据/客户端的轻量快照

## 组件职责

### `packages/nextclaw-ncp-runtime-stdio-client`

- 对 Hermes ACP runtime，发送 prompt 前不再调用 `unstable_setSessionModel(modelId)`。
- 原因：该 ACP 调用只传模型名，会破坏 prompt 级 `providerRoute` 的单一真相。

### `packages/nextclaw-hermes-acp-bridge`

- `sitecustomize.py`
  - patch Hermes ACP 生命周期
  - 在 prompt 入口创建请求级临时执行 agent
  - prompt 完成后恢复轻量 session 快照
  - 把初始化失败等请求级错误显式抛回 NextClaw
- `nextclaw-hermes-acp-runtime-route.py`
  - 解析 `nextclaw_narp.providerRoute`
  - 归一化 `model/provider/apiBase/apiKey/apiMode/headers`
  - 管理 session 级 route override 读取

## 状态归属

- 会话常驻状态：
  - 对话历史
  - cwd
  - 选中模型快照
  - 必要工具面元数据
- 请求级临时状态：
  - provider
  - apiBase
  - apiKey
  - headers
  - OpenAI/Anthropic client
  - 真实执行 agent

## 失败语义

- 用户主动 abort/cancel：
  - 继续走静默取消语义，不额外制造 runtime error。
- 运行时错误：
  - provider route 缺失或非法
  - 请求级执行 agent 初始化失败
  - ACP prompt 抛错
  - 上述情况必须让 stdio runtime 收到明确失败，从而发出 `MessageFailed + RunError`。

## 验证方案

- Bridge 回归：
  - 同一会话 `MiniMax -> qwen/dashscope`，第二次请求必须只使用新 route。
  - prompt 结束后 session 常驻对象不得残留 `_client_kwargs/api_key/headers`。
- Runtime 回归：
  - Hermes route bridge 开启时，stdio runtime 不再调用 `unstable_setSessionModel`。
  - prompt 失败时必须得到 `MessageFailed + RunError`。
- 命令验证：
  - `pnpm --filter @nextclaw/nextclaw-hermes-acp-bridge test`
  - `pnpm --filter @nextclaw/nextclaw-hermes-acp-bridge lint`
  - `pnpm --filter @nextclaw/nextclaw-hermes-acp-bridge tsc`
  - `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client test`
  - `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client lint`
  - `pnpm --filter @nextclaw/nextclaw-ncp-runtime-stdio-client tsc`
  - `pnpm lint:maintainability:guard`
