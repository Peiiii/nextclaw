# v0.13.22-chatpage-sync-external-store-stability

## 迭代完成说明（改了什么）

- 修复 `ChatPage` 的 `Maximum update depth exceeded` 根因链路：
  - `useChatRuntimeController` 中 `useSyncExternalStore` 的 `subscribe` 回调由内联函数改为稳定引用（`useCallback`），避免在 `BehaviorSubject` 下反复重订阅并立即触发回调导致渲染循环。
  - 保留并继续使用上一轮 `manager syncSnapshot` 的 no-op 守卫，减少无变化写入 store 导致的被动重渲染。
- 将 `ChatSidebar` 保持为原有 Radix Select 交互，不再依赖临时 UI 兜底方案。
- 相关方案文档：[`2026-03-10-chat-runtime-agent-align.md`](../../designs/2026-03-10-chat-runtime-agent-align.md)

## 测试/验证/验收方式

- 已执行：
  - `pnpm --filter @nextclaw/ui tsc`
  - `pnpm --filter @nextclaw/ui lint`
  - `pnpm --filter @nextclaw/ui build`
- 结果：
  - `tsc/build` 通过。
  - `lint` 无 error，仅存在仓库既有 warning。

## 发布/部署方式

- 本次为前端运行时稳定性修复，按常规 UI 发布流程发布。
- 不适用项：
  - 远程 migration：不适用（未涉及后端/数据库）。

## 用户/产品视角的验收步骤

1. 启动 UI 后进入 chat 页面，确认不再出现 `Maximum update depth exceeded`。
2. 发送消息、等待流式回复、切换会话，确认页面不崩溃且消息渲染稳定。
3. 在 Sidebar 切换主题/语言，确认交互正常且不触发循环报错。
