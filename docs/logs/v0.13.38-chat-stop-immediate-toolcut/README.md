# v0.13.38 Chat Stop Immediate Toolcut

## 迭代完成说明（改了什么）

- 将 `UiChatRunCoordinator.stopRun()` 从“等待 run 收敛后返回”改为“立即进入终止态并返回”：
  - stop 请求命中后立即将 run 标记为 `aborted`。
  - 立即生成 `final` 事件（基于当前已接收 delta 拼接），避免前端继续等待。
  - 同步触发 `abortController.abort(...)`，并保留后端协作式取消。
- 增加 `finalizeRunAsStopped()`，统一 stop 终止收口：
  - 防重 `final`（避免重复 final 事件）。
  - stop 后落地 partial reply（无 tool session event 时）。
  - 防止后续流程把已 stop run 覆盖回 `completed`。
- 在 run 执行链路中增加 stop 后护栏：
  - `onAssistantDelta` / `onSessionEvent` 在 `cancelRequested=true` 后不再继续推送事件。
  - `processDirect` 返回后若已 stop，直接走 stop 收口，不再进入 completed 分支。
- 在 `AgentLoop` 的 tool 分支入口新增 abort 检查（普通消息与 system 消息路径各一处），降低 stop 后继续进入工具调用分支的概率。

## 测试/验证/验收方式

- 影响面：`packages/nextclaw`（run 协调器）+ `packages/nextclaw-core`（agent loop）。
- 最小充分验证命令：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw test src/cli/commands/agent-runtime-pool.command.test.ts`
- 冒烟（用户可见行为）：
  - 真实 chat 流程中发送一条会触发工具/长回复的消息，点击 stop；观察点：
    - UI 回复不再继续增长（或仅极短尾流后停止）；
    - run 状态立即进入 `aborted`，不再长时间保持 `running`；
    - stop 后不再看到新的工具调用事件继续追加。

## 发布/部署方式

- 本次为前后端运行时逻辑变更，不涉及数据库 schema，不需要 migration。
- 按项目常规流程发布：
  - 若只发前端承载可走 `/release-frontend`；
  - 若包含 CLI/runtime 行为修复，按 changeset/version/publish 流程发布 `nextclaw` 相关包。

## 用户/产品视角的验收步骤

1. 打开 Chat，发送一条会持续输出或可能触发工具调用的消息。
2. 在输出进行中点击停止。
3. 预期：
   - 停止动作触发后，回复应“基本立刻”停止增长；
   - 会话/运行状态快速进入终态 `aborted`；
   - 停止后不应再出现新的工具调用继续执行/追加的可见迹象。
