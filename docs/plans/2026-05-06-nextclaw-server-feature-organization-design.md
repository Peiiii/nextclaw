# NextClaw Server Feature Organization Design

日期：2026-05-06

## 这份文档解决什么问题

这份文档定义 `packages/nextclaw-server` 的长期目录组织方向。

当前 `packages/nextclaw-server/src/ui` 是历史结构。它承载了本地 HTTP server、router、controller、配置、会话、runtime control、marketplace、remote、auth 等多类能力，但目录名 `ui` 描述的是消费方，不是 server 自己拥有的语义能力。

后续新增能力不应继续塞进 `src/ui`，也不应因为某个上层产品形态直接新增 `src/companion`、`src/desktop` 这类消费方目录。Server 应该提供通用、原子化、可复用的领域能力，上层 Desktop、Companion、Web UI、Client SDK 或未来远程客户端按需消费。

## 目标

把 `nextclaw-server` 从“给 UI 用的接口集合”收敛成“按能力域组织的本地服务端”：

- Server 内部按 feature-first 组织能力域
- 每个 feature 内部按 role-first 组织 controller、service、types、utils
- 对外 API 表达原子领域事实，不绑定 Desktop 或 Companion
- 上层宿主和 Client SDK 只消费 API，不影响 server 内部 owner 命名
- 不新增 `support`、`helpers`、`common`、`client`、`core` 这类模糊层

## 目录原则

### feature 是能力域，不是消费方

允许的 feature 名应表达 server 拥有的能力，例如：

```text
sessions
agents
config
marketplace
remote-access
auth
attachments
server-path
runtime-control
```

不应以消费方命名：

```text
ui
desktop
companion
web
client
```

`ui` 可以作为历史迁移来源存在，但不应作为新能力落点。

### role 高于 domain

feature 内部按职责角色组织：

```text
controllers/
services/
types/
utils/
stores/
repositories/
```

文件名必须匹配角色：

```text
controllers/sessions.controller.ts
services/session-query.service.ts
types/session-api.types.ts
utils/session-status.utils.ts
```

不要新增：

```text
support/
helpers/
common/
contracts/
schemas/
readers/
```

除非后续治理明确批准这些角色。

## 目标结构

长期目标结构：

```text
packages/nextclaw-server/src/
  app/
    server.ts
    router.ts
    route-registry.service.ts

  features/
    sessions/
      controllers/
        sessions.controller.ts
      services/
        session-query.service.ts
        session-action.service.ts
        session-realtime.service.ts
      types/
        session-api.types.ts
      utils/

    agents/
      controllers/
      services/
      types/

    config/
      controllers/
      services/
      types/

    marketplace/
      controllers/
      services/
      types/
      utils/

    remote-access/
      controllers/
      services/
      types/

    auth/
      controllers/
      services/
      types/

    attachments/
      controllers/
      services/
      types/

    server-path/
      controllers/
      services/
      types/
      utils/

    runtime-control/
      controllers/
      services/
      types/

  shared/
    types/
    utils/
```

`shared/` 只允许承载两个以上 sibling feature 真实复用、契约稳定、且不属于某个 feature 私有逻辑的内容。不能把 `shared/` 当成历史代码暂存区。

## API 原则

Server API 应保持原子化。

也就是说：

- session API 表达 session 事实
- agent API 表达 agent 事实
- config API 表达 config 事实
- realtime API 表达 session 或 runtime 的实时变化事实
- remote-access API 表达远程访问事实

Server 不应为了上层显示形态新增聚合 API：

```text
/api/companion/status
/api/runtime/presence
/api/desktop/summary
```

如果某个客户端需要组合视图，应优先在 Client SDK 或客户端 manager 中组合。只有当现有领域 API 缺少本该属于该领域的字段时，才回到原 owner 补齐。

例子：

- session 是否 running，归 sessions feature
- session 当前 agent summary，归 sessions 或 agents 的 view contract
- agent avatar，归 agents feature
- session stream，归 sessions realtime owner

## 与 Client SDK 的关系

`packages/nextclaw-client` 是 server 的消费者，不是 server 内部 feature。

正确关系：

```text
packages/nextclaw-server/src/features/sessions
  -> exposes session API

packages/nextclaw-server/src/features/agents
  -> exposes agent API

packages/nextclaw-client
  -> wraps session / agent / realtime access

apps/desktop / apps/companion / Web UI
  -> consume packages/nextclaw-client
```

错误关系：

```text
packages/nextclaw-server/src/client
packages/nextclaw-server/src/companion
packages/nextclaw-server/src/features/desktop
```

Server 侧 owner 不应跟随上层宿主或 SDK 命名。

## 迁移策略

不要一次性做全量大搬家。Server 目录治理应按风险和新增能力顺序渐进迁移：

1. 新增能力不再落到 `src/ui` 顶层
2. 先建立 `src/app` 与关键 `src/features/*` 结构
3. 优先迁移会被 Client SDK 消费的 sessions、agents、realtime 相关 owner
4. 保持旧 `src/ui` API 兼容，必要时由旧 router 转发到新 feature owner
5. 后续按热点逐步迁移 config、marketplace、remote-access、auth、attachments、server-path

迁移期间允许存在旧结构和新结构并行，但新能力必须落在新结构，不能继续扩大 `src/ui` 历史豁免区。

## 与 Companion 的关系

Companion 是上层宿主，不是 server feature。

Companion 通过 Client SDK 读取 session / agent / realtime 数据，然后在客户端侧决定展示哪个 Agent avatar。

Server 不新增：

```text
packages/nextclaw-server/src/companion
packages/nextclaw-server/src/features/companion
packages/nextclaw-server/src/features/presence
```

除非未来 `presence` 成为独立于任何客户端的真实 server 领域事实，并且有多个非 UI 消费方需要它；在当前 Companion 设计里不成立。

## 验证

目录治理落地时必须至少覆盖：

- touched server package `tsc`
- 对应 feature route contract 测试
- route registry 或 router 绑定测试
- touched-file governance 检查
- maintainability guard

如果仅新增本设计文档，不触达源码和运行链路，则无需运行 TypeScript / build 验证。
