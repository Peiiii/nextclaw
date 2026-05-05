# System Status View Model Boundary Refactor

## 背景

当前 `system-status` 层的 `SystemStatusView` 同时暴露事实状态和聊天交互策略：

- `phase` / `connectionStatus` 是系统事实。
- `isChatBlocked` / `chatMessage` 是聊天 UI 的场景化展示与交互决策。

这会让调用方把“某个视图当前怎么处理聊天交互”误认为“系统客观状态”。后续想更早开放发送、支持准备中提示、恢复期策略或更细的交互差异时，会被一个粗粒度布尔值绑死。

## 原则

底层状态只表达事实，不表达场景化决策。场景化决策必须放在对应 feature 的 view model 层，由事实状态推导。

这次改造遵循三条边界：

1. `system-status` 只保留系统事实：生命周期、连接状态、运行时控制状态、错误和当前 phase。
2. `chat` 自己推导聊天可用性：是否 blocked、展示什么消息、是否隐藏发送错误。
3. 发送执行层不再调用系统层的聊天策略方法，而是先读取事实状态，再用 chat feature 的可用性工具推导。

## 改造范围

- 从 `SystemStatusView` 移除 `isChatBlocked` 与 `chatMessage`。
- 从 `SystemStatusManager` 移除聊天策略方法。
- 新增 chat feature 内的 runtime availability view model：
  - 根据 `bootstrapStatus.ncpAgent.state` 推导聊天发送是否被 runtime 阻止。
  - 根据 lifecycle/action/error 推导聊天运行时消息。
  - 根据 runtime phase 与发送错误推导最终展示错误。
- 更新聊天输入与发送 manager，统一使用 chat 层 availability。

## 非目标

- 本次不改变发送时机策略。
- 本次不实现队列、pending send 或提前执行。
- 本次不改变 runtime phase 的来源和状态机。

## 验收标准

- 系统状态 view 不再包含聊天特定字段。
- 聊天发送禁用行为改为只按 `ncpAgent.state !== "ready"` 阻止 runtime 发送能力；无内容时仍 disabled。
- 原有聊天运行时错误显示语义保持现状。
- 相关单测和 TypeScript 检查通过。
