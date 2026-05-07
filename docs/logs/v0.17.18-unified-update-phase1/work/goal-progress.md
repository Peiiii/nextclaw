# Goal Progress

## 当前目标

一次性完成统一 UI 事件总线改造，并验证 runtime update 进度/状态通过事件链路正确分发，不再依赖 host 模式永久轮询。

## 明确非目标

- 不新增 `/api/events`、SSE 或新的 event-bus 包。
- 不迁移 desktop bridge 的内部更新通道。
- 不抬高 `minimumLauncherVersion`。
- 不把前端做成环境判断 owner；前端只消费 snapshot / eventBus。

## 冻结边界 / 不变量

- 后端公共入口是 `nextclaw.eventBus`。
- 事件 key / envelope 契约来自 `@nextclaw/kernel` 顶层导出。
- server 只把 event bus bridge 到既有 `/ws`。
- SDK 暴露 `client.eventBus`，并懒启动 realtime transport。
- UI 初始状态仍允许一次 GET，后续变化走事件。

## 已完成进展

- 已落地 `nextclaw.eventBus`、`EventBus`、`eventKeys`、`AppEvent`。
- 已把 server `/ws` bridge 接到 `nextclaw.eventBus.subscribeAll`。
- 已让 NPM runtime update host 通过 `runtime.update.snapshot` 发布状态。
- 已让 SDK 暴露懒启动 `client.eventBus`，`sessions.subscribe` 复用同一 bus。
- 已让 UI 使用 `useAppEventConsumers` 消费统一事件，并删除 host 模式 1s 轮询。
- 已补齐 Vite / Vitest / tsconfig 对 `@nextclaw/kernel` 与 `@nextclaw/client-sdk` 的一致 alias。
- 已同步 `packages/nextclaw/ui-dist`。
- 已完成测试、tsc、build、rg 和 maintainability guard 验证。

## 当前下一步

等待用户决定是否提交 / 发布新 beta；当前实现与验证链路已闭环。

## 锚点计数器

20/20
