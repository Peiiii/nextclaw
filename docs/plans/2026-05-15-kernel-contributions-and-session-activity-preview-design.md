# Kernel Contributions 与会话活动预览设计

## 背景

会话列表需要在标题下方展示更有信息密度的第二行内容。这个内容不只是“最后一条消息”，也应该能表达最近活动状态，例如正在运行、工具调用、运行失败，以及完成后最后一次 assistant 回复的摘要。

这类能力属于 kernel 内部的旁路投影：它监听底层事实事件，派生轻量 metadata，写回 session，再让已有 session summary 事件通知前端。它不应进入 NCP 核心消息链路，也不应散落在 store / API / UI hook 里。

## Contribution 角色

`contributions/` 是 kernel package 内部的新顶层组织角色，定位接近 `features/`，但语义不同：

- `features/` 承载核心能力域和主链路。
- `contributions/` 承载非核心链路的 kernel 内部贡献能力。
- contribution 主要通过监听 kernel 事件、投影派生状态、写回已有 owner 来增强体验。
- kernel 只维护 contribution 数组并调用生命周期，不感知内部逻辑。

最小生命周期接口：

```ts
export interface KernelContribution {
  start(): void | Promise<void>;
  dispose(): void | Promise<void>;
}
```

`NextclawKernel` 直接持有数组：

```ts
private readonly contributions: KernelContribution[];
```

constructor 中实例化：

```ts
this.contributions = [
  new SessionActivityPreviewContribution(this),
];
```

`start()` 与 `dispose()` 直接遍历数组，不引入 manager / host / context。

## 目录结构

每个 contribution 是 `contributions/<name>/` 下的独立目录。该目录根只保留 `index.ts` 作为唯一公开出口，contribution class 直接写在 `index.ts` 里。

推荐结构：

```txt
packages/nextclaw-kernel/src/contributions/
  session-activity-preview/
    index.ts
    types/
      session-activity-preview.types.ts
    utils/
      session-activity-preview-metadata.utils.ts
      session-activity-preview-ncp-event.utils.ts
```

约束：

- `index.ts` 只导出 contribution class。
- 内部类型、工具、测试 helper 不从 `index.ts` re-export。
- 内部角色文件进入 `types/`、`utils/` 等角色子目录，不在 contribution root 平铺。
- 外部只允许依赖 contribution class；如果某个内部 util 后续需要复用，应重新判断它是否应该上移到真正公共 owner。

## Session Activity Preview

第一个 contribution 建议命名为 `session-activity-preview`。它监听底层 NCP 事件：

```ts
eventKeys.ncpEvent
```

它不监听 `session.updated`，因为 `session.updated` 是宽泛的 invalidation signal，不能准确表达发生了什么。activity preview 的事实来源应该是 NCP event stream。

metadata 字段建议为：

```ts
metadata.last_activity_preview = {
  state: "running" | "completed" | "failed" | "idle",
  statusText?: string,
  replyText?: string,
  timestamp: string
}
```

展示优先级：

- failed：展示 `statusText`。
- running：展示 `statusText`。
- completed 且有 `replyText`：展示 `replyText`。
- 其他情况：展示 `statusText`。

事件投影规则：

- `run.started`：设置 running 状态和运行中 status。
- tool 相关事件：更新 status，表示正在或刚刚处理的工具活动。
- assistant `message.completed`：更新 replyText，完成后优先展示回复摘要。
- `run.error`：设置 failed 状态和错误 status。
- `run.finished`：只更新状态，不覆盖已有 replyText。
- delta 类高频事件不写 metadata。

## 写入与通知

contribution 通过现有统一 facade 写回 session metadata：

```ts
await this.kernel.ncpSessionApi.updateSession(sessionId, {
  metadata: nextMetadata,
});
```

这里使用 `NcpSessionApiService` 是当前最合适的已有入口：它已经统一了 NCP journal / legacy session 的路由，并负责 `session.summary.upsert` 通知。`NcpAgentSessionStoreAdapter` 是给 agent backend / NCP toolkit 的 `AgentSessionStore` 适配器，不作为 contribution 的直接依赖。

contribution 不直接发前端事件。写入后由 `NcpSessionApiService` 继续发布 session summary change。

## 验收条件

- kernel 能通过 contribution 数组启动和停止 contribution。
- `session-activity-preview` 能从 NCP event 投影 `metadata.last_activity_preview`。
- preview 不因 token delta 高频写入。
- preview 未变化时不重复写 session。
- 前端会话列表能从 summary metadata 读取并展示第二行。
- module-structure 治理允许 `contributions/<name>/index.ts` 和角色子目录，但不允许 contribution root 平铺角色文件。
