# CLI Command Boundary Refactor Plan

## Goal

把 `packages/nextclaw/src/cli` 从当前“真实命令、项目内共享能力、历史过渡目录混在一起”的状态，收敛成一套可解释、可治理、可持续迁移的结构。

这次计划要解决的不是单个目录名字不好看，而是下面三个系统性问题：

- `commands/` 下出现了不代表真实命令 owner 的伪 feature，例如 `runtime/`
- `shared/`、`lib/`、命令 owner 三者的语义边界还不够硬，容易互相串味
- 一些跨命令共享能力还没有完成 owner 去耦，导致目录归属讨论总在“这坨先塞哪”

## Core Decision

本次计划采用下面三层边界，并且严格区分：

- `commands/`：真实命令 feature
- `shared/`：本项目内共享层
- `lib/`：跨项目可复用的通用逻辑层

一句话版：

- 命令本身进 `commands/`
- 只在本项目内共享的能力进 `shared/`
- 只有跨项目通用的能力才进 `lib/`

## Hard Rules

### 1. `commands/` 的规则

- `commands/` 下只允许真实命令名，或团队明确批准的命令组名
- `commands/<command>/` 等价于一个 feature root
- `commands/<command>/` 必须有自己的 `index.ts`
- 外部只能通过 `commands/<command>` 导入，不允许 deep import
- 禁止再引入 `runtime/`、`support/`、`compat/` 这类伪 feature 根目录

### 2. `shared/` 的规则

- `shared/` 是本项目内共享层，不是 feature 回收站
- 允许放带项目语义的共享能力
- 但禁止把某个真实命令 owner 整体塞进 `shared/`
- 只有当某段能力确实被两个及以上命令稳定复用，且不再由单一命令拥有时，才允许进入 `shared/`

### 3. `lib/` 的规则

- `lib/` 只允许放跨项目通用逻辑
- `lib/` 默认不带项目语义
- `lib/` 默认不带业务语义
- `lib/` 默认不带运行时语义
- 只要一个模块还能被自然描述成 `nextclaw`、`gateway`、`plugin`、`marketplace`、`session runtime`、`service lifecycle` 之类项目内能力，它就不属于 `lib/`

## What This Means For Current CLI

当前 CLI 的 `commands/runtime/` 不应作为长期结构保留。

原因不是它内部代码一定没价值，而是它同时违反了两件事：

- 它不是一个真实命令 owner
- 它内部装的是多种不同 owner 的混合内容

当前 `commands/runtime/` 下面混入了：

- `gateway`
- `ui`
- `start / restart / serve / stop`
- `plugin runtime`
- `marketplace install/runtime`
- `session runtime`
- `ui runtime`

这些东西不是一个 feature，只是历史上被临时收拢到了一起。

因此，这次计划的基本结论是：

- 删除 `commands/runtime/`
- 恢复真实命令 owner
- 把项目内共享但不属于单一命令 owner 的能力迁到 `shared/`

## Important Clarification

### 不是所有“非业务代码”都应该进 `lib`

这里有一个容易误判的点：

- “不是某个 feature 的业务代码”
- “不是某个 command 的直接入口代码”

并不等于它就属于 `lib`

例如：

- `gateway startup`
- `managed service state`
- `session bridge`
- `plugin runtime bridge`

这些即使不是用户直接感知的业务 feature，它们仍然强烈绑定 `NextClaw CLI` 项目和运行时语义，因此应优先判定为：

- 项目内共享能力

而不是：

- 跨项目通用逻辑

### 为什么不是所有东西都迁到 `shared/services/`

`shared/services/` 不是默认垃圾桶。

一个模块只有同时满足下面条件时，才建议放到 `shared/services/`：

- 被两个及以上命令稳定复用
- 明显带项目语义，不能放进 `lib`
- 又不再属于某一个命令单独 owner
- 它的主要角色是编排 / 协调 / 生命周期控制，而不是纯工具函数或纯类型

如果不满足这四条，就不应该直接迁到 `shared/services/`。

例如：

- 如果 `session/*` 只服务 `gateway` / `ui` 这一条运行链路，并没有被其它命令真实复用，那么它不一定要进 `shared/services/`，也可以保留为某个命令 feature 内部的私有能力。
- 如果 `ui/*` 只是 `ui` 命令自己的私有实现，就应留在 `commands/ui/`，而不是因为名字像通用能力就搬进 `shared/services/`。

所以这次计划不会采用“看到共享实现就统一扔到 `shared/services/`”这种粗暴策略，而是按 owner 和复用事实判断。

## Placement Matrix

### A. 命令 owner

如果某段代码满足下面条件：

- 它只服务一个真实命令
- 它表达的是该命令本身的业务 owner
- 如果删掉该命令，这段代码也随之失去意义

那么它应进入：

- `commands/<command>/`

### B. 项目内共享能力

如果某段代码满足下面条件：

- 被多个命令稳定复用
- 仍然带 `NextClaw CLI` 项目语义
- 不是跨项目通用逻辑

那么它应进入：

- `shared/services/`
- `shared/utils/`
- `shared/types/`

具体进入哪一个，按角色决定：

- 编排 / 生命周期 / 协调：`shared/services/`
- 无状态函数 / 解析 / 格式化 / 纯判断：`shared/utils/`
- 纯类型：`shared/types/`

### C. 跨项目通用逻辑

如果某段代码满足下面条件：

- 不带 `NextClaw` 项目语义
- 不带某个命令语义
- 脱离当前项目后仍然成立

那么它才允许进入：

- `shared/lib/`

默认假设：

- CLI 当前大多数 `runtime / plugin / marketplace / session / gateway` 相关逻辑都不满足这条

## Target Structure

```text
packages/nextclaw/src/cli/
├── app/
│   ├── index.ts
│   ├── runtime.ts
│   ├── register-agents-commands.ts
│   └── service-command-registration.service.ts
├── commands/
│   ├── agent/
│   ├── channel/
│   ├── config/
│   ├── cron/
│   ├── diagnostics/
│   ├── gateway/
│   ├── learning-loop/
│   ├── login/
│   ├── mcp/
│   ├── onboard/
│   ├── platform-auth/
│   ├── plugin/
│   ├── remote/
│   ├── restart/
│   ├── secrets/
│   ├── serve/
│   ├── service/
│   ├── skills/
│   ├── start/
│   ├── status/
│   ├── stop/
│   ├── ui/
│   └── update/
└── shared/
    ├── services/
    ├── utils/
    ├── types/
    └── lib/
```

说明：

- `shared/lib/` 在这次计划里只是保留合法位置
- 不预设一定要往里面放东西
- 如果清点后没有真正跨项目通用的逻辑，`shared/lib/` 完全可以空着

## Migration Strategy

### Phase 1. 先修规则，再动目录

先完成下面几件事：

- 在结构规范里明确：
  - `commands/` 下禁止伪 feature 根目录
  - `lib` 只允许跨项目通用逻辑
  - `shared` 是项目内共享层
- 治理脚本要具备识别 `commands/runtime` 这类伪 feature 的能力

### Phase 2. 建立真实命令 owner

新增这些真实命令 root：

- `commands/gateway/`
- `commands/ui/`
- `commands/start/`
- `commands/restart/`
- `commands/serve/`
- `commands/stop/`

这些目录初期可以很薄，先只承接：

- `index.ts`
- 命令 owner service
- 该命令自己的 types / utils

### Phase 3. 从 `commands/runtime/` 抽离共享能力

不是整坨平移，而是分三类迁：

#### 3.1 命令私有实现

如果某个模块只被一个命令 owner 使用，就迁回对应 `commands/<command>/`

#### 3.2 项目内共享实现

如果某个模块被多个命令稳定复用，但明显带项目语义，就迁到：

- `shared/services/`
- `shared/utils/`
- `shared/types/`

#### 3.3 真正跨项目通用的逻辑

只有极少数满足跨项目通用条件的，才迁到 `shared/lib/`

### Phase 4. 删除 `commands/runtime/`

在 owner 和共享能力都落位之后：

- 删除 `commands/runtime/`
- 更新 imports
- 更新治理文档
- 更新 README / contract / lint 规则

## Current Runtime Tree: Preliminary Placement Proposal

下面是当前 `commands/runtime/` 里几类内容的初步迁移建议。

这是草案，不是最终定案，目的就是让后续讨论有明确对象。

### `services/session/*`

初步建议：

- 不默认放进 `shared/services/`
- 先判定它是否被多个命令真实复用

判定结果：

- 如果只服务 `gateway/ui/start/serve` 这一组运行态命令，并且本质上仍是同一条运行链路私有实现，更适合暂时留在运行态相关命令 owner 内部
- 只有当它被多个独立命令 root 稳定复用，且不再属于单一命令 owner 时，才迁到 `shared/services/`

### `services/ui/*`

初步建议：

- 同样不默认进入 `shared/services/`

判定结果：

- 如果它只是 `ui` 命令私有实现，应归 `commands/ui/`
- 如果 `start/restart/serve` 也稳定复用它，且已经形成项目内共享 owner，再迁入 `shared/services/`

### `services/plugin/*`

初步建议：

- 不进 `lib`
- 优先回 `commands/plugin/`
- 真正被多个命令共享的项目内 runtime bridge，再考虑迁到 `shared/services/`

### `services/marketplace/*`

初步建议：

- 不进 `lib`
- 不单独新增 `commands/marketplace/`
- 按真实 owner 拆回：
  - `commands/plugin/`
  - `commands/skills/`
  - `commands/mcp/`

### `service-port-probe.utils.ts`

初步建议：

- 如果纯无状态、纯项目内工具，迁到 `shared/utils/`
- 如果仍然带明显命令 owner 语义，则保留在对应命令内部

## Validation Plan

改造过程中，每一阶段都要至少通过：

- `pnpm --filter nextclaw tsc`
- 受影响命令的定向 `vitest`
- `pnpm lint:new-code:governance -- <touched files>`
- 非功能改造时的 maintainability guard
- 必要时 `pnpm dev start` 冒烟

## Success Criteria

当下面条件全部满足时，这次改造才算完成：

- `commands/runtime/` 被删除
- `commands/` 下只剩真实命令 feature
- `shared/` 与 `lib/` 的边界被写入规范并接入治理
- `plugin`、`marketplace` 不再隐藏在模糊目录里
- 后续新增代码不再需要靠“临时特殊分组”兜底

## Open Questions For Review

这份计划写完后，优先需要一起确认的是：

1. `gateway / ui / start / restart / serve / stop` 是否都提升为独立命令 root
2. `session/*` 是否真的满足进入 `shared/services/` 的条件
3. `ui/*` 是否应该优先归 `commands/ui/`，而不是共享层
4. `plugin` 相关 runtime bridge 里，哪些属于 `commands/plugin/`，哪些属于项目内共享
5. 当前 CLI 是否实际需要任何 `shared/lib/` 内容，还是允许它为空
