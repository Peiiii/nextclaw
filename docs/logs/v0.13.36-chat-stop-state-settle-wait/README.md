# v0.13.36 Chat Stop State Settle Wait

## 迭代完成说明（改了什么）

- 修复点击终止后会话列表 `running` 状态短暂消失又回弹的问题。
- 在后端 `UiChatRunCoordinator.stopRun()` 中增加“短等待 run 进入终态”逻辑：
  - 收到 stop 后先触发 `abortController.abort(...)`；
  - 在返回 stop 结果前等待 run 从 `queued/running` 退出（最多 1500ms）；
  - 让前端 stop 后立刻 refetch 时更大概率读到终态，而不是短暂仍 running。
- 该变更不改变 stop 的语义（仍是 best-effort），但显著优化了状态一致性与 UI 体感。

## 测试/验证/验收方式

- 执行命令：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw tsc`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw build`
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw test src/cli/commands/agent-runtime-pool.command.test.ts`
- 结果：
  - `tsc` 通过；
  - `build` 通过；
  - 测试 5/5 通过。

## 发布/部署方式

- 本次为 CLI/runtime 逻辑修复，不涉及数据库变更，无需 migration。
- 按常规 nextclaw 发布流程进行版本与发布（changeset/version/publish）。

## 用户/产品视角的验收步骤

1. 重启 `nextclaw` 服务，进入 `native` 会话发送消息。
2. 在回复中点击终止。
3. 预期：
   - 会话列表 running 指示器不再明显“停一下又恢复转圈”；
   - 刷新后 run 状态更快稳定到终态（多数为 `aborted`）；
   - 若仍有少量延迟追加文本，幅度应明显小于修复前。
