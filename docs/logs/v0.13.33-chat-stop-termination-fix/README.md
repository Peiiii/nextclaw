# v0.13.33 Chat Stop Termination Fix

## 迭代完成说明（改了什么）

- 修复聊天“终止”在运行早期可能只本地停止、后端 run 继续 running 的问题：
  - `useChatRuntimeController`：收紧 stop 按钮可点击条件，仅在“远端可停止”时允许在 `runId` 未就绪阶段点击终止。
  - `chat-stream/transport.ts`：`requestStopRun` 增加 runId 兜底解析逻辑；若未拿到 `ready.runId`，会按 `sessionKey` 查询活动 run（`queued/running`）并尝试终止。
  - `nextbot-runtime-agent.ts`：中断时只要 run 标记为可停止就尝试调用 stop（由 transport 处理 runId 兜底）。

## 测试/验证/验收方式

- 执行命令（在缺省 PATH 无 pnpm 的环境下，使用 one-off PATH 前缀）：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui build`
- 结果：
  - `tsc` 通过。
  - `lint` 通过（存在仓库既有 warning，无新增 error）。
  - `build` 通过。
- 不适用说明：
  - 未执行 UI 自动化 e2e（仓库当前无该链路的现成脚本）；本轮以类型、静态检查和构建通过作为最小充分验证。

## 发布/部署方式

- 本次仅前端代码修复，无需数据库 migration。
- 按项目前端发布流程执行：`/release-frontend`（或等效 `pnpm release:frontend` 流程）。

## 用户/产品视角的验收步骤

1. 打开 Chat 页面，选择一个可运行会话并发送消息。
2. 在 AI 开始回复后立即点击终止（包括“很早点击”的场景）。
3. 预期：
   - 当前回复应停止继续增长；
   - 会话列表中的运行状态应从 `running`/转圈退出，不再长时间卡住；
   - 不会出现“前端已停但后端 run 仍持续 running”的明显不同步。
