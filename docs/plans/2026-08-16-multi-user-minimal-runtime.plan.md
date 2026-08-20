# NextClaw 同构多用户运行时基础批次实施计划

> 状态：Draft v0.13，内部基础批次，不单独构成多用户产品发布
> 日期：2026-08-18
> 角色：同构多用户基础主链的可执行开发批次
> 上位功能：[NextClaw 多用户功能设计](../designs/2026-08-16-multi-user-functional.design.md)
> 上位设计：[NextClaw 多用户可扩展运行时初版设计](../designs/2026-08-16-multi-user-scalable-runtime.design.md)
> 长期路线图：[NextClaw 多用户可扩展运行时实施路线图](./2026-08-16-multi-user-scalable-runtime.plan.md)

**实施目标：** 在不复制 Kernel、不重写成熟本地 Store 格式、不开启第二套多用户模式的前提下，建立默认 Space、身份授权、文本主链、Workspace 和 Skill 的完整隔离闭环。

**实施架构：** Access 边界把认证 `userId` 解析为已授权 `spaceId`；Stateful Manager 只接收必填 `spaceId` 和自己的窄 typed port；Local provider 在端口后委托现有 Store，并把路径、缓存和迁移复杂度封装在数据层。Run/Event/恢复 record 显式持久化 `spaceId`，Execution owner 接收已经解析的 Workspace、Credential 和 capability snapshot。

**技术栈：** TypeScript、Hono、Vitest、现有 JSON/JSONL/SQLite/文件 Store、NCP Session Journal；基础批次不要求 PostgreSQL、S3、Redis、Kafka、Kubernetes 或容器平台。

## 1. 计划目的

本计划只负责基础批次：用尽可能小、可审查、可回滚的改动，建立默认管理员 Space、身份入口、文本主链和受管 Workspace 的 Space 归属。

这个批次可以在开发和测试环境中使用双 Space fixture 证明主链，但不能单独作为“多用户版”发布。Search、Asset、Project、Cron、Channel、App、MCP、Extension 等现有个人 feature 必须按完整路线图完成自己的 Space owner 后，产品版本才满足上位功能设计的同构合同。

基础批次遵守以下约束：

- 一个逻辑 Kernel，不创建 per-user Kernel、scoped Kernel 或 per-Space Manager 树；
- 单用户和多用户使用同一条业务主链，不维护两套产品架构；
- `spaceId` 只出现在认证入口、状态 owner、异步 record 和执行边界；
- `userId` 只表达认证与审计 actor；Authorization 使用 `userId + spaceId`，状态 Manager 和 Store 只接收已授权 `spaceId`；
- 尽量复用现有 Manager、Store、Config schema、Session Journal 和 Skill scope；
- `nodes = 1、spaces = 1` 不增加第二组 Manager、完整 Config、Provider client、Watcher、连接池、timer 或进程；改造后不得提高现有单用户最低 VPS 档位；
- 改动规模与安全能力同步增长，不能用共享数据 fallback、用户数量分支或功能模式切换维持表面功能完整。

## 2. 基础批次边界

### 2.1 本批次完成

| 能力 | 基础批次语义 |
| --- | --- |
| 身份与登录 | 当前管理员稳定映射到默认 Personal Space；内部双 Space fixture 与用户管理合同可验证，真实第二用户入口最后放行 |
| 文本会话 | Chat、Session、Run 和 Event 全部归属一个 `spaceId` |
| Agent / Provider 配置 | 管理员 Model Offering 与 Space Private Provider 同时可用，来源和 Credential owner 显式 |
| 工作目录 | 每个 Space 只访问自己的 managed workspace |
| Skill | builtin、管理员提供的 deployment-global Skill、Space 私有 Skill |
| 管理员维护 | 显式选择目标 Space、短期提权、全量审计；先提供 CLI/API |

### 2.2 后续 owner 批次

以下能力继续按完整路线图改造；未完成只表示后续开发批次，不形成运行时产品状态：

- Session Search；
- 附件、Asset 和 Project 数据接口；
- Cron、个人 Channel、Inbox background delivery；
- App Data、App Grant、Service App；
- MCP、第三方 Extension；
- 任何仍依赖 deployment-global 可变 Store 或进程级单例缓存的个人功能。

每个 owner 可以独立实现和 Review，但正式多用户发布前必须闭合已纳入产品的 owner inventory。开发中的未完成状态不得依据用户数量改变当前正式产品行为。

Shell、浏览器、stdio MCP、Extension process、Service App action 和任意宿主路径不属于这一数据 owner 清单；它们统一由 Execution owner 根据 Space capability、显式 host mount、Credential、网络和资源预算解析 Execution Plan。管理员旧 Space 可以迁移现有 `process.execute` 和 host mount 范围，新 Space 默认只有 `workspace.files`；这里没有单 owner/多用户或 trusted-host/sandboxed 模式。

### 2.3 无模式切换

现有单用户安装升级后自动解析到管理员默认 Space。新增用户只增加 User、Space 和 Membership：

- 业务代码不增加 `embedded` / `cluster` 分支；
- 不增加 `multiUserActivatedAt`、activate 命令或安全模式 marker；
- 创建用户不重启 Deployment；
- capability 来自目标 Space 的配置、grant 和 provider，不来自 enabled User 数量；
- 旧个人数据和现有授权只迁移到管理员 Space，新 Space 不继承。

### 2.4 可停止阶段合同

本计划的 Task 是可独立发布检查点，不是必须一次完成的大改造。任何 Task 结束后，即使永久停止后续实施，也必须满足：

1. 现有管理员继续使用升级前已经支持的功能、数据和入口，不依赖未来 Task 才能恢复正确行为；
2. 本 Task 触达的状态 owner 已一次性闭合入口、Manager、Store/Cache、Async record、Event、恢复和越权测试，不能留下“接口已加 `spaceId`、实际 Store 仍全局”的半迁移状态；
3. 尚未进入本 Task 的 owner 继续以升级前单用户路径作为自己的唯一活动实现，不把它伪装成已支持多用户，也不建立新旧双读、双写或 fallback；
4. 真实第二用户的创建和登录入口保持不可交付，直到当前产品发布 inventory 中所有可达个人 owner 和所需 Execution 边界全部闭合；开发测试只能使用进程内 fixture 或受控测试数据；
5. 迁移 commit 前旧源是唯一事实，commit 后新 Space owner 是唯一事实；中断能够幂等继续或清理未提交 staging；
6. 单用户回归、双 Space 攻击型测试、适用的 crash injection、`tsc` 和低配资源 ratchet 全部通过。

这个合同不增加 `multiUserEnabled`、用户数量判断或另一套运行模式。默认管理员从第一阶段起就走统一 Space 主链；用户管理入口最后交付只是能力放行顺序。

“可停止、无损”不等于 commit 后产生新写入仍可以任意降级旧二进制。此时标准恢复是向前修复，或使用明确时间点备份并接受其数据边界；禁止为了伪造任意回滚能力引入长期双写。

完整风险分类、影响、预防、检测和恢复措施以[运行时设计第 16 节风险总账](../designs/2026-08-16-multi-user-scalable-runtime.design.md#16-风险总账与控制措施)为唯一 owner。每个 Task 开始时选择适用风险，结束时逐项记录关闭证据；适用 P0 未关闭时不得进入下一 Task 或放行第二用户入口，适用 P1 未关闭时当前 Task 不得结束。

## 3. 最小稳定合同

### 3.1 只新增一个领域隔离标识

```ts
declare const spaceIdBrand: unique symbol;

export type SpaceId = string & {
  readonly [spaceIdBrand]: "SpaceId";
};
```

不新增 `KernelIdentifiers`、`ExecutionScope` 或通用 context wrapper。已有 `userId`、`sessionId`、`runId`、`requestId` 保持各自语义。

`userId` 不作为个人数据隔离键：Access owner 用它查询 Access Session 和 Membership，得到已授权 `spaceId` 后，Session、Config、Workspace、Cache、Run 和 Event 主链不再继续传 `userId`。第一版的一 User 一默认 Space 不能写死为 `userId === spaceId`。

### 3.2 同步调用复用现有载体

```ts
export type IngressContext = {
  source: string;
  token?: string | null;
  spaceId?: SpaceId;
};
```

HTTP / WebSocket 入口从已认证 principal 解析 `spaceId`。进入第一个个人状态 owner 后，`spaceId` 必填；缺失时失败，不能回退到旧全局目录。

### 3.3 异步归属写入既有 record

Run、Event、恢复记录和任何脱离请求栈继续执行的数据都直接增加 `spaceId`。不使用 `AsyncLocalStorage` 或进程全局“当前用户”隐式传播。

```ts
type SpaceRunRecord = {
  spaceId: SpaceId;
  triggeredByUserId?: string;
  sessionId: string;
  runId: string;
};
```

`spaceId` 对所有 Space 级异步工作必填；`triggeredByUserId` 仅用于审计，可以在 Cron、恢复或系统 maintenance 工作中缺失，不能作为重新获得数据访问权的依据。

### 3.4 管理员不是数据层 bypass

认证层输出普通访问上下文或限时管理员提权上下文：

```ts
type AccessPrincipal = {
  userId: string;
  deploymentRole: "user" | "admin";
  defaultSpaceId: SpaceId;
};

type AdminElevation = {
  targetSpaceId: SpaceId;
  reason: string;
  issuedAt: string;
  expiresAt: string;
};
```

提权完成后，Kernel、Manager 和 Store 只接收目标 `spaceId`，不接收 `userId`、`isAdmin`，也不实现跨 Space 查询。所有管理员访问至少记录 `actorUserId`、`targetSpaceId`、reason、时间、动作和结果。

### 3.5 用户创建 preflight

创建用户前执行无状态校验：管理员认证已配置、管理员 Space 迁移完成、当前发布要求的个人 feature 都有 Space owner、新 Space 默认 grant 满足 Deployment policy。校验只返回通过或阻塞项，不持久化模式，不停止组件，不改变已有 Space 的 capability。

创建 User、默认 Space、owner Membership、默认 Config 和受管目录必须是一个原子产品操作；物理实现使用 4.4 的可重入 provisioning 状态机，不假设跨文件事务。失败时 User 不可见且可以继续或清理，成功后无需重启即可登录。

## 4. 第一版本地数据布局

```text
<NEXTCLAW_HOME>/
├── config.json                         # deployment config 与单用户迁移源
├── access/
│   ├── identities.json                 # users, spaces, memberships
│   ├── access-sessions.json
│   └── deployment-audit.jsonl
├── skills/packages/                    # deployment-global Skill，用户只读
├── spaces/
│   └── <spaceId>/
│       ├── config.json                 # 复用现有 ConfigSchema 的 Space 配置快照
│       ├── workspace/
│       │   └── .nextclaw/skills/       # Space 私有 Skill
│       └── sessions/                   # 复用现有 Journal / metadata 格式
└── migrations/
    └── personal-space-v1.json
```

本批次只创建主链需要的布局；后续 owner 批次增加 assets、projects、cron、app-data 等 Space 目录。它们属于同一最终布局，不由运行模式决定。

本地 access、Space config 和 credential 文件默认使用仅运行用户可读写的权限，Space 目录不对其它系统账号开放。这里保护的是 NextClaw 用户之间的产品隔离；拥有宿主 root、进程调试或磁盘读取权限的 Host Operator 位于应用信任边界之外。

本批次的 Local provider 不要求外部数据库服务，也不把所有资源改写成 SQLite：

| 资源 | 本批承载 | 边界 |
| --- | --- | --- |
| Identity / Membership / Access Session | `access/` 下 JSON/JSONL Store | 后续可由同一 typed control port 换成嵌入式 SQLite 或共享事务 provider |
| Space Config / Session Journal | `spaces/<spaceId>/` 下现有 JSON/JSONL/文件 Store | 是标准事实；按 Space 分区并 fail closed |
| Workspace / Skill files | Space 受管目录和 deployment 只读 package 目录 | 文件内容不进入关系数据库；执行时只挂载已授权目录 |
| Session Search | 保留现有按需 `session-search.db` | 它是可重建派生索引，不是 Session source of truth |
| Live Run / Event / client | 进程内对象 | 不持久化 live handle；异步 record 只保存恢复所需事实 |
| Secret | 权限受保护的本地文件/现有 secret Store | 普通 Config/records 只保存引用或按现有迁移合同保护，不新增明文复制 |
| Execution | 本地 Execution provider 按 Run 使用进程、临时目录和 workspace | 数据库只记录归属、结果和审计，不承载执行资源 |

这里的低配合同是“无 PostgreSQL/Redis/S3 等外部服务依赖”。不把“完全禁止 SQLite”设为目标：当前 Search 已使用嵌入式 SQLite，为消除它而自研索引和崩溃恢复会扩大改动与风险；未使用 Search 时应按需打开并释放相关资源。

### 4.1 Config 的最小改法

基础批次不拆出一套全新的 `DeploymentConfig` / `SpaceConfig` 类型体系，也不重写所有 Config 消费者：

1. 继续使用现有 `ConfigSchema` 和解析逻辑；
2. 根 `config.json` 是迁移源，并继续保存 deployment-owned 字段；迁移验证成功后，个人字段只保留 schema 所需的空值或默认值，不保留旧用户 secret/config 作为 fallback；
3. 每个 Space 保存一份现有 schema 可解析的配置快照；
4. `ConfigManager.getResolvedConfig(spaceId)` 读取 Space 快照，再用根配置覆盖 deployment-owned 字段；
5. 第一批只让 Agent、Provider、Skill 和文本会话主链使用 resolved config；
6. 尚未迁移的配置消费者不能进入多用户产品发布；基础批次不为它们增加按用户数量判断的运行时分支。

deployment-owned 字段列表必须是一个集中白名单，不允许在不同 Manager 内分别手写合并规则。

模型配置不使用通用 deep merge：根 Config 保存 Deployment Model Offering、默认/锁定策略和 shared secret ref；Space Config 保存 BYOK binding、Private Provider 和 Space 默认 Model Ref。Resolver 产出带明确 `deployment | space` 来源和 Credential owner 的 snapshot。

### 4.2 Store 的最小改法

- 基础批次建立最小 `NextclawData` 边界，首批只组合 Access、Config、Session 等本批真实使用的 typed repository ports；Access 属于 bootstrap control port，Config/Session 属于 Space ports；
- 不提供通用 `SpaceStore`、`get(kind, key)` 或 JSON CRUD；每个 feature 继续拥有业务 schema、事务和错误语义；
- Manager 构造时只注入自己需要的 typed port，不接收整个 `NextclawData`，也不读取 provider 类型或物理 placement；
- `LocalDataProvider` 通过小型 adapter 委托现有 Store；其中 Space ports 使用路径解析器和 `spaceId`，control ports 使用 deployment bootstrap 路径，不重写现有 JSON、JSONL、SQLite 和文件格式；
- adapter 可以有有界缓存，但 cache key 必须包含 `spaceId`，并在 Space 删除/迁移、配置重载、placement epoch 变化、进程关闭和测试 teardown 时释放；User 禁用只撤销该 User 的认证与连接，不作为 Space 数据 cache 的 owner 生命周期；
- 后续 feature 只在自己进入 owner 改造时增加对应 typed port；PostgreSQL、S3 等 provider 实现相同端口，不改变 Manager 调用面。

### 4.3 低缺陷、低侵入实现策略

实现采用“类型收窄 + 单一路径 + 纵向闭环”，不依赖后续排查弥补结构缺陷：

1. **`SpaceId` 是带类型区分的标量，不是 Context 对象。** 运行时仍是字符串，没有额外对象和内存成本；TypeScript 不允许把普通 `userId` 或任意字符串直接传给 Space Store。
2. **入口可选，状态边界必填。** `IngressContext.spaceId` 因 deployment 事件允许缺失；`SessionManager`、`SpaceConfigRepository`、Cache、Run、Workspace 等 Space owner 只提供必填 `spaceId` 签名，不保留无 Space overload。
3. **授权与数据访问分两步。** Access owner 使用 `userId + targetSpaceId` 校验 Membership/elevation，只返回一个已授权 `SpaceId`；Controller 只透传，Manager/Store 不接收 principal、role 或 `isAdmin`。
4. **复用 Store，不复用全局路径。** Local provider 继续调用现有 JSON/JSONL/SQLite/Journal 实现，但每次先在数据层解析目标 Space 的受管 base path；Manager 不拼路径、不选择 provider。
5. **一次只闭合一个纵向 owner。** 一个批次同时完成入口、Manager、Store/Cache、Async record、恢复和攻击型测试；禁止只给数据库加字段后把 Event、Queue 或缓存留到以后。
6. **公开用户管理最后放行。** 默认管理员 Space 和双 Space fixture 可以先存在于开发链；创建第二个真实用户的 CLI/API 只有在当前产品 owner inventory 全部闭合后才对外可用，不增加用户数量模式开关。
7. **没有静默 fallback。** 缺少 Space、无 Membership、迁移不完整、provider 不可用或记录版本不兼容都显式失败；运行时不扫描旧目录、不尝试 global default、不在新旧 Store 之间自动切换。

基础类型使用 3.1 的 branded `SpaceId`，并只提供一个规范解析入口：

```ts
export function parseSpaceId(value: string): SpaceId;
```

`parseSpaceId` 只验证格式和规范表示，不授予权限。只有 Access/Membership resolver 可以把外部 target 解析为本次请求的已授权 `SpaceId`。状态方法直接使用标量参数：

```ts
sessionManager.getSession(spaceId, sessionId);
sessionStore.read(spaceId, sessionId);

// 禁止保留：
sessionManager.getSession(sessionId);
sessionStore.read(sessionId);
```

`NextclawData` 只在 composition root 组合端口；Manager 构造时获取自己的 `SessionRepository`、`SpaceConfigRepository` 等窄接口，不接收整个数据对象。`LocalDataProvider` 只有在确实拥有 lazy Store handle、有界缓存和 dispose 生命周期时才实现为 class service；如果只是确定性装配，则直接留在 `NextclawKernel` composition root，不新增无状态 wrapper。

### 4.4 崩溃一致性与恢复主链

恢复只集中在两个显式流程 owner，不把重试散落到 Controller、Manager 和 Store。

#### User / Space provisioning

“创建 User、默认 Space、Membership、Config 和目录原子成功”是产品可观察合同，不假设 JSON 文件与文件系统目录具有跨资源事务。实现使用可重入 provisioning record：

```text
prepare
  -> materialize-space
  -> verify
  -> commit-access-state
  -> ready
```

- `prepare` 一次生成稳定 `operationId/userId/spaceId`，重复执行不重新生成 ID；
- User 在 `ready` 前不出现在普通登录和用户列表中；
- Config、目录和默认 grant 使用 create-if-absent + expected owner/version，重试不会覆盖已有其它 Space；
- `commit-access-state` 原子写入 User、Space、Membership 和 ready 状态；
- 进程在任一步崩溃后，启动恢复只允许“继续同一 operation”或“清理本 operation 新建且尚未提交的资源”，不能猜测成功；
- 禁用 User 只撤销认证与连接，不删除 Space，也不触发 Space 数据回滚。

#### 旧单用户数据迁移

旧路径承载真实用户数据，因此允许作为有退出条件的迁移源；它不是运行时兼容路径。状态机固定为：

```text
planned
  -> copied
  -> verified
  -> committed
  -> cleanup-eligible
```

- Gateway/Kernel 尚未开始个人状态服务时取得单实例 migration lock，并先写 versioned inventory/operation record；
- 只复制到同文件系统 staging 目录，不移动或修改旧源；每类数据记录 count、bytes、关键 ID、schema/version 和 checksum；
- `verified` 前失败直接丢弃/隔离 staging，旧源仍是唯一事实；
- 通过验证后 atomic rename 到 canonical Space root，再原子推进 marker 到 `committed`；崩溃发生在 rename 与 marker 之间时，通过 operation ID、target manifest 和 checksum 完成同一 cutover，不能重新复制成第二份 owner；
- 只有 `committed` 后才构造读取个人状态的 Manager；此后运行时只读写 Space 路径，不回退旧目录；
- 旧源在明确保留期内只读保存并标记 migration source，由 Migration owner 清理。发生新路径写入后不允许简单把 pointer 切回旧源，因为那会丢失新写入；此时恢复采用修复后向前继续，或依据明确备份/导出执行人工恢复；
- migration read/status 是纯读，resume/rollback/cleanup 是显式 action，页面轮询或启动状态查询不能暗中执行迁移。

必须在测试中对 provisioning 和 migration 的每个状态转换注入崩溃，至少证明：重复启动结果一致、没有两个 active owner、不会出现可登录的半成品 User、旧数据在 commit 前始终可恢复、commit 后运行时不会读取旧路径。

## 5. 实施任务

每个任务必须单独形成可审查 diff；前一任务未通过退出条件，不进入下一任务。

每个 Task 使用相同的实施节奏：

1. 用 `rg` 做该 owner 的 producer/owner/consumer 双向调用图审计，并更新触达文件；
2. 从风险总账选择本 Task 适用的 P0/P1/P2，写明预防结构、验证入口和故障恢复 owner；
3. 先写同 ID 双 Space、缺失 Space、越权和恢复失败测试，确认它们在改造前按预期失败；
4. 先修改 typed contract，让遗漏调用点通过 `tsc` 暴露，再实现最小 Local adapter 和状态 owner 改造；
5. 运行本 Task 定向测试和所有受影响 package 的 `tsc`；
6. 运行一次 diff-only maintainability Review，确认没有旧 overload、global fallback、per-Space Manager 或 provider 词汇上浮；
7. 写明“如果永久停在本 Task”的运行状态、未完成能力、唯一数据 owner、故障恢复方式和适用风险关闭证据；
8. 只形成可审查 changeset；未经用户明确授权不 commit、push、发布或部署。

### Task 0：冻结基线与失败合同

**目标：** 在改代码前证明当前单用户行为，并先写清多用户必须失败的路径。

**工作：**

- 记录单用户登录、创建会话、重启恢复、Agent 运行、Skill discovery 的定向基线；
- 在同一 1C1G/2C2G 环境重复记录稳定 idle、基础聊天和单次 mock/远程模型 Run 的 RSS/heap、CPU、FD、子进程、timer 与已加载可选模块，并在改造前冻结测量噪声；
- 列出所有会进入个人数据或 host capability 的 HTTP / WebSocket 路由；
- 在合同中预留稳定错误码 `SPACE_CONTEXT_REQUIRED`、`CAPABILITY_NOT_GRANTED`、`CAPABILITY_RUNTIME_UNAVAILABLE` 和 `FEATURE_SPACE_OWNER_REQUIRED`；只有首个真实调用方所在 Task 才加入生产枚举和处理分支；
- 写攻击型测试清单：猜测另一个 Space 的 ID、Session ID、事件 cursor、文件路径均不得成功；尚未开始空间化的 owner 以 contract/todo 保存，不把预期失败测试留在必跑 CI；
- 定义结构性 ratchet：某个 owner 一旦进入改造，其 Store/Manager 状态方法不得使用 `userId`、`isAdmin` 或通配 Space 作为数据 owner 条件；Task 0 不对尚未改造的现有代码制造失败检查；
- 确认 migration 输入目录、pre-commit 自动恢复边界，以及 commit 后已有新写入时只能向前修复或显式从备份恢复的数据损失边界。

**退出条件：**

- 基线测试可重复；
- 当前发布要求的 Space owner inventory 有唯一清单；
- 任何未分类入口都视为阻塞项，不允许默认放行；
- 必跑测试全部为绿，生产代码、数据布局和用户行为没有变化。

### Task 1：Space 类型、当前管理员与默认 Space

**目标：** 只让当前安装拥有稳定的 User、默认 Space 和 Membership，并建立唯一的认证到 Space 解析起点；不在本阶段创建或开放第二个真实用户。

**工作：**

- 新增 `SpaceId`、User、Space、Membership 和 access session 持久模型；
- 只建立本阶段实际使用的 `SpaceAccessRepository` 与本地装配；`NextclawData` 在 composition root 只是 typed ports 的组合概念，不新增万能类或无状态 wrapper；
- 本阶段只有 Local provider，不实现 `DataProviderRouter`、placement、PostgreSQL/S3 client 或未来 feature 空端口；出现第二个真实物理 provider 时再在 typed port 以下增加路由；
- 迁移现有本地管理员为一个 User、一个默认 Space 和 owner Membership；
- 认证完成后生成 `AccessPrincipal`，由 access owner 解析默认 `spaceId`；
- 旧认证 session 升级后仍映射到同一个管理员和默认 Space，现有登录、登出和密码行为不变；
- 用内部双 Space fixture 验证 Membership resolver，但不注册 create-user、target-space elevation 或第二用户登录入口。

**约束：**

- 第一版保持一 User 一默认 Personal Space，但持久模型不能写死 `userId === spaceId`；
- 不支持公开注册、组织、邀请、SSO 和协作 Space；
- 不新增管理员数据访问分支到 Kernel / Manager / Store；
- User provisioning 和管理员跨 Space elevation 的产品入口延后到 Task 6，并受完整 owner inventory 放行门槛约束。

**退出条件：**

- 新安装、无密码旧安装和有密码旧安装都得到稳定默认 Space，重启后 ID 不变化；
- 当前管理员登录、登出、密码和已有个人功能回归通过；
- 双 Space fixture 的 Membership 解析不会混淆 `userId` 与 `spaceId`；
- 没有第二用户可登录入口、第二个 Kernel、DataProviderRouter 或新增常驻 provider 资源。

### Task 2：HTTP、WebSocket 与 Ingress 的 Space 透传

**目标：** 只让现有个人请求和连接携带服务端解析出的默认 Space，不在本阶段提前建设 capability 系统或第二用户管理面。

**工作：**

- request context 保存 `AccessPrincipal` 和已授权 `spaceId`；
- 客户端首期不提交任意 `spaceId`；Task 6 达到放行条件后提供的管理员 elevation endpoint 是唯一显式 target-space 入口，本 Task 停止时该入口可以尚不存在；
- `IngressContext` 增加可选 `spaceId`，个人 handler 首行调用 `requireSpaceId()`；
- WebSocket / Event Stream 在连接时绑定 principal 和 Space，不接受订阅另一个 Space；
- auth status 只增加当前管理员的非敏感 Space 摘要，现有 UI 和密码行为保持不变；
- 本 Task 只实际加入 `SPACE_CONTEXT_REQUIRED`；`CAPABILITY_NOT_GRANTED` 和 `CAPABILITY_RUNTIME_UNAVAILABLE` 分别由 Task 5/6 的首个真实调用方引入。

**退出条件：**

- 缺失 Space 的个人请求全部失败；
- 修改 URL、body、header 或事件 cursor 不能切换 Space；
- 单用户基线仍走相同 handler，没有复制一套多用户 controller。

### Task 3：Config owner 的默认 Space 迁移与隔离

**目标：** 只闭合 Config/Credential/Model owner：把现有个人配置迁入默认 Space，并使 Agent / Provider / Skill 读取目标 Space 配置；Workspace 和 Session 在各自后续 Task 前继续使用原单用户 owner。

**工作：**

- 新增集中 `kernel-storage-paths` 的 Config 路径解析，只负责从明确的 `spaceId` 解析本 Task 实际使用的受管目录；
- Config migration 先盘点、再复制、校验、最后原子写 domain marker；中断后可继续或清理未提交 staging；
- 只迁移根 Config 中的个人字段；deployment-owned 字段保留在根 Config，Workspace 和 Session 数据不在本 Task 搬迁；
- 完成校验后再清理根配置中的个人值；受限 migration snapshot 只用于 pre-commit 自动恢复或显式灾难恢复，任何运行时读取都不得回退到它；commit 后已有新写入时不能用旧 snapshot 做无损回滚；
- ConfigManager 增加 `getResolvedConfig(spaceId)` 与 Space 写入入口；
- 为 Config 增加 `SpaceConfigRepository` typed port；Local 实现继续读写现有兼容配置快照，不让 ConfigManager 拼路径或读取 provider kind；
- 单 Space 下只保留一个有效 Config view；Deployment/Space 分层使用按需解析和结构共享，不在内存中复制两份等价完整 Config；
- 使用集中白名单覆盖 deployment-owned 字段；
- 增加 Model Offering resolver：支持 Deployment Shared、Deployment BYOK Template 和 Space Private Provider；Model Ref 有歧义时失败；
- Shared Credential 不复制进 Space Config，Space BYOK 不进入 Deployment Config；删除 Offering 或 Credential 失效时不跨来源 fallback；
- 旧 Provider/Model/Credential 迁移为管理员 Space Private Provider；显式 publish 才创建 Deployment Shared Offering 或 BYOK Template，不能自动把原 Key 暴露给新 Space；
- 配置 watcher 只监听当前活跃或最近请求使用的 Space，不为所有注册用户常驻 watcher；
- 配置写入后只失效目标 Space 的缓存。

**退出条件：**

- 旧安装升级后个人配置、历史文本会话和原工作目录都仍可见；其中 Config 已使用新 Space owner，Session/Workspace 仍各自使用唯一的原单用户 owner，不存在双读或 fallback；
- 两个 Space 使用相同 Agent / Provider ID 仍读取各自配置；
- 两个 Space 可以共同使用一个 Deployment Shared Offering，但 Usage/Quota 分别归因；也可以对同一 BYOK Template 使用不同个人 Key；
- Space 用户不能覆盖 deployment-owned 字段；
- 单 Space Config 分层后的稳定内存和 watcher/client 数量不超出 Task 0 基线噪声；
- migration 重跑幂等，失败时旧数据仍可恢复。

### Task 4：文本 Session、Run 与 Event 隔离

**目标：** 打通基础批次中的双 Space 文本主链。

**工作：**

- 按 4.4 的复制、验证、原子 commit 合同，只迁移 Session/Journal/unfinished-run 数据到默认 Space；迁移完成前旧 Session owner 是唯一事实，完成后新 Session owner 是唯一事实；
- SessionManager 的状态方法在 owner 边界接收 `spaceId`；
- 增加 `SessionRepository` typed port；Local adapter 按 `spaceId` 委托现有 Journal、metadata 和 unfinished-run Store；
- 所有 Session Map、projection、run registry 和 provider cache key 增加 `spaceId`；
- Agent run request / recovery record 持久保存 `spaceId`；
- Event envelope 增加 `spaceId`，Event Stream 在发布与订阅两端过滤；
- session route 先校验 Space，再按 session ID 查询，禁止“先全局查到再判断”；
- Session Search 不进入本基础批次；后续完成 Search owner 后才能进入多用户产品发布，不新增按用户数量门控。

**退出条件：**

- 旧管理员的全部历史 Session、Journal 和未完成 Run 在迁移后仍可读取或按原合同恢复；
- 两个 Space 可创建同名或同 ID 形态的资源而互不覆盖；
- 猜测 Session ID、Run ID、Event cursor 均不能获得另一个 Space 的存在性或内容；
- 进程重启后 Run 仍恢复到原 Space；
- Store、Map、event registry 中不存在只以业务 ID 为 key 的个人状态。

### Task 5：Workspace、Skill 与执行边界

**目标：** 提供用户真正可用的文件和 Skill 隔离，同时把所有执行统一收口到 Space capability 和 Execution Plan，而不在基础批次建设完整远程/容器执行平台。

**工作：**

- 按 4.4 的复制、验证、原子 commit 合同，只迁移 Workspace 与 Space 私有 Skill 数据到默认 Space；commit 前后始终只有一个活动文件 owner；
- 运行前由 owner 把目标 Space 的 canonical workspace、resolved config 和 Skill snapshot 传给现有执行链；
- Agent/Provider owner 按显式 Model Ref 解析 Deployment Offering 或 Space Private Provider；有效顺序为 Run/Agent 显式选择、Space 默认、Deployment 默认、配置缺失；
- Provider client/cache key 纳入 offering/binding identity、Credential version 和必要的 `spaceId`，不能只按 providerId 复用带认证 client；
- 文件能力只能经过一个 root-bound managed file primitive；现有工具不能满足合同时就保持门控，不为兼容直接暴露 Node 文件 API；
- managed file primitive 只接受相对 workspace 的路径，每个路径段使用不跟随 symlink 的方式检查，拒绝 symlink、`..`、绝对路径、挂载跳转和间接宿主访问；同一 Space 的路径创建、rename 和删除与解析串行化，或使用等价的目录描述符方案，防止用户 API 内的路径替换竞争；
- ToolProvider 根据目标 Space capability 注册能力：`workspace.files` 默认可用；`process.execute` 只有当前 Execution provider 能落实 resolved mounts、网络和资源预算时可用；宿主路径只来自显式 `host.mount` grant；
- 迁移旧安装时，现有宿主执行范围转成管理员 Space 的 `process.execute` 和 host mount；新 Space 不继承；
- SkillManager 按调用中的 target workspace 解析 Skill，不创建 per-Space SkillManager；
- 复用现有 builtin / global / project / workspace scope：global root 固定到 deployment 受管目录，workspace / project root 来自目标 Space；
- deployment-global Skill 对普通用户只读；Space 私有 Skill 只在自己的 workspace 可见；
- Skill loader 可使用小型有界缓存，key 至少包含 `spaceId`、workspace 和配置版本。

**基础批次不做：**

- required / blocked / locked 等高级 Skill policy；
- Skill Binding 数据库、共享 Credential Broker、多版本灰度；
- 允许 Agent 以管理员身份跨 Space 操作文件。

管理员如需查看或修复用户文件，基础批次使用 Task 6 的 maintenance CLI；它显式进入目标 Space、复用相同 managed file primitive、写审计，不复用 Agent host tools。没有 `process.execute` 和对应 host mount 的 Space 不能从 Shell、宿主共享目录或其它旁路修改 workspace。

**退出条件：**

- 用户 A 看不到用户 B 的私有 Skill 和 workspace 文件；
- 两个 Space 可以启用同名私有 Skill；
- global Skill 对所有 Space 可发现，但普通用户无法修改其 definition；
- symlink、相对路径、绝对路径、路径替换竞争和工具调用攻击测试均不能逃出 workspace；
- 每个 Space 的 Agent tool list 与自己的 capability 和 provider readiness 一致；管理员 elevation 不给目标 Space 额外增加 process 或 host mount；
- 任意 Space 的工具都不能访问未出现在 Execution Plan 中的其它 Space root 或宿主路径。

### Task 6：用户管理合同、端到端验证与最终放行

**目标：** 在基础主链全部闭合后实现可重入用户管理合同，并证明同一主链能承载两个隔离 Space；只有完整产品发布 inventory 同时闭合时才注册真实第二用户入口。

**工作：**

- 实现管理员用户管理 service：创建用户 preflight、创建/启用/禁用/重置用户、列出全部 Space、申请/结束限时 elevation、查看审计记录；提供 maintenance service 读写和删除目标 Space 的全部受管文件；
- 创建用户使用 4.4 的 `prepare -> materialize-space -> verify -> commit-access-state -> ready` 状态机；ready 前 User 不可见、不可登录，崩溃后只继续同一 operation 或清理它未提交的资源；
- CLI/API 路由只有在当前产品发布 inventory 中所有可达个人 owner 和所需 Execution 边界闭合后才随对应发布一起注册；否则只保留测试 harness，不交付一个会制造半隔离用户的入口；
- 普通用户 UI/API 支持修改自己的密码，并展示当前身份和 capability summary；
- Deployment Admin 的“全部可访问”只覆盖 NextClaw 管理的所有 Space；任意宿主路径、数据库文件、容器 socket 和备份介质仍属于 Host Operator 边界；
- 不建设完整 Admin UI；只有达到入口放行条件的发布才给现有普通用户 UI 补登录和稳定错误展示；
- 创建用户 preflight 列出未完成迁移、缺少 Space owner、默认 grant 或 provider 不满足策略等阻塞项；通过后直接创建，不写模式 marker、不重启；
- User 被禁用时撤销 access session 和 Event Stream、取消排队 Run，并向 active Run 发起终止；终止后的事件或恢复不能继续接受该 User 的新操作；
- 运行双 Space 端到端、迁移、重启恢复、权限、路径攻击和单用户回归；
- 验证修改/重置密码撤销旧 session，禁用 User 撤销连接、拒绝新 Run 并终止或中断排队/运行中任务；
- 在 1C1G 或等效受限环境测量 idle、单 run 与并发峰值，记录实际边界，不先承诺数字；
- 与 Task 0 单用户资源基线逐项比较；任何超出冻结测量噪声的稳定回归先优化，不能因为仍可启动或仍低于绝对上限而放行；
- 形成 recovery runbook：停止新增用户和写入、保留 access/audit；pre-commit 可以恢复 migration source，post-commit 优先向前修复，只有 operator 明确接受 snapshot 之后的数据损失时才从备份恢复；不执行无 owner 的跨 Space 合并。

**退出条件：**

- 所有高优先级攻击型测试通过；
- 单用户核心回归通过；
- 基础批次 owner inventory 没有未分类入口；
- 1C1G 测试没有随机 OOM，超限表现为明确排队或拒绝；
- 升级前支持的最低单用户 VPS 档位在升级后仍支持相同基础场景；未配置 PostgreSQL/S3/remote/sandbox provider 时没有对应 SDK client、连接池、timer 或进程；
- Review 不存在高/中优先级 finding 后，才允许宣布“同构多用户基础批次完成”；
- 如果完整 owner inventory 尚未闭合，生产行为仍是默认管理员单用户且全部现有功能正常，第二用户入口没有被注册；如果 inventory 已闭合，两个真实用户才能分别登录稳定 Space，并通过完整越权与生命周期验收。

## 6. 改动边界与文件策略

基础批次优先修改现有 owner，新增文件只允许承担以下明确职责：

- `space.types.ts`：`SpaceId` 与最小持久模型；
- `nextclaw-data.types.ts`：`NextclawData`、control/Space typed ports 与最小静态 local placement 合同；
- `local-data-provider.service.ts`：仅在需要统一拥有 lazy Store handle、有界缓存和 dispose 生命周期时创建；否则由 composition root 直接组合 typed ports；
- `kernel-storage-paths.ts`：受管路径解析；
- access identity/session/audit 的本地 Store；
- personal-space migration；
- Session 本地 repository adapter；
- Space capability resolver。

禁止为“以后可能扩展”新增：

- 通用 key-value Repository、JSON CRUD 或跨 feature 查询 facade；
- 只有占位方法、没有本批调用方的 provider 端口；
- Space facade 或通用 identifiers envelope；
- per-Space Manager registry；
- Admin-aware Store；
- 分布式 Queue / Event / Blob 抽象；
- 第二套 Config schema 和全量配置代理。

如果一个新增 abstraction 不能同时减少至少两个调用方的重复复杂度，或隔离一个已经存在的真实变化点，默认不新增。

### 6.1 基础批次预计触达面

下表冻结 owner 和主要入口，不要求为了命中清单而机械修改每个文件。实施每个 Task 前仍需用 `rg` 沿真实调用链做双向范围审计；发现计划外个人状态 owner 时，先补 owner 批次，不增加用户数量门控。

| Task | 主要修改 | 允许新增 |
| --- | --- | --- |
| 1 | `packages/nextclaw-kernel/src/types/access.types.ts`、`stores/access-session.store.ts`、`managers/access.manager.ts`、`app/nextclaw-kernel.ts` | `packages/nextclaw-shared/src/types/space.types.ts`；kernel `types/nextclaw-data.types.ts`、`stores/space-access.store.ts`、`stores/deployment-audit.store.ts`；只有真实拥有 lazy handle 生命周期时才增加 `services/local-data-provider.service.ts`；测试遵循现有 `managers/__tests__` 与相邻 store/service 目录 |
| 2 | `packages/nextclaw-shared/src/services/ingress.service.ts`、`types/event-bus.types.ts`；server `features/auth/services/ui-auth.service.ts`、`features/auth/controllers/auth.controller.ts`、`app/router.ts`、Event Stream auth/authorizer/registry；登录相关 UI | `packages/nextclaw-server/src/app/types/ui-request-context.types.ts`、`app/utils/request-space.utils.ts` 及测试；不新增第二套 controller 树 |
| 3 | kernel `app/kernel-storage-paths.ts`、`managers/config.manager.ts`、composition root；service `app/nextclaw-service-runtime.ts` 启动迁移 hook；Model Offering/Provider resolution | `stores/space-config.store.ts`、`services/personal-space-migration.service.ts` 及测试；不新增第二套 Config schema |
| 4 | kernel `managers/session.manager.ts`、`session-run.manager.ts`、`agent-run-request.manager.ts`、`services/session-event-ingestion.service.ts`、Agent Run types、现有 Session Store；server session/event routes | `stores/space-session.store.ts` 及测试；不新建通用 repository 目录或无 Space overload |
| 5 | kernel `managers/agent.manager.ts`、`llm-provider.manager.ts`、`skill.manager.ts`、run context、`contributions/tool-provider/providers/core-tool.provider.ts`；core `features/agent/services/skills-loader.service.ts` | `services/space-managed-files.service.ts` 及测试；它同时服务普通 workspace 工具和管理员维护命令，因此是安全边界而非通用 facade |
| 6 | service command manager、用户命令 controller/service；server auth API；普通登录、修改密码、当前身份、capability 状态与错误展示 | 用户管理命令及测试；基础批次不新增 Admin UI 或新的 server maintenance feature |

基础批次文件维护采用 CLI 调用 `space-managed-files.service.ts`。Server API 只负责认证、用户管理和 elevation；若以后需要远程管理文件，再为它单独设计有唯一公共入口的 maintenance feature，不把文件 CRUD 塞进 Auth controller。

## 7. 验证矩阵

| 风险 | 最小证明 |
| --- | --- |
| 认证串 Space | 两用户交叉 token、header、URL、body 攻击测试 |
| IDOR | 交叉 Session / Run / Event ID 与 cursor 测试 |
| Store / cache 污染 | 两 Space 相同资源 ID、交替访问和并发访问测试 |
| 配置泄漏 | 相同 Agent / Provider ID 使用不同 secret/config 的测试 |
| 模型来源混淆 | Deployment Shared、BYOK Template、Space Private 同名模型并存时必须使用明确 Model Ref |
| Credential fallback | Shared Key 失效/超额不改用 Space BYOK；Space Key 缺失不改用 Shared Key |
| Skill 泄漏 | global 可见只读、private 不可见、同名 private 并存 |
| 文件逃逸 | `..`、绝对路径、symlink、rename race、挂载边界测试 |
| 管理员越权 | 无 elevation、错误 target、过期 TTL、禁用用户、审计完整性 |
| 异步错配 | Run 创建、重启恢复、Event 订阅始终保持原 `spaceId` |
| actor/owner 混用 | 状态 Manager/Store 不接收 `userId`；Membership 撤销只影响访问，不改写 Space 数据与资源 ID |
| Feature owner 遗漏 | 发布 inventory 发现无 Space Store/cache/record 的个人 feature 时阻止发布 |
| Space grant 串用 | 两个 Space 使用不同 `workspace.files`、`process.execute` 和 host mount grant 时，工具列表与执行资源互不串用 |
| 迁移损坏 | dry-run、幂等重跑、中断恢复、旧数据校验 |
| 单用户回归 | 登录、Chat、恢复、Skill 与原 workspace 基线 |
| 低配资源 | idle、单 run、并发峰值、队列上限和 OOM 行为 |

文档改动本身只做结构和合同 Review；真正实现触达 TypeScript、类型声明、导入导出或运行链路时，必须按实际 package 运行定向测试和 `tsc`。

### 7.1 每批最低验证入口

```bash
pnpm -C packages/nextclaw-shared tsc
pnpm -C packages/nextclaw-core tsc
pnpm -C packages/nextclaw-kernel tsc
pnpm -C packages/nextclaw-server tsc
pnpm -C packages/nextclaw-service tsc
pnpm -C packages/nextclaw-ui tsc

pnpm -C packages/nextclaw-kernel exec vitest run \
  src/managers/__tests__/access.manager.test.ts \
  src/services/personal-space-migration.service.test.ts \
  src/stores/space-config.store.test.ts \
  src/stores/space-session.store.test.ts \
  src/services/space-managed-files.service.test.ts

pnpm -C packages/nextclaw-server exec vitest run \
  src/app/router.auth.test.ts \
  src/app/router.multi-space-isolation.test.ts \
  src/app/utils/request-space.utils.test.ts \
  src/app/tests/server-event-stream.test.ts
```

命令中的新测试文件只有在对应 Task 落地后才存在；每个 Task 迭代期先跑自己的定向测试，基础批次收尾再统一运行上述集合。Lint 不能替代任何受影响 package 的 `tsc`。

## 8. 放行顺序与停止线

```text
单用户基线
  -> 当前管理员与默认 Space
  -> Ingress 透传
  -> Config owner 迁移与隔离
  -> Session / Run / Event owner 迁移与隔离
  -> Workspace / Skill owner 迁移与隔离
  -> 用户管理合同与攻击型/低配验证
  -> 基础批次完成
  -> 继续完成其余 owner inventory
  -> 执行边界与多用户产品发布 Review
  -> 注册真实第二用户入口
```

任何阶段出现以下情况立即停止扩大范围：

- 需要把 `spaceId` 传遍纯 helper 或 UI 展示层；
- 需要创建 per-user Kernel / Manager tree 才能继续；
- 未隔离功能只能依赖共享 fallback 才能运行；
- 管理员能力要求在 Store 内加入 `isAdmin`；
- 单次改动同时触达三个以上尚未完成基线的 feature；
- migration 无法证明可恢复；
- 高优先级隔离 finding 未关闭。

停止后应缩小当前改动批次或把该 feature 纳入后续 owner 计划，而不是用额外兼容层或运行模式掩盖问题。

## 9. 后续演进接口

基础批次完成后，其余 owner 遵循同一空间化模板：

1. 明确状态 owner；
2. 所有持久数据和 cache key 纳入 `spaceId`；
3. 所有异步 record 固化 `spaceId`；
4. 执行资源获得 canonical workspace、短期 credential 和限制策略；
5. 补齐 IDOR、跨 Space event、重启恢复和资源公平性测试；
6. 纳入多用户发布 inventory，并证明不根据用户数量改变功能语义。

所有持久数据 owner 都逐步接入同一个 `NextclawData` 抽象层，但每个端口仍由对应 feature 定义。Local provider 先委托现有 Store；共享 provider 在后续路线图实现同一端口。`DataProviderRouter`、placement 和迁移合同只在数据层内部出现，不改变本文的 Kernel、Manager、`spaceId` 和访问语义。

Run Queue、Lease、Event 和 Execution 不是普通数据 CRUD，继续拥有独立 runtime port；它们不能为了“统一”被塞进 `NextclawData`。provider 间的数据迁移统一使用版本化 snapshot/batch/change/verify 合同，禁止为每一对 provider 编写专用迁移器。

## 10. 决策记录

### 2026-08-16 / v0.1（已被 v0.4 否决发布范围）

- 将完整路线图与第一期执行计划拆开，避免“部分实施某个大任务”造成范围歧义。
- 第一期开启范围收缩到身份、文本会话、Agent/Provider 配置、managed workspace、基础 Skill 和管理员维护面。
- Asset、Project、Search、Cron、Channel、App、MCP、Extension 和危险 host tool 在多用户状态下先门控。
- Config 复用现有 schema，只增加 Space snapshot、集中 deployment-owned 覆盖和定向 consumer 改造。
- Skill 复用现有 scope，不提前建设 Binding/Policy/Credential 平台。
- 管理员跨 Space 访问使用限时 elevation 和维护 API/CLI，数据层无角色分支。

### 2026-08-16 / v0.2（已被 v0.4 否决激活方案）

- 发现仅在 route 层门控不够：现有 Kernel 会构造全局 Search、Asset 等组件，因此改为显式激活、受控重启、composition-root 不注册和 startup self-check。
- 迁移成功后清除根配置中的个人值，禁止把旧用户 secret/config 当作兼容 fallback。
- managed file primitive 增加 symlink 与路径替换竞争合同；应用隔离边界与 Host Operator 信任边界明确分开。
- 管理员文件维护第一期只走 CLI，共享同一受管文件原语；不为缩短路径把文件 CRUD 塞进 Auth controller。

### 2026-08-16 / v0.3（部分保留）

- 将《多用户功能设计》设为实施计划的上位产品合同。
- 增加普通用户自助修改密码、管理员启用用户、密码变更撤销旧 session 和用户禁用后的 Run/连接收尾。
- 增加 capability summary，使 UI 能正确表达不可用能力，同时保留 Server 独立 fail-closed 校验。

### 2026-08-16 / v0.4（同构模型修正）

- 本文降级为内部基础开发批次，不再把基础主链完成等同于多用户产品发布。
- 删除 multi-user activation、永久 marker、创建用户重启和按用户数量关闭 feature。
- 旧数据与已有宿主权限归管理员 Space；该权限表达后来由 v0.6 收敛为 `process.execute` 和显式 host mount，新用户只增加空 Space 和默认 `workspace.files`。
- Search、Asset、Project、Cron、Channel、App、MCP、Extension 等通过后续 owner 批次完成，正式发布前闭合 inventory，而不是运行时降级。

### 2026-08-16 / v0.5（全局与个人模型配置）

- 增加 Deployment Shared Offering、Deployment BYOK Template 和 Space Private Provider 三种模型来源。
- Model Ref、Credential owner、默认选择和管理员锁定策略显式解析，不做通用 Config deep merge。
- Shared Credential 与 Space BYOK 不互相复制或静默 fallback；使用量始终归发起 Space。

### 2026-08-16 / v0.6（统一执行主链）

- 删除 managed/sandboxed/trusted-host 三态执行模型，不按单 owner、多用户、用户数量或部署形态选择业务路径。
- 所有 Space 统一由 Execution owner 解析 capability、mount、Environment、Credential、网络与预算；provider 只负责落实同一 Execution Plan。
- 旧宿主权限迁移为管理员 Space 的 `process.execute` 和显式 host mount；新 Space 默认只有 `workspace.files`。

### 2026-08-16 / v0.7（统一数据抽象）

- 基础批次即建立最小 `NextclawData` typed port 集合，不再等第二个物理 provider 出现后才抽象。
- `LocalDataProvider` 委托现有 Store 和数据格式；Manager 只获得所需 feature port，避免扩大改造面和跨 feature 耦合。
- Access 等 control ports 由 bootstrap local provider 直接承载，Config/Session 等 Space ports 才走静态 local placement，避免认证依赖尚未解析出的 `spaceId`。
- PostgreSQL、S3 等都作为可替换 provider；迁移使用 provider-neutral 传输合同，不使用两两 adapter 或长期双写。

### 2026-08-17 / v0.8（单用户资源不回退）

- `nodes = 1、spaces = 1` 仍只装配一组 Manager、Local control/data provider 和按需运行资源，不为未来规模预创建对象。
- 未配置的 PostgreSQL、S3、远程执行和 Sandbox 实现必须保持未加载、无 client、无连接池、无 timer、无进程。
- Task 0 先冻结当前单用户资源基线和测量噪声；后续稳定回归阻止批次完成，最低 VPS 档位不得上调。

### 2026-08-17 / v0.9（本地资源边界）

- 明确数据库不是全部资源：本批继续使用 JSON/JSONL/目录、现有嵌入式 SQLite、进程内 live state 和本地 Execution provider 的组合。
- 单节点硬要求是无外部数据库服务依赖，不是移除现有 `session-search.db` 或强制把全部文件改写为 SQLite。
- Workspace、Skill 文件、live handle、Secret 和执行资源各自保持正确 owner；records 只保存适合持久化的事实、引用和审计。

### 2026-08-17 / v0.10（User/Space 标识职责）

- `userId` 固定为 Identity/Authorization/Audit actor，`spaceId` 固定为个人状态、异步工作和执行资源的数据 owner。
- Authorization 解析并校验 `userId + targetSpaceId` 后，Kernel 状态主链只继续传递 `spaceId`；Manager/Store 不接收 `userId`、`isAdmin` 或通配 Space。
- Space 级 Run/Event/恢复记录持久化 `spaceId`；可选 `triggeredByUserId` 只用于审计。User 禁用撤销访问，不驱动 Space 数据 cache 生命周期或改写 Space 资源。

### 2026-08-18 / v0.11（低缺陷与可恢复实施主链）

- `SpaceId` 采用带类型区分的零运行时成本标量；入口解析一次，状态 Manager/Store 只提供必填 Space 签名并删除无 Space overload，让漏改调用点由 `tsc` 暴露。
- User/Space provisioning 采用 `prepare -> materialize -> verify -> commit -> ready` 可重入状态机；半成品 User 不可登录，崩溃后只继续同一 operation 或清理未提交资源。
- 旧单用户数据仅作为有退出条件的迁移源，使用 `planned -> copied -> verified -> committed -> cleanup-eligible`；commit 后运行时只读新 Space owner，不扫描旧目录或静默 fallback。
- Local provider 只在 typed port 后复用现有 Store 与格式；Manager 不感知路径/provider。只有真实拥有 lazy handle/cache/dispose 生命周期时才增加 `LocalDataProvider` service，避免无状态 wrapper。
- 对外创建用户入口最后放行；每个 owner 按入口、状态、缓存、异步、恢复和攻击型测试纵向闭合，不用用户数量开关掩盖开发中间态。

### 2026-08-18 / v0.12（可停止、无损的阶段交付）

- 每个 Task 都升级为可独立发布检查点：现有管理员行为无损，本 Task owner 完整闭环，未进入 Task 的 owner 继续保持自己的唯一旧实现。
- 默认 Space substrate 不提前实现 `DataProviderRouter` 或第二用户入口；Config、Session、Workspace 分别在自己的纵向 Task 中迁移，避免一次搬迁所有数据后由未改 Manager 继续访问。
- User provisioning、管理员 elevation 和真实第二用户入口收口到最后放行阶段；完整发布 inventory 未闭合时只保留内部 fixture/test harness，不交付半隔离用户。
- 明确“可停止和升级中断可恢复”不等于新路径产生写入后仍能任意降级旧二进制；commit 后采用向前修复或显式时间点恢复，不以长期双写换取表面回滚能力。

### 2026-08-18 / v0.13（风险总账成为阶段硬门槛）

- 详细风险只由运行时设计第 16 节维护，基础计划不复制平行清单。
- 每个 Task 开始时选择适用 P0/P1/P2，并在结束时提供预防结构、验证入口、恢复 owner 和剩余风险；适用 P0/P1 未关闭时不得结束或放行。
- 风险关闭不能只依赖人工约定或单一正常路径测试，必须同时有结构约束、攻击型/故障验证和明确恢复行为。
