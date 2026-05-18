# v0.18.73 Typing Indicator Sheen Cycle

## 迭代完成说明

- 将等待 AI 回复时的 `Agent 正在思考...` 文字光影动画从 `4.2s` 缩短为 `1.8s`。
- 删除动画关键帧中后段停留在结束位置的 `64%` 停顿，让光影按固定周期连续扫过。
- 顺手将被触达文件中的跨目录相对导入改为 `@agent-chat-ui/` 包内 alias，满足当前 module-structure 治理规则。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-agent-chat-ui tsc`：通过。
- `pnpm -C packages/nextclaw-agent-chat-ui exec eslint src/components/chat/ui/chat-message-list/chat-message-list.tsx src/components/chat/ui/chat-message-list/chat-message-list.test.tsx`：无错误，保留既有 props destructuring 警告。
- `pnpm -C packages/nextclaw-agent-chat-ui test src/components/chat/ui/chat-message-list/chat-message-list.test.tsx`：通过，19 个测试通过。
- `pnpm -C packages/nextclaw-agent-chat-ui build`：通过。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-list.tsx packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-list.test.tsx`：通过，保留目录预算和测试文件接近预算的既有警告。
- Vite 源码验证：`http://127.0.0.1:5174/@fs/.../chat-message-list.tsx` 可看到 `1.8s linear infinite`，未命中旧 `4.2s` 或 `64%` 停顿。
- `pnpm -C packages/nextclaw-agent-chat-ui lint`：未通过，阻塞来自既有无关文件 `chat-composer-plugins.tsx` 的 React hooks immutability 错误。
- `pnpm -C packages/nextclaw-agent-chat-ui test`：未通过，剩余失败来自既有 public contract 测试中 `ReactNode` 类型泄漏断言，非本次动效改动。
- 浏览器截图验证：未完成，Chrome DevTools MCP profile 被既有浏览器实例占用；已用 Vite 源码请求作为最小可信替代验证。

## 发布/部署方式

未发布。该改动触达 `@nextclaw/agent-chat-ui`，需要随下一次前端/桌面或相关 NPM 发布批次带出。

## 用户/产品视角的验收步骤

1. 在聊天中发送一条消息，并让 AI 进入尚未回复的等待状态。
2. 观察 `Agent 正在思考...` 提示。
3. 确认文字光影约每 `1.8s` 连续扫过一次，不再出现长时间像静止的停顿。

## 可维护性总结汇总

- 本次是非新增能力的用户可见行为调优，总 diff `+4 / -7 / net -3`，非测试代码 `+3 / -6 / net -3`。
- 正向减债动作：删除与职责收敛。删除动画停顿关键帧，同时修正触达文件的跨目录导入边界。
- `post-edit-maintainability-review` 已执行：no maintainability findings。

## NPM 包发布记录

- 涉及包：`@nextclaw/agent-chat-ui`。
- 当前状态：仅本地源码与构建产物验证，未执行 NPM 发布。
- 发布判断：需要随下一次统一前端/桌面发布批次评估并带出。
