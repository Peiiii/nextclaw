# Cross-Session Request And Child Session Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不打补丁、不继续堆特例的前提下，把 NextClaw 当前 `spawn/subagent/follow-up` 链路收敛成可长期演进的 `child session + session request + completion event + delivery adapter` 结构，并同步落地 Phase 1 的 child session 产品交互约束。

**Architecture:** 先收敛协议与后端编排层，再接入前端产品表面，最后把旧 `spawn` 兼容映射到新模型。核心做法不是再叠一层新逻辑，而是删除旧的 subagent 专用回传分支，把“创建子会话”“向目标会话发请求”“等待终态事件”“把结果回投到源会话”拆成稳定的一等对象与 class 边界。

**Tech Stack:** TypeScript, `@nextclaw/core`, `@nextclaw/ncp`, `@nextclaw/ncp-toolkit`, `packages/nextclaw`, `packages/nextclaw-ui`, React, Zustand/manager pattern, Vitest.

---

## 1. 这份计划的定位

这份文档不是开放讨论稿，而是后续实现阶段的主约束文档。

它要解决的不是：

- “能不能先尽快做出来”
- “要不要先用兼容补丁兜住”
- “要不要先加个 if 让旧逻辑也继续跑”

它真正要解决的是：

- 用最少的新抽象收敛现有多条链路
- 明确哪些旧结构该删、该折叠、该替换
- 把一阶段产品行为和协议行为都写死，避免实现时自由发挥
- 让后续即使不是当前上下文的人接手，也不容易做出 surprise success / surprise failure

## 2. Primary Contract

第一阶段的 primary contract 不是：

- 旧 `spawn`
- 旧 `subagent completion`
- hidden follow-up message
- 某个 runtime 的私有行为

第一阶段的 primary contract 是：

1. `SessionRecord`
2. `SessionRequestRecord`
3. `SessionRequestEvent`
4. `DeliveryAdapter`
5. `SessionRequestBroker`

只有这些对象和边界，才允许成为系统的真相源。

以下对象在 Phase 1 只能是兼容层，不得继续扩大职责：

- `SpawnTool`
- `SubagentManager` 当前 run-oriented API
- NCP hidden follow-up message
- 任意 `system_event_kind=subagent_completion*` 的特判桥接

## 3. 马斯克五步法在本次实现中的强约束

### Step 1: Challenge

先质疑一切“看起来以后可能会需要”的字段和枚举。

Phase 1 明确不预埋：

- `Session.relation`
- `Session.visibility`
- session tree 多层导航模型
- `sessions_request` inline spawn
- 复杂的 request relation 枚举
- 为各种 runtime 预置不同 delivery 语义

### Step 2: Delete

优先删除或折叠以下旧结构，而不是在外面再包一层：

- subagent completion 对 legacy inbound system-message relay 的依赖
- NCP completion 对 hidden follow-up message 作为唯一真相源的依赖
- “spawn 既代表建 worker，又代表发请求，又代表等回执”的混合语义
- 任何把 child session 伪装成普通 tool result 文本的 UI 拼接逻辑

### Step 3: Simplify

Phase 1 只保留这几个最小判断：

- 这个 session 有没有 `parentSessionId`
- 这个 request 的目标 session 是谁
- 这个 request 的 terminal event 是什么
- 这个 request 完成后如何 delivery
- 父会话是否需要继续运行

### Step 4: Accelerate

只有在删除和简化之后，才允许加速实现。

加速方式应是：

- 用单一 broker 收敛旧链路
- 用单一 card surface 收敛 child session 产品入口
- 用单一详情入口收敛 child session 查看方式

### Step 5: Automate

本轮完成后至少要新增：

- broker contract tests
- request terminal-state tests
- child session UI state tests
- fail-fast 参数校验测试

## 4. Phase 1 必须写死的行为边界

### 4.1 Session 边界

`SessionRecord` 第一阶段只承诺这些字段：

```ts
type SessionLifecycle = "persistent" | "ephemeral";

type SessionRecord = {
  sessionId: string;
  sessionType: string;
  runtimeFamily: "native" | "external";
  backendId?: string;
  backendTargetId?: string;
  backendSessionId?: string;
  parentSessionId?: string;
  spawnedByRequestId?: string;
  lifecycle?: SessionLifecycle;
  title?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};
```

硬约束：

- 有 `parentSessionId` 就是 child session
- 没有 `parentSessionId` 就不是 child session
- 默认 `lifecycle = persistent`
- Phase 1 不允许新增 `relation`
- Phase 1 不允许新增 `visibility`

### 4.2 Session Request 边界

```ts
type SessionRequestStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

type SessionRequestAwaitMode = "none" | "final_reply";

type SessionRequestDeliveryMode =
  | "none"
  | "resume_source";

type SessionRequestRecord = {
  requestId: string;
  sourceSessionId: string;
  targetSessionId: string;
  sourceToolCallId?: string;
  sourceMessageId?: string;
  targetMessageId?: string;
  rootRequestId: string;
  parentRequestId?: string;
  handoffDepth: number;
  awaitMode: SessionRequestAwaitMode;
  deliveryMode: SessionRequestDeliveryMode;
  status: SessionRequestStatus;
  finalResponseMessageId?: string;
  finalResponseText?: string;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  metadata?: Record<string, unknown>;
};
```

硬约束：

- `await` 必须显式传入
- `delivery` 必须显式传入
- Phase 1 不支持 inline spawn target
- Phase 1 只支持 `target.session_id`
- 未定义组合必须 fail fast

### 4.3 终态事件边界

```ts
type SessionRequestEvent =
  | {
      type: "session.request.accepted";
      requestId: string;
      sourceSessionId: string;
      targetSessionId: string;
      targetMessageId?: string;
      timestamp: string;
    }
  | {
      type: "session.request.completed";
      requestId: string;
      sourceSessionId: string;
      targetSessionId: string;
      finalResponseMessageId?: string;
      finalResponseText?: string;
      timestamp: string;
    }
  | {
      type: "session.request.failed";
      requestId: string;
      sourceSessionId: string;
      targetSessionId: string;
      error: string;
      timestamp: string;
    }
  | {
      type: "session.request.cancelled";
      requestId: string;
      sourceSessionId: string;
      targetSessionId: string;
      timestamp: string;
    };
```

硬约束：

- `session.request.completed` 才是“请求完成”的真相源
- hidden follow-up message 不能继续当唯一完成依据
- UI 只能消费标准 request 状态或事件，不得自行猜测 tool result 文本

## 5. 建议删除、整合、收敛的代码方向

这部分不是精确删哪几行，而是明确“该往哪里合并，不要继续扩散”。

### 5.1 后端协议层

应新增一个单一编排类：

- `SessionRequestBroker`

它统一承接：

- 创建 request
- 向目标 session 发起一轮请求
- 监听目标 session 的 live stream
- 识别 terminal event
- 更新 request 状态
- 调用 delivery adapter

不应再让以下逻辑继续分散：

- `SubagentManager` 自己决定如何 announce result
- NCP runtime 自己决定如何 follow-up
- UI 自己猜 request 是否已完成

### 5.2 子会话创建层

应新增或收敛到单一工厂/服务：

- `SessionCreationService`

它统一承接：

- 创建普通 session record
- 创建 child session record
- 填 `parentSessionId`
- 填 `spawnedByRequestId`
- 写默认 lifecycle

不应让：

- `SpawnTool`
- runtime registry
- UI 侧状态管理

分别拼自己的 child session 创建逻辑。

### 5.3 兼容层

旧 `spawn` 应该逐步退化成薄包装：

```ts
spawn(task) =>
  create child session
  + create request
  + dispatch request
```

不应继续让 `spawn` 成为一套独立于 `sessions_spawn/sessions_request` 之外的运行模型。

### 5.4 前端产品层

child session 的产品表面必须收敛到：

- `ChildSessionCard`
- `ChildSessionDetailsPanel`
- `PromoteToStandaloneAction`

而不是：

- 顶层会话列表直接混入 child session
- 同时再做一套 inline transcript 伪会话
- 再额外做一套“子任务列表”

## 6. 推荐的 class 边界

遵循当前仓库的治理要求，复杂业务逻辑下沉到 class，不堆在组件和零散 helper 上。

### 6.1 后端

推荐新增：

- `session-request-broker.manager.ts`
- `session-request-store.service.ts`
- `session-request-delivery.service.ts`
- `session-creation.service.ts`

推荐职责：

- `SessionRequestBroker`
  - 编排 request 生命周期
- `SessionRequestStoreService`
  - 读写 request 持久化
- `SessionRequestDeliveryService`
  - 按 `deliveryMode` 执行回投
- `SessionCreationService`
  - 统一创建普通 session / child session，确保默认字段和 fail-fast 校验

### 6.2 前端

推荐新增：

- `child-session-card.presenter.ts`
- `child-session-details.manager.ts`
- `child-session-navigation.service.ts`

推荐职责：

- `ChildSessionCardPresenter`
  - 把 session/request 状态映射成 UI view model
- `ChildSessionDetailsManager`
  - 详情面打开、关闭、加载、回父会话
- `ChildSessionNavigationService`
  - 处理“是否进入顶层导航”“是否提升为独立会话”

### 6.3 为什么这里建议 class

因为这块逻辑天然跨越：

- session 元数据
- request 生命周期
- runtime 终态事件
- UI 展示状态
- 导航行为

如果不用 class 边界收敛，很快就会演化成：

- 一排 hook
- 一排 effect
- 一排状态转换 helper
- 一排 ad-hoc adapter

这正是这次明确要避免的结构。

## 7. 推荐目录与文件组织

这部分不要求一次重构所有目录，但新增实现应尽量往这个方向收。

### 7.1 后端建议

优先考虑收敛到：

- `packages/nextclaw/src/cli/commands/ncp/session-request/`

而不是继续把所有 request/session/broker 逻辑平铺回原命令文件。

建议新增文件：

- `packages/nextclaw/src/cli/commands/ncp/session-request/session-request-broker.manager.ts`
- `packages/nextclaw/src/cli/commands/ncp/session-request/session-request-store.service.ts`
- `packages/nextclaw/src/cli/commands/ncp/session-request/session-request-delivery.service.ts`
- `packages/nextclaw/src/cli/commands/ncp/session-request/session-request.types.ts`
- `packages/nextclaw/src/cli/commands/ncp/session-request/session-creation.service.ts`

### 7.2 前端建议

优先考虑收敛到：

- `packages/nextclaw-ui/src/components/chat/child-session/`

建议新增文件：

- `packages/nextclaw-ui/src/components/chat/child-session/child-session-card.presenter.ts`
- `packages/nextclaw-ui/src/components/chat/child-session/child-session-card.tsx`
- `packages/nextclaw-ui/src/components/chat/child-session/child-session-details.manager.ts`
- `packages/nextclaw-ui/src/components/chat/child-session/child-session-details-panel.tsx`
- `packages/nextclaw-ui/src/components/chat/child-session/child-session-navigation.service.ts`
- `packages/nextclaw-ui/src/components/chat/child-session/child-session.types.ts`

## 8. 前端产品实现硬约束

这里直接把产品方案翻成工程约束，防止实现偏航。

### 8.1 默认表面

- child session 默认不进顶层会话列表
- 父会话中必须出现 `Child Session Card`
- 卡片必须由真实 `sessionId` 驱动
- 卡片至少显示：
  - title
  - status
  - recent progress
  - final summary

### 8.2 详情入口

- 桌面端点击卡片，打开右侧详情面板
- 移动端点击卡片，打开全屏子页面
- 详情视图必须依赖真实 `sessionId`
- 详情视图必须有 `Back to parent`
- 详情视图必须展示父链路 breadcrumb 或等价提示

### 8.3 提升为独立会话

- 只能由用户显式触发
- 触发前不得自动进入顶层导航
- 触发后才允许出现在普通会话导航

### 8.4 `resume_source` 的限制

- 它只决定父会话是否继续往下跑
- 它不得决定 child session 是否存在
- 它不得决定 child session 是否可见
- 它不得决定 child session 是否可以打开详情

## 9. 测试与验证策略

这次实现不是普通功能叠加，必须先锁 contract，再写实现。

### 9.1 后端 contract tests

至少覆盖：

- 创建 child session 后，`parentSessionId` 是否正确
- request 创建后，状态是否从 `queued -> running -> terminal`
- terminal event 是否只由标准 completion/failure 路径驱动
- `delivery = resume_source` 时是否调用对应 delivery adapter
- 未定义参数和未定义组合是否 fail fast

### 9.2 前端状态 tests

至少覆盖：

- child session 默认不进入顶层会话列表
- 父会话中能看到 child session card
- 卡片点击后进入详情
- 详情视图可返回父会话
- 提升为独立会话前后，导航层表现是否变化

### 9.3 最小冒烟

实现完成后至少要有一条真实链路冒烟：

1. 在父会话触发 `spawn`
2. 系统创建真实 child session
3. 父会话中出现 `Child Session Card`
4. child session 完成后卡片状态更新
5. 若为 `resume_source`，父会话继续输出
6. 点击卡片能打开详情并返回父会话

## 10. 具体执行顺序建议

### Stage 1: 收敛后端协议对象

先落：

- `SessionRequestRecord`
- `SessionRequestEvent`
- `SessionRequestBroker`

不碰 UI。

### Stage 2: 收敛 child session 创建

把 child session 的创建收进单一 service。

不急着改旧 `spawn` 对外表面。

### Stage 3: 让旧 `spawn` 变成薄包装

把旧 `spawn` 的运行主链切到：

- create child session
- create request
- broker dispatch

逐步删掉老的 subagent completion announce 分支。

### Stage 4: 前端落 Child Session Card 与 Details

此时前端只消费稳定协议对象，不自己猜 runtime 细节。

### Stage 5: 删除过渡桥接

在 contract tests 和 UI tests 稳定后，删除：

- NCP completion 的旧专用 relay
- 只为旧 `spawn` 存在的重复逻辑

## 11. Phase 1 明确不做什么

以下内容不进这次执行范围：

- 多层 child tree 常驻导航
- inline spawn target in `sessions_request`
- runtime-specific child session UI
- 复杂审批流与 steer 流
- 大一统 protocol layer
- 所有 external runtime 一次接完

## 12. 最终判断

这次实现若想真正做到“高质量、可维护、可扩展”，关键不在于写多少新代码，而在于是否敢于收敛旧结构。

一句话原则：

**不要在旧 `spawn/subagent/follow-up` 外面再包一层新框架；要把它们拆开、删掉重复职责、收进统一 broker 与 child session 模型。**

如果这一点做对，代码量未必大增，甚至有机会在第二阶段开始出现净删除。

## 13. 与主设计文档的关系

本文件是实现与重构约束文档。

主设计语义以以下文档为准：

- [Cross-Session Request And Child Session Design](./2026-04-03-cross-session-request-and-child-session-design.md)
- [External Agent Session Framework V1 Design And Execution Plan](./2026-04-01-external-agent-session-framework-v1-plan.md)
- [Subagent Completion And Visibility Implementation Plan](./2026-03-31-subagent-completion-and-visibility-plan.md)
