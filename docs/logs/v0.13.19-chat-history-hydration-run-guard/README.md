# v0.13.19-chat-history-hydration-run-guard

## 迭代完成说明（改了什么）

- 修复 chat 前端在发送后出现的异常链路：用户消息消失、assistant 重复展示、`Maximum update depth exceeded`。
- 在 `ChatRunLifecycleManager.applyHistoryMessages` 增加运行态保护：当本地 run 仍在进行（`activeRun` 或 `isAgentResponding`）时，禁止 history 回填覆盖当前流式消息。
- 增加消息清空幂等：仅在当前消息非空时才执行 `setMessages([])`，避免重复空写造成无意义状态更新。
- 保留“run 结束后再回填 history”的行为，确保最终仍以后端历史为准。
- 相关方案文档：[`2026-03-10-chat-runtime-agent-align.md`](../../designs/2026-03-10-chat-runtime-agent-align.md)

## 测试/验证/验收方式

- 已执行：
  - `pnpm --filter @nextclaw/ui tsc`
  - `pnpm --filter @nextclaw/ui lint`
  - `pnpm --filter @nextclaw/ui build`
  - `pnpm --filter @nextclaw/ui dev --host 127.0.0.1 --port 4173` + `curl -s http://127.0.0.1:4173/`
- 结果：
  - `tsc/build` 通过。
  - `lint` 无 error，仅存在仓库既有 warning。
  - 本地 dev 服务可正常启动并访问首页。

## 发布/部署方式

- 本次为前端 chat runtime 逻辑修复，按常规 UI 发布链路发布即可。
- 不适用项：
  - 远程 migration：不适用（未涉及后端/数据库变更）。

## 用户/产品视角的验收步骤

1. 在 chat 页发送一条消息并回车，确认用户消息不会消失。
2. 等待 assistant 流式回复，确认不再出现“同一轮 assistant 回复重复两条”。
3. 完成一次回复后再次发送，确认会话消息连续、无循环报错。
4. 打开浏览器控制台，确认不再出现 `Maximum update depth exceeded`。
