# NCP Chat 冒烟

使用仓库 smoke 入口验证指定 `session-type + model` 的真实 NCP SSE 链路，避免临时拼 `curl` 或只看 UI。

```bash
pnpm smoke:ncp-chat -- --session-type native --model dashscope/qwen3-coder-next --port 18792
pnpm smoke:ncp-chat -- --session-type codex --model dashscope/qwen3-coder-next --prompt "Reply exactly OK" --json
pnpm smoke:ncp-chat -- --session-type claude --model minimax/MiniMax-M2.5 --port 18794
```

基础成功条件：退出码 0、`Result: PASS`、assistant text 非空，且没有 `run.error` / `message.failed`。JSON 模式断言 `ok: true`、非空 `assistantText` 和通常为 `run.finished` 的 terminal event。

## 按目标选择能力断言

- 文本：真实模型回复命中固定 marker。
- 工具：同时出现 `message.tool-call-start`、`message.tool-call-result` 和最终 marker。
- 思考：出现 reasoning start/delta/end 且 `reasoningText` 非空。
- runtime 能力接入：优先在同一轮断言思考、工具和最终文本，避免三条链路分别通过但组合失败。

结论记录 `runtime + transport + provider/model + capability + evidence`。确认 agent runtime 走 `narp-stdio` 而非旧直连；一个 provider 的失败不能否定 runtime，一个 runtime 的成功不能代表其它 runtime。

## 隔离与缩圈

怀疑本机配置、缓存、全局插件或旧进程污染时，使用临时 `NEXTCLAW_HOME` 和 launcher bin；Codex/Claude 还可隔离各自运行时 home。冻结 marker、session type、model、port、home 和 runtime entry，结束后停止服务与子进程，输出中脱敏 key、token 和 headers。

端到端失败时依次切链：

1. provider 原始响应；
2. bridge 输出；
3. SDK/CLI raw event；
4. NARP wrapper 翻译；
5. NextClaw NCP SSE。

每一步只判断这个边界之前是否正确、是否在这里第一次变错。文本成功不能证明工具或 reasoning；未证明上游事件形状前不修改下游 renderer/translator。
