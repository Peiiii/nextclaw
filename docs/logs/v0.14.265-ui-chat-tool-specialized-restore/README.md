# v0.14.265-ui-chat-tool-specialized-restore

## 迭代完成说明

本次将你在 `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-tool-specialized.tsx` 的 UI 改动从临时 stash 中恢复回工作区，确保这部分聊天工具卡片样式与交互改动重新可见。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-agent-chat-ui test -- --run src/components/chat/ui/chat-message-list/chat-message-list.test.tsx`
- `pnpm smoke:ncp-chat -- --session-type native --model minimax/MiniMax-M2.7 --base-url http://127.0.0.1:18793 --json`
- `pnpm smoke:ncp-chat -- --session-type codex --model minimax/MiniMax-M2.7 --base-url http://127.0.0.1:18793 --thinking medium --json`
- `pnpm smoke:ncp-chat -- --session-type native --model yunyi/gpt-5.4 --base-url http://127.0.0.1:18793 --json`
- `pnpm smoke:ncp-chat -- --session-type codex --model yunyi/gpt-5.4 --base-url http://127.0.0.1:18793 --thinking medium --json`

验收结果：

- `native + minimax/MiniMax-M2.7`：通过，且有 reasoning 输出。
- `codex + minimax/MiniMax-M2.7`：通过。
- `native + yunyi/gpt-5.4`：失败，返回 `401 Incorrect API key provided`。
- `codex + yunyi/gpt-5.4`：失败，返回 `stream closed before response.completed`。
- `chat-message-list.test.tsx`：当前恢复后的 UI 改动下有 1 个既有断言失败，失败点为工具卡片 `Tool Result` 文案不再按原测试预期展示。

## 发布/部署方式

不适用。本次仅恢复本地工作区中的 UI 改动，没有执行发布或部署。

## 用户/产品视角的验收步骤

1. 打开聊天界面，发送一条会触发工具卡片的消息。
2. 确认 `chat-tool-specialized.tsx` 的视觉样式与展开/折叠行为恢复为你期望的版本。
3. 如果你要继续核对模型链路，优先用 `MiniMax/MiniMax-M2.7` 这条已验证可用的路径。
