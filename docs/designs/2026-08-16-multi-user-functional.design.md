# NextClaw 多用户功能设计

> 状态：Draft v0.8
> 日期：2026-08-18
> 角色：多用户产品功能与行为合同
> 上位依据：[NextClaw 产品愿景](../VISION.md)
> 下游架构：[NextClaw 多用户可扩展运行时初版设计](./2026-08-16-multi-user-scalable-runtime.design.md)
> 基础批次计划：[NextClaw 同构多用户运行时基础批次实施计划](../plans/2026-08-16-multi-user-minimal-runtime.plan.md)

## 1. 文档目的

本文先于架构设计和实施计划，定义 NextClaw 支持多用户后，用户和管理员实际能够看到什么、操作什么，以及各种操作成功或失败时系统应当表现为何种行为。

本文不决定 Store、数据库、目录 resolver、Kernel 方法签名或单节点/多节点 provider。技术实现必须满足本文，不应反过来用实现方便程度改变产品语义。

文档关系如下：

```text
产品愿景
  -> 多用户功能设计：产品要做什么
  -> 多用户架构设计：这些功能如何成立
  -> 最小实施计划：第一期按什么顺序改造和验证
  -> 完整演进路线图：后续如何扩展到完整能力与多节点
```

## 2. 产品判断

多用户 NextClaw 不是“多人共用一个聊天机器人”，而是“一套 NextClaw 部署承载多个相互独立的个人 NextClaw”。

对普通用户而言：

- 登录后看到的是自己的长期个人智能搭档；
- 会话、配置、凭据、文件、Skill 和运行历史都属于自己；
- 不需要理解节点、数据库、租户或集群；
- 部署从一台机器扩展到多台机器时，用户体验和数据身份不变化。

对部署管理员而言：

- 可以创建和管理用户；
- 可以提供所有用户共享的全局 Skill；
- 可以在明确选择目标用户 Space、重新认证、限时提权和完整审计后维护该 Space；
- 不会因为管理员身份，让自己的普通 Agent 自动拥有所有用户数据。

这与产品愿景的关系是：NextClaw 仍然是每个用户的个人操作层，而平台部署只是在不复制整套产品进程的前提下，提高部署和资源利用效率。

## 3. 功能设计原则

1. **个人体验优先**：用户进入的是自己的 NextClaw，不是一个需要手工选择 tenant 的平台后台。
2. **默认隔离**：所有个人数据默认只对所属用户可见；缺少明确归属时拒绝访问。
3. **管理员显式进入**：管理员普通登录不自动进入其它用户 Space；跨用户访问必须有目标、原因、时限和审计。
4. **共享能力不共享个人状态**：全局 Skill 可以共享 Definition，但配置、Credential、生成文件、记忆和使用记录仍属于用户。
5. **能力边界可感知**：系统必须告诉用户当前哪些能力可用、哪些因多用户安全尚不可用，不能表现为随机失败。
6. **单用户自然升级**：现有用户升级后仍看到原来的数据，不需要先理解 Space。
7. **低配与规模化同一体验**：节点数量和底层 provider 不是产品模式，不产生两套用户功能定义。
8. **单用户资源不回退**：`nodes = 1、spaces = 1` 时，升级不能要求更高的最低 CPU/内存档位；未配置的共享 provider、分布式 placement cache、迁移 worker 和额外隔离 runtime 不得常驻。
9. **先安全闭环，再对外发布**：某个个人 feature 没有完成 Space owner 时，不能进入多用户版本；不能在运行时根据用户数量继续共享旧数据或临时关闭功能。
10. **身份与数据归属分离**：User 是发起操作和承担审计责任的 actor，Space 是个人产品数据的 owner；认证、成员关系和授权可以关联二者，但 Session、Memory、Config、Workspace 等个人状态不能直接以 User 作为数据隔离边界。

## 4. 角色与产品对象

### 4.1 User

User 是可以登录 NextClaw 的个人身份，也是认证和审计中的 actor。第一期每个 User 默认拥有一个 Personal Space，但 User 本身不直接拥有 Session、Memory、Config、Workspace 等个人产品数据；User 通过 Membership 获得对 Space 的访问权。

User 可以：

- 登录和退出；
- 修改自己的密码；
- 使用自己的 Chat、Session、Agent、Provider、Workspace 和 Skill；
- 管理自己的个人配置和凭据；
- 查看当前部署允许自己使用的能力。

User 不能：

- 查看用户列表或其它用户是否存在；
- 提交任意 Space ID 切换数据归属；
- 访问其它 Space 的会话、事件、配置、凭据、Skill 数据或文件；
- 开启管理员关闭或尚未完成隔离的能力。

### 4.2 Personal Space

Personal Space 是个人数据和运行状态的产品归属边界。第一期一个 User 只有一个默认 Space，因此普通界面不提供 Space 选择器，也不要求用户理解 `spaceId`。

Space 是内部稳定身份，不等于 workspace：

- Space 归属个人配置、会话、记忆、凭据、文件和运行状态；
- workspace 是 Space 内供 Agent 使用的受管文件目录；
- 将来一个 User 可以拥有多个 Space，但第一期不提前提供这套交互。

因此，`userId` 回答“谁在操作”，`spaceId` 回答“操作哪一份个人数据”。普通请求由服务端从已认证 User 和 Membership 自动解析默认 Space；普通客户端既不需要也不能通过任意提交 `spaceId` 改变数据归属。

### 4.3 Deployment Admin

Deployment Admin 是 NextClaw 产品内的部署管理员。

Deployment Admin 可以：

- 创建和管理用户与默认 Space 策略；
- 创建、启用、禁用和重置用户；
- 查看用户与 Space 的管理 metadata；
- 安装和维护 deployment-global Skill；
- 显式进入任意目标 Space 进行维护；
- 查看部署级审计和安全状态。

Deployment Admin 的普通个人使用仍然只进入自己的默认 Space。跨 Space 权限不是常驻环境权限。

### 4.4 Host Operator

Host Operator 是操作系统、容器、磁盘、数据库和备份的宿主管理者，不是普通 NextClaw 产品角色。

个人部署中 Deployment Admin 与 Host Operator 往往是同一个人；平台部署中两者可以分离。本文承诺的是 NextClaw 用户之间的产品隔离，不承诺防御拥有宿主 root、进程调试或原始磁盘读取权限的人。

### 4.5 System / Deployment / Space 能力

| 归属 | 用户看到的含义 | 例子 |
| --- | --- | --- |
| System | 随产品提供，用户不能修改 | 内置 Skill、协议能力、系统定义 |
| Deployment | 管理员为本次部署统一提供 | 全局 Skill、部署安全策略、功能可用性 |
| Space | 只属于当前用户 | 会话、Agent/Provider 配置、私有 Skill、workspace、凭据 |
| Run | 某次执行的短期状态 | 当前运行、临时上下文、事件流 |

### 4.6 什么可以全局共享

判断标准不是“代码上能否放到全局变量”，而是该对象是否包含个人选择、个人内容、个人凭据或可变运行状态。

| 可以 System / Deployment 共享 | 必须归 Space | 原因 |
| --- | --- | --- |
| Provider adapter、协议实现、模型能力 metadata | 用户自己的 endpoint、BYOK Credential、模型选择 | 共享实现，不共享连接身份和个人选择 |
| 管理员发布的 Model Offering 和默认模型策略 | Space 默认模型、个人 Provider / Model | 管理员统一提供，用户保留被允许的个人配置 |
| Builtin / Global Skill Definition | Private Skill、Skill config/data/memory/credential | 共享能力定义，不共享使用数据 |
| App / Extension / MCP package code 与 manifest | enablement、config、grant、client/process/connection | 共享安装包，不共享运行实例 |
| Agent template、静态 schema、UI metadata | 用户 Agent、会话、记忆和 workspace | 共享模板，不共享长期个人状态 |
| Deployment policy、Quota 规则、审计 schema | Session、Run、Event、Cron、Asset、Project、Inbox | 个人事实必须有唯一 Space owner |

全局对象应优先是只读 Definition、管理员 Offering、默认值或策略。任何包含用户内容、可变连接、Credential、cache 或执行实例的对象，即使由全局 Definition 创建，也必须继续归属于 Space 或 Run。

## 5. 同构功能范围

### 5.1 所有部署从一开始就是同一种模型

NextClaw 不区分“单用户功能模式”和“多用户功能模式”。任何安装第一次启动时都拥有：

- 一个本地 Deployment Admin User；
- 该管理员自己的默认 Personal Space；
- 所有个人功能都通过这个 Space 访问；
- 一个 User 时不展示多余的租户或 Space UI。

部署只有一个用户时，是 `users = 1、spaces = 1`；新增用户后只是集合中多出 User、Space 和 Membership，不改变产品状态、不切换模式、不要求重启，也不根据用户数量关闭功能。

### 5.2 现有数据默认属于管理员 Space

旧版本中没有 Space owner 的个人数据，在升级时统一归入默认管理员的 Personal Space，包括：

- Config、Agent、Provider 和 Credential；
- Session、Message、Memory、Search 和运行历史；
- Workspace、Project、Asset 和附件；
- Cron、Inbox、Channel binding；
- Private Skill、App Data、Grant 和个人运行状态。

迁移后，这些数据与新建用户的数据使用同一套功能语义。旧路径不能继续作为“全局个人数据”供所有用户 fallback。

### 5.3 每个 Space 的功能语义相同

| 功能 | 同构行为 |
| --- | --- |
| 用户身份 | 每个 User 登录后自动进入自己的默认 Space |
| Chat / Session / Search | 只查询和修改当前 Space，会话与搜索语义一致 |
| Run / Event / Recovery | 始终继承发起者 Space，刷新和重启不改变归属 |
| Agent / Provider | 每个 Space 独立配置、模型选择和 Credential |
| Workspace / Project / Asset | 访问当前 Space 的受管文件、项目和资产 |
| Skill | 同时发现 Builtin、Global 和当前 Space 的 Private Skill |
| Cron / Inbox / Channel | 配置、任务、连接和投递归当前 Space |
| App / MCP / Extension | 代码可以共享，启用状态、配置、数据和运行实例归 Space |
| 管理员维护 | 明确进入一个 target Space 后沿同一功能链路维护 |
| 能力状态 | 反映该 Space 的配置、授权和运行条件，不反映“单用户/多用户模式” |

实现可以分批完成这些 owner 改造，但对外宣称支持多用户的版本不能把“尚未改完”包装成用户数量触发的功能降级。开发阶段未完成的 feature 保持未发布，不能形成长期产品模式。

### 5.4 宿主能力是 Space 授权，不是多用户开关

Shell、浏览器、stdio MCP、Extension process、Service App action 和任意宿主目录访问与普通数据功能不同：它们会越过 NextClaw 受管数据边界。

所有 Space 使用同一套 capability 模型和 Execution 主链，不定义单 owner、多用户、trusted-host 或 sandboxed 产品模式。执行相关 capability 至少包括：

- `workspace.files`：通过受管文件原语访问当前 Space workspace；新 Space 默认拥有；
- `process.execute`：允许发起命令、浏览器、stdio MCP、Extension process 或 Service App action，但必须进入统一 Execution owner；
- `host.mount`：把管理员明确授权的宿主路径或设备作为 mount grant 加入本次 Execution Plan；未授权的宿主资源不可见；
- `software.install.space`：允许在当前 Space environment 中安装个人依赖，不代表宿主 root。

Execution owner 每次根据 Space capability、显式 mount grant、软件环境、Credential、网络策略和资源预算解析不可变 Execution Plan，再交给当前 provider 落实。provider 可以使用本地进程、独立 OS principal、namespace、容器、MicroVM 或远程 Worker，但产品 API、授权模型和工具主链不因 provider 或用户数量改变。provider 无法满足 Execution Plan 时返回 `runtime_unavailable`，不能绕过约束换一条宿主快捷路径。

旧安装原本拥有的宿主执行范围迁移为管理员 Space 的 `process.execute` 和显式 `host.mount` grant；新 Space 只获得默认的 `workspace.files`。这只是 Space 权限数据不同，不是部署模式不同。管理员 elevation 只允许维护目标 Space，不自动扩大该 Space 原有 capability 或 mount。

## 6. 默认 Space 与自然增加用户

### 6.1 新安装

```text
首次启动
  -> 创建本地管理员 User
  -> 创建管理员默认 Personal Space
  -> 所有个人功能解析到该 Space
  -> 用户按现有个人方式使用 NextClaw
```

即使用户永远不创建第二个账号，系统内部也不保留无 Space 的个人数据路径。

### 6.2 旧安装升级

```text
发现旧个人数据
  -> 创建或确认管理员 User / Space
  -> 将旧数据归入管理员 Space
  -> 校验迁移结果
  -> 所有功能切到统一 Space 主链
  -> 保留受限回滚快照，不保留运行时 fallback
```

用户升级后仍看到原来的数据和功能，不需要执行“激活多用户”，也不需要因为迁移而重新选择 Space。

### 6.3 创建新用户

Deployment Admin 创建用户时，系统在一个原子操作中：

1. 校验用户名、认证条件和 Deployment 安全策略；
2. 创建 User；
3. 创建空的默认 Personal Space；
4. 创建 owner Membership；
5. 初始化该 Space 的默认配置和受管目录；
6. 赋予默认 `workspace.files` capability，不继承管理员的个人数据、`process.execute` 或 host mount grant。

创建完成后立即可以登录，不切换 Deployment 状态，不需要重启。失败时整体回滚。

### 6.4 创建前检查不是激活模式

创建用户前可以执行一次无状态 preflight，用于发现：

- 管理员尚未设置登录密码；
- 旧数据迁移尚未完成；
- 某个已对外开放的个人 feature 仍没有 Space owner；
- 配置要求 Sandbox，但当前没有可用 provider；
- 新 Space 默认授权不满足安全策略。

preflight 只验证当前版本能否安全创建用户，不写永久模式标记、不改变功能矩阵、不停止现有组件。失败时说明阻塞项，成功后直接执行用户创建。

### 6.5 分阶段交付不是半成品运行态

多用户改造必须允许按阶段停止，但每个已经结束的阶段都必须是可独立发布、可长期停留的稳定产品状态：

- 现有管理员的已支持功能、数据可见性和最低部署规格不得因为后续阶段尚未完成而退化；
- 开发环境可以提前使用双 Space fixture 验证隔离，真实第二用户的创建与登录入口只在当前发布所暴露的个人能力全部完成 Space owner 闭环后放行；
- 一个能力的入口、持久状态、缓存、异步任务、事件、恢复和执行权限必须作为同一个纵向批次完成，不能只完成其中一层就宣称该能力支持多用户；
- 尚未完成的能力不产生可登录用户能够到达的半隔离路径，也不能依据当前用户数量切换实现、共享旧 Store 或静默 fallback；
- 每个阶段都要同时通过现有单用户回归、双 Space 越权测试和适用的迁移中断恢复测试，未通过时停留在上一稳定阶段。

这里的“最后放行入口”是发布顺序，不是多用户激活模式。所有安装从第一阶段起始终使用默认管理员 Space 和同一条业务主链；后续只是增加已经满足安全合同的产品能力。

## 7. 用户与认证功能

### 7.1 初始管理员

- 新安装自动创建一个稳定的本地管理员身份和默认 Space；
- 旧安装沿用现有管理员身份，不生成第二份个人数据；
- 创建第二个用户前必须设置有效管理员密码；
- 无密码自动登录只允许 Deployment 中仍只有默认本地用户且未开放远程访问的情况。

### 7.2 创建用户

Deployment Admin 可以创建本地用户：

- 用户名在当前 Deployment 内唯一，比较时不区分大小写；
- 密码通过安全输入设置，不允许出现在命令行历史或普通日志中；
- User、默认 Personal Space 和 owner 关系必须一起创建；
- 任一步失败时，不留下半个用户或孤立 Space；
- 创建完成后，管理员只获得管理 metadata，不自动进入该用户 Space。

第一版不支持公开注册、邀请、组织、SSO 或一个用户拥有多个 Space。

### 7.3 登录与退出

- 用户输入用户名和密码登录；
- 成功后系统自动进入该 User 的默认 Space；
- 普通客户端不显示或提交任意 `spaceId`；
- 退出会撤销当前 access session 和事件连接；
- 登录状态显示当前用户名、角色和可用能力，但不暴露其它用户信息。

### 7.4 修改与重置密码

- User 可以在验证当前密码后修改自己的密码；
- Deployment Admin 可以重置任意用户密码；
- 重置和修改密码后，旧 access session 全部失效；
- 新密码不能出现在日志、审计详情或 API 响应中。

### 7.5 禁用与重新启用

禁用用户时：

- 立即禁止新登录；
- 撤销现有 access session 和 Event Stream；
- 拒绝新的 Run；
- 取消排队中的 Run，并停止或中断仍在执行的 Run；
- 保留 Space 数据，不自动删除会话、配置或文件。

重新启用后，用户可以重新登录，但旧 session 不恢复。用户删除、数据导出和保留期策略不进入第一版。

## 8. 普通用户体验

### 8.1 首页和导航

多用户不应把 NextClaw 变成租户管理界面：

- 普通用户登录后直接进入现有个人工作台；
- 第一版没有 Space 切换器；
- 会话列表、运行状态、设置和 Skill 目录只显示当前 Space 内容；
- 用户不需要知道部署是一台机器还是多台机器。

### 8.2 Chat、Session 与 Run

- 用户只能列出、创建、查看、继续、取消和删除自己的 Session；
- Session ID、Run ID 或事件 cursor 即使被猜中，也不能读取其它 Space 的内容或存在性；
- 跨 Space 猜测资源统一表现为“资源不存在”，不泄漏另一个用户是否拥有该资源；
- 页面刷新或重新连接后，只恢复当前 Space 的事件；
- 服务重启后，未完成 Run 仍保持原 User/Space 归属；
- 用户禁用后，原 session 数据保留，但不能继续运行。

### 8.3 Agent 与 Provider 配置

- 每个 Space 拥有自己的 Agent 和 Provider 配置；
- 两个用户可以使用相同名称或 ID，而配置和凭据互不影响；
- deployment-owned 字段在用户界面中只读或不展示；
- Provider secret 保存后默认只显示已配置状态或掩码，不再次通过普通 API 返回明文；
- 修改用户 A 的配置不会让用户 B 的 Agent、Provider 或界面重载；
- 当前 Run 使用启动时解析的配置快照，运行中配置修改只影响后续 Run。

### 8.4 管理员全局模型与个人模型配置

模型和 Provider 同时支持管理员统一配置与用户个人配置，但必须显式区分来源和 Credential owner。

#### 8.4.1 三种可用形态

| 形态 | 管理员配置 | 用户配置 | Credential owner |
| --- | --- | --- | --- |
| Deployment Shared Offering | Provider endpoint、模型目录、共享 Credential、默认限额 | 选择模型和个人默认值 | Deployment，密钥只保存一份 |
| Deployment BYOK Template | Provider 类型、endpoint、可用模型和参数边界 | 为自己的 Space 填写 Credential | Space |
| Space Private Provider | 无，只受 Deployment 基础策略约束 | endpoint、模型、Credential 和默认选择 | Space |

管理员因此可以一次配置所有用户可用的模型，也可以只提供统一模板让每个用户使用自己的 Key。用户还可以在 Deployment 允许时增加 OpenAI-compatible 或其它已安装 adapter 支持的个人 Provider / Model。

Global Offering 默认对当前 Deployment 所有 Space 可发现。第一版不增加组织、用户组或复杂 per-Space Offering 分发；需要限制成本时，管理员使用统一 allow/deny、Space Quota 和共享 Credential 限额。

旧版本已有的 Provider、Model 和 API Key 在升级时默认归管理员自己的 Space Private Provider，不能自动发布为 Global Offering。管理员必须显式选择“发布为 Deployment Shared Offering”或“发布为 Deployment BYOK Template”；发布前系统展示将共享的 endpoint、model catalog、Credential mode 和使用范围，但不回显完整 secret。

#### 8.4.2 模型来源和冲突

- 模型目录必须显示 `Deployment` 或 `Private` 来源；
- Deployment Offering 对普通用户只读，Space Private Provider 只对当前用户可见和可修改；
- 相同 Provider ID 或 Model ID 可以在 Deployment 与 Space 同时存在，但内部引用必须包含来源；
- 只按短名称引用且存在歧义时要求明确选择，不能让个人配置静默覆盖管理员模型；
- 管理员修改 Offering 只影响后续 Run，当前 Run 保持启动时的模型快照。

#### 8.4.3 Credential 行为

- Deployment Shared Credential 不复制到任何 Space，也不通过普通 API 返回给用户；
- 使用共享 Credential 的请求仍然按发起 Space 记录 Usage、Cost、Quota 和审计关联；
- BYOK Template 要求每个 Space 提供自己的 Credential，用户 A 的 Key 不能被用户 B 使用；
- Space Private Credential 只能用于当前 Space；
- 同一模型同时存在共享 Key 与个人 Key 时，选择的 Model Offering 明确决定使用哪一个；
- Credential 缺失、失效或超额时明确失败，不能在 Deployment Shared 与 Space BYOK 之间静默 fallback。

#### 8.4.4 默认模型和管理员策略

有效模型选择顺序为：

1. 当前 Run / Agent 显式选择的已授权 Model Ref；
2. 当前 Space 默认 Model Ref；
3. Deployment 默认 Model Ref；
4. 都不存在时要求完成配置，不猜测或静默选择其它模型。

Deployment Admin 可以：

- 配置、更新和删除 Global Model Offering；
- 设置 Deployment 默认模型；
- 把默认模型标记为“用户可覆盖”或“管理员锁定”；
- 决定是否允许 Space Private Provider，默认允许；
- 设置共享 Credential 的 Space 配额和总量限制。

User 可以：

- 从允许的 Deployment Offering 中选择自己的默认模型；
- 在策略允许时配置、修改和删除 Space Private Provider / Model；
- 为 BYOK Template 保存自己的 Credential；
- 选择个人模型作为 Agent 或 Space 默认值，除非管理员锁定了模型策略。

管理员删除或禁用一个仍被 Space / Agent 引用的 Offering 时，对应配置进入 `model_unavailable` 状态并要求重新选择；不能自动切到另一个模型或个人 Credential。

### 8.5 能力状态展示

认证状态或运行时状态应返回一个不含底层拓扑信息的 capability summary，例如：

| 能力 | 状态 | 用户行为 |
| --- | --- | --- |
| Chat | available | 正常显示和使用 |
| Workspace Files | available | 只操作当前 Space workspace |
| Session Search | available / not_configured | 查询当前 Space，或提示需要配置对应 provider |
| Shell | not_granted / runtime_unavailable / available | 根据当前 Space 的 `process.execute`、Execution provider 和 mount grant 展示 |

capability 状态至少区分 `available`、`not_configured`、`not_granted` 和 `runtime_unavailable`。UI 隐藏或禁用只是体验优化，Server 仍然必须独立校验；能力不可用不能通过空结果、无限 loading 或随机 500 表达，也不能暴露节点数量或部署拓扑。

## 9. Skill 功能设计

### 9.1 三种来源

| 来源 | 谁提供 | 谁可见 | 谁可修改 |
| --- | --- | --- | --- |
| Builtin | NextClaw | 所有用户 | 用户和管理员都不可修改 |
| Global | Deployment Admin | 当前部署所有用户 | 仅 Deployment Admin |
| Private | 当前 User / Space | 仅当前用户 | 当前用户 |

Global 的含义是“所有用户都能发现和选择”，不表示自动执行，也不表示共享用户数据。

### 9.2 Skill 目录

用户看到一个合并后的 Skill 目录，每项至少显示名称、描述和来源：Builtin、Global 或 Private。

- 来源不同但 ID 相同的 Skill 不允许静默覆盖；
- 如果引用可以唯一解析，则正常使用；
- 如果只提供名称而存在歧义，系统要求用户明确选择来源；
- Private Skill 不能冒充或替换 Builtin / Global Skill；
- 第一版不增加 required、available、blocked、版本 pin 或复杂 binding policy。

### 9.3 全局 Skill

Deployment Admin 可以通过管理 CLI 安装、更新和删除 Global Skill：

- Global Skill 文件对普通用户只读；
- 更新只影响后续新 Run，已经启动的 Run 使用原快照；
- 删除后不再出现在新 Run 的目录中，但不会改写历史 Session；
- Global Skill 产生的配置、Credential、Memory、cache、生成文件和使用记录仍分别归各 Space；
- 需要 Shell、浏览器、stdio 或其它危险执行的 Global Skill，在第一版多用户状态下仍不能执行这些能力。

### 9.4 私有 Skill

- 用户可以在自己的受管 workspace 中安装、更新和删除 Private Skill；
- Private Skill 只出现在当前 Space；
- 两个用户可以拥有同名 Private Skill；
- 用户 A 的 Private Skill、配置和运行数据不能被用户 B 发现；
- 删除 Private Skill 不自动删除历史会话和由用户明确保留的普通 workspace 文件。

### 9.5 第一版没有 Skill 管理后台

第一版复用现有 Skill 目录和 workspace 能力，管理员全局管理先使用 CLI，不新增完整的 Skill policy 后台。后续出现真实的强制启用、组织策略或共享 Credential 需求时，再设计 Binding/Policy 功能。

## 10. Workspace 与文件功能

### 10.1 普通用户

普通用户及其 Agent 可以在当前 Space 的 managed workspace 内：

- 列出目录；
- 读取和创建文件；
- 修改、移动和删除文件；
- 创建和删除目录；
- 使用 Private Skill 所在的受管目录。

第一版多用户状态下不能：

- 登记任意宿主绝对路径为 Project；
- 访问其它 Space workspace；
- 访问 Deployment config、审计、数据库、宿主 home 或容器 socket；
- 通过 symlink、`..`、绝对路径或路径替换竞争逃离 workspace；
- 使用 Shell 或其它旁路绕过受管文件能力。

### 10.2 管理员文件维护

Deployment Admin 在有效 elevation 下，可以通过 maintenance CLI 对目标 Space 的全部受管文件执行列出、读取、创建、修改、移动和删除。

管理员文件维护必须：

- 每次明确 target Space；
- 复用与普通用户相同的受管文件边界；
- 记录 actor、target、操作、相对路径、原因、时间和结果；
- 不把文件内容、Credential 明文或完整 secret 写入审计；
- 不把所有 Space 同时暴露给一个 Agent；
- 不扩展为任意宿主文件浏览器。

高风险原始文件读取可能看到用户配置中的 secret，因此需要重新认证、明确原因和审计。普通配置 API 对 User 和 Admin 均继续默认脱敏。

### 10.3 命令行环境与软件安装

命令行不是普通数据功能。一旦 Agent 可以执行宿主 Shell，就可能绕过 Session、Workspace 和 Credential 的 Space 隔离。因此 Shell、浏览器、stdio MCP、Extension process 和 Service App action 无论部署规模如何，都必须使用同一个 Execution 入口：

```text
Space capability + Run
  -> resolve workspace / mounts / environment / credentials / network / budget
  -> immutable Execution Plan
  -> Execution Provider
  -> result / audit / usage
```

`workspace.files`、`process.execute` 和 `host.mount` 是可以组合的 capability，不是三种互斥模式。拥有 `process.execute` 但没有 `host.mount` 时，进程只能看到 Space 受管目录；授权某个 host mount 时，只增加该资源；显式授权宿主根目录意味着管理员接受相应风险，但仍走相同 Execution owner、审计和资源治理链路。

创建 NextClaw 用户不创建或暴露操作系统账号。Linux UID、rootless namespace、容器、MicroVM 或远程 Worker 是 provider 内部实现，用户看到的仍然只是自己的 Personal Space 和 capability 状态。当前 provider 不能落实 mount、进程、网络或资源约束时，对应 capability 显示为运行环境不可用并稳定拒绝，不能回退到另一执行路径。

软件安装按 owner 分层：

- Host Operator 可以使用宿主 root 安装系统依赖或构建基础镜像；
- Deployment Admin 可以发布所有允许用户共享的版本化工具链、镜像和只读 package cache；
- Space 用户在相应执行能力可用时，可以在自己的 Space environment 中安装 venv、npm prefix、用户级 binary 和私有依赖；
- Run 可以使用任务临时依赖，结束后回收。

普通用户和 Agent 不能通过 `sudo` 修改宿主，也不能因为在 Sandbox 内拥有 namespace root 就获得宿主 root。Space 安装的依赖、缓存、配置和生成数据只对本 Space 可见；共享 package 内容不共享 Credential、用户配置、写层或执行实例。

旧个人安装的管理员 Space 可以迁移现有 `process.execute` 和 host mount 范围，保持本机自动化体验；新 Space 不继承。Deployment Admin 的 Space elevation 不自动增加执行权限或 mount，Host Operator 的宿主 root 也不等于 Web 管理员身份。

## 11. Deployment Admin 功能

### 11.1 普通管理视图

不需要 elevation 的 Deployment 管理行为包括：

- 查看用户列表和 enabled/disabled 状态；
- 查看 Space ID、创建时间、最后活跃时间等管理 metadata；
- 查看版本、健康度、容量、capability 和执行 provider 状态；
- 查看部署审计；
- 管理 Global Skill；
- 创建、禁用、启用和重置用户。

这些行为默认不返回用户会话内容、文件内容、Provider secret 或其它个人数据。

### 11.2 进入目标 Space

管理员需要读取或修改某个 Space 内容时：

1. 明确选择一个 target Space；
2. 输入非空原因；
3. 重新认证；
4. 获得默认 15 分钟、最长 60 分钟的 elevation；
5. 通过相同的单 Space 功能链路执行操作；
6. 到期、主动结束、退出登录或 session 撤销后立即失效。

第一版 elevation 对目标 Space 提供完整管理能力，不增加 read/write/files/execute 细粒度矩阵。但 elevation 不改变目标 Space 的 capability、mount grant 或 Execution Plan；只有该 Space 本身已经获得相应授权且 provider 可以落实时，对应执行能力才可用。

### 11.3 批量操作

需要批量检查、备份或修复多个 Space 时，系统必须逐 Space 执行，每一步记录目标和结果。第一版不允许创建一个无 target Space 的“全局 Agent”读取所有用户数据。

### 11.4 第一版管理入口

第一版以 CLI/API 为主，不建设完整 Admin UI：

- 用户管理、Space capability 策略和 elevation 可以由 CLI/API 完成；
- Space 文件维护先使用本地 maintenance CLI；
- 普通用户 UI 只增加登录、当前身份和 capability 状态；
- 后续 Admin UI 必须复用相同权限和审计合同。

## 12. 权限矩阵

| 操作 | 普通 User | Deployment Admin 普通 session | Deployment Admin 有效 elevation | Host Operator |
| --- | --- | --- | --- | --- |
| 使用自己的 Space | 允许 | 允许 | 允许 | 产品授权不适用 |
| 查看其它用户 metadata | 拒绝 | 允许 | 允许 | 产品授权不适用 |
| 读取其它 Space 内容 | 拒绝 | 拒绝 | 允许，仅 target Space | 产品授权不适用 |
| 修改其它 Space 配置 | 拒绝 | 拒绝 | 允许，仅 target Space | 产品授权不适用 |
| 操作其它 Space 受管文件 | 拒绝 | 拒绝 | 允许，仅 target Space | 产品授权不适用 |
| 管理 Global Skill | 拒绝 | 允许 | 允许 | 产品授权不适用 |
| 管理 Deployment Model Offering / Shared Credential | 拒绝 | 允许 | 允许 | 产品授权不适用 |
| 管理自己的 Private Provider / BYOK | 允许 | 允许，仅自己的 Space | 允许，仅 target Space | 产品授权不适用 |
| 使用 Deployment Model Offering | 按 Deployment policy / quota | 按 Deployment policy / quota | 按 target Space policy / quota | 产品授权不适用 |
| 管理用户 | 拒绝 | 允许 | 允许 | 产品授权不适用 |
| 读取 Deployment Audit | 拒绝 | 允许 | 允许 | 产品授权不适用 |
| 使用 Space 已授权的 host capability | 按当前 Space grant | 按管理员自己的 Space grant | 按 target Space grant，不因 elevation 扩权 | 产品授权不适用 |
| 访问任意宿主文件/进程 | 拒绝 | 拒绝 | 拒绝 | 拥有宿主权限，位于产品边界外 |

## 13. 数据与对象归属

| 对象 | 归属 | 第一版行为 |
| --- | --- | --- |
| User、Membership、Access Session | Identity / Authorization | User 是 actor，Membership 关联 User 与 Space，Access Session 证明登录状态；三者都不直接成为个人产品数据 owner |
| Deployment Audit | Deployment | 仅管理员读取，append-only 语义 |
| Builtin / Global Skill Definition | System / Deployment | 所有用户可发现，普通用户只读 |
| Provider adapter / Model metadata | System | 共享实现和静态能力描述，不含 Credential |
| Deployment Model Offering / Shared Credential | Deployment | 管理员维护；Offering 可发现，Credential 不返回给用户 |
| Session、Message、Run、Event | Space | 只在当前 Space 查询、恢复和订阅 |
| Agent / Private Provider / Model Ref | Space | 用户独立；可以引用 Deployment Offering 或 Space Private Provider |
| Provider Credential | Space | 普通 API 脱敏，运行时只供当前 Space 使用 |
| Workspace / Private Skill | Space | 只允许当前 Space 与显式管理员维护访问 |
| Runtime snapshot | Run | 从当前 Space 解析，Run 结束后释放 |
| Search、Asset、Project、Cron、App 等 | Space | 旧数据归管理员 Space，新 Space 使用自己的空数据和相同功能语义 |

即使两个 Space 使用相同资源 ID，也必须被视为两个不同对象。普通用户接口不能提供 deployment-global 的个人数据搜索。

标识职责固定如下：

| 标识 | 回答的问题 | 可以决定什么 | 不能决定什么 |
| --- | --- | --- | --- |
| `userId` | 谁在操作 | 登录状态、Membership、授权主体和审计 actor | 不能直接选择 Session、Workspace、Config 或 Memory 分区 |
| `spaceId` | 操作哪一份个人数据 | 个人状态、文件、缓存、异步任务和执行资源归属 | 不能证明当前 User 有权访问该 Space |
| `userId + spaceId` | 谁要操作哪个 Space | Authorization 和 Audit | 不能作为绕过 Space owner 条件的管理员快捷路径 |

产品不引入含义模糊的 `ownerId` 把二者合并。第一版虽然是一个 User 对应一个默认 Space，但接口、迁移和数据生命周期不能依赖 `userId === spaceId`，也不能把这种一对一关系固化为个人数据的存储键。

## 14. 失败与边界行为

| 场景 | 产品行为 |
| --- | --- |
| 用户名或密码错误 | 返回统一认证失败，不披露用户名是否存在 |
| disabled User 登录 | 拒绝登录；普通响应不披露禁用原因细节 |
| 猜测其它 Space 的资源 ID | 表现为资源不存在，不披露 owner 或存在性 |
| 个人请求缺少 Space 归属 | fail closed，记录内部诊断，不回退到默认全局数据 |
| Space 未获得某项能力授权 | 返回 `CAPABILITY_NOT_GRANTED` 和可理解原因 |
| Space 已授权但缺少执行 provider | 返回 `CAPABILITY_RUNTIME_UNAVAILABLE`，说明缺少 Sandbox 或其它运行条件 |
| Model Ref 来源冲突 | 返回 `MODEL_REF_AMBIGUOUS`，要求明确 Deployment / Private 来源 |
| Model Offering 被删除或禁用 | 返回 `MODEL_UNAVAILABLE`，保留原配置并要求重新选择，不自动 fallback |
| Shared Credential 无效或超额 | 返回明确的 Credential / Quota 错误，不改用用户 BYOK |
| BYOK Credential 缺失 | 标记对应 Provider 未配置，只影响当前 Space |
| 管理员未提权访问内容 | 返回 `ADMIN_ELEVATION_REQUIRED` |
| elevation 到期 | 当前操作失败为 `ADMIN_ELEVATION_EXPIRED`，不自动续期 |
| 创建用户 preflight 失败 | 不改变 Deployment 状态，不创建 User/Space，返回阻塞项和修复建议 |
| 用户创建部分失败 | 整体回滚，不留下孤立 User 或 Space |
| Skill 名称冲突 | 不静默覆盖，要求明确来源 |
| 文件越界或 symlink | 拒绝并写安全日志，不返回宿主路径详情 |
| 配置修改时 Run 正在执行 | 当前 Run 保持原快照，新配置只影响后续 Run |

## 15. 审计功能

Deployment Audit 至少记录：

- User/Space bootstrap、旧数据迁移和创建用户 preflight；
- 创建、启用、禁用和重置用户；
- 管理员 elevation 的开始、结束、过期和失败；
- 管理员读取或修改目标 Space 配置和内容；
- 管理员对目标 Space 的文件操作；
- Global Skill 的安装、更新和删除；
- Deployment Model Offering、默认模型、模型锁定策略和 Shared Credential 的新增、修改与删除；
- 被拒绝的高风险越权尝试。

每条记录至少包含 `actorUserId`、action、target、reason、timestamp、request/correlation identity 和 result；只要操作针对个人数据，还必须包含明确的 `targetSpaceId`。Deployment 级操作可以没有 `targetSpaceId`，但不能用通配 Space 表达。审计不保存密码、完整 token、Provider secret、文件正文或会话正文。

普通用户第一版不能读取 Deployment Audit。用户自己的普通 Chat 和文件操作不需要全部进入 Deployment Audit，继续使用各 feature 自己的历史与日志。

## 16. 用户流程

### 16.1 现有单用户升级

```text
升级 NextClaw
  -> 自动创建默认 User / Personal Space
  -> 迁移原配置、workspace 和文本 sessions
  -> 用户按原方式进入产品
  -> 历史内容可见，界面不要求选择 Space
```

### 16.2 创建新用户

```text
管理员设置密码
  -> 运行创建用户 preflight
  -> 必要时补齐 Space owner 或执行 provider
  -> 创建新 User 和默认 Space
  -> 配置该 Space 的 capability grant
  -> 新用户登录自己的 NextClaw
```

### 16.3 普通用户使用全局与私有 Skill

```text
用户打开 Skill 目录
  -> 同时看到 Builtin / Global / Private 来源
  -> 选择一个无歧义 Skill
  -> Run 使用当前 Space 的配置、Credential 和 workspace
  -> 运行数据只写回当前 Space
```

### 16.4 管理员维护用户文件

```text
管理员查看 Space metadata
  -> 选择 target Space
  -> 输入原因并重新认证
  -> 获得限时 elevation
  -> maintenance CLI 操作目标 Space 受管文件
  -> 每次操作写审计
  -> 主动结束或等待 elevation 到期
```

## 17. 性能与规模的产品要求

功能层冻结以下用户可观察要求：

- 注册但不活跃的用户不应常驻一套 Kernel、Agent runtime、文件 watcher 或 Provider client；
- 冷 Space 只占持久存储，不持续占用执行资源；
- 用户开始请求时才按需加载其会话、配置和运行资源，空闲后可以释放；
- 现有单用户安装升级后不得因为“具备多用户能力”被要求升级 VPS 规格；稳定 idle、基础聊天和单次远程模型 Run 的资源使用必须保持在升级前同一支持档位内；
- 未配置 PostgreSQL、S3、远程 Worker 或额外 Sandbox 时，相关模块不加载 client、不创建连接池、不启动后台 timer/process；
- 一个用户高负载不能无限占用所有执行槽位；超限时应排队或明确拒绝；
- 1C1G 一类低配节点可以承载个人或少量用户的基础文本功能，但不承诺在本机承载百万用户；
- 百万注册用户依靠相同功能语义下的共享持久化和横向扩展资源，不能要求每用户一个常驻进程；
- 用户不因扩容改变登录方式、Space identity、会话格式或 Skill 语义。

具体并发、内存、延迟和容量数字由架构与容量验证文档冻结，功能设计不虚构尚未测量的承诺。

## 18. 第一版验收场景

### 18.1 正常功能

- 旧单用户升级后可以看到原文本会话、Agent/Provider 配置和 workspace。
- 管理员无需切换模式或重启，即可创建两个不同用户和各自的默认 Space。
- 两个用户可以分别登录、创建会话、发起 Run、刷新页面并恢复自己的事件。
- 两个用户可以使用相同 Agent/Provider 名称而获得不同配置结果。
- 管理员可以配置一个 Deployment Shared Model，两个 Space 都可发现并使用，Usage 分别归属各自 Space。
- 旧管理员 Provider 升级后只在管理员 Space 可见，未经显式发布不能被新用户发现或使用。
- 管理员可以配置一个 BYOK Template，两个用户分别保存自己的 Key 且互不读取。
- 用户可以在策略允许时增加 Private Provider，并将其设置为自己的默认模型，不影响其它 Space。
- 管理员锁定 Deployment 默认模型时，用户不能用 Space 配置绕过；解除锁定后可以恢复个人选择。
- 删除仍被引用的 Global Model Offering 会产生明确不可用状态，不会静默切换模型或 Credential。
- 两个用户能发现相同 Global Skill，同时只看到各自的 Private Skill。
- 用户可以在自己的 workspace 中创建、修改、移动和删除文件。

### 18.2 隔离与权限

- 用户 A 使用用户 B 的 Session/Run/Event ID 不能获得内容或存在性。
- 即使两个 Space 存在相同的 Session、Asset 或 Skill ID，读取、修改、事件订阅和缓存也只命中当前 Space。
- 用户 A 无法读取用户 B 的 Provider secret、Private Skill 或 workspace 文件。
- Deployment Admin 普通 session 不能访问用户 Space 内容。
- Deployment Admin 取得目标 Space elevation 后可以维护该 Space，不能同时访问另一个未选择的 Space。
- elevation 到期或结束后，后续操作立即失败。
- 管理员所有跨 Space 内容与文件操作都有审计。
- 审计可以明确回答“哪个 `userId` 对哪个 `spaceId` 做了什么”；数据 owner 不因为 actor 是管理员而省略目标 Space。
- symlink、`..`、绝对路径和路径替换竞争不能逃离 workspace。

### 18.3 同构能力与授权

- 创建第二个用户前后，管理员 Space 原有数据和已授权功能保持不变。
- 新 Space 的 Search、Asset、Project、Cron、Channel、App、MCP 和 Extension 使用自己的配置、数据和运行实例，不读取管理员 Space。
- UI 能获取 capability summary，区分未配置、未授权和缺少执行 provider，不把它们表现为随机错误。
- 直接调用未授权能力的 API 仍然稳定拒绝。
- 新增、禁用或删除用户不会改变其它 Space 的 capability grant。
- Shell、浏览器和 stdio 等能力仅在目标 Space 获得 `process.execute` 且 Execution provider 可以落实计划时可用。
- Host 文件、设备和其它宿主资源只通过显式 `host.mount` 暴露；provider 不可用时不会回退到无约束宿主进程。
- 用户 A 安装的软件、依赖写层、环境变量和命令历史不会出现在用户 B 的命令环境中。
- 普通 Agent 不能取得宿主 root；Deployment Admin elevation 也不会隐式获得宿主 Shell。

### 18.4 生命周期

- 修改或重置密码会撤销旧 session。
- 禁用用户会撤销连接、拒绝新 Run 并处理排队/运行中任务，但保留数据。
- Membership 撤销后 User 立即失去目标 Space 访问权，但 Space 数据和其中的资源 ID 不因授权关系变化而改写或删除。
- 服务重启不会把未完成 Run 恢复到错误 Space。
- 用户创建失败不会留下孤立身份或目录。

## 19. 第一版明确不做

- 公开注册、邀请、组织和 SSO；
- 一个用户多个 Space、Space 切换和多人共享 Space；
- 完整 Admin UI；
- 用户删除、导出、转移和保留期管理；
- 管理员细粒度 capability matrix；
- Skill required/available/blocked、版本 pin，以及面向 Skill/App/Provider 的通用 Credential Broker；模型 Shared Credential 首版复用现有 secret owner；
- 组织、用户组和复杂 per-Space Model Offering 分发策略；
- 在 Deployment Shared Credential 与 Space BYOK 之间自动容错或静默切换；
- 自动给所有新 Space 授予 `process.execute` 或宿主 mount；
- 在 Execution provider 无法落实计划时运行危险宿主命令；
- 以“功能完整”为理由保留任何跨 Space fallback。

## 20. 后续功能解锁模板

未来每开放一项能力，功能设计必须补充：

1. 用户能看到和操作什么；
2. 对象归属哪个 Space；
3. 管理员如何显式维护；
4. 异步任务、事件和恢复如何保持原归属；
5. 配额和高负载时如何表现；
6. 与其它用户相同资源 ID 时如何隔离；
7. UI capability 状态如何从 unavailable 变为 available；
8. 需要哪些正常、越权和生命周期验收场景。
9. 如果后续阶段永远不实施，当前阶段如何保持现有行为完整、数据唯一且可恢复。

完成这些功能合同后，架构文档再决定对应 owner 和 provider，不允许先删除 capability gate 再补隔离。

## 21. 待后续 Review 的产品参数

以下参数不阻塞功能结构，但在正式实现对应入口前必须冻结：

1. AdminElevation 默认 15 分钟、最大 60 分钟是否符合实际运维频率；
2. Deployment Audit 默认保留期和导出策略；
3. 用户密码最小规则、失败重试和本地账号锁定策略；
4. Global Skill 删除或更新时，是否需要向受影响用户显示通知；
5. 用户禁用时 active Run 的最大停止等待时间；
6. capability summary 在现有设置页、账号菜单或独立系统状态入口中的最终呈现位置；
7. 实施阶段按什么 owner 顺序空间化 Search、Project、Cron 和 Channel，同时保证发布时不形成用户数量触发的功能降级；
8. 管理员锁定模型时是否允许某些系统维护 Run 使用独立的 Deployment maintenance model；
9. Deployment Shared Credential 的默认 Space 配额、全局预算和超额提示方式。

## 22. 决策记录

| 日期 | 版本 | 结论 | 状态 |
| --- | --- | --- | --- |
| 2026-08-16 | v0.1 | 冻结“每个用户看到自己的个人 NextClaw”作为上位产品语义；第一版只开放最小文本主链、managed workspace、Global/Private Skill 和显式管理员维护，未隔离能力通过 capability 状态统一关闭 | 已被 v0.2 修正 |
| 2026-08-16 | v0.2 | 删除多用户激活、永久 marker、受控重启和按用户数量关闭功能；所有部署默认拥有管理员 Space，旧数据归管理员 Space，新增用户只增加空 Space，host capability 改为 Space 级 grant | 已被 v0.3 扩展，仍然有效 |
| 2026-08-16 | v0.3 | 冻结管理员全局 Model Offering、BYOK Template 和用户 Private Provider 三种形态；Credential owner 与模型来源显式，支持 Deployment 默认/锁定与 Space 个人选择，禁止跨来源静默 fallback | 已被 v0.4 扩展，仍然有效 |
| 2026-08-16 | v0.4 | 尝试以 managed/sandboxed/trusted-host 三态表达命令行行为；冻结 NextClaw 用户不等于 OS 用户、宿主 root 与软件四层 owner | 已被 v0.5 收敛 |
| 2026-08-16 | v0.5 | 删除单 owner/多用户和三态执行模式；所有 Space 统一使用 capability-driven Execution Plan，宿主访问只是显式 mount grant，provider 差异不上浮 | 已被 v0.6 扩展，仍然有效 |
| 2026-08-17 | v0.6 | 冻结单用户资源不回退：具备多用户与横向扩展能力不能提高单 Space 部署的最低 CPU/内存档位；未配置 provider/runtime 必须保持未加载、无连接、无后台任务 | 已被 v0.7 扩展，仍然有效 |
| 2026-08-17 | v0.7 | 冻结 User/Space 标识职责：User 是认证与审计 actor，Space 是个人产品数据 owner；普通客户端不选择任意 Space，权限关联 `userId + spaceId`，个人状态始终按 `spaceId` 隔离，管理员操作也必须保留明确目标 Space | 当前判断，待产品 Review |
| 2026-08-18 | v0.8 | 冻结可停止交付合同：每个阶段必须可独立发布并保持现有管理员行为无损；开发双 Space fixture 可提前存在，但真实第二用户入口必须等当前发布能力的 Space owner 纵向闭环后再放行。该顺序不引入激活模式或用户数量分支 | 当前判断，待实施验证 |
