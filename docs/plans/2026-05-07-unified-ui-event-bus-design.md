# Unified UI Event Bus Design

日期：2026-05-07

## 1. 结论

第一阶段不新增 `/api/events`，不新增 SSE，也不新建 event-bus 包。

统一方向：

```text
复用现有 /ws 通道
在 @nextclaw/kernel 顶层导出 nextclaw facade、EventBus、eventKeys
后端 bootstrap 安装一次 NextClawApp
后端 runtime 代码直接通过 nextclaw.events 使用同一个事件根
nextclaw-server 将 nextclaw.events 桥接到现有 /ws
@nextclaw/client-sdk 暴露 client.eventBus
NextClaw UI 通过 client.eventBus 消费事件
runtime update 删除 host 模式永久 1s 轮询
```

这里的核心不是“传一个参数”，而是建立一个类似 VS Code `vscode.*` 的产品级运行时入口。第一阶段只落 `nextclaw.events`，其它分支先不展开。

## 2. 背景

当前 runtime update 前端在 host 模式下通过固定 `1s` 轮询 `GET /api/runtime/update` 获取更新状态。问题本质不是单个接口太频繁，而是系统缺少统一的自感知事件入口。

仓库已有基础：

- 服务端 `/ws`：`packages/nextclaw-server/src/ui/server.ts`
- 服务端事件类型：`packages/nextclaw-server/src/ui/types.ts` 的 `UiServerEvent`
- 前端 SDK realtime owner：`packages/nextclaw-client-sdk/src/services/realtime.service.ts`
- 当前 UI 消费桥：`packages/nextclaw-ui/src/app/hooks/use-realtime-query-bridge.ts`

同时已有需要收敛的问题：

- `nextclaw-server` router options 里有原始 `publish(event)`。
- `nextclaw` CLI/service 层里有 `publishUiEvent?: (event: UiServerEvent) => void`。
- `nextclaw` 包为了发 UI 事件 import 了 `@nextclaw/server` 的 `UiServerEvent` 类型。

这些都说明事件契约和运行时入口应该下沉到更稳定的 `@nextclaw/kernel` 顶层，而不是让业务包依赖 server 类型。

## 3. 命名

后端顶层入口叫：

```ts
nextclaw
```

真实实例类型叫：

```ts
NextClawApp
```

原因：

- `nextclaw` 类似 VS Code API 的 `vscode` namespace，是产品级运行时入口。
- `App` 太泛，容易和 Express/Nest/Electron 的 app 混。
- `Kernel` 更像产品内核分支，不适合作为所有基础设施的顶层名字。
- 事件分支 class 仍叫 `EventBus`，共享事件类型叫 `AppEvent`。

未来可以有：

```ts
nextclaw.events
nextclaw.runtime
nextclaw.diagnostics
nextclaw.services
nextclaw.kernel
```

第一阶段只实现 `nextclaw.events`，其它分支先留空，不设计空对象。

## 4. Kernel Public API

新增内部文件：

```text
packages/nextclaw-kernel/src/app/nextclaw-app.service.ts
packages/nextclaw-kernel/src/app/nextclaw-app.registry.ts
packages/nextclaw-kernel/src/events/event-bus.service.ts
packages/nextclaw-kernel/src/events/event-bus.types.ts
packages/nextclaw-kernel/src/events/event.keys.ts
packages/nextclaw-kernel/src/events/index.ts
```

调用方只从顶层导入：

```ts
import { eventKeys, nextclaw } from "@nextclaw/kernel";
```

不允许 import：

```ts
@nextclaw/kernel/events
@nextclaw/kernel/src/events/*
@nextclaw/server 的 UiServerEvent
```

顶层导出：

```ts
export {
  createNextClawApp,
  getNextClawApp,
  installNextClawApp,
  nextclaw,
  resetNextClawAppForTest
} from "./app/nextclaw-app.registry.js";
export { EventBus, createAppEventKey, eventKeys } from "./events/index.js";
export type { NextClawApp } from "./app/nextclaw-app.service.js";
export type { AppEvent, AppEventKey } from "./events/index.js";
```

## 5. API Shape

事件总线：

```ts
export type AppEventKey<T> = {
  readonly id: string;
  readonly _type?: T;
};

export type AppEventEnvelope = {
  type: string;
  payload: unknown;
  emittedAt?: string;
  source: "backend" | "realtime" | "local";
};

export type AppEventHandler<T> = (payload: T, envelope: AppEventEnvelope) => void;

export type AppEventEmitOptions = {
  emittedAt?: string;
  source?: AppEventEnvelope["source"];
};

export class EventBus {
  emit = <T>(key: AppEventKey<T>, payload: T, options?: AppEventEmitOptions): void;
  on = <T>(key: AppEventKey<T>, handler: AppEventHandler<T>): (() => void);
  off = <T>(key: AppEventKey<T>, handler: AppEventHandler<T>): void;
  once = <T>(key: AppEventKey<T>, handler: AppEventHandler<T>): (() => void);
  subscribeAll = (handler: (event: AppEventEnvelope) => void): (() => void);
}
```

`nextclaw` facade：

```ts
export type NextClawApp = {
  readonly events: EventBus;
};

export const nextclaw: NextClawApp;
export function createNextClawApp(options?: CreateNextClawAppOptions): NextClawApp;
export function installNextClawApp(app: NextClawApp): void;
export function getNextClawApp(): NextClawApp;
export function resetNextClawAppForTest(): void;
```

约束：

- `nextclaw` 是 facade，不是直接裸导出的可变 singleton。
- `installNextClawApp` 必须在服务启动 bootstrap 阶段执行一次。
- 未安装时访问 `nextclaw.events` 必须抛错，避免静默丢事件。
- 重复安装默认抛错，避免同进程事件根被悄悄替换。
- `resetNextClawAppForTest` 只给测试使用。

## 6. 后端使用方式

bootstrap：

```ts
import { createNextClawApp, installNextClawApp } from "@nextclaw/kernel";

const app = createNextClawApp();
installNextClawApp(app);
```

任意后端 runtime 代码：

```ts
import { eventKeys, nextclaw } from "@nextclaw/kernel";

nextclaw.events.emit(eventKeys.runtimeUpdateSnapshot, snapshot, {
  source: "backend"
});
```

这样不同包不需要层层传 `appBus`，也不需要依赖 `@nextclaw/server`。同一进程内所有发布者都使用已安装的同一个 `NextClawApp.events`。

跨进程不能共享同一个内存实例，跨进程事件只能通过明确 transport：

```text
backend process nextclaw.events -> /ws -> client process client.eventBus
```

## 7. WebSocket Bridge

`nextclaw-server` 不定义业务事件，只做 sink：

```ts
const webSocketEventSink = new WebSocketEventSink(clients);
const unsubscribeWebSocketSink = getNextClawApp().events.subscribeAll(
  webSocketEventSink.publish
);
```

`/ws` wire format 继续保持 JSON：

```json
{
  "type": "runtime.update.snapshot",
  "emittedAt": "2026-05-07T12:00:00.000Z",
  "payload": {
    "status": "downloading",
    "progress": {
      "percent": 42
    }
  }
}
```

## 8. Client SDK

前端仍然只使用：

```ts
nextclawClient.eventBus.on(eventKeys.runtimeUpdateSnapshot, (snapshot) => {
  runtimeUpdateManager.reportSnapshot(snapshot);
});
```

`RealtimeService` 是内部 transport owner。SDK 内部把 `/ws` 收到的 event 喂给 `client.eventBus`，UI 不直接管理 WebSocket 生命周期。

## 9. Runtime Update 接入

runtime update host 只通过 `setSnapshot` 更新状态并发布完整 snapshot：

```ts
private setSnapshot = (snapshot: UpdateSnapshot): UpdateSnapshot => {
  this.snapshot = snapshot;
  nextclaw.events.emit(eventKeys.runtimeUpdateSnapshot, snapshot, {
    source: "backend"
  });
  return snapshot;
};
```

原则：

- 默认发完整 snapshot，不发细碎 diff。
- UI 初始 `GET /api/runtime/update` 一次拿真相。
- 后续变化通过 `runtime.update.snapshot` 推进。
- realtime reconnect / focus 恢复时再补一次 GET。
- 删除 host 模式永久 `1s` 轮询。

## 10. 第一阶段范围

做：

1. `@nextclaw/kernel` 顶层增加 `nextclaw`、`NextClawApp`、`createNextClawApp`、`installNextClawApp`、`getNextClawApp`、`resetNextClawAppForTest`、`EventBus`、`AppEvent`、`eventKeys`。
2. 增加 `runtime.update.snapshot` key。
3. 后端 bootstrap 创建并安装一次 `NextClawApp`。
4. `nextclaw-server` 将 `getNextClawApp().events.subscribeAll(...)` 桥接到现有 `/ws`。
5. NPM runtime update host 通过 `nextclaw.events.emit(...)` 发布 snapshot。
6. `@nextclaw-client-sdk` 暴露 `client.eventBus`，并在 SDK 内部绑定 realtime event。
7. NextClaw UI 改为 `useAppEventConsumers` 消费 `client.eventBus`。
8. 删除 runtime update host 永久轮询和 `/updates` 页面重复 start。
9. 补测试和接口级 smoke。

不做：

- 不迁移 desktop bridge。
- 不迁移 system status。
- 不新增 WebSocket。
- 不新增 SSE。
- 不新增 `/api/events`。
- 不做 ack/resume/seq。
- 不做事件持久化。
- 不把其它未来分支做成空壳。

## 11. 验证

需要覆盖：

- `EventBus` 支持 `emit/on/off/once/subscribeAll`，并隔离 listener error。
- `installNextClawApp` 保证同一进程只安装一个 `NextClawApp`。
- 未安装时 `nextclaw.events` 抛错。
- runtime update host 每次 snapshot 变化会发布 `runtime.update.snapshot`。
- `WebSocketEventSink` 能把 `AppEventEnvelope` 发给打开的 WebSocket client。
- `NextClawClient` 暴露 `client.eventBus`。
- `RuntimeUpdateManager` 收到事件后更新 store。
- 稳定状态下 `/api/runtime/update` 不再每秒调用。
