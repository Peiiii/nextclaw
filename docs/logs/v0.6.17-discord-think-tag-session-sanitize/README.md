# 2026-02-19 v0.6.17-discord-think-tag-session-sanitize

## 迭代完成说明

- 基于本地 `~/.nextclaw/sessions` 的 Discord 历史复现到问题：
  - 大量 `assistant` 消息在工具调用后含 `<think>...</think>` 文本块。
  - 这些文本会写入会话历史，污染后续上下文，并在部分场景表现为“回复奇怪内容”。
- 根因定位：
  - 渠道发送前虽然有 `sanitizeOutboundAssistantContent`，但会话写入与上下文注入时未做同样净化。
- 修复：
  - 在 `AgentLoop` 中统一对 assistant 内容做净化后再：
    - 写入会话（`sessions.addMessage`）
    - 写回上下文（`context.addAssistantMessage`）
    - 作为最终回复输出（`finalContent`）

## 测试 / 验证 / 验收

### 复现证据（本地历史）

- `discord_1471158891831361638.jsonl`：
  - `toolAssistant = 311`
  - `suspiciousAfterTool = 244`（包含 `<think>`）

### 开发验证

```bash
pnpm -C packages/nextclaw-core build
pnpm -C packages/nextclaw-core lint
pnpm -C packages/nextclaw-core tsc
```

结果：通过（仅仓库既有 lint warning，无新增 error）。

### Discord 路径复测（同处理链路）

- 使用 `channel=discord`、`chatId=1471158891831361638` 触发真实模型调用：
  - 模型：`openrouter/qwen/qwen3.5-plus-02-15`
  - 指令：`请调用 list_dir 工具读取 /tmp，然后只回复 OK`
- 结果：返回 `OK`。
- 会话文件 `discord_repro-1771503101956.jsonl` 中 assistant 消息不含 `<think>`（`hasThink=false`）。

## 发布 / 部署方式

- 本次为本地修复与验证，未执行 npm 发布。
- 若需发布：按 `docs/workflows/npm-release-process.md` 执行 changeset/version/publish。
