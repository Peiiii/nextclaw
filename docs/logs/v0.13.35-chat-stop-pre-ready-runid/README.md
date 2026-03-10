# v0.13.35 Chat Stop Pre-ready RunId

## 迭代完成说明（改了什么）

- 修复“点击终止很早时，后端 stop 触发慢，导致仍追加较多输出”的链路延迟问题。
- 在发送阶段预先生成并透传后端 `runId`（不再依赖 `ready` 事件后才拿到 runId）：
  - `SendMessageParams` 新增可选 `runId`。
  - `NextbotRuntimeAgent` 在 `send` 模式下若缺失 `runId`，自动生成 `run-<ts>-<rand>` 并写入请求 payload。
  - `transport.buildSendTurnPayload` 透传 `runId` 到 `/api/chat/turn/stream`。
- stop 时序优化：
  - `abortRun()` 中先异步发起后端 stop，再本地 abort 流，尽量缩短后端持续运行窗口。
  - `buildInitialRunState()` 在 send 模式下即记录 `backendRunId`，使 pre-ready 停止可直接命中。

## 测试/验证/验收方式

- 执行命令：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw build`
- 结果：全部通过。
- 说明：
  - `nextclaw-ui lint` 仍受仓库既有 `ChatConversationPanel.tsx` React Compiler 规则错误影响（非本次引入）。

## 发布/部署方式

- 本次涉及前端与 CLI/runtime 代码，不涉及数据库变更，无需 migration。
- 本地验证后，按既有前端/CLI 发布流程发布（`/release-frontend` 或 changeset/version/publish）。

## 用户/产品视角的验收步骤

1. 重启当前 `nextclaw` 服务进程（确保加载本次代码）。
2. 在 `native` 会话发送消息后立即点击终止（尽量在首个 token 附近）。
3. 预期：
   - 会话列表 running 转圈不再长时间回弹；
   - 刷新页面后，助手追加内容显著减少（相比之前“终止点后还增长一整句”应明显收敛）；
   - 对应 run 最终为 `aborted` 或快速进入终态，不再长时间运行。
