# v0.14.271-native-subagent-session-update-notify

## 迭代完成说明

- 把 `session.updated` 的通知点下沉到真实会话保存链路，而不是只依赖系统消息分支。
- `NextclawAgentSessionStore` 在 `saveSession` / `deleteSession` 后会主动回调会话更新通知，保证 NCP runtime 和 UI session API 都能触发刷新。
- `packages/nextclaw/src/cli/commands/service.ts` 和 `packages/nextclaw/src/cli/commands/service-gateway-startup.ts` 统一接上这条通知链，子 Agent 完成后会推 `session.updated` 给 UI。
- 补了对应单测，覆盖保存、删除、UI session 服务更新，以及 gateway 启动桥接。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw exec vitest run src/cli/commands/ncp/nextclaw-agent-session-store.test.ts src/cli/commands/ncp/ui-session-service.test.ts src/cli/commands/service-gateway-startup.test.ts`
- `pnpm -C packages/nextclaw tsc`
- `pnpm -C packages/nextclaw lint`
- `pnpm -C packages/nextclaw build`
- 真实联测：
  - 启动当前源码的 `pnpm -C packages/nextclaw dev serve --ui-port 18796`
  - 用 `pnpm smoke:ncp-chat -- --session-type native --model minimax/MiniMax-M2.7 --base-url http://127.0.0.1:18796 --prompt "请派发一个子Agent去检查 1+1=2，并在子Agent完成后把结果回传给主会话。最终回复请明确说明已完成子Agent任务，并只输出简短结论。" --json`
  - 另开 websocket 监听 `ws://127.0.0.1:18796/ws`，确认收到了 `{"type":"session.updated",...}`。

## 发布/部署方式

- 本次未单独发布。
- 该变更随 `packages/nextclaw` 的下一次正常构建 / 打包 / 发布流程生效。
- 无数据库 migration，不涉及额外远程部署动作。

## 用户/产品视角的验收步骤

1. 在支持 `native` 的 chat 页面里发起一次会话，并让模型派发子 Agent。
2. 等子 Agent 完成后，确认主会话会继续收到更新，且前端会自动刷新到最新消息。
3. 打开会话列表，确认最近会话的更新时间会跟着更新，不需要手动刷新页面。
4. 再重复一次子 Agent 任务，确认 `session.updated` 仍然稳定触发。
