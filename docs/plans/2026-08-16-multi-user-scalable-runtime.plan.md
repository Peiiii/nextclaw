# NextClaw 多用户可扩展运行时完整路线图

> 状态：Draft v0.23，终态演进路线图，不作为单次直接执行清单。
> **For Codex:** 不得从本文整包实施。先执行[同构多用户运行时基础批次计划](./2026-08-16-multi-user-minimal-runtime.plan.md)，再按 owner 拆分后续批次；基础批次不单独构成多用户产品发布。

**Goal:** 在不创建 per-user Kernel、不维护单机/集群两套业务架构的前提下，让一套 NextClaw 同时支持低配单节点和可水平扩展的多用户部署，并以 `spaceId` 隔离个人数据、配置、凭据、异步任务、运行状态和执行权限。

**Architecture:** 每个 runtime 进程只装配一个 `NextclawKernel`。认证边界以 `userId + targetSpaceId` 完成授权，只把带类型区分的 `spaceId` 交给状态 owner；现有 Manager 保留产品语义，并只依赖自己需要的 `NextclawData` typed port。Identity/Access/Provider Catalog/Placement 由 bootstrap control provider 承载，Space data 再由 `DataProviderRouter` 按 `spaceId + dataDomain` 选择 Local、PostgreSQL、S3 等 provider。单节点和多节点使用同一调用链；Run、Event 和 Execution 使用独立 runtime owner。Kernel、Manager、API 与资源 ID 不感知节点和物理位置。

**Tech Stack:** TypeScript、Hono、Vitest、Node.js `node:sqlite`、现有 JSON/JSONL Journal；规模化 provider 使用 PostgreSQL、S3-compatible object storage 和可挂载的 Workspace filesystem/volume shard，首期不引入 Redis、Kafka 或 Kubernetes 作为必需依赖。

**Source Functional Design:** [NextClaw 多用户功能设计](../designs/2026-08-16-multi-user-functional.design.md)

**Source Design:** [NextClaw 多用户可扩展运行时初版设计](../designs/2026-08-16-multi-user-scalable-runtime.design.md)

**Current Executable Plan:** [NextClaw 同构多用户运行时基础批次实施计划](./2026-08-16-multi-user-minimal-runtime.plan.md)

---

## 1. 冻结范围与实施假设

### 1.1 首期产品边界

- 首期产品关系为一个 User 默认拥有一个 Personal Space，但持久模型保留 Membership，不能把 `userId === spaceId` 写死。
- 当前本地单管理员安装迁移成一个本地 User、一个默认 Space 和一条 owner Membership。
- 未启用密码保护的个人安装仍然自动认证为本地 User，但同样必须解析出默认 `spaceId`，不保留无 Space 的个人数据路径。
- 本地多用户首期通过管理员 CLI/API 创建、禁用和重置用户；不把公开注册、组织、邀请、SSO 和多人共享 Space 纳入第一批。
- 客户端首期不提交任意 `spaceId`。Server 从认证 principal 解析默认 Space；未来支持切换 Space 时，只允许选择 Membership 已授权的 Space。
- Deployment Admin 在授权上可访问全部 Space，但普通 session 只进入自己的默认 Space；访问其它 Space 必须显式选择目标、限时提权并审计，数据面不增加 admin bypass。
- Skill、App、Provider、MCP、Channel、Extension 和 Agent 采用 Definition/Binding/Instance：System/Deployment Definition 可共享，Binding 与用户数据归 Space，运行 Instance 继承 Space 与 Run/lease。
- Shell、浏览器、stdio MCP、Service App 和第三方 Extension process 统一由 Execution owner 根据目标 Space capability、显式 host mounts、Credential、网络和预算解析 Execution Plan；管理员 elevation 不自动扩权。

### 1.2 明确非目标

- 不新建 `KernelIdentifiers`、`KernelEnvelope`、`ExecutionScope` 或 `kernel.withScope()`。
- 不为 Space 创建 Kernel、完整 Manager 树或永久常驻 Worker。
- 不一次性把所有 JSON/JSONL Store 改写成数据库。
- 不在业务层增加 `isCluster`、`nodeId`、`shardId` 或本地/远程条件分支。
- 不要求 1 核 1 GiB 节点运行 PostgreSQL、对象存储、容器编排器或本地大模型。
- 不在未经用户授权时提交、推送、发布或部署。每个任务只设置可审查的交付检查点。

### 1.3 最小改动预算

本文是完整演进地图，不代表要在一个 changeset 中实施全部任务。[基础批次计划](./2026-08-16-multi-user-minimal-runtime.plan.md)先交付：

- 默认 Space、User/Membership、登录和管理员显式进入目标 Space；
- 文本 Chat/Session/Run/Event、Provider/Agent Config 和 managed Workspace 的 Space 隔离；
- 复用现有 Skill scope：builtin、deployment-global、Space workspace/project；
- 一个 Kernel、现有 Manager 主体和现有本地 Store 格式尽量保留；
- 最小 `NextclawData` typed ports 与 Local provider adapter，使后续共享 provider 不改变 Manager 调用面；
- 双 Space 开发 fixture 和 owner inventory，为后续 feature 逐项空间化提供同一主链。

第一期明确不做：

- PostgreSQL/S3/共享 Workspace shard/分布式 Queue/Lease/Outbox；
- 完整管理员管理 UI，先使用 CLI/API；
- Skill required/available/blocked、Skill 配置锁定、通用 Credential Broker、Skill 多版本灰度等高级策略；这里不包括已经冻结的 Model Offering 默认/锁定策略；
- 为恢复 Shell、浏览器、stdio MCP、第三方 Extension、Service App host action 而建设完整 Sandbox 平台。

基础批次完成后，Session Search、附件、Asset、Project、Cron、Channel、Inbox、App Data/Grant、MCP、Extension 和 Service App 分别完成 Space owner、异步归属和攻击型测试。尚未完成只是开发进度，不能形成“创建第二个用户后功能降级”的正式产品状态；多用户发布前必须闭合已纳入产品的完整 owner inventory。

改动预算遵守以下硬规则：

1. 只为当前 owner 建立实际使用的 typed port；不预建可选方法、通用 CRUD 或未来 feature 空接口。
2. 不新增通用 Space facade、scoped Kernel、per-Space Manager tree 或 admin-aware Store。
3. 优先给现有 Manager 增加一个 `spaceId` 并注入所需 typed port；Local provider adapter 在数据层内部复用现有固定路径 Store。
4. 第一批不改变公开资源 ID、Session Journal 格式和 NCP payload，除非异步归属确实要求。
5. 每次只迁移一个 feature；无法在一个可审查批次内证明隔离时，停止该 owner 批次，不增加用户数量开关或共享 fallback。
6. 每个批次都复测单用户 idle 和基础主链资源；稳定 RSS/heap/CPU/FD/子进程超出已冻结测量噪声时不得继续累积，必须在当前批次优化或明确停止。
7. Space owner 的公共方法先改成必填 `SpaceId` 且不保留旧 overload，让 `tsc` 暴露所有遗漏调用点；不以 `spaceId?` 或默认管理员 Space 掩盖半迁移状态。
8. User/Space provisioning、旧数据迁移和 provider cutover 必须是显式可重入状态机；read/status 纯读，resume/rollback/cleanup 是显式 action，不由页面加载、轮询或普通启动查询暗中触发。

## 2. 目标目录与数据布局

本地 provider 的目标布局：

```text
<NEXTCLAW_HOME>/
├── config.json                         # deployment config
├── access/
│   ├── identities.json                 # users, spaces, memberships
│   ├── access-sessions.json            # authenticated sessions
│   └── deployment-audit.jsonl           # admin elevation and maintenance audit
├── apps/                               # deployment-global installed package code
├── skills/packages/                    # system/deployment Skill definitions，按版本只读
├── spaces/
│   └── <spaceId>/
│       ├── config.json                 # agents/providers/channels/mcp/tools/secrets
│       ├── workspace/
│       ├── skills/private/             # Space-owned Skill definitions
│       ├── skill-data/                 # 每个 Skill 的 Space-owned data
│       ├── sessions/
│       ├── assets/
│       ├── projects/projects.json
│       ├── preferences/preferences.json
│       ├── inbox/deliveries.json
│       ├── app-data/
│       ├── app-grants/
│       └── usage/
└── migrations/
    └── personal-space-v1.json          # inventory, cutover and verification marker
```

Cron 在单节点使用一个 deployment 级调度 Store，但每条 Job 必须包含 `spaceId`；这样服务重启时无需扫描所有 Space 目录即可恢复定时任务。Cron payload 只保存资源 ID 和用户输入，不复制 Space Config 或 Secret。

规模化 provider 的最小物理依赖不是只有数据库：

- PostgreSQL：Identity、Membership、Space Config、Session metadata/events、Project、Preference、Inbox、Cron、Run queue、Lease、Usage、Audit 和 Event outbox 等结构化事实与协调记录。
- S3-compatible Blob：Asset、附件、大型 App Data、导出和冷快照；PostgreSQL 只保存 owner、object ref、hash、size 和 lifecycle。
- Workspace storage：单节点为受管本地目录；多节点以固定 virtual partition 映射到多个可挂载 POSIX storage shard，Worker 按 placement/lease 访问目标 shard。对象存储承担快照、归档和冷层，但不能直接假装成所有在线 Shell 的文件系统；禁止一 Space 一永久 volume/mount。
- Secret provider：单节点受保护文件/keychain，规模化后使用 KMS/Vault/Secret Manager；普通 records 只保存 `secretRef` 与 owner/version。
- Worker / Execution：通过 queue/lease claim Run 和 Cron，按活跃任务创建进程、容器或远程执行实例；计算资源不在数据库中。
- Package / artifact：版本化只读 Definition 放在安装目录、registry/object store 和节点内容寻址 cache；Space 只保存 Binding 与可变数据。
- Gateway：无状态认证和 Event Stream 接入；通过 outbox cursor 获取 Space 事件。
- Observability：日志、metric 和 trace 进入独立后端；只有需要 owner、保留策略和不可抵赖语义的安全 audit 进入 records/audit store。

这些资源不新增一个万能 `ResourceManager`。持久产品数据继续由 `NextclawData` typed ports 负责；Queue/Lease/Event、Execution、Secret、Package 和 Observability 保持各自最小 owner/provider 合同，但统一遵守 Space 归属、权限、生命周期、配置装配和资源不回退原则。

## 3. 里程碑和放行门槛

| 里程碑 | 可交付结果 | 放行门槛 |
| --- | --- | --- |
| M1：Space substrate | 现有单用户安装强制拥有默认 Space，外部行为基本不变 | 单 Space 回归通过；无 Space 状态访问 fail closed；provisioning/迁移逐状态崩溃注入通过且只有一个活动 owner |
| M2：单节点多 Space 数据面 | 同一进程的内部双 Space fixture 在数据、缓存、事件、Cron 和凭据上隔离；尚不要求注册第二用户产品入口 | 双 Space 攻击型测试通过；无跨 Space ID 猜测读取；现有管理员回归通过 |
| M3：安全执行与多用户入口 | 计划对普通用户开放的危险执行具备隔离、空间配额和公平调度，随后才注册真实第二用户入口 | 文件、Secret、进程、网络越权测试与 Noisy Neighbor 基准通过；两个真实用户生命周期通过 |
| M4：多节点 provider | 相同 Kernel/Manager API 使用共享 Store、Queue、Lease 和 Event provider | 增加节点提升吞吐；节点故障无双写；Space identity 不变化 |
| M5：容量承诺 | 低配和百万注册用户模型分别有真实证据 | 1C1G 实机矩阵与平台负载矩阵达到冻结预算 |

任何里程碑失败时停止进入下一阶段，不用兼容分支掩盖失败。

### 3.1 每个里程碑必须可长期停止

里程碑不是必须连续完成的施工中间态。每一个可发布批次都必须同时满足：

- 现有管理员的用户可见行为、历史数据和最低部署规格没有回退；
- 本批状态 owner 的入口、持久化、缓存、异步、事件、恢复和执行边界已经纵向闭合；
- 未进入本批的 owner 仍以原单用户实现作为自己的唯一活动 owner，不被描述成已经支持多用户，也不与新路径双读或双写；
- 开发双 Space fixture 可以使用未公开的测试身份，但真实第二用户入口只在当前发布 inventory 和所需 Execution 边界全部闭合后注册；
- 迁移 commit 前后始终只有一个活动 owner，失败可以幂等继续或清理未提交 staging；
- 单用户回归、双 Space 攻击型测试、适用 crash injection、`tsc` 与资源 ratchet 全部通过。

因此“完成 B0 后永久不做 B1”以及“完成 D1 某个 owner 后不再扩展”都必须是正确产品状态，只是多用户或规模化能力尚未完整交付。真实第二用户入口最后出现是发布顺序，不是 `multiUserEnabled` 模式。

## 4. 稳定合同

### 4.1 Space 基础类型

```ts
declare const spaceIdBrand: unique symbol;

export type SpaceId = string & {
  readonly [spaceIdBrand]: "SpaceId";
};

export type SpaceOwned = {
  spaceId: SpaceId;
};
```

`SpaceId` 仍是零额外运行时对象的字符串标量，但普通 `userId` 或任意客户端字符串不能直接传入 Space Store。`parseSpaceId` 只验证格式；Access/Membership resolver 才能把 target 解析为本次调用已授权的 `SpaceId`。`SpaceOwned` 只用于确实会脱离当前调用栈的 record/envelope，不要求所有业务 payload 继承。

### 4.2 Ingress

```ts
export type IngressContext = {
  source: string;
  token?: string | null;
  spaceId?: SpaceId;
};
```

- deployment 级 ingress 可以没有 `spaceId`。
- Agent Run、Channel message、Panel App agent call、Cron 和 Session Request handler 的第一行必须调用 `requireSpaceId(context)`。
- `requireSpaceId` 只做存在性和格式校验；Membership 授权在 Server/Auth/Channel 入口完成。

### 4.3 Stateful Manager

```ts
sessionManager.getSession(spaceId, sessionId);
projectManager.listProjects(spaceId);
preferenceManager.getPreference(spaceId, key);
automationManager.addJob(spaceId, input);
assetStore.open(spaceId, assetId);
```

纯 helper 接收已经解析的 Session、Config、Workspace 或 Credential snapshot，不继续传递 `spaceId`。

Stateful Manager 不直接构造 Local/PostgreSQL/S3 Store，不读取 provider ID 或 placement。每个 owner 通过自己定义的 typed repository port 访问 `NextclawData`；Local adapter 可以继续把已解析目录交给现有 concrete file Store。

### 4.4 异步 record

```ts
type SpaceRunRecord = {
  spaceId: SpaceId;
  triggeredByUserId?: string;
  sessionId: string;
  runId: string;
  idempotencyKey: string;
};

type SpaceCronJob = CronJob & {
  spaceId: SpaceId;
};
```

Event、Run、Cron、Queue、Session Request、App background operation 和恢复记录必须显式保存 `spaceId`。`triggeredByUserId` 仅用于审计，可以在 Cron、恢复和 system maintenance 中缺失，不能作为继续访问 Space 数据的授权依据。

### 4.5 能力资源

能力对象不使用一个通用 scope wrapper，而是遵循相同生命周期：

```text
Definition = System / Deployment / Space 提供的代码、manifest、schema 和版本
Binding    = Space 的启用状态、配置、Credential 和授权
Instance   = 继承 Space + Run/lease 的 client、process、connection 或 tool
```

Resolver 接收 `spaceId` 并输出已解析 snapshot；Prompt、Tool 和纯 helper 不继续感知 `spaceId`。

### 4.6 管理员访问

```ts
type AdminElevation = {
  targetSpaceId: SpaceId;
  reason: string;
  issuedAt: string;
  expiresAt: string;
};
```

Access/Server 边界验证当前认证 session 内的 elevation 后只向 Kernel 传目标 `spaceId`。结束提权、session 撤销或过期都会使 elevation 失效；第一期不新增独立 grant Store。管理员访问不改变 Manager/Store API，不允许 `isAdmin`、全局 root 或跳过 owner 条件的平行数据路径。

### 4.7 复杂度防泄漏合同

- Public API/UI/Channel 不感知 provider、shard、bucket、volume、epoch、lease、mount 或 node；普通单用户入口由 Server 自动解析默认 Space。
- Kernel 与 Stateful Manager 最多感知 `spaceId` 和 feature-owned typed port；不得导入具体 provider descriptor、SDK、SQL、S3 key layout 或 Workspace shard 类型。
- Pure helper、Prompt、Tool 和外部 provider client 只接收已解析的 Session、Config、Credential、workspace root 与权限快照，不继续传播 `spaceId`。
- Data、Run/Event、Execution、Secret 分别拥有自己的最小合同；不新增万能 `ResourceManager`、`RuntimeFabric` 或包含全部能力的 facade。
- Composition root 是唯一知道部署配置和具体 provider 装配的位置；Local/Cloud 只改变依赖注入，不改变业务分支。
- 增加共享 provider 或节点如果要求修改 Kernel/Manager/API/资源 ID，当前批次必须停止并回到边界设计。

### 4.8 低缺陷与恢复合同

- Access owner 是唯一把 actor 与 target Space 关联的地方；Controller 只透传 `spaceId`，Stateful Manager/Store 不接收 `userId`、principal、role、`isAdmin` 或通配 Space。
- Local provider 在 typed port 后委托现有 Store 和文件格式；Manager 不拼路径。只有真实拥有 lazy Store handle、有界 cache 和 dispose 生命周期时才增加 `LocalDataProvider` class，否则由 composition root 直接组合端口。
- 每个 owner 以纵向批次完成：入口、Manager、Store/Cache、Async record、恢复、攻击型测试同时切换；切换后删除无 Space 入口，不长期双读、双写或保留 global fallback。
- User/Space provisioning 使用 `prepare -> materialize -> verify -> commit-access-state -> ready`。User 在 ready 前不可登录；崩溃恢复只继续同一 operation 或清理该 operation 未提交资源。
- 旧数据迁移使用 `planned -> copied -> verified -> committed -> cleanup-eligible`。旧路径只作为真实用户数据的只读迁移源；commit 后 shipped runtime 只读写 canonical Space owner，不扫描或 fallback 到旧路径。
- commit 前失败保持旧源为唯一事实；commit 后发生新写入时禁止盲目把 pointer 切回旧源。恢复优先修复后向前继续，或执行带明确数据损失边界的备份/导出恢复。
- Provisioning、migration 和 provider cutover 的每个状态转换都要有 crash injection、重复启动和幂等测试；完成标准是相同输入与持久状态总得到相同 owner 和恢复结果。

## 5. Task 1：建立基线和跨 Space 攻击型测试框架

**目标：** 在修改产品代码前，把当前会串数据的行为写成失败测试，并建立后续每批复用的双 Space fixture。

**Files:**

- Create: `packages/nextclaw-kernel/src/app/nextclaw-kernel.multi-space.test.ts`
- Create: `packages/nextclaw-server/src/app/router.multi-space-isolation.test.ts`

**步骤：**

1. 写两个 Space 使用相同 `sessionId`、`assetId`、Preference key 和 Cron job 名称的测试数据。
2. 写用户 A 猜测用户 B 资源 ID 的 HTTP 测试，当前应失败或证明存在串读风险。
3. 写 EventBus/UI WebSocket 测试，证明当前 UI principal 会收到另一个 Space 的事件。
4. 写 Cron 重启测试，证明 Job 恢复必须从持久 record 获得 Space，而不能取最近登录用户。
5. 在目标 1C1G/2C2G 环境重复记录当前单用户 Kernel 启动、稳定空闲、基础文本会话和一次 mock/远程模型 Run 的 RSS/heap、CPU、FD、子进程、timer 和已加载可选 provider 模块，冻结测量噪声，作为后续所有批次的资源 ratchet。
6. 写 Deployment Admin 未提权访问目标 Space 失败、有效 elevation 成功、elevation 过期/结束失败且全程有 audit 的测试。
7. 写一个全局 Skill 在两个 Space 下使用不同 config/credential/data 的测试，证明只共享 Definition。
8. 建立并冻结 resource inventory：每类 control/Space record、Blob、Workspace、derived index、runtime coordination、live state、Execution、Secret、package、observability、backup 和 external resource 都写明 owner、source of truth、是否包含 `spaceId`、单节点/多节点承载、迁移/重建方式和删除责任；未归类资源不能进入多用户发布。

**验证：**

```bash
pnpm -C packages/nextclaw-kernel exec vitest run src/app/nextclaw-kernel.multi-space.test.ts
pnpm -C packages/nextclaw-server exec vitest run src/app/router.multi-space-isolation.test.ts
```

**预期：** 在本 Task 的临时 red 阶段证明当前隔离缺口；结束 Task 前，尚未进入 owner 改造的攻击场景以明确 contract/todo 保存，不把失败断言留在必跑 CI，已有单用户测试始终通过。对应 owner 开始实施时先把自己的 contract 转成真实失败测试，并在同一 owner Task 内修复为通过。

**完成标准：** 后续每个状态 owner 都能在相同 fixture 下证明 A/B 隔离；不使用只测不同随机 ID 的弱测试；resource inventory 没有“其它全局数据”“临时文件”或“存在数据库里”一类无 owner 笼统项。

## 6. Task 2：加入 Space 类型、默认 Space 和 Identity/Membership Store

**目标：** 让任何安装都有稳定 User/Space/Membership，同时保持一个 Kernel。

**Files:**

- Create: `packages/nextclaw-shared/src/types/space.types.ts`
- Modify: `packages/nextclaw-shared/src/services/ingress.service.ts`
- Modify: `packages/nextclaw-shared/src/types/event-bus.types.ts`
- Modify: `packages/nextclaw-shared/src/services/event-bus.service.ts`
- Modify: `packages/nextclaw-shared/src/index.ts`
- Modify: `packages/nextclaw-shared/src/services/ingress.service.test.ts`
- Modify: `packages/nextclaw-shared/src/services/event-bus.service.test.ts`
- Create: `packages/nextclaw-kernel/src/stores/space-access.store.ts`
- Create: `packages/nextclaw-kernel/src/stores/space-access.store.test.ts`
- Modify: `packages/nextclaw-kernel/src/types/access.types.ts`
- Modify: `packages/nextclaw-kernel/src/stores/access-session.store.ts`
- Modify: `packages/nextclaw-kernel/src/managers/access.manager.ts`
- Create: `packages/nextclaw-kernel/src/managers/__tests__/access.manager.test.ts`
- Modify: `packages/nextclaw-kernel/src/app/nextclaw-kernel.ts`
- Modify: `packages/nextclaw-kernel/src/index.ts`

**持久模型：**

```ts
type SpaceAccessState = {
  kind: "nextclaw.space-access";
  version: 1;
  users: Array<{
    id: string;
    username: string;
    deploymentRole: "deployment-admin" | "user";
    passwordHash?: string;
    passwordSalt?: string;
    disabledAt?: string;
    createdAt: string;
  }>;
  spaces: Array<{
    id: SpaceId;
    name: string;
    createdAt: string;
  }>;
  memberships: Array<{
    userId: string;
    spaceId: SpaceId;
    role: "owner" | "member";
  }>;
};
```

**步骤：**

1. 给 `IngressContext` 和 `AppEventEnvelope/AppEventEmitOptions` 增加可选 `spaceId`，不改变 deployment 事件。
2. 只定义本 Task 使用的 `SpaceAccessRepository`；`AccessManager` 直接依赖该窄端口，不创建 `NextclawData` 文件、Local provider class、DataProviderRouter、通用 CRUD 或未来 feature 占位端口。
3. 实现 `SpaceAccessStore` 的原子写入、版本校验和文件权限，并在 composition root 直接装配；禁止接受路径分隔符形式的 Space ID。
4. `AccessManager` 只注入 `SpaceAccessRepository`，不直接构造 Store，也不经过需要 `spaceId` 的 Space router。
5. 将 `AccessPrincipal` 改成至少包含 `userId`、`deploymentRole`、`defaultSpaceId`；Space 成员角色继续来自 Membership，不把管理员角色复制进个人数据。
6. `AccessManager` 初始化时：Identity Store 为空则创建稳定本地 User/Space；检测到旧 UI admin 配置则迁移为 `deployment-admin`，同时成为默认 Space owner。
7. `AccessManager.authenticateSession()` 始终返回带默认 Space 的 principal；无密码个人模式也不能返回无 Space 的匿名全局 principal。
8. 实现 `resolveAuthorizedSpace(principal, requestedSpaceId?)`；普通成员只能解析 Membership 内 Space。Deployment Admin 的普通请求仍返回自己的 default Space，不能仅凭 role 任意传 target ID。
9. 冻结管理员访问合同：未来 elevation 只能在 Server 授权层解析成唯一目标 `spaceId`，Kernel、Manager 和 Store 不接收 `isAdmin` 或 bypass 参数；本 Task 不提前实现尚无真实目标用户的 elevation 生命周期和审计入口。
10. 为现有 Access session state 增加版本迁移；旧 `admin` principal 在重启后映射到迁移后的本地 Deployment Admin。
11. 本 Task 不实现 create/list/disable/reset-password、provisioning record 或第二用户登录；这些代码没有当前调用方，提前加入只会扩大 control state 和恢复面。
12. 双 Space 只通过受控 fixture 验证 Membership 和标识职责；真实 User provisioning 与 AdminElevation 在 Task 12 和用户管理入口一起实现。

**验证：**

```bash
pnpm -C packages/nextclaw-shared test
pnpm -C packages/nextclaw-shared tsc
pnpm -C packages/nextclaw-kernel exec vitest run src/stores/space-access.store.test.ts src/managers/__tests__/access.manager.test.ts
pnpm -C packages/nextclaw-kernel tsc
```

**完成标准：** 新安装、无密码旧安装和有密码旧安装都得到稳定默认 Space；重启后 ID 不变化；当前管理员行为保持一致；内部 fixture 能验证 Membership，但没有第二用户产品入口、未使用 provisioning 状态和第二个 Kernel。

## 7. Task 3：在 HTTP、WebSocket 和 Ingress 入口解析 Space

**目标：** Server 只认证一次、解析一次，Controller 只透传，不信任客户端 owner 字段。

**Files:**

- Create: `packages/nextclaw-server/src/app/types/ui-request-context.types.ts`
- Create: `packages/nextclaw-server/src/app/utils/request-space.utils.ts`
- Create: `packages/nextclaw-server/src/app/utils/request-space.utils.test.ts`
- Modify: `packages/nextclaw-server/src/features/auth/services/ui-auth.service.ts`
- Modify: `packages/nextclaw-server/src/features/auth/controllers/auth.controller.ts`
- Modify: `packages/nextclaw-server/src/features/event-stream/types/event-stream-principal.types.ts`
- Modify: `packages/nextclaw-server/src/features/event-stream/services/event-stream-auth.service.ts`
- Modify: `packages/nextclaw-server/src/features/event-stream/utils/event-stream-authorizer.utils.ts`
- Modify: `packages/nextclaw-server/src/features/event-stream/services/event-stream-client-registry.service.ts`
- Modify: `packages/nextclaw-server/src/app/types/router-options.types.ts`
- Modify: `packages/nextclaw-server/src/app/router.ts`
- Modify: `packages/nextclaw-server/src/app/server.ts`
- Modify: `packages/nextclaw-server/src/app/router.auth.test.ts`
- Modify: `packages/nextclaw-server/src/app/tests/server-event-stream.test.ts`
- Modify: `packages/nextclaw-server/src/shared/types/server-api.types.ts`
- Modify: `packages/nextclaw-ui/src/shared/lib/api/auth.types.ts`
- Modify: `packages/nextclaw-ui/src/features/account/components/login-page.tsx`
- Modify: `packages/nextclaw-ui/src/features/account/hooks/__tests__/use-auth.test.ts`

**步骤：**

1. 将 `UiAuthService.isRequestAuthenticated/isSocketAuthenticated` 的 boolean-only 用法替换成返回 `AccessPrincipal | null` 的认证方法，并在同一批迁移全部调用方和测试；不为内部测试保留旧 helper 或平行认证入口。
2. 在 Hono `UiRequestContext` 的 Variables 中保存 `principal` 和 `spaceId`；进入 Kernel 后只继续透传 `spaceId`。
3. API middleware 对所有个人数据 route 调用 `resolveAuthorizedSpace` 后设置 context；health、登录和 deployment runtime route 明确列为无 Space。
4. Agent Run HTTP route 把 `spaceId` 放入现有 `IngressContext`，不写入客户端 payload。
5. WebSocket principal 保存允许的 `spaceId`；UI event 不再拥有“接收全部事件”的隐式权限。
6. Panel bridge token、Extension event credential 后续必须能解析 owner Space；本任务先让缺少归属的个人事件拒绝推送。
7. Auth status 返回当前管理员和默认 Space 的非敏感摘要；Login UI 保持现有管理员登录行为，不为尚未交付的第二用户提前扩大界面。
8. AdminElevation、target-space API 和用户列表全部延后到 Task 12；客户端伪造 target、header 或 body owner 不会改变默认 Space。

**验证：**

```bash
pnpm -C packages/nextclaw-server exec vitest run src/app/router.auth.test.ts src/app/tests/server-event-stream.test.ts src/app/utils/request-space.utils.test.ts
pnpm -C packages/nextclaw-server tsc
pnpm -C packages/nextclaw-ui exec vitest run src/features/account/hooks/__tests__/use-auth.test.ts
pnpm -C packages/nextclaw-ui tsc
```

**完成标准：** Server 内任何已认证个人请求都能读取唯一默认 `spaceId`；客户端伪造 header/body owner 不会改变授权 Space；不存在 target-space/elevation 产品入口；deployment route 不被强行绑定个人 Space，现有管理员行为不变。

## 8. Task 4：建立本地 Space 路径与只读迁移盘点

**目标：** 建立后续 owner 共用的 canonical Space 路径规则和只读 inventory，但不在对应 Manager/Store 尚未完成空间化时提前搬迁全部生产数据。

**Files:**

- Modify: `packages/nextclaw-kernel/src/app/kernel-storage-paths.ts`
- Create: `packages/nextclaw-kernel/src/app/kernel-storage-paths.test.ts`

**路径合同：**

```ts
resolveKernelSpaceRoot(options, spaceId);
resolveKernelSpaceConfigPath(options, spaceId);
resolveKernelSpaceSessionsDir(options, spaceId);
resolveKernelSpaceAssetRoot(options, spaceId);
resolveKernelSpaceDataPath(options, spaceId, ...segments);
```

**步骤：**

1. `kernel-storage-paths.ts` 集中校验 Space ID 和解析目录；任何 Manager 不自行拼 `spaces/<id>`。
2. 生成只读 inventory，覆盖 Config、Workspace、Session、Journal、Search、Asset、Project、Preference、Inbox、Cron、App Data、grant 和 Usage；记录旧 owner、路径、数量、大小、schema/version 和后续负责迁移的 Task。
3. 本 Task 不复制、rename、切换或清理任何生产数据，也不让运行时读取尚未启用的 `spaces/<spaceId>` 路径；现有单用户 Store 仍是唯一活动 owner。
4. 提供仅供后续 owner 调用的最小 domain migration contract：`planned -> copied -> verified -> committed -> cleanup-eligible`。若没有两个真实调用方需要共享状态机代码，本 Task 只冻结合同，不提前创建通用 Migration Coordinator class。
5. Config 在 Task 5、Session/Journal 在 Task 7-8、Workspace/Skill 与其余资源在各自 owner Task 内执行复制、校验和原子切换；每个 Task commit 前后都只有自己的一个活动 owner。
6. `migration status` 是纯读；真正的 resume/cleanup 只随正在迁移的 owner 提供，不能由页面加载、轮询或普通启动查询暗中触发。
7. App package code 永远保留在 deployment-global `apps/`；未来只迁移 App Data、grant 和个人 runtime state。

**验证：**

```bash
pnpm -C packages/nextclaw-kernel exec vitest run src/app/kernel-storage-paths.test.ts
pnpm -C packages/nextclaw-kernel tsc
```

**完成标准：** 所有旧个人资源都有明确 owner 和后续迁移 Task；路径解析测试通过；生产数据和用户行为完全未改变，没有提前创建第二个活动 owner、通用迁移服务或运行时 fallback。

## 9. Task 5：拆分 Deployment Config 与 Space Config

**目标：** 解决当前 ConfigManager 同时持有宿主配置和个人配置的核心结构问题，同时尽量保留现有 schema、UI 和 reload 能力。

**Files:**

- Modify: `packages/nextclaw-core/src/features/config/configs/config-schema.config.ts`
- Create: `packages/nextclaw-core/src/features/config/configs/config-scope.config.test.ts`
- Modify: `packages/nextclaw-core/src/features/config/utils/config-loader.utils.ts`
- Modify: `packages/nextclaw-core/src/features/config/services/config-secrets.service.ts`
- Create: `packages/nextclaw-kernel/src/types/nextclaw-data.types.ts`
- Create only if this Task has a real lazy handle/cache/dispose lifecycle: `packages/nextclaw-kernel/src/services/local-data-provider.service.ts`
- Modify: `packages/nextclaw-kernel/src/managers/config.manager.ts`
- Modify: `packages/nextclaw-kernel/src/managers/__tests__/config.manager.test.ts`
- Modify: `packages/nextclaw-server/src/features/config/stores/server-config.store.ts`
- Modify: `packages/nextclaw-server/src/features/config/controllers/config.controller.ts`
- Modify: `packages/nextclaw-server/src/features/config/utils/provider-auth.utils.ts`
- Modify: `packages/nextclaw-server/src/features/config/utils/channel-auth.utils.ts`
- Modify: `packages/nextclaw-server/src/app/router.model-config.test.ts`
- Modify: `packages/nextclaw-server/src/app/router.search-config.test.ts`
- Modify: `packages/nextclaw-server/src/app/router-provider-probe.test.ts`
- Modify: `packages/nextclaw-service/src/managers/service-gateway.manager.ts`
- Modify: `packages/nextclaw-service/src/managers/gateway-extension.manager.ts`
- Modify: `packages/nextclaw-service/src/managers/gateway-remote.manager.ts`
- Modify: `packages/nextclaw-service/src/controllers/gateway.controller.ts`
- Modify: `packages/nextclaw-service/src/controllers/commands/config-command.controller.ts`
- Modify: `packages/nextclaw-service/src/controllers/commands/secrets-command.controller.ts`
- Modify: `docs/USAGE.md`
- Modify: `packages/nextclaw/resources/USAGE.md`
- Modify: `packages/nextclaw-core/src/features/agent/shared/skills/nextclaw-self-manage/SKILL.md` 及该 skill 指定的配置 reference

**Schema 合同：**

```ts
type DeploymentConfig = Pick<
  Config,
  "gateway" | "ui" | "remote" | "companion"
>;

type SpaceConfig = Pick<
  Config,
  | "agents"
  | "channels"
  | "providers"
  | "search"
  | "mcp"
  | "bindings"
  | "session"
  | "tools"
  | "secrets"
>;

type ResolvedConfig = DeploymentConfig & SpaceConfig;
```

**ConfigManager 目标 API：**

```ts
getDeploymentConfig(): DeploymentConfig;
getSpaceConfig(spaceId: SpaceId): SpaceConfig;
getResolvedConfig(spaceId: SpaceId): ResolvedConfig;
applySpaceConfig(spaceId: SpaceId, next: SpaceConfig, note?: string): Promise<ConfigMutationResult>;
applyDeploymentConfig(next: DeploymentConfig, note?: string): Promise<ConfigMutationResult>;
```

**步骤：**

1. 从现有 `ConfigSchema` 复用子 schema 组合 `DeploymentConfigSchema` 和 `SpaceConfigSchema`，不复制字段定义。
2. 保留 `ConfigSchema` 作为导入、迁移和兼容解析的 composite schema；运行时 owner 改用 scoped 类型。
3. 增加 `SpaceConfigRepository` typed port 和 Local adapter；`ConfigManager` 移除无 owner 语义的全局 `config` getter和无参数 `loadConfig()`，只注入该 port，所有调用点明确选择 deployment 或 `spaceId`。
4. 单 Space 只保留一个有效 Config view；Deployment/Space 分层通过结构共享与按需解析组合，不在常驻内存中复制两份等价完整 Config。
5. Space Secret 相对路径和 file provider 相对 `spaces/<spaceId>/config.json` 解析，不能从 deployment config 或进程环境意外继承其它用户 Secret。
6. Config reload hook 增加 `spaceId`，只重载对应 Space 的 Provider、Channel、MCP 和 Agent runtime。
7. deployment config watcher 只处理 host/restart 字段；Space Config 通过 API/CLI 保存后直接触发 scoped reload，不启动百万文件 watcher。
8. Config API 从 request context 读取 `spaceId`，返回该 Space 的 resolved/redacted view；deployment runtime API 使用独立 route 和管理员授权。
9. CLI 在本地通过 AccessManager 解析默认 Space；需要显式管理其它用户时使用管理员命令参数并做 Membership 校验。
10. 同步三份自管理文档，解释 deployment config 与个人 Space config 的路径和命令语义。
11. Config mutation 根据目标 Space 的 grant 和 provider 状态校验 host execution；不能读取 enabled User 数量决定功能行为。发布检查发现个人 feature 缺少 Space owner 时阻止发布并返回可操作诊断。

**验证：**

```bash
pnpm -C packages/nextclaw-core exec vitest run src/features/config/configs/config-scope.config.test.ts src/features/config/services/config-secrets.service.test.ts
pnpm -C packages/nextclaw-core tsc
pnpm -C packages/nextclaw-kernel exec vitest run src/managers/__tests__/config.manager.test.ts
pnpm -C packages/nextclaw-kernel tsc
pnpm -C packages/nextclaw-server exec vitest run src/app/router.model-config.test.ts src/app/router.search-config.test.ts src/app/router-provider-probe.test.ts
pnpm -C packages/nextclaw-server tsc
pnpm -C packages/nextclaw-service tsc
```

**完成标准：** 两个 Space 可以使用同名 Provider ID、Agent ID 和 Secret ref 而不串值；修改 Space A 配置不重载 Space B；修改 deployment port 不写入 Space config。

## 10. Task 6：空间化 Event、Agent Run Ingress 和 Event Stream

**目标：** 先让所有异步链路拥有 Space 归属，为 Session、Run 和 Cron 改造提供可靠主线。

**Files:**

- Modify: `packages/nextclaw-kernel/src/services/agent-run-client.service.ts`
- Modify: `packages/nextclaw-kernel/src/services/agent-run-client.service.test.ts`
- Modify: `packages/nextclaw-kernel/src/managers/agent-run-request.manager.ts`
- Modify: `packages/nextclaw-kernel/src/managers/__tests__/agent-run-request.manager.test.ts`
- Modify: `packages/nextclaw-kernel/src/types/agent-run.types.ts`
- Modify: `packages/nextclaw-kernel/src/types/session.types.ts`
- Modify: `packages/nextclaw-kernel/src/utils/agent-run-request.utils.ts`
- Modify: `packages/nextclaw-server/src/app/utils/ncp-session-event-stream.utils.ts`
- Modify: `packages/nextclaw-server/src/app/router.ncp-agent-stream.test.ts`
- Modify: `packages/nextclaw-server/src/features/event-stream/utils/event-stream-authorizer.utils.ts`
- Modify: `packages/nextclaw-server/src/app/tests/server-event-stream.test.ts`
- Modify: `packages/nextclaw-server/src/shared/utils/app-events.utils.ts`

**步骤：**

1. `AgentRunClient.send*` 的空间级入口要求 `spaceId`，并把它写入 `IngressContext`；不修改 NCP 客户端 payload。
2. Agent Run ingress handler 调用 `requireSpaceId(context)`，构造内部 `AgentRunRequest.spaceId`。
3. `AgentRunSession` 保存 `spaceId`；Queued Request、Run status、NCP event 和 synthetic error event 都从内部 request/session 继承。
4. 所有个人 `eventBus.emit` 调用在 options 中传 `spaceId`；runtime update、deployment config 和 host status 等全局事件保持无 Space。
5. AgentRunObserver 同时匹配 `spaceId` 和 correlation/run/session identity，防止不同 Space 的相同 ID 串流。
6. Session SSE endpoint 使用 request context 的 `spaceId` 过滤，而不是只比较 `sessionId`。
7. Event Stream authorizer 对 Space event 强制 principal Membership；无 Space deployment event 使用独立的 Deployment Admin 授权，不借用 Space elevation。
8. 增加相同 correlationId/sessionId 在两个 Space 并发运行的测试。

**验证：**

```bash
pnpm -C packages/nextclaw-kernel exec vitest run src/services/agent-run-client.service.test.ts src/managers/__tests__/agent-run-request.manager.test.ts
pnpm -C packages/nextclaw-server exec vitest run src/app/router.ncp-agent-stream.test.ts src/app/tests/server-event-stream.test.ts
pnpm -C packages/nextclaw-kernel tsc
pnpm -C packages/nextclaw-server tsc
```

**完成标准：** 任何个人 Event 都带 `spaceId`；UI A、AgentRunClient A 和 Extension A 都不能观察 B 的事件；deployment 事件语义没有被伪装成默认 Space。

## 11. Task 7：空间化 Session、Journal、Projection 和 Search

**目标：** 建立最核心的数据隔离主链，并删除 SessionManager 对无 Space `NcpSessionApi` 的直接实现。

**Files:**

- Modify: `packages/nextclaw-kernel/src/types/nextclaw-data.types.ts`
- Modify: `packages/nextclaw-kernel/src/services/local-data-provider.service.ts`
- Create: `packages/nextclaw-kernel/src/stores/space-session.store.ts`
- Create: `packages/nextclaw-kernel/src/stores/space-session.store.test.ts`
- Modify: `packages/nextclaw-kernel/src/managers/session.manager.ts`
- Modify: `packages/nextclaw-kernel/src/managers/__tests__/session.manager.test.ts`
- Modify: `packages/nextclaw-kernel/src/stores/ncp-agent-session-journal.store.ts`
- Modify: `packages/nextclaw-kernel/src/stores/ncp-agent-session-journal.store.test.ts`
- Modify: `packages/nextclaw-kernel/src/stores/ncp-agent-session-message-projection.store.ts`
- Modify: `packages/nextclaw-kernel/src/stores/ncp-agent-session-summary-index.store.ts`
- Modify: `packages/nextclaw-kernel/src/stores/ncp-agent-session-metadata.store.ts`
- Modify: `packages/nextclaw-kernel/src/stores/ncp-agent-unfinished-run.store.ts`
- Modify: `packages/nextclaw-core/src/features/session-search/types/session-search.types.ts`
- Modify: `packages/nextclaw-core/src/features/session-search/stores/session-search.store.ts`
- Modify: `packages/nextclaw-core/src/features/session-search/services/session-search.service.ts`
- Modify: `packages/nextclaw-core/src/features/session-search/worker/session-search-worker-protocol.types.ts`
- Modify: `packages/nextclaw-core/src/features/session-search/worker/session-search-worker.controller.ts`
- Modify: `packages/nextclaw-core/src/features/session-search/worker/session-search-worker-indexer.service.ts`
- Modify: `packages/nextclaw-core/src/features/session-search/worker/session-search-file-scanner.service.ts`
- Modify: `packages/nextclaw-core/src/features/session-search/worker/session-search-worker.controller.test.ts`
- Modify: `packages/nextclaw-server/src/features/sessions/controllers/sessions.controller.ts`
- Modify: `packages/nextclaw-server/src/features/sessions/services/session-skills-view.service.ts`
- Modify: `packages/nextclaw-server/src/shared/types/server-api.types.ts`
- Modify: `packages/nextclaw-service/src/services/gateway/gateway-restart-wake.service.ts`

**SessionManager 目标：**

```ts
getSession(spaceId, sessionId);
listSessions(spaceId, options?);
createSession(spaceId, input);
listSessionMessages(spaceId, sessionId);
appendSessionEvent(spaceId, params);
deleteSession(spaceId, sessionId);
```

**步骤：**

1. 移除 `SessionManager implements NcpSessionApi`，Server/Kernal 内部使用明确的 Space-aware host type。
2. `SessionLocalRepository` 按活跃 Space 懒加载 Journal handle，使用 LRU/TTL 和硬上限；它是 `SessionRepository` 的 Local adapter，不是 per-space Manager 树。
3. `SessionRepository` 的 Local adapter 继续把已解析目录交给 Journal、metadata、projection 和 summary 的 concrete file Store，不必让这些内部 Store 全都增加 `spaceId` 方法；Space partition 由该 adapter 保证。
4. Journal 内部 session、seq 和 write-chain Map 只存在于对应 Space handle；释放 handle 时等待 write chain 后清缓存。
5. SessionManager 所有状态方法第一个参数改为 `spaceId`；内部跨 Session 操作禁止跨 Space，Session Request V1 只允许同 Space。
6. Event ingestion 根据 event envelope 的 `spaceId` 选择 Journal，不再订阅后写入唯一全局 Store。
7. Session Search 使用一个进程内 Worker 和一个 SQLite DB；表增加 `space_id`，主键/查询采用 `(space_id, session_id)`。
8. Search Worker 支持按活跃 Space 注册 sessions root；启动时不扫描所有注册 Space，只对请求或 session update 触发的 Space 建索引。
9. Server Session controller 从 request context 读取 `spaceId`；所有 get/list/patch/delete/usage/skills/queued-input route 传入同一个值。
10. Restart wake record 必须包含 `spaceId`；旧 record 迁移到默认 Space。
11. 增加两个 Space 使用相同 sessionId、messageId、cursor 和 search 文本的隔离测试。

**验证：**

```bash
pnpm -C packages/nextclaw-kernel exec vitest run src/stores/space-session.store.test.ts src/stores/ncp-agent-session-journal.store.test.ts src/managers/__tests__/session.manager.test.ts src/managers/__tests__/session-message-page.manager.test.ts
pnpm -C packages/nextclaw-core exec vitest run src/features/session-search/worker/session-search-worker.controller.test.ts
pnpm -C packages/nextclaw-server exec vitest run src/features/sessions/controllers/__tests__/session-message-pagination.controller.test.ts src/features/sessions/controllers/__tests__/session-queued-inputs.controller.test.ts
pnpm -C packages/nextclaw-core tsc
pnpm -C packages/nextclaw-kernel tsc
pnpm -C packages/nextclaw-server tsc
```

**完成标准：** Session、Journal、Search、Cursor、unfinished run 和 restart recovery 全部以 Space 为第一归属；空闲 Space 的 Journal cache 可回收；不创建每用户 Kernel。

## 12. Task 8：空间化 Run、Runtime Cache、Context 和 Session Tools

**目标：** 解决当前只按 session/runtime key 保存 live object 的串状态风险，同时不让纯模型输入 helper 感知 Space。

**Files:**

- Modify: `packages/nextclaw-kernel/src/managers/session-run.manager.ts`
- Modify: `packages/nextclaw-kernel/src/managers/__tests__/session-run.manager.test.ts`
- Modify: `packages/nextclaw-kernel/src/managers/agent-runtime.manager.ts`
- Modify: `packages/nextclaw-kernel/src/managers/agent-context-window.manager.ts`
- Modify: `packages/nextclaw-kernel/src/managers/agent-run-session-command.manager.ts`
- Modify: `packages/nextclaw-kernel/src/managers/session-context-compaction.manager.ts`
- Modify: `packages/nextclaw-kernel/src/features/context-compaction/services/context-compaction-journal-recovery.service.ts`
- Modify: `packages/nextclaw-kernel/src/features/session-request/managers/session-request.manager.ts`
- Modify: `packages/nextclaw-core/src/features/session-request/types/session-request.types.ts`
- Modify: `packages/nextclaw-kernel/src/features/session-request/utils/agent-runtime-session-request-dispatcher.utils.ts`
- Modify: `packages/nextclaw-kernel/src/contributions/tool-provider/services/tool-provider-run-context.service.ts`
- Modify: `packages/nextclaw-kernel/src/contributions/tool-provider/providers/core-tool.provider.ts`
- Modify: `packages/nextclaw-kernel/src/contributions/tool-provider/providers/core-tool.provider.test.ts`
- Modify: `packages/nextclaw-kernel/src/contributions/tool-provider/providers/session-tool.provider.ts`
- Modify: `packages/nextclaw-kernel/src/tools/session-history.tools.ts`
- Modify: `packages/nextclaw-kernel/src/tools/session-spawn.tools.ts`
- Modify: `packages/nextclaw-kernel/src/tools/session-update.tools.ts`
- Modify: `packages/nextclaw-kernel/src/tools/session-search.tools.ts`
- Modify: 对应 `*.test.ts` 文件

**步骤：**

1. `SessionRunManager` 使用 `Map<SpaceId, Map<sessionId, SessionRun>>`，不要拼可碰撞字符串 key。
2. `AgentRuntimeManager` 的 `global` reuse scope 改为 Space-global；session runtime 按 `(spaceId, runtimeId, sessionId)`。
3. `AgentContextWindowManager` 和 compaction recovery cache 按 Space 分区；pure token 计算仍只接收数据 snapshot。
4. `AgentRunRequest` 进入 Manager 后始终有 `spaceId`；validation-only request 使用显式 system validation path，不伪造默认 Space。
5. Session Request record 写入 `spaceId`；V1 source/target 必须同 Space，跨 Space 请求 fail fast。
6. ToolProviderRunContext 使用 `request.spaceId` 加载 Session 和 Config，然后构造无 Space 的模型输入 snapshot。
7. Session tool 在每次 `provide(request)` 时用构造参数绑定当前 `spaceId`；工具参数中不暴露 `spaceId`。
8. abort/edit/continue/remove-queued 等命令全部要求 `spaceId`，防止使用相同 sessionId 操作另一 Space live controller。
9. 空闲 runtime cache 增加 TTL、数量和估算内存上限；Space 删除时提供定向 dispose。

**验证：**

```bash
pnpm -C packages/nextclaw-kernel exec vitest run src/managers/__tests__/session-run.manager.test.ts src/managers/__tests__/agent-context-window.manager.test.ts src/managers/__tests__/agent-run-session-commands.manager.test.ts src/features/session-request/managers/session-request.manager.test.ts src/tools/session-history.tools.test.ts src/tools/session-spawn.tools.test.ts
pnpm -C packages/nextclaw-kernel tsc
```

**完成标准：** 相同 sessionId/runtimeId 在两个 Space 同时运行时，队列、AbortController、runtime、上下文预算、工具和 compaction recovery 不互相影响。

## 13. Task 9：空间化 Project、Preference、Inbox、Cron、Asset 和 Usage

**目标：** 完成剩余基础状态 owner 的同节点双用户隔离。

**Files:**

- Modify: `packages/nextclaw-kernel/src/types/nextclaw-data.types.ts`
- Modify: `packages/nextclaw-kernel/src/services/local-data-provider.service.ts`
- Modify: `packages/nextclaw-kernel/src/managers/project.manager.ts`
- Modify: `packages/nextclaw-kernel/src/managers/preference.manager.ts`
- Modify: `packages/nextclaw-kernel/src/managers/inbox-delivery.manager.ts`
- Modify: `packages/nextclaw-kernel/src/managers/automation.manager.ts`
- Modify: `packages/nextclaw-kernel/src/managers/system-object-reference.manager.ts`
- Modify: `packages/nextclaw-kernel/src/managers/llm-usage.manager.ts`
- Modify: `packages/nextclaw-kernel/src/stores/project.store.ts`
- Modify: `packages/nextclaw-kernel/src/stores/preference.store.ts`
- Modify: `packages/nextclaw-kernel/src/stores/inbox-delivery.store.ts`
- Modify: `packages/nextclaw-kernel/src/stores/llm-usage.store.ts`
- Modify: `packages/nextclaw-core/src/features/cron/types/cron.types.ts`
- Modify: `packages/nextclaw-core/src/features/cron/services/cron.service.ts`
- Modify: `packages/nextclaw-core/src/features/cron/services/cron.service.test.ts`
- Modify: `packages/nextclaw-service/src/utils/gateway-cron-job-handler.utils.ts`
- Modify: `packages/nextclaw-server/src/features/projects/controllers/projects.controller.ts`
- Modify: `packages/nextclaw-server/src/features/preferences/controllers/preferences.controller.ts`
- Modify: `packages/nextclaw-server/src/features/inbox-deliveries/controllers/inbox-deliveries.controller.ts`
- Modify: `packages/nextclaw-server/src/features/cron/controllers/cron.controller.ts`
- Modify: `packages/nextclaw-server/src/features/attachments/controllers/attachments.controller.ts`
- Modify: 各 owner 现有测试

**步骤：**

1. Project、Preference、Inbox 和 Usage Manager 方法接收 `spaceId` 并调用各自 typed port；Local provider adapter 通过集中路径 resolver 复用现有 concrete Store，不长期缓存无连接的轻量文件 Store。
2. Project default workspace 来自 `ConfigManager.getSpaceConfig(spaceId)`；路径必须位于该 Space 授权 root。外部目录只能由有权管理员或 Host Operator 建立可撤销 `host.mount` grant，再由统一 Execution owner 挂入目标 Space。
3. Inbox write queue 改为按 Space 分区；Event 带 `spaceId`。
4. CronJob schema 升级并要求 `spaceId`；旧 Job 一次性归入默认 Space。
5. Cron list/get/update/delete/run 全部按 Space 过滤；Scheduler 可以看到所有 due job，但 Job handler 只从 record 读取 owner。
6. Cron 触发 AgentRunClient 时传 Job 的 `spaceId`；不读取最近登录 principal。
7. Asset root、Blob key、System Object resolved cache 和 visualization path 使用 `(spaceId, assetId)`。
8. LLM usage record、snapshot、history 和聚合增加 Space attribution；用户 API 只能查看本 Space，管理员汇总 API 不默认返回内容。
9. 增加同 ID、同 key、同 job name 的双 Space测试和路径穿越测试。

**验证：**

```bash
pnpm -C packages/nextclaw-kernel exec vitest run src/managers/__tests__/project.manager.test.ts src/managers/__tests__/preference.manager.test.ts src/managers/inbox-delivery.manager.test.ts src/managers/system-object-reference.manager.test.ts src/managers/__tests__/llm-usage.manager.test.ts
pnpm -C packages/nextclaw-core exec vitest run src/features/cron/services/cron.service.test.ts
pnpm -C packages/nextclaw-server exec vitest run src/features/projects/controllers/projects.controller.test.ts src/features/preferences/controllers/preferences.controller.test.ts src/features/inbox-deliveries/controllers/inbox-deliveries.controller.test.ts src/app/router.cron.test.ts
pnpm -C packages/nextclaw-kernel tsc
pnpm -C packages/nextclaw-core tsc
pnpm -C packages/nextclaw-server tsc
```

**完成标准：** 基础数据 owner 的 HTTP、Manager、Store、Event、Cron recovery 和 Usage projection 都通过双 Space 测试。

## 14. Task 10：空间化 Agent、Provider、Channel、MCP、Skill 与 Extension

**目标：** 让配置驱动能力按 Space 解析和按需激活；共享代码，不共享用户配置、凭据、连接或运行实例。

**Files:**

- Modify: `packages/nextclaw-kernel/src/managers/agent.manager.ts`
- Modify: `packages/nextclaw-kernel/src/managers/llm-provider.manager.ts`
- Modify: `packages/nextclaw-kernel/src/managers/provider-model-catalog.manager.ts`
- Modify: `packages/nextclaw-kernel/src/managers/channel.manager.ts`
- Modify: `packages/nextclaw-kernel/src/managers/mcp.manager.ts`
- Modify: `packages/nextclaw-kernel/src/managers/skill.manager.ts`
- Modify: `packages/nextclaw-core/src/features/agent/services/skills-loader.service.ts`
- Create: `packages/nextclaw-core/src/features/agent/services/skills-loader.service.test.ts`
- Modify: `packages/nextclaw-core/src/features/runtime-context/services/layered-skills-loader.service.ts`
- Modify: `packages/nextclaw-kernel/src/managers/extension.manager.ts`
- Modify: `packages/nextclaw-kernel/src/contributions/agent-run-runtime/index.ts`
- Modify: `packages/nextclaw-kernel/src/contributions/context-provider/services/context-provider-run-context.service.ts`
- Modify: `packages/nextclaw-kernel/src/contributions/tool-provider/services/tool-provider-run-context.service.ts`
- Modify: `packages/nextclaw-kernel/src/features/narp-runtime/services/builtin-narp-runtime-provider.service.ts`
- Modify: `packages/nextclaw-kernel/src/features/native-runtime/services/provider-manager-ncp-llm-api.service.ts`
- Modify: `packages/nextclaw-kernel/src/services/extension-runtime.service.ts`
- Modify: `packages/nextclaw-kernel/src/features/extension-runtime/services/extension-lifecycle.service.ts`
- Create: `packages/nextclaw-kernel/src/managers/agent.manager.test.ts`
- Create: `packages/nextclaw-kernel/src/managers/mcp.manager.test.ts`
- Create: `packages/nextclaw-kernel/src/managers/skill.manager.test.ts`
- Modify: `packages/nextclaw-server/src/features/config/controllers/config.controller.ts`
- Modify: `packages/nextclaw-server/src/features/config/utils/provider-auth.utils.ts`
- Modify: `packages/nextclaw-server/src/features/config/utils/channel-auth.utils.ts`
- Modify: `packages/nextclaw-server/src/features/marketplace/controllers/skill-marketplace.controller.ts`
- Modify: `packages/nextclaw-server/src/features/marketplace/utils/marketplace-installed.utils.ts`
- Modify: `packages/nextclaw-server/src/app/router.marketplace-manage.test.ts`
- Modify: `packages/nextclaw-service/src/controllers/commands/marketplace-skill-command.controller.ts`
- Modify: `packages/nextclaw-service/src/controllers/commands/marketplace-skill-install-command.controller.test.ts`
- Modify: `packages/nextclaw-ui/src/features/marketplace/hooks/use-marketplace-item-actions.ts`
- Modify: `packages/nextclaw-ui/src/features/marketplace/hooks/__tests__/use-marketplace.test.tsx`
- Modify: 对应 Manager、runtime、provider probe、channel auth 和 extension 测试

**归属合同：**

| 能力 | 共享部分 | Space 私有部分 |
| --- | --- | --- |
| Agent | schema、内置模板 | 定义、默认 Agent、workspace、memory |
| Provider | provider 实现代码 | endpoint、model 列表、credential、限额 |
| Channel | adapter 代码 | account、binding、credential、connection lease |
| MCP | server 类型和协议代码 | server config、credential、stdio/HTTP session |
| Skill | 内置/管理员安装的 package code、manifest、schema | 启用状态、用户 Skill、配置、credential、data、版本 pin |
| Extension | 已安装 package code | 启用状态、配置、credential、process/sandbox |

**步骤：**

**第一批只做 Agent、Provider 和 Skill：**

1. Agent/Provider/Skill Manager 的状态读取入口接收 `spaceId`，内部调用 `getSpaceConfig(spaceId)` 或使用该 Space workspace。
2. Config owner 解析 Deployment Shared Offering、Deployment BYOK Template 和 Space Private Provider；Model Ref 必须携带 `deployment | space` 来源。
3. 有效模型按 Run/Agent 显式选择、Space 默认、Deployment 默认、配置缺失解析；管理员锁定策略与 `allowPrivateProvider` 在同一个 resolver 中执行，不在 AgentManager 重复判断。
4. Run 开始时解析一次 Agent profile、Model Offering、Provider credential 和 Skill catalog snapshot；模型构造、Prompt 和 token 计算只接收 snapshot。
5. Provider client cache 使用 offering/binding identity、credentialVersion 和必要的 `spaceId`；禁止以 providerId 单独复用带认证 client。
6. Deployment Shared Credential 只存一份且不返回 Space；BYOK Template 和 Private Provider 的 Credential 归 Space。两者失效或超额都不能跨来源 fallback，Usage/Cost 始终归发起 Space。
7. 直接复用当前 SkillsLoader 的 scope：`builtin` 属于 System，`global` 改为明确的 Deployment skills root，`workspace/project` 只从目标 Space 的 workspace/project 发现。
8. 管理员通过现有 CLI/Marketplace 安装或删除 deployment-global Skill；普通用户只安装到自己的 Space workspace。第一批不新增 Skill binding Store、Credential Broker、版本灰度或复杂 policy resolver。
9. 全局 Skill 对所有 Space 可见但只共享只读文件；用户 Skill 只对本 Space 可见。所有 Skill 运行产生的文件、Memory、cache 和 Usage 使用目标 Space 现有 owner。
10. 同名 Skill 沿用明确 ref/ambiguity 机制，不增加隐式 shadow；需要执行代码或宿主命令的 Skill 仍通过目标 Space 的 `process.execute`、显式 mounts 和 Execution provider readiness 决定。
11. 增加两个 Space 共享 Deployment Model Offering、分别使用 BYOK/Private Provider，以及共享 global Skill、隔离 private Skill/data 的测试。
12. Run Context 解析目标 Space 的 host grant；CoreToolProvider 只提供该 Space 获得授权的工具。管理员全局文件操作走 maintenance CLI/API，不给普通 Agent 增加 admin 分支。

**以下能力不进入第一批，分别完成 owner 隔离后再解锁：**

13. Channel inbound 从 account credential 解析固定 `spaceId`；connection registry 使用 `(spaceId, channelId, accountId)` 和 idle lease。
14. MCP HTTP client 与 stdio process 按 Space 隔离；stdio MCP 使用统一 Execution Plan，不能拥有独立宿主快捷路径。
15. Extension package discovery 可以 deployment-global；Extension config、auth lease、process、channel contribution 和事件按 Space。
16. Skill 的 `required | available | blocked`、Skill 锁定字段、共享 Skill Credential Grant、版本 pin 和分阶段升级只有在出现真实产品需求时再增加；这里不包括已经冻结的 Model Offering 默认/锁定策略。
17. 后续每个 owner 批次都增加两个 Space 使用相同资源 ID、但不同 config/secret/data 的攻击型测试；日志和错误不得输出 secret。

**验证：**

```bash
pnpm -C packages/nextclaw-core exec vitest run src/features/agent/services/skills-loader.service.test.ts
pnpm -C packages/nextclaw-kernel exec vitest run src/managers/agent.manager.test.ts src/managers/__tests__/llm-provider.manager.test.ts src/managers/skill.manager.test.ts src/contributions/tool-provider/providers/core-tool.provider.test.ts
pnpm -C packages/nextclaw-server exec vitest run src/app/router-provider-probe.test.ts src/app/router.marketplace-manage.test.ts
pnpm -C packages/nextclaw-service exec vitest run src/controllers/commands/marketplace-skill-install-command.controller.test.ts
pnpm -C packages/nextclaw-ui exec vitest run src/features/marketplace/hooks/__tests__/use-marketplace.test.tsx
pnpm -C packages/nextclaw-core tsc
pnpm -C packages/nextclaw-kernel tsc
pnpm -C packages/nextclaw-server tsc
pnpm -C packages/nextclaw-service tsc
pnpm -C packages/nextclaw-ui tsc
```

后续每项能力解锁时，再单独运行其 Channel/MCP/Extension 定向测试和匹配 package `tsc`，不把未实现能力混入第一批“通过”范围。

**完成标准：** 第一批全局 Skill 只安装一份只读 Definition，用户 Skill 和运行数据留在 Space；Space A 的 Agent、Provider credential、Skill data 和 client cache 不可能被 Space B 命中；冷 Space 不产生常驻 loader 或 provider client。高级 policy 与 Channel/MCP/Extension 不在第一批完成声明中。

## 15. Task 11：空间化 App、Panel、Service 与授权数据

**目标：** 保留 App package 代码全局复用，同时把用户数据、启用状态、授权和运行调用归属到 Space。

**Files:**

- Modify: `packages/nextclaw-kernel/src/types/nextclaw-data.types.ts`
- Modify: `packages/nextclaw-kernel/src/services/local-data-provider.service.ts`
- Modify: `packages/nextclaw-kernel/src/managers/app-data.manager.ts`
- Modify: `packages/nextclaw-kernel/src/managers/panel-app-package-state.manager.ts`
- Modify: `packages/nextclaw-kernel/src/managers/panel-app.manager.ts`
- Modify: `packages/nextclaw-kernel/src/managers/service-app.manager.ts`
- Modify: `packages/nextclaw-kernel/src/stores/panel-app-state.store.ts`
- Modify: `packages/nextclaw-kernel/src/stores/panel-app-client-grant.store.ts`
- Modify: `packages/nextclaw-kernel/src/stores/panel-app-capability-grant.store.ts`
- Modify: `packages/nextclaw-kernel/src/services/panel-app-asset-token.service.ts`
- Modify: `packages/nextclaw-kernel/src/services/panel-app-agent-bridge.service.ts`
- Modify: `packages/nextclaw-kernel/src/services/service-app-record.service.ts`
- Modify: `packages/nextclaw-server/src/features/app-data/controllers/app-data.controller.ts`
- Modify: `packages/nextclaw-server/src/features/panel-apps/controllers/panel-apps.controller.ts`
- Modify: `packages/nextclaw-server/src/features/service-apps/controllers/service-apps.controller.ts`
- Modify: `packages/nextclaw-server/src/features/panel-apps/types/panel-app-api.types.ts`
- Modify: `packages/nextclaw-server/src/features/service-apps/types/service-app-api.types.ts`
- Modify: 对应 Kernel、Server 和 UI 测试

**步骤：**

1. Installed package inventory、manifest 和静态 code 作为 Definition 保持 deployment-global；Space 只保存 Binding：enablement、configuration、data、grant 和 runtime state；Panel/Service runtime 是继承 Space 的 Instance。
2. AppDataManager 的 list/read/write/delete/usage/export 接收 `spaceId`，本地 key 位于 `spaces/<spaceId>/app-data/<appId>/`。
3. Panel App state、client grant 和 capability grant 的唯一键包含 `spaceId`；相同 app/client/capability ID 可以在两个 Space 独立授权。
4. Panel asset token 绑定 `spaceId`、appId、asset path、principal 和 expiration；Server 验证 token 中 Space 与 request principal 一致。
5. Panel agent bridge 从已认证 token 恢复 `spaceId`，传入 AgentRunClient；禁止 iframe body 覆盖。
6. Service App action grant 和 record 绑定 Space；需要进程或宿主资源的 action 统一进入 Execution owner，provider 不能落实当前 plan 时拒绝。
7. 删除 App package 代码是 deployment 管理动作；删除某 Space 的 App Data/Grant 是 Space 动作，两个 API 不复用模糊 delete。
8. UI API 不传任意 owner；当前账户的 Space 从 Server context 决定。
9. 增加跨 Space token 重放、相同 appId 数据隔离、授权隔离和 Space 删除清理测试。
10. 管理员可设置 App/Extension 为 required、available 或 blocked，但全局 policy 不能把用户 App Data 或运行实例提升为共享状态。

**验证：**

```bash
pnpm -C packages/nextclaw-kernel exec vitest run src/managers/__tests__/app-data.manager.test.ts src/managers/__tests__/panel-app.manager.test.ts src/managers/__tests__/service-app.manager.test.ts
pnpm -C packages/nextclaw-server exec vitest run src/features/app-data/controllers/app-data.controller.test.ts src/features/panel-apps/controllers/panel-apps.controller.test.ts src/features/service-apps/controllers/service-apps.controller.test.ts
pnpm -C packages/nextclaw-kernel tsc
pnpm -C packages/nextclaw-server tsc
pnpm -C packages/nextclaw-ui tsc
```

**完成标准：** App code 只存一份；任何 App Data、grant、token、agent call、service action 和删除操作都有唯一 Space owner。

## 16. Task 12：交付本地多用户管理面

**目标：** 让单节点实际可创建和管理多个本地用户，而不把 SaaS 账号系统提前塞进 Kernel。

本 Task 可以先实现并通过内部 fixture 验证 service 合同，但 CLI/API/UI 的真实第二用户入口只有在当前发布 inventory 中全部个人 owner 与所需 Execution 边界闭合后才注册。没有达到该条件时，阶段完成态仍是默认管理员单用户产品，不交付半隔离用户。

**Files:**

- Create: `packages/nextclaw-service/src/controllers/commands/user-command.controller.ts`
- Create: `packages/nextclaw-service/src/controllers/commands/user-command.controller.test.ts`
- Create: `packages/nextclaw-service/src/services/access/user-commands.service.ts`
- Create: `packages/nextclaw-service/src/services/access/user-commands.service.test.ts`
- Modify: `packages/nextclaw-service/src/managers/service-command.manager.ts`
- Modify: `packages/nextclaw-service/src/controllers/commands/README.md`
- Modify: `packages/nextclaw-server/src/features/auth/controllers/auth.controller.ts`
- Modify: `packages/nextclaw-server/src/features/auth/services/ui-auth.service.ts`
- Modify: `packages/nextclaw-ui/src/features/account/components/account-panel.tsx`
- Modify: `packages/nextclaw-ui/src/features/account/components/login-page.tsx`
- Modify: `packages/nextclaw-ui/src/features/account/managers/account.manager.ts`
- Modify: `packages/nextclaw-ui/src/features/account/stores/account.store.ts`
- Modify: `packages/nextclaw-ui/src/shared/lib/api/auth.types.ts`
- Modify: 相关中英文 i18n 文件
- Modify: `commands/commands.md`
- Modify: `docs/USAGE.md`
- Modify: `packages/nextclaw/resources/USAGE.md`
- Modify: `packages/nextclaw-core/src/features/agent/shared/skills/nextclaw-self-manage/SKILL.md` 及适用 reference

**管理员命令合同：**

```text
nextclaw user list
nextclaw user create <username> --dry-run
nextclaw user create <username>
nextclaw user disable <username>
nextclaw user enable <username>
nextclaw user reset-password <username>
nextclaw user list-spaces
nextclaw user elevate-space <spaceId> --reason <text>
nextclaw user end-elevation
```

**步骤：**

1. CLI 仅通过 AccessManager 的用户管理方法操作，不直接读写 identity JSON。
2. 创建 User 前执行无状态 preflight：确认管理员认证、默认 Space 迁移、发布 owner inventory 和新 Space 默认 grant 满足策略；通过后使用 `prepare -> materialize -> verify -> commit-access-state -> ready` provisioning 状态机。只有 ready User 可见和登录，崩溃后继续同一 operation 或清理未提交资源，成功无需重启。
3. disable 立即撤销该 User 的 access sessions 和新 Run 权限，但不删除 Space 数据。
4. reset-password 撤销旧 session；密码只从 TTY/安全输入读取，不接受默认回显参数。
5. Login 与 auth status 支持真实用户名和当前 Space 摘要；UI 不暴露其它用户。
6. 平台部署的外部 IdP 后续只需实现 Identity assertion 到 User/Membership 的映射，不改变 Space 数据面。
7. 用户删除、导出和共享 Space 不进入本任务；在正式多用户 GA 前由数据生命周期 Review 单独冻结。
8. 按项目规范同步命令、用户文档和 self-manage skill。
9. 第一版先通过 CLI/API 开始和结束 session-scoped elevation，不新增管理员管理 UI；所有普通数据 API 仍由 Server 解析成一个 `spaceId`。结束提权、到期、禁用用户或管理员登出时立即失效。
10. 管理员跨 Space 的查看、修改配置、受管文件操作和 elevation 生命周期写入 Deployment Audit；普通用户不能读取该全局审计流。Execution Plan 沿用 target Space 自己的 capability 和 mounts，不因管理员身份扩权。
11. 发布装配只有在静态 owner inventory 和验证报告满足放行条件时才注册用户管理命令、第二用户登录和 target-space elevation；不读取 enabled User 数量，不写 activation marker，也不在运行时改变业务组件图。

**验证：**

```bash
pnpm -C packages/nextclaw-service exec vitest run src/controllers/commands/user-command.controller.test.ts src/services/access/user-commands.service.test.ts
pnpm -C packages/nextclaw-server exec vitest run src/app/router.auth.test.ts
pnpm -C packages/nextclaw-ui exec vitest run src/features/account/hooks/__tests__/use-auth.test.ts
pnpm -C packages/nextclaw-service tsc
pnpm -C packages/nextclaw-server tsc
pnpm -C packages/nextclaw-ui tsc
```

**完成标准：** service 层在双 Space fixture 下证明 provisioning、禁用、重置和 elevation 可恢复且隔离；达到发布 inventory 放行条件时，一台机器可创建至少两个真实用户，分别登录、退出和重启后仍绑定稳定 Space。未达到放行条件时生产装配不注册第二用户入口，现有管理员功能保持完整。Deployment Admin 没有无目标、无期限、无审计的数据 bypass；不要求公开注册系统。

## 17. Task 13：增加执行隔离、配额和公平调度

**目标：** 承认应用数据隔离不等于系统权限隔离，为多用户危险执行建立硬边界，并控制 Noisy Neighbor。

**Files:**

- Create: `packages/nextclaw-kernel/src/types/execution-policy.types.ts`
- Create: `packages/nextclaw-kernel/src/services/execution-policy.service.ts`
- Create: `packages/nextclaw-kernel/src/services/execution-policy.service.test.ts`
- Create: `packages/nextclaw-kernel/src/services/space-quota.service.ts`
- Create: `packages/nextclaw-kernel/src/services/space-quota.service.test.ts`
- Create: `packages/nextclaw-kernel/src/services/run-admission.service.ts`
- Create: `packages/nextclaw-kernel/src/services/run-admission.service.test.ts`
- Modify: `packages/nextclaw-kernel/src/contributions/tool-provider/providers/core-tool.provider.ts`
- Modify: `packages/nextclaw-kernel/src/contributions/tool-provider/providers/core-tool.provider.test.ts`
- Modify: `packages/nextclaw-kernel/src/features/narp-runtime/services/builtin-narp-runtime-provider.service.ts`
- Modify: `packages/nextclaw-kernel/src/features/extension-runtime/services/extension-lifecycle.service.ts`
- Modify: `packages/nextclaw-kernel/src/managers/agent-run-request.manager.ts`
- Modify: `packages/nextclaw-kernel/src/managers/session-run.manager.ts`
- Modify: `packages/nextclaw-kernel/src/managers/llm-usage.manager.ts`
- Modify: `packages/nextclaw-kernel/src/app/nextclaw-kernel.ts`
- Modify: `packages/nextclaw-ui/src/features/system-status/components/runtime-security-card.tsx`
- Modify: 相关安全、usage 和 run queue 测试

**执行策略：**

```ts
type ExecutionPolicy = {
  capabilities: Array<"workspace.files" | "process.execute" | "software.install.space">;
  mounts: ResolvedMountGrant[];
  environmentRef: string;
  secretGrants: ResolvedSecretGrant[];
  network: ResolvedNetworkPolicy;
  resources: ResolvedResourceBudget;
};
```

这里新增的是本次执行的数据快照，不是 Kernel scope 或部署模式。`spaceId` 仍然来自 Run record；Execution provider 只接收已解析的 workspace、mounts、Environment、Credential、网络和资源预算，不能读取用户数量或自行扩大授权。

**步骤：**

1. Operator 在 Deployment policy 中定义可授予的 capability 和 host mount 范围；每个 Space 保存自己的 grant，普通用户不能提升。旧安装的宿主执行范围迁移为管理员 Space 的 `process.execute` 和显式 mounts，新 Space 默认只有 `workspace.files`。
2. Shell、浏览器、本地 NARP、stdio MCP、Service App action 和 Extension process 全部调用同一个 Execution owner；当前 provider 无法落实 plan 时 fail closed，不能切换到宿主快捷路径。
3. NextClaw User、Space 与 OS User 解耦。本地进程、独立 UID、rootless namespace、容器、MicroVM 或远程 Worker 都只是 Execution provider；不能为冷 Space 常驻 UID、容器、进程或数据库连接。
4. Execution provider 最低合同：只暴露 resolved workspace 和 mounts、独立临时目录、最小环境变量、进程/CPU/内存/inode/时间限制、网络策略和终止后清理。具体使用本地进程、namespace 或 VM 不改变合同。
5. 软件环境分为 Host Operator 拥有的 System Base、Deployment Admin 发布的只读 Deployment Runtime、Space 可写的个人 Environment 和 Run Temporary。普通 Agent 不得使用宿主 `sudo`；namespace root 不能映射为宿主 root。
6. Space Environment 可以持久保存 venv、npm prefix 和用户级 binary；共享 package/cache 必须只读或内容寻址，Credential、配置、写层和安装记录仍按 Space 隔离，并纳入磁盘配额和供应链审计。
7. Secret 不写入共享环境或基础镜像；按 tool/action grant 临时注入，并在审计中只记录 secret ref。
8. SpaceQuotaService 统一读取存储、并发 Run、队列长度、token/cost、Cron、Channel connection、Space Environment 和 Sandbox 使用量。
9. RunAdmissionService 在模型调用和 Sandbox 创建前做原子 reservation；成功结算、失败释放，避免并发超卖。
10. 本地 provider 使用进程内 weighted round-robin：每 Space 默认并发 1、全局并发由机器预算决定；不能让一个 Space 的长队列饿死其它 Space。
11. distributed queue 在 Task 14 使用同一 admission/fairness 合同，不把计费逻辑埋入 Worker。
12. UI 展示当前 capability、显式 host mounts、软件层 owner、provider readiness 和不可用原因；不能把具体 provider 技术包装成另一套产品模式。
13. 写跨 Space 文件读取、环境变量泄漏、依赖写层串用、宿主 root 获取、进程枚举、网络访问、fork bomb、超时终止和公平调度测试；宿主 sandbox 的系统测试在支持平台运行。
14. 文件授权先 realpath/canonicalize，再校验受管 root；覆盖 symlink、`..`、bind mount、TOCTOU 和已打开文件描述符复用，不能只做字符串前缀判断。
15. Deployment Admin 持有效 AdminElevation 时可以读写目标 Space 的全部受管文件；Execution owner 只接收解析后的 target `spaceId` 和 allowed roots，不接收 admin bypass。
16. 管理员跨 Space 批量备份、扫描或修复使用 Deployment maintenance job 逐 Space mount；禁止给一个普通 Agent 或 Sandbox 同时挂载全部 Space。
17. Host Operator 的宿主全盘能力只在明确的 maintenance 路径或 host mount grant 开放，与 Web Deployment Admin 分离；管理员登录不能自动挂载宿主 home、数据库文件或管理 socket。
18. 任何 Space 都不能直接登记任意宿主绝对路径为 Project root；Space root 外目录必须先创建可撤销 host mount grant，再由相同 Execution owner 挂入目标 Space。

**验证：**

```bash
pnpm -C packages/nextclaw-kernel exec vitest run src/services/execution-policy.service.test.ts src/services/space-quota.service.test.ts src/services/run-admission.service.test.ts src/contributions/tool-provider/providers/core-tool.provider.test.ts
pnpm -C packages/nextclaw-kernel tsc
pnpm -C packages/nextclaw-ui tsc
```

**完成标准：** 所有 Space 的危险执行都经过同一个 Execution owner；普通用户无法访问未授权的其它 Space 或宿主文件；管理员可以显式操作目标 Space 文件但不能形成无目标的全盘 Agent；个人安装可以通过相同 mount grant 表达更大的本机授权范围；公平调度和硬配额能阻止单 Space 独占。

## 18. Task 14：完成统一数据抽象并实现多节点 provider

**目标：** 把基础批次已经建立的最小 `NextclawData` 扩展到所有持久数据 owner，并实现可路由、可验证、可迁移的共享 provider；上层不感知节点数、数据库、bucket 或 shard。

**Files:**

- Modify: `packages/nextclaw-kernel/src/app/nextclaw-kernel.ts`
- Modify: `packages/nextclaw-kernel/src/types/nextclaw-data.types.ts`
- Modify: `packages/nextclaw-kernel/src/stores/space-access.store.ts`
- Modify: `packages/nextclaw-kernel/src/managers/config.manager.ts`
- Modify: `packages/nextclaw-kernel/src/managers/session.manager.ts`
- Modify: `packages/nextclaw-kernel/src/managers/automation.manager.ts`
- Modify: `packages/nextclaw-kernel/src/managers/llm-usage.manager.ts`
- Modify: `packages/nextclaw-shared/src/services/event-bus.service.ts`
- Create: `packages/nextclaw-service/src/services/data/data-provider-registry.service.ts`
- Create: `packages/nextclaw-service/src/services/data/data-provider-router.service.ts`
- Create: `packages/nextclaw-service/src/services/data/data-provider-router.service.test.ts`
- Create: `packages/nextclaw-service/src/stores/data/space-data-placement.store.ts`
- Create: `packages/nextclaw-service/src/services/data/data-provider-contract.integration.service.test.ts`
- Create: `packages/nextclaw-service/src/stores/postgres/postgres-connection.store.ts`
- Create: `packages/nextclaw-service/src/stores/postgres/postgres-schema-migration.store.ts`
- Create: `packages/nextclaw-service/src/stores/postgres/postgres-space-access.store.ts`
- Create: `packages/nextclaw-service/src/stores/postgres/postgres-space-config.store.ts`
- Create: `packages/nextclaw-service/src/stores/postgres/postgres-session.store.ts`
- Create: `packages/nextclaw-service/src/stores/postgres/postgres-space-document.store.ts`
- Create: `packages/nextclaw-service/src/stores/postgres/postgres-cron.store.ts`
- Create: `packages/nextclaw-service/src/stores/postgres/postgres-usage.store.ts`
- Create: `packages/nextclaw-service/src/stores/s3/s3-asset.store.ts`
- Create: `packages/nextclaw-service/src/services/runtime/postgres-run-queue.service.ts`
- Create: `packages/nextclaw-service/src/services/runtime/postgres-run-lease.service.ts`
- Create: `packages/nextclaw-service/src/services/runtime/postgres-event-outbox.service.ts`
- Create: `packages/nextclaw-service/src/services/runtime/runtime-provider-assembly.service.ts`
- Create: `packages/nextclaw-service/src/services/runtime/runtime-provider-assembly.service.test.ts`
- Create: `packages/nextclaw-service/src/stores/postgres/postgres-runtime-providers.integration.store.test.ts`
- Create: `packages/nextclaw-service/src/stores/s3/s3-asset.store.integration.test.ts`
- Create: `packages/nextclaw-service/src/services/runtime/postgres-run-coordination.integration.service.test.ts`
- Modify: `packages/nextclaw-service/src/app/nextclaw-service-runtime.ts`
- Modify: `packages/nextclaw-service/src/managers/service-gateway.manager.ts`
- Modify: `packages/nextclaw-service/package.json`

**统一数据端口：**

| 地址范围 / 数据域 | feature-owned typed port |
| --- | --- |
| Deployment control / Access | `SpaceAccessRepository` |
| Deployment control / Provider catalog & Placement | `ProviderCatalogRepository`、`PlacementStore` |
| Deployment control / Audit | `DeploymentAuditRepository` |
| Space records / Config | `SpaceConfigRepository` |
| Space records / Session | `SessionRepository` |
| Space records / 小型状态 | `SpaceDocumentRepository`，只负责 versioned document，不拥有 Project/Preference 等业务语义 |
| Space records / Cron | `CronRepository` |
| Space records+blobs / Asset/App Blob | `AssetRepository` |
| Space records / Usage | `UsageRepository` |
| Space search / source+index | `SearchRepository` |

`NextclawData` 是这些 typed ports 的组合边界，不是通用 Repository：

```ts
type NextclawData = {
  control: {
    access: SpaceAccessRepository;
    providerCatalog: ProviderCatalogRepository;
    placement: PlacementStore;
    audit: DeploymentAuditRepository;
  };
  spaces: {
    config: SpaceConfigRepository;
    sessions: SessionRepository;
    documents: SpaceDocumentRepository;
    cron: CronRepository;
    assets: AssetRepository;
    usage: UsageRepository;
    search: SearchRepository;
  };
};
```

每个端口仍由原 feature owner 定义并拥有业务 schema、事务、排序、幂等和错误合同。Manager 构造时只注入自己需要的子端口，不能通过 `NextclawData` 横向读取其它 feature，也不能调用 `get(kind, key)`、`put(kind, key, json)` 一类通用 CRUD。Control ports 在认证解析 `spaceId` 之前可用，由 deployment bootstrap 指定的 control provider 承载；Space ports 才按 `spaceId + dataDomain` 路由。

`DataProviderRegistry` 登记 provider ID、支持的 data domain 与 readiness；`DataProviderRouter` 根据 Space Data Placement 选择对应实现。Local、PostgreSQL、S3 和后续 Search 实现都属于 provider，但一个 provider 可以只实现部分 domain。Run Queue、Lease、EventOutbox 和 Execution 不属于普通持久数据 CRUD，继续使用独立 runtime port；不新增统一 `RuntimeProviders`、`RuntimeFabric` 或包含所有能力的 DataPlane 业务对象。

这里的“所有持久数据”只指 NextClaw 自己拥有的 control facts、Space records、Blob metadata/content、Workspace 和可重建索引，不等于“所有资源都进数据库”。Live stream/client、运行中的进程与 Sandbox、挂载、明文 Secret、package artifact、普通日志指标和备份分别由 runtime、Execution、Secret、Package、Observability 与 Backup owner 承载。数据库可以保存它们的引用、lease、usage 和 audit，但不保存资源本体。

Provider descriptor 必须声明 `supportedDomains`、transfer schema versions、read/write capability、容量与 readiness。“可迁移”只允许在支持同一 domain 和兼容 transfer schema 的 provider 之间发生；不要求 S3 承载 records，也不要求 PostgreSQL 提供可挂载 Workspace。

**PostgreSQL 合同：**

- 所有个人表都有非空 `space_id`；唯一键、外键和查询条件包含 `space_id`。
- 首批表：`users`、`spaces`、`memberships`、`access_sessions`、`space_configs`、`sessions`、`session_events`、`session_summaries`、`space_documents`、`cron_jobs`、`asset_metadata`、`run_queue`、`run_leases`、`usage_records`、`event_outbox`。Project、Preference、低频 Inbox/App state 先复用 versioned `space_documents` 物理原语，但继续由各自 Manager/Store 拥有业务 schema。
- 大表按时间和/或 Space hash 分区；不采用每用户 database/schema/table。
- Blob key 固定为 `spaces/<spaceId>/<kind>/<objectId>`，metadata 行持有 owner、hash、size 和 lifecycle state。

**Space Data Placement 合同：**

```ts
type DataDomain = "records" | "blobs" | "workspace" | "search";

type ProviderTarget = {
  providerId: string;
  location: string;
};

type ProviderPlacement =
  | {
      phase: "active" | "copying" | "verifying" | "draining";
      active: ProviderTarget;
      candidate?: ProviderTarget;
      epoch: number;
    }
  | {
      phase: "unavailable";
      reason: string;
      epoch: number;
    };

type SpaceDataPlacement = {
  spaceId: SpaceId;
  domains: Record<DataDomain, ProviderPlacement>;
};
```

- `spaceId + dataDomain -> providerId/location/epoch` 是统一数据层内部的唯一物理位置映射，不进入 Kernel、Manager、API 或资源 ID；单节点等价为所有 domain 映射到 Local provider。
- domain 按一致性类别而不是物理表划分：标准事实与 Session Journal 留在 `records`，大对象进入 `blobs`，用户文件树进入 `workspace`，可重建索引进入 `search`；需要原子提交的事实不能被任意拆到多个 provider。
- Identity、Access、Provider Catalog、Placement Directory 和 deployment audit 是 control metadata，不通过 `SpaceDataPlacement` 路由自身；它们由 bootstrap control provider 实现相同 typed ports。
- `SpaceDataPlacement` 是解析结果；持久层优先保存 deployment default、固定 stable virtual partition 映射和稀疏 Space override，不要求为每个 Space × domain 常驻完整记录或缓存。
- 不使用 `hash(spaceId) % shardCount` 作为永久路由；增加 shard 时通过显式 placement record 迁移选定 Space，避免全量重映射。
- Placement cache 必须有界并携带 epoch；切换使用 copy、verify、drain、cutover，任一 domain 同时只有一个写 owner。
- copying/verifying 时 `active` 仍是唯一在线读写目标，`candidate` 只供 Migration Coordinator 使用；cutover 原子提升 candidate 并增加 epoch。未配置 domain 显式 `unavailable`，不 fallback 到 Local provider。
- 普通 Space 可以共享 PostgreSQL table、object bucket 和 Search partition，但所有主键、查询、Blob key、cache key 和异步 record 保持 `spaceId` 归属。
- 不为每用户创建 database、schema、table、数据库连接、Worker、Sandbox 或文件 watcher；超大或热点 Space 可以显式迁移到独立 shard。
- 多节点首期只要求 PostgreSQL + S3-compatible object storage + 最简单的可挂载 Workspace filesystem/volume shard；Queue、Lease、Outbox 和基础 Search 优先复用 PostgreSQL，独立 Workspace service 与其它专用基础设施由基准瓶颈触发。
- 执行 placement 由 `ResolvedExecutionPlan` 和 Execution provider 独立拥有，不进入 `SpaceDataPlacement`。

**Workspace domain 合同：**

- 逻辑身份只使用 `(spaceId, relativePath)`；绝对路径、volume、region、storage shard 和 placement epoch 不进入 Kernel/Manager API、Session metadata 或公开资源 ID。
- 单节点 `LocalWorkspaceProvider` 把 Space 解析到受管目录；多节点固定数量的 virtual partition 映射到多个 Workspace storage shard，shard 数变化不改变 virtual partition 算法，热点 Space 允许稀疏 override。
- 空 Workspace 延迟到第一次写入才创建目录；注册百万 Space 不能先制造百万个空目录。冷 Workspace 不创建 watcher、mount、handle、client 或进程。
- 普通 shard 承载许多 Space 目录；禁止为百万冷 Space 预创建百万个 cloud volume、PV、永久 mount、watcher 或 Worker。
- 管理型文件操作通过 Workspace typed port 使用相对路径，Local provider 直接访问目录，共享 provider 可路由到 shard-aware Workspace I/O 节点；需要 POSIX path 的 Skill/App/Shell 只在具有 storage locality 的节点取得受管 root/materialized checkout，再复用现有 path-based helper。
- 随机 Gateway/Kernel replica 不永久挂载全部 shard。首期可以由共享稳定 filesystem namespace 实现最小 provider；mount/locality 成为瓶颈后再加入 Workspace I/O service，不改变上层 Space 合同。
- Run Scheduler 在 runtime/Execution 边界解析 Workspace placement，选择能够访问目标 shard 的 Worker，取得写 lease/fencing 后只挂载目标 Space 根目录；Kernel 不感知 locality。
- 首期修改型 Run 以 Workspace 为写 lease 单位，只读可并行；确有证据后才能收窄到受管 Project/root，不建设逐文件分布式锁。
- PostgreSQL 只保存 placement、virtual partition/override、epoch、quota/usage、lease、snapshot ref 和 migration state；文件内容留在 Workspace provider。
- 活跃 Workspace 使用 POSIX provider；S3-compatible provider 只承担一致性 snapshot、archive/cold tier 与迁移对象。恢复时按需 materialize，不能由启动流程扫描所有冷 Space。
- Workspace provider transfer 验证文件数、bytes、inode/manifest 和内容 hash；cutover 前暂停新修改 Run、等待写 lease 安全点，再更新 placement epoch。首版允许短暂停写，不建设跨 filesystem 长期双写。

**步骤：**

1. 为每个 typed port 提炼逻辑 contract tests；同一测试套件运行 Local 与相应共享 provider，覆盖 owner 条件、顺序、事务、幂等、版本和错误语义。
2. 审计 Task 2-13 的持久数据 owner 已在各自空间化批次接入 `NextclawData`；遗漏 owner 先补 typed port 与 Local adapter，不借机重写成熟本地格式。
3. Composition root 装配 registry、router 和 providers；Manager、Controller、Tool 和 UI 不读取 `providerId`、`providerKind`、`shardId`、`location` 或 placement epoch。
4. 单节点 registry 只装配 Local provider，placement 可以是静态内存映射；仍经过同一 router 合同，不建立本地旁路或额外网络依赖。
5. PostgreSQL、S3、远程 Worker、容器和 migration provider 使用动态加载；配置未引用时不得创建模块级 singleton、SDK client、连接池、health timer 或后台进程。单用户模块/句柄清单与 Task 1 基线比较。
6. 多节点 control provider 使用事务存储承载 Identity、Provider Catalog、Placement 与 Audit；router cache 按 `(spaceId, domain)` 有界缓存并携带 epoch，冷 Space 不进入内存。control provider 迁移通过 bootstrap 配置/leader lock 切流，不递归经过普通 Space placement。
7. PostgreSQL schema migration 使用 advisory lock、单调 version 和可重复读取状态；应用版本不自动执行不可逆 destructive migration。
8. Session event append 使用 `(space_id, session_id, seq)` 唯一约束和事务；projection 以 journal cursor 幂等推进。
9. Run enqueue 使用 idempotency key；Worker 以 `FOR UPDATE SKIP LOCKED` claim，写 lease owner、expiry 和 fencing token。
10. Worker 续租失败立即停止结果提交；任何状态提交校验 fencing token，防止暂停节点恢复后双写。
11. Cron claim 与 Run queue 使用同一 lease 原语；at-least-once delivery 由业务 idempotency 收敛，不承诺 exactly-once。
12. 个人 Event 与状态变更在同一数据库事务写 outbox；Gateway 按 cursor 读取，授权后仅推送目标 Space。
13. 跨 `records`/`blobs` 的 Asset 写入使用临时 object、metadata 状态机、checksum 和孤儿垃圾回收，不假设 PostgreSQL/S3 分布式事务。
14. Router 解析并缓存 Space Data Placement；placement miss、epoch 冲突和 provider 不可用返回明确错误，不能猜测默认 shard 或 fallback 到本地盘形成 split brain。
15. Provider health 只进入 deployment status；业务层对暂时故障返回明确可重试错误，不 fallback 到另一事实源。
16. 节点角色只决定 placement：单节点同进程承载 Gateway/Scheduler/Worker；多节点部署相同组件的多个实例。每个 runtime 进程仍只有一个 Kernel，不创建 per-user Kernel。
17. 增加节点宕机、lease 过期、重复消息、乱序 event、数据库重连、对象上传中断、placement cache 过期、Space 跨 provider/shard 切流和滚动升级兼容测试。

**验证：**

```bash
pnpm -C packages/nextclaw-kernel tsc
pnpm -C packages/nextclaw-service tsc
pnpm -C packages/nextclaw-service test
pnpm -C packages/nextclaw-service exec vitest run src/stores/postgres/postgres-runtime-providers.integration.store.test.ts src/stores/s3/s3-asset.store.integration.test.ts src/services/runtime/postgres-run-coordination.integration.service.test.ts
```

**完成标准：** 所有 control/records/blobs/workspace/search 持久产品数据都经同一个 typed data boundary，Queue/Lease/Event、Execution、Secret、Package 和 Observability 分别闭合自己的最小 provider 合同；同一 Kernel/Manager 合同可以使用 Local 或共享 provider；增加 Worker 或数据 shard 能分别提升 Run 与存储容量；Space 可在不改变逻辑 ID 和 API 的前提下迁移 placement；任一节点退出不会导致跨 Space 读取、双写或 owner 漂移。

## 19. Task 15：实现 provider 间迁移、回滚和 Space 生命周期

**目标：** 让单机数据可以安全搬到共享 provider，并为 Space 导出、删除和故障恢复建立唯一 owner。

**Files:**

- Create: `packages/nextclaw-kernel/src/types/data-transfer.types.ts`
- Create: `packages/nextclaw-service/src/services/migration/data-transfer.service.ts`
- Create: `packages/nextclaw-service/src/services/migration/data-transfer-contract.service.test.ts`
- Create: `packages/nextclaw-service/src/services/migration/space-provider-migration.service.ts`
- Create: `packages/nextclaw-service/src/services/migration/space-provider-migration.service.test.ts`
- Create: `packages/nextclaw-service/src/services/migration/space-export.service.ts`
- Create: `packages/nextclaw-service/src/services/migration/space-export.service.test.ts`
- Create: `packages/nextclaw-service/src/services/migration/space-deletion.service.ts`
- Create: `packages/nextclaw-service/src/services/migration/space-deletion.service.test.ts`
- Create: `packages/nextclaw-service/src/controllers/commands/migration-command.controller.ts`
- Create: `packages/nextclaw-service/src/controllers/commands/migration-command.controller.test.ts`
- Modify: `packages/nextclaw-service/src/managers/service-command.manager.ts`
- Modify: `commands/commands.md`
- Modify: `docs/USAGE.md`
- Modify: `packages/nextclaw/resources/USAGE.md`

**迁移状态机：**

```text
inventoried -> preflighted
  -> online: copied -> verified -> write-frozen -> delta-copied
  -> freeze-only: write-frozen -> copied -> verified
  -> cutover-ready -> active-target -> source-retained -> source-retired
```

**Provider-neutral 传输合同：**

```ts
type DataTransferScope =
  | {
      kind: "deployment";
      domain: "identity" | "provider-catalog" | "placement" | "audit";
    }
  | {
      kind: "space";
      spaceId: SpaceId;
      domain: DataDomain;
    };

interface DataTransferPort {
  capabilities(scope: DataTransferScope): Promise<{
    snapshot: "online" | "requires-write-freeze";
    changeFeed: boolean;
  }>;

  createSnapshot(input: {
    scope: DataTransferScope;
  }): Promise<SnapshotDescriptor>;

  readBatch(input: {
    snapshotId: string;
    cursor?: string;
  }): Promise<DataTransferBatch>;

  readChanges?(input: {
    scope: DataTransferScope;
    afterCursor: string;
  }): Promise<DataTransferBatch>;

  importBatch(batch: DataTransferBatch): Promise<ImportReceipt>;
  verify(manifest: VerificationManifest): Promise<VerificationResult>;
}
```

`DataTransferBatch` 使用版本化逻辑 record/blob/workspace manifest，包含 transfer scope、schema version、cursor、checksum 与引用摘要。Workspace manifest 使用相对路径、类型、size、mode 和 content hash，不携带本地绝对根目录。传输批次不能是 PostgreSQL SQL dump、宿主绝对路径或 S3 私有 object layout，也不能用于在线业务 CRUD。Migration Coordinator 只通过 provider ID 取得源、目标传输端口；禁止创建 `LocalToPostgres` 等两两迁移器。

现有 Local JSON/JSONL provider 可以声明 `requires-write-freeze` 且无 change feed，避免为了迁移先重写所有 Store；支持 online snapshot/change cursor 的 provider 才走后台 copy + delta。Coordinator 必须预估 freeze-only 路径的停写时间，超过 operator 预算时在开始前失败。

**步骤：**

1. Migration inventory 先覆盖 Identity、Provider Registry、Placement、Audit 等 control data，再覆盖 Config、Session journal/projection、Search rebuild source、Asset、Project、Preference、Inbox、Cron、App Data/Grant、Usage 和 unfinished Run，并按 transfer scope 生成 manifest。
2. Coordinator 从 bootstrap/registry 解析 source/target provider ID，逐 scope 创建一致性 snapshot；provider 之间不直接相互调用。
3. copy 前校验目标的 supported domain、transfer schema、容量、read/write capability 和 readiness，并读取源的 snapshot/change-feed capability；不兼容或预计 freeze 超预算时不创建 candidate placement。
4. 第一次 copy 不改变 source owner；目标侧所有 record 保留相同 `spaceId` 和资源 ID。
5. 使用统一 contract 校验 count、ordered journal tail、content hash、blob hash、config version 和引用完整性；Search index 允许从 source record 重建，不作为唯一事实源搬运。
6. 支持 change feed 时先后台 copy，cutover 前拒绝新 Run/Cron 写入目标 Space，等待活跃 Run 到达安全点，再短暂 write freeze 后复制 delta；freeze-only provider 则在冻结后生成和复制最终 snapshot。
7. control provider 在 maintenance/leader lock 下把 Identity、Provider Catalog、Placement 和 Audit 作为一个 control bundle 完成验证，再原子更新 deployment bootstrap 并滚动替换 client；Space data 则原子提升对应 domain 的 placement epoch。两者都不能同时双写 source 与 target。
8. 切换后保留只读 source 和 verification window；回滚只允许在 target 尚未产生不可合并的新写入时执行。
9. Export 复用逻辑 manifest，但增加每文件 hash、可选加密/签名与 credential rebinding；Import 目标 Space ID 冲突时必须显式 remap 并重写所有 owner reference。
10. Delete 先禁用访问和新 Run，再等待/终止执行，写 tombstone，异步清除 DB、Blob、cache、credential 和 audit-retention 外数据。
11. 文档明确哪些备份由 operator 负责；删除不能宣称立即清除 operator-controlled backup。

**验证：**

```bash
pnpm -C packages/nextclaw-service exec vitest run src/services/migration/space-provider-migration.service.test.ts src/services/migration/space-export.service.test.ts src/services/migration/space-deletion.service.test.ts src/controllers/commands/migration-command.controller.test.ts
pnpm -C packages/nextclaw-service tsc
```

**完成标准：** 一个真实旧安装可迁移到默认 Space，再通过相同传输合同把 records/blobs/workspace 分别迁到 PostgreSQL、S3 和 Workspace shard，资源 ID 与 Space ID 不变；增加新 provider 不需要新增两两迁移器；失败时只有一个活动 owner；验证窗口内具备清晰回退路径。

## 20. Task 16：容量、成本与故障验收

**目标：** 用可重复测量证明“低配可运行”和“多节点可扩展”，并把百万用户拆成真实工作负载。

**Files:**

- Create: `scripts/benchmarks/multi-user-local.ts`
- Create: `scripts/benchmarks/multi-user-platform.ts`
- Create: `scripts/benchmarks/multi-user-faults.ts`
- Create: `scripts/benchmarks/fixtures/multi-user-workloads.ts`
- Create: `docs/reports/2026-08-16-multi-user-runtime-capacity.report.md`
- Modify: root `package.json`
- Modify: `docs/USAGE.md`
- Modify: `packages/nextclaw/resources/USAGE.md`

**冻结的测量维度：**

```text
R = registered spaces
D = daily active spaces
C = authenticated concurrent connections
Q = API requests/second
S = run starts/second
A = active agent runs
E = emitted events/second
B = stored bytes and daily growth
```

`B` 必须进一步拆为 structured records、Blob、Workspace、Search derivative、package cache、log/trace 和 backup bytes；不能只看 PostgreSQL 大小。另行记录 live connection、open FD、active process/Sandbox、secret handle 和各类 provider client 数量，避免数据库指标掩盖其它资源瓶颈。

**首轮验收工作负载：**

| Profile | 注册/冷 Space | 在线连接 | 活跃 Run | 用途 |
| --- | ---: | ---: | ---: | --- |
| Tiny | 1 / 100 个顺序激活 | 1 | 1 | 1C1G、2C2G 单节点 |
| Isolation | 1,000 | 100 | 20 | 高碰撞 ID 和 Noisy Neighbor |
| Scale-1 | 1,000,000 | 20,000 | 1,000 | 百万注册用户参考容量，不等于百万并发 |
| Fault | 100,000 | 5,000 | 300 | 节点、DB、Blob 故障和滚动升级 |

数值是第一轮容量模型，不是未测即承诺的 SLA；若产品目标改变，先改 workload fixture 和预算，再改架构。

**Tiny 初始预算：**

- 不运行本地模型、浏览器集群、PostgreSQL、S3 或容器编排器。
- Local `NextclawData` 只做静态 route + typed call，不增加网络请求、重复序列化或 per-Space placement row；
- 未配置的 PostgreSQL/S3/remote/sandbox provider 不加载 SDK、不创建 client/连接池/timer/process；单 Space 仍只有一组 Manager、一个有效 Config view、现有场景所需的 Provider client 和 Session runtime，不因抽象层复制。
- 空闲时零 per-Space process、watcher、database connection 和 timer。
- 单节点默认全局一个活跃 Run、每 Space 一个活跃 Run；其余排队。
- 当前单用户基线是相对硬门槛，256 MiB 只是绝对上限而不是可消费预算；改造后稳定 idle、基础聊天和单 Run 超出基线测量噪声即视为回归，不能因为仍低于 256 MiB 而放行。
- 改造后不得提高最低 CPU/内存 VPS 档位；若同档机器无法完成升级前已经支持的场景，M1-M4 不得完成。
- 100 个 Space 顺序激活并回收后，steady-state RSS 相对单 Space 增量目标不高于 32 MiB。
- 1 GiB 环境在压力下应通过 admission 拒绝新 Run，不得由 OOM killer 决定行为。

**平台初始效率预算：**

- 冷 Space 的应用内存成本近似 0；注册用户主要产生数据库行和 Blob。
- provider client/connection pool 数量与 runtime × provider/location 相关，不与 Space 总数相关；placement cache 必须有硬上限。
- Gateway API QPS、Worker Run 吞吐分别随各自节点增加，在下游瓶颈前应近线性增长；对应维度 2 节点相对 1 节点不少于 1.7 倍，4 节点不少于 3 倍。
- records 增加 shard 后能够迁入更多 virtual partition 或热点 Space，并提高存储容量/吞吐；不能要求修改 Kernel/Manager 或资源 ID。
- Workspace 容量报告同时计算实际 bytes、文件/inode、热数据比例、冗余/快照/余量和冷层；并发使用 `min(worker slots, safe IOPS / ops-per-run, safe bandwidth / throughput-per-run, write lease slots)`，不能把 virtual partition 数当成吞吐证明。
- Scale-1 增加一组可复算参考：平均 100 MB、100 个持久文件时，百万 Space 为约 100 TB/1 亿文件；以 2.5 倍低基线估算约 250 TB 物理预算。该数字只作为 fixture，报告必须用真实分位分布和 provider benchmark 替换或确认。
- package cache、venv、`node_modules`、编译 cache 和 Run 临时文件分别归 Deployment/Space Environment/Run Temporary，默认不计入持久 Workspace snapshot；否则单测必须单独报告 inode 与备份成本。
- 任一 Space 超配额只影响该 Space；其它 Space API/queue p95 退化不超过冻结阈值。
- 报告必须分开基础设施成本、模型 token 成本、Sandbox 执行成本、存储与出口成本。

**步骤：**

1. 基准脚本通过公开 API/Ingress 运行，不直接调用 Store 制造虚假吞吐。
2. Tiny 在与 Task 1 相同的真实 1C1G 和 2C2G Linux VPS 运行启动、登录、100 轮会话、一次 mock/远程模型 Run、Cron、重启恢复和内存回收；比较 RSS/heap、CPU、FD、子进程、timer 和已加载 provider 模块。
3. Isolation 使用重复 ID、热点 Space、慢消费者、大附件和长队列，测隔离与公平性。
4. Scale-1 先预置一百万冷 Space，再逐步增加 C/Q/S/A；记录 Gateway、Worker、PostgreSQL、Blob、placement cache hit/miss、control store QPS 和模型 API 各自饱和点。
5. 分别执行四个独立 scale test：只增加 Gateway 测 API/连接，只增加 Worker 测 Run，只增加 records shard 并迁移 virtual partition 测结构化数据容量，只增加 Workspace storage shard 并迁移 virtual partition 测 bytes/inode/IOPS 与 Worker locality；不能一次同时增加全部资源来掩盖真实瓶颈。
6. Fault 注入 Worker kill、Gateway kill、DB failover、lease expiration、event replay、Blob timeout 和滚动版本混跑。
7. 记录 p50/p95/p99、错误率、queue lag、lease conflicts、RSS/heap、CPU、DB connections、provider client 数、placement cache 大小、open FD、active process/Sandbox、structured/Blob/Workspace/Search bytes、IO、bytes/user 和 cost/run。
8. 任何未达到预算的结果写成明确 gap 与下一步，不用平均值掩盖 tail latency。

**验证：**

```bash
pnpm benchmark:multi-user:local
pnpm benchmark:multi-user:platform
pnpm benchmark:multi-user:faults
```

**完成标准：** 容量报告能回答一台低配 VPS 的功能边界、每种节点的单位吞吐和成本、百万注册 Space 下的冷数据成本、扩容曲线及首个瓶颈；在此之前不对外宣称“支持百万用户”。

## 21. Task 17：最终端到端验证、Review 与文档收口

**目标：** 证明没有遗漏无 Space 状态入口、没有形成双架构，并给 operator 一条可执行部署路径。

**Files:**

- Modify: `docs/designs/2026-08-16-multi-user-scalable-runtime.design.md`
- Modify: `docs/USAGE.md`
- Modify: `packages/nextclaw/resources/USAGE.md`
- Modify: `packages/nextclaw-core/src/features/agent/shared/skills/nextclaw-self-manage/SKILL.md` 及适用 reference
- Create: `docs/reports/2026-08-16-multi-user-runtime-validation.report.md`
- Modify: 受影响 package 的合同测试和 package API exports

**最终审计：**

1. 全仓检索无参数 `loadConfig()`、只按 `sessionId`/`assetId` 的全局 Map、固定个人路径、无 Space async record 和 UI-all event 权限。
2. 检查所有 HTTP、SSE、WebSocket、Channel、Cron、Panel bridge、Extension 和恢复入口的 Space 来源与授权证据。
3. 检查所有 Space owner 的 list/get/update/delete/export 路径是否使用相同 owner 条件，尤其防止 list 过滤但 get/delete 漏过滤。
4. 检查日志、metric、trace、audit 是否包含可归因的不可逆 pseudonymous Space key，且不泄漏凭据和内容。
5. 运行 diff-only maintainability review，确认没有 per-Space Manager tree、通用 scope wrapper、local/cluster 业务分支或重复 provider owner。
6. 对 public package exports 和 TypeScript 运行链路执行匹配范围 `tsc`。
7. 文档只描述一套架构：单节点是所有角色同机、使用 local provider；多节点是角色复制/分置、使用 shared provider。
8. 根据实际验证结果更新设计文档的待 Review 项、容量边界和决策记录，不倒写未经验证的承诺。
9. 全仓检索 `isAdmin`、`role === "admin"`、无 target 的全局文件 root 和 Store bypass；管理员能力只能存在于 Access/Server/maintenance 授权边界，不能进入普通数据 owner。
10. 对 Skill/App/Provider/MCP/Extension 逐项证明 Definition 可共享、Binding 按 Space、Instance 按 Run/lease；全局 package 的用户 data 和 credential 不得落入 deployment-global 路径。
11. 审计 package/import 方向：Kernel Manager、Controller、UI 不得导入 concrete provider SDK、provider descriptor、placement/epoch/lease/mount/node 类型；Manager 只注入自己使用的 typed sub-port，不取得整个基础设施 facade。
12. 检索 `isCluster`、`shardId`、`providerLocation`、bucket/volume 和节点判断在上层的泄漏；只允许出现在明确的 data/runtime/execution infrastructure owner。若独立增加 Gateway、Worker、records shard 或 Workspace shard 需要修改 Kernel/Manager/API，M4/M5 不得通过。

**最终验证矩阵：**

```bash
pnpm lint
pnpm -C packages/nextclaw-shared test
pnpm -C packages/nextclaw-core test
pnpm -C packages/nextclaw-kernel test
pnpm -C packages/nextclaw-server test
pnpm -C packages/nextclaw-service test
pnpm -C packages/nextclaw-ui test
pnpm tsc
pnpm -C packages/nextclaw-service exec vitest run src/stores/postgres/postgres-runtime-providers.integration.store.test.ts src/stores/s3/s3-asset.store.integration.test.ts src/services/runtime/postgres-run-coordination.integration.service.test.ts
pnpm benchmark:multi-user:local
pnpm benchmark:multi-user:platform
pnpm benchmark:multi-user:faults
```

完整命令以实施时根 `package.json` 的真实 scripts 为准；不存在的聚合命令在 Task 16 中新增，不能把命令缺失当成验证通过。

**完成标准：** M1-M5 的证据、未验证项、容量上限、迁移/回滚路径和安全限制全部写入 validation report；任何个人状态链都能从 principal 一直追到 Store/Run/Event/Execution owner；Public API、Kernel 和 Manager 不感知物理拓扑，Local/Cloud/扩容只改变 typed port 以下的装配与 provider。

## 22. 演进依赖、Review 点和回滚边界

本节表达长期依赖关系，不是第一期执行批次。表内出现“某 Task 的一部分”只表示后续拆计划时的能力边界；不得据此直接创建跨 Task 大改。

### 22.1 推荐批次

| Batch | Tasks | 交付含义 | Review 后才进入 |
| --- | --- | --- | --- |
| B0 | 最小实施计划 Task 0-2 | 基线、当前管理员默认 Space、Ingress；可永久停留为行为不变的单用户产品 | B1 |
| B1 | 最小实施计划 Task 3-4 | Config 与文本 Session/Run/Event 分 owner 迁移和隔离；仍不开放第二用户 | B2 |
| B2 | 最小实施计划 Task 5-6 | Workspace/Skill 与用户管理合同的内部双 Space 验证；生产入口仍受发布 inventory 阻塞 | D1 |
| D1 | 本路线图 Task 9-11 的各独立 feature owner | Search、Asset、Project、Cron、Channel、App、MCP、Extension 等逐项完成隔离 | 按产品优先级逐项立计划 |
| D2 | 13 | 所有计划对普通用户开放的危险能力具备 Execution 隔离、Quota 和公平调度；未完成能力保持未授权 | R1 |
| R1 | 12 的产品入口放行 | 注册用户管理、第二用户登录和管理员 elevation；只进入已经闭合的产品面 | 单节点多用户 beta |
| D3 | 14-15 | 共享 provider、迁移和生命周期 | 多节点 beta |
| D4 | 16-17 | 容量、故障、Review 和文档 | GA 决策 |

### 22.2 每批硬规则

- 风险分类、影响和控制措施统一引用[运行时设计第 16 节风险总账](../designs/2026-08-16-multi-user-scalable-runtime.design.md#16-风险总账与控制措施)；每批必须列出适用风险、预防结构、验证证据、恢复 owner 和剩余风险。适用 P0/P1 未关闭时不得放行。
- 每批先写失败测试，再做最小实现，再运行定向 Vitest 与匹配 package `tsc`。
- 一次只切一个状态 owner；切换完成后删除旧活动路径，不保留长期双写。
- 数据格式变更由显式 migration reader 在 cutover 前读取旧版本并生成 canonical 数据；切换后 shipped runtime 只读新 owner，不保留旧版本 fallback。旧源只在有 owner、有保留期的 verification window 内只读保存。
- API breaking change 在同一批修改所有 repo 内调用点；不以可选 `spaceId` 长期掩盖遗漏。
- 任何 performance 优化不能放宽授权条件；任何兼容 fallback 不能跨 Space。
- 每批必须写明永久停在当前批次时的产品行为、未完成能力、唯一数据 owner 与恢复方式，并通过现有管理员回归；不能只做到“代码可编译”。
- 每批停在可独立审查、可独立发布的工作区状态；是否 commit、push、发布由用户另行授权。

### 22.3 最小第一刀

真正开始实现时，只执行最小实施计划的 Task 0-2，不同时改 PostgreSQL、Sandbox、Workspace 或所有 Manager：

1. 写双 Space 攻击型 fixture。
2. 加入 `SpaceId`、Identity/Space/Membership 和默认 Space。
3. 让 HTTP/WebSocket/Ingress 得到唯一 `spaceId`。
4. 用现有管理员单用户回归和内部双 Space Membership/入口测试验收。

这一步完成后，系统仍然是一个 Kernel、一个进程和现有本地 Store，对外仍只有当前管理员；没有 User provisioning、DataProviderRouter 或第二用户入口，但所有后续 owner 已拥有正确的身份和数据归属起点。

### 22.4 首版停止线

B2 完成后先停止并 Review 基础主链，但不能据此宣布多用户产品可用或注册真实第二用户入口。随后按 D1 逐个完成 Search、Asset、Project、Cron、Channel、Inbox、App、MCP、Extension 和 Service App 的 owner，并按 D2 关闭对外危险执行边界；发布 inventory 闭合后才进入 R1，注册用户管理与第二用户登录。宿主能力按相同 Space capability、mount 和 Execution provider 证据逐项放行。

## 23. 方案最终判断

- **能做到一套架构。** 单节点和多节点共享同一 Kernel、Manager、API、Space identity 和业务主链，变化只发生在 composition root 的 provider 装配与组件 placement。
- **只加 `spaceId`，但不能只改数据库。** 它使用零运行时成本 branded scalar，在认证入口解析，随后出现在状态 owner、异步 record、缓存 key、Event 和执行边界；纯 helper 和 UI payload 不机械感知。
- **不做 per-user Kernel。** 一个 runtime 进程只装配一个 Kernel；Space 只按需产生轻量 Store handle、cache entry 或 Sandbox task，并可回收。
- **不做多用户激活。** 所有安装默认拥有管理员 User/Space，旧数据归管理员 Space；新增用户只增加空 Space，不切模式、不重启、不按用户数量关闭功能。
- **数据层只有一个抽象。** `NextclawData` 组合 feature-owned typed ports；bootstrap control provider 承载 Identity/Provider Catalog/Placement，router 为 Space data 选择 Local、PostgreSQL、S3 等 provider；单节点只是 control 与各 Space domain 都落到 Local provider。
- **provider 必须可迁移。** 所有数据 provider 使用同一个 snapshot/batch/change/verify 传输合同；Space data 更新 placement epoch，control data 更新 bootstrap/leader owner；不建设两两迁移 adapter 或长期双写。
- **恢复是显式状态机，不是 fallback。** User/Space provisioning、旧数据迁移和 provider cutover 都有 versioned operation、单一 active owner、幂等 resume 与明确 cleanup；commit 后不扫描旧路径或盲目回滚覆盖新写入。
- **数据库不是资源总线。** PostgreSQL 只承担适合事务、约束、查询和协调的 records；Blob、Workspace、派生索引、live state、Execution、Secret、package、观测和备份由各自 provider/owner 承载。单节点不依赖外部数据库服务，但可以按需使用嵌入式 SQLite。
- **Workspace 单独 Scale。** 文件保留 POSIX 工作集语义，单节点落受管目录，多节点由固定 virtual partition 分散到多个 storage shard；Worker 按 placement/lease 获取当前 Space mount。数据库只存位置、配额、lease 和 snapshot ref，对象存储负责 snapshot/archive/cold tier，不创建一用户一 volume。
- **执行也只有一套主链。** 所有 Space 都由同一 Execution owner 解析 capability、mount、Environment、Credential、网络和预算；本地进程、OS principal、容器、MicroVM 或远程 Worker 只是 provider，不形成产品模式。
- **1C1G 与百万用户不矛盾。** 前者依靠 local provider、零冷用户常驻成本和严格 admission；后者依靠共享 provider、无状态 Gateway、弹性 Worker 与按需 Sandbox。两者不是两套产品。
- **单用户不能为未来规模预付资源税。** 可扩展模块按配置动态加载，Local route 是静态 typed call；改造后相同单用户场景必须保持原最低 VPS 档位，资源差异只允许落在预先冻结的测量噪声内。
- **复杂度必须后置。** 最小 typed data boundary 在基础批次建立，但 PostgreSQL/S3/lease/outbox 只在本地多用户合同稳定后加入，而且不泄漏到上层。Redis、Kafka、Kubernetes、独立 Search cluster 都不是首期前置条件。
