# MiniMax Chat Stream Normalization

## 背景

`pnpm docker:start` 后，Docker UI 的 `native + minimax/MiniMax-M3` 对话会在已经收到正文后显示 `Premature close`。同一请求在 `pnpm dev` 下可以完成。

## 现状依据

- Docker NCP journal 显示事件序列为 `message.text-delta -> run.error("Premature close")`。
- Dev NCP journal 显示同模型同 runtime 的事件序列为 `message.text-delta -> message.text-end -> message.completed -> run.finished`。
- MiniMax Chat Completions SSE 会返回 `finish_reason:"stop"`，但不会发送 `data: [DONE]`。
- Docker Linux/aarch64 中 OpenAI SDK 使用的 `node-fetch` shim 会把这种关闭判定为 `ERR_STREAM_PREMATURE_CLOSE`；宿主机 dev 环境不会。

## 核心判断

这是 provider adapter 边界的协议归一化问题，不应在 UI、NCP runtime 或 Docker 配置层兜底。NextClaw 应自己读取 Chat Completions SSE，并把已经出现 `finish_reason` 的 EOF 视为正常完成。

## 推荐方案

- 在 OpenAI core utils 中补齐 Chat Completions SSE 请求和读取能力。
- 保留现有 chunk 归一化逻辑，继续产出 `delta`、`reasoning_delta`、`tool_call_delta` 和最终 `done`。
- 将 Responses API 与 Chat Completions API 共享的 SSE 帧读取逻辑收敛为一个通用 reader。
- `OpenAICompatibleProvider.chatCompletionsStream` 改为使用该 reader，不再依赖 OpenAI SDK 的 stream iterator。

## Owner 与数据流

- Owner：`OpenAICompatibleProvider` 负责 provider 协议选择；OpenAI core stream utils 负责 SSE 帧读取和 chunk 归一化。
- 数据流：MiniMax/OpenAI-compatible SSE -> Chat stream reader -> Chat chunk normalizer -> provider `LLMStreamEvent` -> NCP runtime -> UI。

## 兼容与迁移

这不是隐藏 fallback。规则是明确的 provider 协议合同：只有已观察到 `finish_reason` 的 Chat stream 才允许 EOF 正常完成；没有终止信息的空流或坏流继续失败并触发既有 apiBase candidate 重试。

## 验收标准

- 单测覆盖无 `data: [DONE]` 但有 `finish_reason:"stop"` 的 Chat Completions stream。
- `packages/nextclaw-core` 的定向测试、`tsc`、lint 通过。
- Docker `native + minimax/MiniMax-M3` smoke 从 `run.error` 变为 `run.finished`。

## 非目标

- 不调整 UI 错误显示。
- 不修改 Docker 镜像或 Node 版本。
- 不改变 Responses API 读取语义。

## 后续实现顺序

1. 抽通用 SSE frame reader。
2. 实现 Chat Completions stream request/consumer。
3. 切换 provider stream 路径。
4. 增加定向测试并跑真实 Docker smoke。
