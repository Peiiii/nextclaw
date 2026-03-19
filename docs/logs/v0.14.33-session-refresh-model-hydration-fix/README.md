# v0.14.33 Session Refresh Model Hydration Fix

## 迭代完成说明

- 修复“刷新当前会话页面时，若该会话保存的是非默认模型，输入区仍回落到默认模型”的问题。
- 在 legacy/NCP 聊天页补上首屏 `selectedModel` hydrate：只有等 session 列表数据已返回、provider 状态已就绪且 model options 可用后，才把当前会话保存的模型重新写回输入区。
- 保留上一版“切换会话时优先恢复当前会话偏好”的逻辑，同时补上“同一会话刷新”这条异步时序缺口。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui test -- --run src/components/chat/chat-page-runtime.test.ts`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/ui exec eslint src/components/chat/chat-page-runtime.ts src/components/chat/chat-page-data.ts src/components/chat/ncp/ncp-chat-page-data.ts src/components/chat/legacy/LegacyChatPage.tsx src/components/chat/ncp/NcpChatPage.tsx src/components/chat/chat-page-runtime.test.ts`
- `python3 .codex/skills/post-edit-maintainability-guard/scripts/check_maintainability.py --paths packages/nextclaw-ui/src/components/chat/chat-page-data.ts packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-page-data.ts packages/nextclaw-ui/src/components/chat/legacy/LegacyChatPage.tsx packages/nextclaw-ui/src/components/chat/ncp/NcpChatPage.tsx`
- 说明：目标文件 lint 仅剩仓库里已有的超长函数 warning，本次改动未新增 error。

## 发布/部署方式

- 本次修改尚未发布。
- 后续发布前建议补一次真实 UI 冒烟，重点验证“进入指定 session URL 后直接刷新页面”时，模型与 `thinking effort` 都恢复为该会话保存值。

## 用户/产品视角的验收步骤

1. 进入一个已有会话，将模型切到非默认模型并保存一次对话。
2. 停留在该会话页面，直接浏览器刷新。
3. 等待 provider/model options 加载完成，确认输入区恢复到该会话之前保存的非默认模型，而不是全局默认模型。
4. 对 legacy 与 NCP 会话各执行一遍，确认两条链路行为一致。
