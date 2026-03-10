# v0.13.23-chat-runtime-snapshot-stability-guard

## 迭代完成说明（改了什么）

- 修复 `ChatPage` 仍出现 `Maximum update depth exceeded` 的关键触发点：
  - `ChatRunLifecycleManager.subscribe()` 之前会在 `activeRun$ / lastError$` 每次发射时无条件触发 `onChange`。
  - 由于 `BehaviorSubject` 订阅时会立即发射，导致 `useSyncExternalStore` 在 mount/commit 期被重复触发更新。
- 新增生命周期状态比较函数，仅当 `activeBackendRunId / stopDisabledReason / lastSendError` 发生真实变化时才触发 `onChange`。
- 保持 `ChatSidebar` 的 Radix Select 方案不变（未再引入 UI 层兜底替代）。

## 测试/验证/验收方式

- 已执行：
  - `pnpm --filter @nextclaw/ui tsc`
  - `pnpm --filter @nextclaw/ui lint`
  - `pnpm --filter @nextclaw/ui build`
- 结果：
  - `tsc/build` 通过。
  - `lint` 无 error，仅有仓库既有 warning。

## 发布/部署方式

- 本次为前端运行时稳定性修复，按常规 UI 发布流程发布。
- 不适用项：
  - 远程 migration：不适用（未涉及后端/数据库）。

## 用户/产品视角的验收步骤

1. 进入 chat 页面，确认不再出现 `Maximum update depth exceeded`。
2. 发送消息并等待流式回复，确认页面持续可交互。
3. 切换会话与侧边栏配置（主题/语言），确认不触发循环报错。
