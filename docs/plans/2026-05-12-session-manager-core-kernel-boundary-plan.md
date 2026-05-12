# Session Manager Core / Kernel Boundary Plan

日期：2026-05-12

## 1. 结论

Session 这一套最终应该拆成“core 领域能力 + kernel 编排层”：

- `@nextclaw/core` 提供稳定、可复用、可组合的 session 领域 manager / store / service / types / utils。
- `@nextclaw/kernel` 只负责产品级装配：决定路径、连接外部 runtime、统一生命周期。
- `SessionManager` 是 session 基础领域 owner，创建 session 是它自己的标准职责，不再保留独立 `SessionCreationService`。
- `SessionStore` 是 `SessionManager` 的内部持久化组件，不应该由 kernel new，也不叫 `SessionRecordStore`。
- `SessionRequestManager` 是独立领域 owner，负责跨 session request / handoff / spawn-and-request；它可以依赖 `SessionManager`，但 `SessionManager` 不能依赖它。
- 有副作用或可恢复状态的 owner 才有生命周期；生命周期统一由 kernel 调用。

目标代码形态：

```ts
export class NextclawKernel {
  readonly sessions: SessionManager;
  readonly sessionSearch: SessionSearchManager;
  readonly sessionRequests: SessionRequestManager;

  constructor(options: NextclawKernelOptions = {}) {
    const sessionsDir = resolveKernelSessionsDir(options);
    this.sessions = new SessionManager({
      sessionsDir,
    });
    this.sessionSearch = new SessionSearchManager({
      sessionsDir,
      databasePath: resolveKernelSessionSearchDatabasePath(options),
    });
    this.sessionRequests = new SessionRequestManager({
      sessions: this.sessions,
      dispatcher: new NcpSessionRequestDispatcher(() => this.agentRuntimeManager.currentBackend),
    });
  }

  start = async (): Promise<void> => {
    await this.sessionSearch.start();
    await this.agentRuntimeManager.start();
    this.learningLoop.start();
  };
}
```

关键点：kernel 传 `sessionsDir` / `databasePath` 这类外部事实，不传 `new SessionStore(...)` 这类内部实现细节。

## 2. 命中的原则

- `complete-owner`
  - `SessionManager` 必须完整覆盖 session 基础管理闭环：创建、读取、更新、删除、metadata 归一、持久化协调。
  - `SessionManager` 不能只是拿着外部传入的 store / creator / updater 做空心壳。

- `responsibility-surface-minimization`
  - kernel 只传 manager 无法自知的外部事实，例如目录、数据库路径、外部 dispatcher。
  - manager 内部可以稳定决定的组件，例如 `SessionStore`，不进入 kernel options。

- `single-domain-owner`
  - session 基础管理只属于 `SessionManager`。
  - session request / handoff 只属于 `SessionRequestManager`。
  - session search / indexing 只属于 `SessionSearchManager`。

- `constructor-builds-graph`
  - constructor 建立同步、确定、长期持有的对象图。
  - `start()` / `dispose()` 只用于 worker、订阅、恢复、预热、外部连接等副作用。

- `no-compatibility-by-default`
  - 内部重构不保留旧 alias / getter / proxy。
  - 旧 `SessionCreationService` 删除，而不是在 `SessionManager` 旁边长期并存。

## 3. 包归属

### 3.1 `@nextclaw/core`

放稳定领域能力，不依赖 NCP / kernel / service：

```text
features/session/
  managers/session.manager.ts
  stores/session.store.ts
  types/session.types.ts
  utils/session-metadata.utils.ts

features/session-request/
  managers/session-request.manager.ts
  types/session-request.types.ts
  utils/session-request-result.utils.ts

features/session-search/
  managers/session-search.manager.ts
  types/session-search.types.ts
  worker/session-search-worker.controller.ts
```

说明：

- `SessionManager` 内部创建 `SessionStore`。
- `SessionRequestManager` 是同级领域，不挂在 `SessionManager` 下。
- `SessionRequestManager` 依赖 `SessionManager` 和一个外部 `SessionRequestDispatcher` 抽象。
- `SessionManager` 不知道 request manager、NCP backend、agent runtime。

### 3.2 `@nextclaw/kernel`

只放产品级装配和协议适配：

```text
services/ncp-agent-session-store.service.ts
services/ncp-session-api.service.ts
services/ncp-lifecycle-event-bridge.service.ts
services/ncp-session-request-dispatcher.service.ts
tools/session-request.tools.ts
tools/session-spawn.tools.ts
```

说明：

- NCP adapter 暂留 kernel，因为它同时依赖 core session 与 NCP runtime。
- 如果未来 adapter 被多个包复用，再考虑沉到 `@nextclaw/ncp-toolkit`。
- kernel 不实现 session 创建规则、不维护 request 状态规则，只连接 core manager 和外部 runtime。

### 3.3 `@nextclaw/ncp-toolkit`

暂不作为第一步迁移目标。

只有当 NCP session adapter 被多个 runtime host 复用时，再迁移：

```text
agent-session-store.adapter.ts
ncp-session-api.adapter.ts
```

## 4. 领域对象职责

### 4.1 `SessionStore`

职责：

- 读写 session 文件。
- list / get / save / delete。
- 管理持久化格式和路径布局。

不负责：

- 创建 session 的业务规则。
- metadata 继承和归一。
- request / handoff。
- NCP message adapter。

生命周期：

- 默认无 `start()`。
- 如果未来有迁移、watcher、预加载，再由 `SessionManager` 内部管理，不对 kernel 暴露 store 生命周期。

### 4.2 `SessionManager`

职责：

- 内部创建并持有 `SessionStore`。
- 创建 session。
- 读取、更新、删除 session。
- append event / clear / save 这类 session 状态变更。
- session metadata 基础归一。
- 对外发布清晰的 session 基础 API。

构造参数：

```ts
export type SessionManagerOptions = {
  sessionsDir: string;
};
```

不负责：

- session request / handoff。
- agent runtime dispatch。
- NCP session API。
- session search worker。
- event bus lifecycle bridge。

生命周期：

- 默认无 `start()`。
- 只有未来出现数据迁移、恢复 pending 状态、watcher 时才加。

### 4.3 `SessionRequestManager`

职责：

- `requestSession`。
- `spawnSessionAndRequest`。
- 创建 request record。
- 生成 request tool result。
- 调用 dispatcher 发送任务。
- 处理 final reply notify / handoff 结果。

构造参数：

```ts
export type SessionRequestManagerOptions = {
  sessions: SessionManager;
  dispatch: SessionRequestDispatcher;
};
```

依赖方向：

```text
SessionRequestManager -> SessionManager
SessionManager -X-> SessionRequestManager
```

生命周期：

- 如果只是即时 dispatch，不需要 `start()`。
- 如果后续要恢复 pending request、重试队列或订阅运行时事件，再加 `start()` / `dispose()`。

### 4.4 `SessionSearchManager`

职责：

- 管理 session search worker。
- 维护 session 派生索引。
- 响应 session updated。
- 提供 search tool 所需查询能力。

构造参数：

```ts
export type SessionSearchManagerOptions = {
  sessionsDir: string;
  databasePath: string;
};
```

生命周期：

- 需要 `start()`，因为有 worker / sqlite / warmup。
- 需要 `dispose()`，清理 worker。

### 4.5 NCP Adapter

职责：

- 把 core session 转成 `AgentSessionStore` / `NcpSessionApi`。
- 把 NCP message 转换为 core legacy session message，或反向转换。
- 把 `NcpEndpointEvent` 转成 kernel event bus lifecycle event。

不负责：

- 创建 session 业务规则。
- request / handoff 领域逻辑。
- store 文件布局。

## 5. Kernel 最终职责

kernel 只负责这些：

- 推导 `sessionsDir`。
- 推导 `sessionSearchDatabasePath`。
- 创建 `SessionManager`、`SessionRequestManager`、`SessionSearchManager`。
- 把 `SessionRequestManager` 的 dispatcher 接到 `AgentRuntimeManager`。
- 把 NCP adapter 接到 agent backend。
- 在 `start()` 调用有生命周期的 owner。
- 在 `dispose()` 反向释放生命周期。

kernel 不应该：

- new `SessionStore`。
- 实现 session 创建规则。
- 维护 request record 细节。
- 暴露 `kernel.sessions.requests` 这种把独立领域挂进基础 manager 的结构。
- 为了调用方便写 forwarding API。

## 6. 迁移步骤

### Step 1：沉淀 core session 基础领域

- 将当前 core 里的 session 持久化能力整理为：
  - `SessionStore`
  - `SessionManager`
- 把 session 创建逻辑从 kernel `SessionCreationService` 合并进 core `SessionManager.createSession`。
- 删除 kernel `SessionCreationService`。

验收：

- `new SessionManager({ sessionsDir })` 可以完整完成 session 创建、读写、删除。
- kernel 不再传 `store`。

### Step 2：沉淀 core session request 领域

- 将 `SessionRequestBroker` 改名并沉淀为 core `SessionRequestManager`。
- 将 request types / result utils / execution utils 移到 core。
- `SessionRequestManager` 依赖 core `SessionManager` 和 `SessionRequestDispatcher`。

验收：

- `SessionManager` 不依赖 `SessionRequestManager`。
- kernel 持有 `sessionRequests`，而不是 `sessions.requests`。

### Step 3：调整 kernel 装配

目标形态：

```ts
this.sessions = new SessionManager({ sessionsDir });
this.sessionSearch = new SessionSearchManager({
  sessionsDir,
  databasePath: sessionSearchDatabasePath,
});
this.sessionRequests = new SessionRequestManager({
  sessions: this.sessions,
  dispatcher: new NcpSessionRequestDispatcher(() => this.agentRuntimeManager.currentBackend),
});
```

验收：

- `NextclawKernel` 是唯一装配层。
- `AgentRuntimeManager` 不再持有 session manager 主题 owner。
- `LearningLoopManager` 使用 `kernel.sessionRequests`，不通过 `agentRuntimeManager`。

### Step 4：保留并收窄 NCP adapter

- `NcpAgentSessionStore` / `NcpSessionApiService` 暂留 kernel services。
- 只依赖 core `SessionManager`。
- 不拥有创建和 request 领域规则。

验收：

- NCP backend 只拿 adapter。
- adapter 不成为新的领域 owner。

### Step 5：生命周期统一

kernel lifecycle：

```ts
start = async (): Promise<void> => {
  await this.sessionSearch.start();
  await this.agentRuntimeManager.start();
  this.learningLoop.start();
};

dispose = async (): Promise<void> => {
  this.learningLoop.dispose();
  await this.agentRuntimeManager.dispose();
  await this.sessionSearch.dispose();
};
```

验收：

- 没有副作用的 manager 不加空生命周期。
- 有 worker / 订阅 / 外部连接的 owner 必须有明确生命周期。

## 7. 删除清单

迁移完成后应该删除：

- kernel `SessionCreationService`。
- kernel `SessionRequestBroker`。
- `kernel.sessions.requests`。
- 任何 `SessionRuntimeManager` / `AgentSessionRuntime` 之类命名。
- 只为了兼容旧调用的 getter / alias / forwarding 方法。
- 未使用的 child-session promotion / alias API。

## 8. 风险与取舍

- `@nextclaw/core` 不能依赖 NCP，因此 NCP adapter 不进入 core。
- `SessionSearchManager` 是否进入 core 取决于它是否只依赖 session 文件和 worker。如果它保持协议无关，可以进入 core；如果 tool / NCP 绑定变重，tool adapter 留 kernel。
- 迁移时不要为了少改调用方保留双入口。内部调用方一次性改到新 owner。
- 非功能改动必须保持非测试代码净增 `<= 0`，优先通过删除旧 service 和旧路径达成。

## 9. 最终验收标准

- `@nextclaw/core` 有清晰的 session 基础领域 API：

```ts
new SessionManager({ sessionsDir });
```

- kernel 有清晰的同级 owner：

```ts
kernel.sessions;
kernel.sessionRequests;
kernel.sessionSearch;
```

- 依赖方向清晰：

```text
kernel -> core managers
kernel -> NCP adapters
SessionRequestManager -> SessionManager
SessionManager -X-> SessionRequestManager
core -X-> kernel / NCP / service
```

- 生命周期清晰：
  - `SessionManager` 默认无生命周期。
  - `SessionSearchManager` 有 `start()` / `dispose()`。
  - `SessionRequestManager` 只有存在恢复/订阅/队列时才加生命周期。

- 代码形态更少、更简单、更可预测，不通过 wrapper / alias / proxy 假装收敛。
