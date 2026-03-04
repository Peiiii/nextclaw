# v0.0.5 Validation

## 执行命令

- `PATH=/opt/homebrew/bin:$PATH pnpm tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm lint`
- `PATH=/opt/homebrew/bin:$PATH pnpm build`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server test -- src/ui/router.chat.test.ts`

## 冒烟测试（stop 闭环）

- 场景：隔离 `NEXTCLAW_HOME` + 本地 mock OpenAI 流式服务。
- 动作：
  1. 调用 `/api/chat/capabilities`，确认 `stopSupported=true`。
  2. 调用 `/api/chat/turn/stream`，读取 `ready.runId`。
  3. 收到首个 `delta` 后调用 `/api/chat/turn/stop`。
- 结果：
  - `runId` 成功返回；`ready.stopSupported=true`。
  - stop 调用成功。
  - 流式输出在首个 token 后终止，最终 `final.reply` 为已生成部分（示例：`Hello`）。

## 结论

- 手动停止在 API/Runtime/Provider/前端交互链路均验证通过。
