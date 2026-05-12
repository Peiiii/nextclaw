---
name: smoke-testing-ncp-chat
description: Use when a running NextClaw service needs a real NCP chat smoke for a specific session type and model, especially when validating text replies, tool calls, reasoning events, or comparing runtimes with blind/isolated smoke tests.
---

# Smoke Testing NCP Chat

## Overview

Use the reusable smoke command instead of ad-hoc `curl` or UI clicking when a fast real-reply check is needed.

This smoke command:

- Sends one real chat message to a running NextClaw service
- Forces the request through the specified `session-type` and `model`
- Reads the returned SSE event stream
- Prints pass/fail, assistant text, terminal event, and error details
- Exits non-zero when the route does not produce a real assistant reply

## When to Use

- A quick check is needed to confirm that one concrete chat route can return a real assistant reply.
- A specific `session-type + model` pair needs to be validated without opening the UI.
- A fast smoke is preferred over ad-hoc request assembly.

## Command

```bash
pnpm smoke:ncp-chat -- --session-type native --model dashscope/qwen3-coder-next --port 18792
```

## Quick Reference

```bash
pnpm smoke:ncp-chat -- --session-type codex --model dashscope/qwen3-coder-next --port 18792
pnpm smoke:ncp-chat -- --session-type claude --model minimax/MiniMax-M2.5 --port 18794
pnpm smoke:ncp-chat -- --session-type native --model openai/gpt-5.3-codex --base-url http://127.0.0.1:18792
pnpm smoke:ncp-chat -- --session-type codex --model dashscope/qwen3-coder-next --prompt "Reply exactly OK" --json
```

## Success Criteria

- Exit code is `0`
- Output shows `Result: PASS`
- `Assistant Text` is non-empty
- No `run.error` or `message.failed`

When `--json` is used, the key checks are:

- `ok: true`
- `assistantText` is non-empty
- `terminalEvent` is usually `run.finished`

## 真实冒烟分级

不要把“能回复文本”当成 runtime 已经跑通。根据本次目标选择最小充分断言：

- 文本冒烟：必须有真实模型返回，`assistantText` 命中固定 marker。
- 工具冒烟：必须同时看到 `message.tool-call-start`、`message.tool-call-result` 和最终文本 marker。
- 思考冒烟：必须看到 `message.reasoning-start`、`message.reasoning-delta`、`message.reasoning-end`，且 `reasoningText` 非空。
- 组合冒烟：当目标是 agent runtime 能力接入时，优先跑“思考 + 工具 + 最终文本”同一轮，避免分别通过但组合链路失败。

示例断言脚本可以包一层 `pnpm smoke:ncp-chat -- --json`，对 `eventTypes`、`assistantText`、`reasoningText` 做硬判断；不要只人工看 PASS。

## Agent Runtime 烟测矩阵

当验证 Codex、Claude Code、Hermes 或其他通过 `narp-stdio` 接入的 agent runtime 时，至少记录下面几个维度：

- `runtime`: 例如 `codex` / `claude`，来自显式 session type 或 runtime entry。
- `transport`: 必须确认走的是 `narp-stdio`，不是旧插件直连路径。
- `provider/model`: 例如 `minimax/MiniMax-M2.7`、`gpt-5.4`；provider 只是变量，不等同于 runtime。
- `capability`: text / tool / reasoning / reasoning+tool。
- `evidence`: NCP SSE eventTypes、assistant marker、tool result、reasoning length。
- `raw check`: 如果 SSE 不符合预期，要注明是否已经做过 SDK/CLI raw event 或 bridge 直测。

结论必须写成“某 runtime + 某 provider + 某能力”的组合结果。不要用一个 provider 的失败否定 runtime，也不要用一个 runtime 的通过代表所有 runtime。

## 盲眼测试和隔离 HOME 法

当怀疑本机历史配置、全局 Codex/Claude 插件、缓存、会话状态或环境变量污染结果时，使用隔离环境：

- 设置临时 `NEXTCLAW_HOME=/tmp/...`，只放本次需要的 provider、runtime entry 和 workspace。
- 给 runtime launcher 建临时 bin 目录，例如 `/tmp/nextclaw-narp-bin`，确保服务加载的是当前源码构建出的 dist。
- 对 Codex/Claude 这类会读取用户目录的 CLI，必要时同时设置隔离 `CODEX_HOME` / 运行时 HOME，避免全局插件、skill、历史会话影响判断。
- 烟测结束后停止服务和子进程，避免旧 wrapper 进程复用旧 dist 或旧 bridge。
- 输出和记录时必须脱敏 API key、bearer token、extra headers。

“盲眼”不是少看日志，而是先冻结 marker、session type、model、port、HOME、runtime entry，再让脚本只按可观察事件判定通过或失败。

## 分层缩圈跑道

如果端到端烟测失败，不要立刻改下游 UI 或 NCP event translator。按下面顺序切链：

1. 上游直连：直接请求 provider，确认模型原始响应字段和必要扩展参数。
2. bridge 直测：如果 runtime 有 bridge，直接请求 bridge 输出，确认它产出目标协议形状。
3. SDK/CLI raw event：绕过 NextClaw 服务，直接看 runtime SDK/CLI 原始事件，确认 provider/bridge 输出是否被 runtime 暴露。
4. NARP wrapper：确认 wrapper 把 runtime 事件翻译成协议更新。
5. NextClaw 服务 SSE：最后才看 `pnpm smoke:ncp-chat` 的 NCP event stream。

每一刀只回答一个问题：这个边界之前是对的，还是这个边界第一次变错。

## Common Mistakes

- Testing the wrong port: `pnpm dev start` usually serves API on `18792` in this repo.
- Forgetting `--session-type`: the smoke should target the exact runtime under investigation.
- Treating one runtime as proof for another runtime: `native`, `codex`, and `claude` should be checked explicitly.
- Treating text success as tool or reasoning success.
- Patching a downstream renderer or translator before proving the upstream event shape.
