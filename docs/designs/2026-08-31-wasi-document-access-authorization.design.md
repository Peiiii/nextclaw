# WASI 文档访问后置授权设计

## 文档状态

- 日期：2026-08-31
- 状态：Phase A 已本地实现并验证，待用户验收；Phase B `DocumentRef` 保持后续范围
- 对应问题：[NC-163：WASI DocumentAccess 补齐用户目录授权与管理的正式闭环](https://linear.app/dimstack/issue/NC-163/wasi-documentaccess-%E8%A1%A5%E9%BD%90%E7%94%A8%E6%88%B7%E7%9B%AE%E5%BD%95%E6%8E%88%E6%9D%83%E4%B8%8E%E7%AE%A1%E7%90%86%E7%9A%84%E6%AD%A3%E5%BC%8F%E9%97%AD%E7%8E%AF)
- 上位设计：[Portable Runtime 能力闭合设计](./2026-08-30-portable-runtime-capability-closure.design.md)
- 设计缺口：Level 2，能力面缺失
- 实施计划：[WASI 文档访问后置授权实施计划](../plans/2026-08-31-wasi-document-access-authorization.plan.md)

本文是上位设计“用户 Documents/workspace”能力的聚焦补充。现有实现已经能把已存在的 registry grant 解析为 WASI preopen，也能在 capability fingerprint 变化时轮换 runner lane；但产品没有正式入口让用户创建、查看、替换和撤销这些 grant，缺授权时的错误合同与文档也不一致。因而“底层能 mount”不等于“用户目录授权已经闭环”。

## 一、结论

NC-163 是真实问题，不是重复能力或误报。缺失的是 NextClaw 产品授权面，而不是 WASI 文件系统本身。

推荐采用浏览器文件选择器式的后置授权体验，但不照搬浏览器上传语义：

1. App manifest 只声明能力上限，不在安装时自动获得任何用户目录。
2. 用户真正使用相关功能时，由宿主打开文件或目录选择器并明确确认权限。
3. 临时处理一个文件或目录使用一次性 `DocumentRef`，只绑定当前 invocation/job。
4. 知识库、工作区、编辑器、同步器和 Resident watcher 使用命名的持久 document scope，授权持续到用户撤销或声明失效。
5. 未声明的 App 可以接收显式的 `DocumentRef` 输入，但不能获得未声明的持久目录权限。
6. Guest 永远只看到稳定虚拟路径或 opaque reference，不看到宿主真实路径，也不能把选择器当作任意文件系统逃生口。
7. 前端复用现有服务端目录选择器；App 权限说明、模式选择和 grant mutation 由 Apps 业务层拥有，不复制目录浏览组件。

NC-163 的必交付范围是命名 scope 的使用时授权和管理闭环；`DocumentRef` 的合同在本文中一并冻结，但实现可以作为紧邻后续批次，不阻塞 NC-163 的核心关闭。

## 二、问题与现状证据

当前链路已经具备下列底层能力：

- manifest schema 可以声明 `permissions.documentAccess[]`，每个 scope 有稳定 `id`、最大 `mode` 和用途描述。
- App registry 可以保存和删除 document grant。
- Kernel capability resolver 可以把有效 grant 解析为实例 capability snapshot。
- WASI runner 可以按 snapshot 将宿主目录 preopen 到 `/documents/<scope-id>`。
- grant 变化会改变 capability fingerprint，运行时可以停止并重建受影响 lane。

但正式产品链缺失：

- `nextclaw app` 没有 inspect/grant/replace/revoke 命令。
- Server API 没有 document grant 管理接口。
- `AppPackageView` 没有向 UI 投影 scope 声明、授权状态和实际资源摘要。
- Apps UI 没有选择器、权限说明、模式升级、替换和撤销入口。
- resolver 会跳过缺失 grant，runner 最终暴露通用 `WASI_COMPONENT_FAILED`；公开文档却承诺 `WASI_CAPABILITY_DENIED`。
- 当前 `PRT-FILE-001` 证据主要验证 runner 接受合成 mount，不能证明真实用户从产品入口完成授权、调用和撤权。

因此，这不是再加一个 CLI 命令即可关闭的局部缺口，而是同时跨越 manifest、Kernel owner、持久化、Server、CLI、UI、runner 生命周期、错误合同和验收证据的能力面缺失。

## 三、用户任务与成功定义

### 3.1 用户任务

用户安装一个需要处理文件的 Portable App 后，应当能够：

- 在真正需要文件时再选择文件或目录，而不是安装时被迫配置。
- 清楚知道哪个 App、为什么、将以只读还是读写方式访问哪个资源。
- 对临时任务只授权一次，不留下持续权限。
- 对长期工作区保存授权，重启 NextClaw 后继续使用。
- 随时查看、替换、降级或撤销持久权限。
- 撤销后确信新调用和后台任务不能继续访问原目录。
- 在 Agent、Panel、CLI 和自动化入口遇到同一缺授权状态与恢复动作。

### 3.2 完成定义

以下全部成立才算闭环：

- App 未获授权仍可安装；无关功能仍可运行。
- 首次触达受限功能时返回结构化 `authorization-required`，而不是通用运行失败。
- 用户通过正式 UI 或 CLI 完成选择和确认后，下一次调用获得精确 scope/mode。
- grant 在 host restart 后继续生效；replace/revoke 立即使旧 capability snapshot 失效。
- read grant 不能写，目录 A 的 grant 不能访问目录 B，Guest 不能获得真实宿主路径。
- Resident 或长任务在撤权后停止使用旧句柄，并在下一安全检查点终止或进入明确失败状态。
- 更新、回滚、禁用、卸载和目录失效都有确定行为。
- `PRT-FILE-001` 由真实安装实例和正式产品入口产生证据，不再只凭 runner 合成 mount 判定通过。

## 四、范围与非目标

### 4.1 本设计范围

- WASI Portable App 对用户选择文件和目录的授权模型。
- 命名持久 scope 与一次性 `DocumentRef` 的边界。
- AppPackage、registry、Server、CLI、UI 和 runtime 的 owner 与事件流。
- read/read-write 升级、替换、撤销、失效和 App 生命周期语义。
- Agent/Panel/CLI/Resident/远程宿主的交互一致性。
- 错误、审计和验收合同。

### 4.2 非目标

- 不把任意宿主文件系统暴露给 WASI Guest。
- 不为 `native-process` App 提供同等沙箱承诺；它继承宿主进程权限，必须继续作为低推荐 escape hatch 提示。
- 不在安装时默认弹出目录选择器。
- 不以聊天会话作为权限生命周期；App 可能由 Panel、CLI、Agent、Resident 或 automation 调用。
- 不把浏览器上传到服务器的临时副本伪装成远程宿主目录 mount。
- 不在本批次统一 Agent、Desktop、Panel 等其它 capability grant 存储；document mount 继续只有一个持久事实源。
- 不允许 App 自己提供字符串路径来绕过宿主选择器和 canonicalization。

## 五、方案比较

| 方案 | 优点 | 关键问题 | 结论 |
| --- | --- | --- | --- |
| 安装前静态挂载 | 运行时简单，适合固定服务器部署 | 打断安装；用户尚不知道用途；过度授权；一次性任务体验差 | 仅保留为 CLI/无人值守显式配置能力，不作为默认 UX |
| 完全动态且无需声明 | 最灵活，App 可随时请求任何资源 | manifest 无法审计能力上限；商店与安装提示失真；持久权限容易膨胀 | 拒绝用于持久 grant |
| 声明上限 + 使用时授权 | 安装轻量；最小权限；可审计；同时覆盖一次性和长期任务 | 需要结构化恢复、picker、lane invalidation 和完整状态管理 | 采用 |

核心取舍是把“声明”和“授权”分开：声明回答 App 最多可能需要什么；授权回答用户现在实际给了什么。声明绝不等于自动授权。

## 六、统一授权模型

### 6.1 三类存储不可混用

| 类型 | Guest 视图 | 来源 | 生命周期 | 是否提示用户 |
| --- | --- | --- | --- | --- |
| 包内 assets | `/app` | artifact | 随版本 | 否 |
| App 私有存储 | `/data`、`/cache`、`/tmp` 等 | App instance home | 随实例与卸载策略 | 否 |
| 用户文档 | `/documents/<scope-id>` 或 `DocumentRef` | 用户显式选择 | once 或 persistent | 是 |

App 即使没有任何 document grant，仍然可以读包内 assets、使用自己的 data/cache/temp，并执行不依赖用户目录的功能。它不能因此访问用户真实 Documents、Desktop 或任意绝对路径。

当前默认 App home 位于 `~/.nextclaw/apps`，实例私有目录位于 `instances/<app-id>/default/{data,config,state,cache,tmp,logs}`，授权记录位于 `registry.json`；`NEXTCLAW_APP_HOME` 可以覆盖根目录。这里保存的是 App 私有数据和授权元数据，不是被授权用户目录的副本。

WASI preopen 在效果上接近 Docker bind mount：Guest 通过一个稳定虚拟路径访问宿主选中的原始资源，read-write 操作会修改原文件；不同点是它主要依靠宿主授予的目录 handle/capability，而不是把完整宿主路径和容器 mount namespace 交给 Guest。未 mount 时，WASI App 对用户目录既不能读也不能写，但仍能使用上述私有存储。一次性浏览器上传若采用复制对象，则属于 `DocumentRef` 的另一种 transport，不应冒充原目录 mount。

### 6.2 命名持久 scope

manifest 继续使用现有声明形态：

```yaml
permissions:
  documentAccess:
    - id: workspace
      mode: read-write
      description: 读取并更新你的项目工作区
```

合同如下：

- `id` 是 App 版本间稳定的产品语义标识，也是 Guest mount path 的组成部分。
- `mode` 是权限上限。用户可以只授予 `read`，但不能超过声明上限授予 `read-write`。
- `description` 必须是用户可理解的用途，展示在授权和管理界面。
- 未 grant 时 scope 不存在；不创建空目录、不回退到 App private data，也不静默选择默认目录。
- 持久 grant 只能绑定到已声明 scope。任何未声明或声明已移除的持久 grant 都不得进入 capability snapshot。
- grant 绑定具体 App identity 和安装实例，不跨 App 共享。

第一阶段不扩张 manifest schema。某个 action 是否必须使用某个 scope，由调用实现和结构化缺授权结果表达；待 action capability dependency 成为稳定公共合同后再单独设计，避免在 NC-163 中新增第二套半成品声明。

### 6.3 一次性 `DocumentRef`

`DocumentRef` 用于“选择这个文件并让 App 处理一次”，语义更接近浏览器 file picker：

```text
DocumentRef {
  id,
  kind: file | directory,
  mode: read | read-write,
  invocationId | jobId,
  opaqueHostReference,
  displayName,
  expiresAt,
  status
}
```

- action 输入合同必须显式接受 `DocumentRef`；仅有普通 string/path 参数不能触发文件权限。
- 用户选择后，reference 只进入当前 invocation/job 的 ephemeral capability snapshot，不写入 App registry。
- invocation/job terminal、取消、超时、宿主重启或到期都会使 reference 失效。
- Guest 只收到临时虚拟路径或 handle；输出和日志不得包含宿主路径。
- 未声明持久 `documentAccess` 的 App 可以接收一次性 `DocumentRef`，因为用户直接为具体调用提供了资源；它仍不能把该资源升级成持久 mount。
- “仅本次”与“始终允许”不能只是同一 grant 的布尔开关：两者使用不同 owner 和生命周期，避免临时输入意外变成 ambient authority。

`DocumentRef` 是本文冻结的相邻合同。NC-163 第一阶段只需预留结构化错误与输入扩展点，不要求同时交付完整上传、导出和跨设备传输。

### 6.4 为什么不用“会话授权”

聊天会话不是稳定的资源 owner：用户可能关闭面板但后台 job 仍在运行，也可能从 CLI 或 automation 调用同一 App。权限生命周期固定为：

- `once`：绑定 invocation/job。
- `persistent`：绑定 App instance + named scope，直到 revoke、声明失效或卸载清理。

如果未来需要“本次工作区打开期间”，应引入独立 workspace lease owner，而不是借用 chat/session id。

## 七、状态 owner 与数据合同

### 7.1 唯一产品 owner

Kernel `AppPackageManager` 是 document access 的产品 API owner：

- 读取当前 App manifest 声明。
- 计算 scope 的 `undeclared | ungranted | granted | insufficient | unavailable | stale` 状态。
- 校验选择结果、真实路径、资源类型、模式和声明上限。
- 创建、替换、降级和撤销持久 grant。
- 触发 runtime capability invalidation。
- 向 Server、CLI、UI 和 Agent 恢复动作输出同一 view/error contract。

现有 App registry 继续作为持久 grant 的唯一事实源；runtime resolver 只消费 Kernel 已校验的 grant，不另存权限。现有 generic capability grant store 不复制 document mount 状态，避免双 owner。registry service 是持久化 adapter，不向 UI 或 CLI直接暴露业务语义。

一次性 `DocumentRef` 由 invocation/job owner 保存在内存和受控 journal 中，不能落入 App registry。宿主重启后的非 terminal job 按现有 interrupted 合同处理，不恢复旧临时文件权限。

### 7.2 持久 grant 记录

逻辑记录至少包含：

```text
appId, instanceId, scopeId,
declarationFingerprint,
resourceKind,
opaqueHostReference,
displayPathOrName,
effectiveMode,
grantedAt, lastUsedAt,
status
```

要求：

- `opaqueHostReference` 优先使用平台可恢复的安全 reference；当前 raw canonical path 可以作为迁移期实现，但不能通过产品 API、Guest、日志或 VerificationRecord 泄露。
- `displayPathOrName` 只用于宿主侧权限管理 UI，并按隐私规则脱敏；远程客户端只能看当前账号有权查看的摘要。
- `declarationFingerprint` 至少覆盖 scope id、kind 约束和最大 mode。声明收窄或删除时，旧 grant 变为 `stale`，不得继续运行。
- `lastUsedAt` 由成功装配并开始调用时更新，供用户识别长期未使用权限；不能因单纯查看页面刷新。

### 7.3 对外 view

`AppPackageView` 为每个声明 scope 投影：

```text
id, description, declaredMode,
grantStatus, effectiveMode,
resourceKind, displayResource,
grantedAt, lastUsedAt,
availableActions[]
```

`availableActions` 只能来自 owner 状态机，例如 `grant | replace | upgrade | downgrade | revoke | locate`；前端不得自行猜测。

## 八、端到端主链

### 8.1 正常后置授权

```text
App action invocation
  -> Kernel 解析 action 与当前 capability snapshot
  -> 缺少 named scope，返回 authorization-required + scope metadata
  -> Panel / Agent / CLI 展示恢复动作
  -> 前端共享的服务端目录 picker 选择 runtime host 上的目录
  -> Kernel canonicalize + declaration/mode/type 校验
  -> App registry 原子写入或替换 grant
  -> runtime 使目标 App instance 的旧 snapshot/lane 失效
  -> 用户明确继续或重新调用
  -> resolver 生成新 snapshot
  -> runner preopen 到 /documents/<scope-id>
  -> Guest 执行并产生脱敏审计
```

授权后不做隐藏自动重试。UI 可以提供“授权并继续”，但必须让用户知道原调用会重新执行；对可能产生副作用的 action 使用新 invocation id，并遵守其幂等合同。

### 8.2 主动管理

```text
Apps > App 详情 > 文件与文件夹
  -> 读取 AppPackageView
  -> Grant / Replace / Upgrade / Downgrade / Revoke
  -> Kernel 校验并原子更新 registry
  -> capability invalidation
  -> UI 重新读取 owner 状态
```

CLI 和 Server 复用相同 owner：

```text
nextclaw app permissions inspect <app-id>
nextclaw app permissions document grant <app-id> <scope-id> [--read-only]
nextclaw app permissions document revoke <app-id> <scope-id>
```

命令名在实施阶段按 CLI 注册树约束最终冻结；CLI 不接受未经用户确认的 App 提供路径。CLI 由操作者显式传入 runtime host 上的路径，并在确认 App、scope、用途、模式和路径摘要后授权；是否增加本机原生 picker 属于后续宿主体验优化，不是 CLI 合同前提。

### 8.3 撤销与失效

```text
revoke / replace / declaration change / resource unavailable
  -> registry 状态变化
  -> capability fingerprint 变化
  -> 停止或隔离目标 App instance lane
  -> 新调用不再获得旧 preopen
  -> 运行中 job 在下一安全检查点终止
  -> Resident watcher 停止并记录结构化原因
```

不能只让“下一次重启后生效”。旧 lane、缓存的 snapshot 和持有的 descriptor 必须一起失效；无法安全回收时终止目标 lane，不影响其它 App。

## 九、交互设计

### 9.1 Apps 权限管理页

每个 declared scope 显示：

- 用途描述和声明上限。
- 当前状态：未授权、只读、读写、不可用或声明已变化。
- 宿主侧资源摘要、授权时间和最近使用时间。
- 根据状态提供选择、替换、升级、降级、重新定位和撤销。

安装页只提示“这个 App 可能在使用相关功能时请求文件/文件夹”，默认不弹 picker。required/optional 语义没有稳定声明前，不得用“安装缺配置”阻止整个 App enable。

### 9.2 使用时提示

授权提示必须同时显示：

- 请求方 App 名称与可信发布信息。
- manifest 中的 scope 用途。
- 用户选择的资源摘要。
- 实际授予模式，不用模糊的“完全访问”。
- 持久权限的撤销入口。

read-write 必须醒目标识；如果 read 足以完成当前任务，默认授予 read。read 到 read-write 的升级需要新的用户动作和确认，不能由失败后的 Guest 自动升级。

picker 取消是用户选择，不显示为 App 故障，也不创建空 grant。

### 9.3 Agent 与 CLI

Agent 收到 `authorization-required` 时可以解释用途并发起宿主选择动作，但不能代表用户选择目录或确认持久读写权限。CLI 在非交互模式缺授权时直接返回结构化错误和下一步命令，不尝试猜测当前目录。

### 9.4 本机与远程宿主

- NextClaw UI 默认复用服务端目录 picker，选择的始终是 Portable App 实际运行主机上的资源；本机 Desktop 只是“UI 与 runtime host 恰好同机”的特例。
- Web UI 连接远程 NextClaw：继续使用同一 server-side picker 或受控管理员路径选择流程，不能调用浏览器本地 picker 后把客户端路径当作服务端路径。
- Electron 原生 picker 可以作为同机 Desktop 的 host adapter 后续接入，但必须返回与服务端 picker 相同的 host path selection contract，也不能绕过 Kernel grant 校验；Phase A 不以新增 Electron IPC 为前提。
- 浏览器本地选择后上传：产生的是一次性上传对象或 `DocumentRef`，不是远程宿主目录的持久 mount。
- 产品必须明确标注“选择本机文件”和“选择运行主机目录”，避免把两台机器的路径混为一体。

### 9.5 前端复用与组件 owner

仓库已有共享的 [`ServerPathPickerDialog`](../../packages/nextclaw-ui/src/shared/components/path-picker/server-path-picker-dialog.tsx)，并已被新建项目和会话项目目录切换复用。它已经拥有服务端路径浏览、跨平台常用位置、地址导航、前进/后退、面包屑、搜索、新建目录、单击选择、双击进入、键盘移动以及 loading/error/empty 状态。Phase A 不应再实现第二套文件夹树或路径输入弹窗。

组件边界固定为：

| owner | 负责 | 不负责 |
| --- | --- | --- |
| shared path-picker | 浏览 runtime host 路径、目录选择、导航、搜索、键盘与通用反馈 | App 身份、scope、权限用途、read/read-write、grant/revoke API |
| Apps `AppDocumentGrantDialog`/manager | App 与 scope 摘要、模式选择、授权风险、提交状态、错误恢复、grant/replace/upgrade | 复制路径浏览、自己 canonicalize、直接写 registry |
| Kernel permission owner | 声明上限、路径/type/mode 校验、原子 grant、invalidation、结构化错误 | 前端弹层状态和视觉交互 |

Phase A 的 named scope 当前只挂载目录，可以直接复用现有 `ServerPathPickerDialog`。业务层为它提供权限语境化的 `title/description/hint/confirmLabel`，并在最终提交前同时展示 App、用途、所选目录和 effective mode。picker 的确认动作是状态修改，保持 `<button>` 语义；取消、加载、失败、禁用和焦点返回沿用 shared dialog 合同。

权限确认不能通过在页面外层再嵌套一个 modal 实现。实施时应选择一种单一流：要么由 Apps 页面先选择 mode，再打开语境化 picker 并一次确认；要么提取可复用的 path-picker content，由业务 dialog 编排“选择资源 → 确认权限”两步。无论哪种方式，shared picker 都不依赖 App API，Apps 也不复制其内部列表与导航状态。

现有 `useServerPathBrowse` 和 Server browse contract 已支持 `includeFiles`，但 `ServerPathPickerDialog` 当前会主动过滤为目录，列表图标、Enter/双击行为也按目录设计。因此 Phase B 的单文件 `DocumentRef` 应将 shared primitive 显式泛化为 `selectionKind: directory | file | both`，同步处理文件选择与目录进入的不同键盘/双击语义；不能只打开 `includeFiles` 就宣称文件 picker 已完成，更不能另建一套平行 picker。

## 十、生命周期合同

| 事件 | 持久 named scope | 一次性 `DocumentRef` |
| --- | --- | --- |
| install | 不自动创建 grant | 不适用 |
| enable | scope 缺失不阻止无关功能；受限调用后置请求 | 不适用 |
| host restart | 重新解析安全 reference，成功则保留 | 全部失效；未完成 job interrupted |
| app update | declaration fingerprint 兼容则保留；收窄、删除或类型变化则 stale | 当前调用不跨更新迁移 |
| rollback | 按回滚版本声明重新验证，不因旧版本曾获授权自动放宽 | 失效 |
| replace | 原子替换并立即 invalidation | 不适用 |
| revoke | 删除 active grant；新调用立即拒绝；目标 lane 停止 | 主动取消当前 ref/job |
| disable | grant 可保留但不装配；Resident 停止 | 当前 ref/job 取消 |
| uninstall retain-data | 私有数据可保留，active grant 必须删除 | 全部失效 |
| uninstall purge | grant、binding 与 App data 一并删除 | 全部失效 |
| 文件移动/磁盘卸载 | 标为 unavailable，不回退到同名路径 | 当前调用失败并失效 |

grant 兼容条件必须是显式 allowlist：相同 scope id、相同资源 kind、声明 mode 未低于 effective mode，且 App identity/instance 未变化。其余情况 fail closed。

## 十一、稳定错误与恢复合同

| code | 含义 | 可恢复动作 |
| --- | --- | --- |
| `DOCUMENT_SCOPE_NOT_GRANTED` | manifest 已声明，但当前 instance 未授权 | grant / choose |
| `DOCUMENT_SCOPE_MODE_INSUFFICIENT` | 已有模式低于本次操作需要 | upgrade 或使用只读功能 |
| `DOCUMENT_SCOPE_UNAVAILABLE` | 已授权资源移动、卸载或 reference 无法恢复 | locate / replace / revoke |
| `DOCUMENT_SCOPE_REVOKED` | 调用或 job 使用期间被撤权 | 停止；重新授权后新调用 |
| `DOCUMENT_REFERENCE_EXPIRED` | 一次性 ref 已过期或调用已结束 | 重新选择 |
| `DOCUMENT_SELECTION_CANCELLED` | 用户取消 picker | 返回取消，不计为 App failure |

所有错误共同包含稳定的 `appId`、`scopeId`（若适用）、`requestedMode`、`currentStatus` 和允许的 recovery actions；不得包含真实宿主路径或文件正文。

runner 的底层 trap 可以作为 cause 留在脱敏诊断中，但产品入口必须在实例化前尽可能由 Kernel 返回上述错误。公开文档、CLI exit contract、Server response 和 Panel 状态只引用同一错误 owner。

## 十二、安全与隐私约束

- 所有 grant 都需要可归因的用户动作；App 不能通过 WIT、stdout、日志或返回值触发静默授权。
- 宿主在写入 grant 前执行 realpath/canonicalization、资源类型校验和平台安全 reference 创建。
- mount 固定到选中目录句柄，拒绝 `..`、symlink escape、设备文件、跨 scope rename/link 和声明外模式。
- Guest path 稳定为 `/documents/<scope-id>`；真实路径只在宿主权限管理面按需显示。
- 每次装配记录 app/instance/scope/effective mode/reference digest/call/trace，不记录路径正文和文档内容。
- grant 不随导出、备份或 App 数据迁移到另一台主机自动恢复为 active；目标主机必须重新确认资源。
- 平台 permission/bookmark 被系统撤销时，NextClaw 同步为 unavailable 或 revoked，不能因为 registry 仍有记录而视为有效。
- App 更新后的新用途描述不能覆盖用户当初授权语义；declaration fingerprint 不兼容时要求重新确认。
- 授权管理页必须支持一键撤销，而不是要求用户删除 App 或手工修改 registry。

## 十三、验收与证据设计

### 13.1 `PRT-FILE-001` 必须升级为产品链验收

真实场景至少覆盖：

1. 安装声明 `read` 与 `read-write` scope 的正式测试 App。
2. 未授权时调用受限 action，得到 `DOCUMENT_SCOPE_NOT_GRANTED` 和可执行恢复动作。
3. 通过正式 Kernel API 的 CLI 或 UI grant 入口选择目录。
4. read scope 能读取、不能写入；read-write scope 能在所选目录写入。
5. 不能访问父目录、相邻目录、另一 App scope 或宿主真实路径。
6. host restart 后持久 grant 仍可恢复。
7. replace 后旧目录立即不可见，新目录生效。
8. revoke 后新调用拒绝，Resident/长任务停止，旧 lane 不再持有可用 descriptor。
9. App 更新的兼容声明保留 grant，不兼容声明变为 stale 并要求重新确认。
10. uninstall retain-data 不保留 active permission。

runner 合成 mount 测试继续作为低层回归证据，但不能单独产生 L5 `PRT-FILE-001` 通过状态。VerificationRecord 需要记录入口、grant transition、capability fingerprint、隔离断言和 revoke observation，不记录真实路径。

### 13.2 `DocumentRef` 后续验收

- 未声明持久 document scope 的 action 可以处理用户显式传入的一次性文件。
- terminal/cancel/timeout 后 ref 不可复用。
- ref 不能被另一个 App、另一个 invocation 或 Resident 获取。
- 本地浏览器上传与远程 host mount 的 UI 和证据类型明确区分。

### 13.3 平台矩阵

macOS、Windows、Linux 都必须验证选择、持久恢复、撤权和 host restart。平台缺少可持久安全 reference 时，产品必须明确标记需要重新选择，不能伪装成持久授权已恢复。

## 十四、交付分层

### Phase A：NC-163 核心闭环

- Kernel document permission owner 与 `AppPackageView`。
- Server/CLI/UI inspect、grant、replace、downgrade/upgrade、revoke。
- 复用 `ServerPathPickerDialog` 的 runtime-host 目录选择，并新增 Apps 权限业务编排；无 GUI CLI 使用显式路径流程。
- 结构化错误和 authorization-required 恢复动作。
- registry grant 兼容校验、capability invalidation 和 lane 撤权。
- 生命周期、审计、文档与真实 `PRT-FILE-001`。

### Phase B：一次性 `DocumentRef`

- action 输入 contract、shared picker 的 file/directory 泛化、ephemeral snapshot 和 job-bound cleanup。
- 文件与目录、read 与受控 read-write/export 语义。
- 浏览器上传对象与远程宿主资源的清晰区分。

### Phase C：平台持久 reference 强化

- macOS security-scoped bookmark、Windows FutureAccessList 或平台等价机制。
- Linux desktop portal/document portal 与 headless host policy。
- 跨设备迁移、失效修复和长期未使用权限治理。

实施计划必须按 owner 切片并先关闭 Phase A 的垂直主链，不能先分别堆 UI、CLI 和 runner 半成品。任何 phase 都不新增第二个 document permission store。

## 十五、Rust 与 CI 构建成本边界

### 15.1 Phase A 不修改 Rust runner

现有主链已经具备 Phase A 所需的执行能力：Kernel 生成 `fileMounts`，Rust runner 校验宿主目录并按 `writable` 创建 WASI preopen。命名 scope 的创建、查看、授权、替换、撤销、错误恢复和 lane invalidation 都应在 TypeScript 产品层闭合，不需要修改 `apps/nextclaw-wasmtime-runner/src/main.rs`、Cargo manifest、Spin Factor 或 Rust Guest。

只有出现下列已证明的合同缺口时才允许扩大到 Rust：

- 现有 runner 无法在 lane 轮换后释放旧 descriptor。
- 现有 read/read-write preopen 不能满足已冻结的隔离合同。
- Phase B 的单文件 `DocumentRef` 无法安全复用临时目录/preopen 合同，必须新增 runner transport。

不能因为验收场景使用 runner 就默认修改或重编 runner。Phase A 的实现门应明确标记 `rust-runner-change: not-applicable`，直到定向证据推翻。

### 15.2 当前 CI 的真实成本风险

当前 `.github/workflows/portable-runtime-validate.yml` 把整个 `packages/nextclaw/src/cli/app/**` 纳入 pull request 和主干 push 的触发路径。Phase A 必然增加 App permission CLI，因此即使 Rust 源码完全不变，也会启动 macOS arm64、Linux x64、Windows x64 三平台 native runner matrix，并执行：

- 六个 Rust test Guest 的 `cargo component build --release`。
- native runner 的 `cargo build --release`。
- `cargo test --release`、runner smoke、Kernel/参考 App/性能/文档证据聚合。

workflow 会恢复 Cargo registry、git 和 runner `target` cache，且 cache key 以平台、target 和 `Cargo.lock` 为主，因此未变化的 Rust 依赖通常不会从零编译。但它仍会重复启动三台 runner、安装 Node/pnpm/Rust/cargo-component、执行 Cargo fingerprint 检查与整套 smoke；PR 已包含 CLI 路径后，后续同步 push 仍可能反复触发。缓存不能消除这部分时间和云端消耗。

### 15.3 推荐验证分层

NC-163 的实施计划必须同时修正验证路由：

| 层级 | 触发范围 | 证据 | Rust 构建 |
| --- | --- | --- | --- |
| 快速产品合同 | Kernel grant owner、registry、Server、CLI、UI | 定向 unit/integration、UI component test、匹配范围 `tsc` | 否 |
| 产品链文件授权 | grant → snapshot → 已有 runner artifact → revoke | 单平台真实安装实例与 `PRT-FILE-001` 场景 | 本地或 CI 复用与 runner source fingerprint 匹配的既有 artifact；不按每个切片重编 |
| native runner 合同 | Rust runner、Cargo、build script、Guest、transport 真实变化 | native build、cargo test、runner smoke | 只在 Rust-affecting paths 变化时跑三平台 |
| 最终候选/发布门 | 冻结的完整候选 | 三平台 L5 `PRT-FILE-001` 与 release evidence | 完整运行一次 |

推荐把当前 workflow 拆成或等价隔离为：

1. 轻量 `portable-product-contract-validate`：覆盖 App CLI、Kernel、Server、UI 和产品链场景，不构建 Rust。
2. 昂贵 `portable-native-runner-validate`：只由 runner Rust、Cargo、Rust Guest、build/transport contract 或 workflow 自身变化触发。
3. stable candidate/release 显式调用完整 native matrix，保持 exact-source 和三平台证据，不依赖 PR path filter 猜测。

如果 NC-163 本身不调整 CI，最低限度也必须先在本地完成 TypeScript 垂直链和定向验证，再集中推送，最终只运行一次完整矩阵；但这只是临时节流，不是长期解决方案。不能通过把 CLI 放到错误目录、跳过最终三平台证据或伪造 runner 未变化状态来规避成本。

## 十六、设计门结论

- `design-document: required`：已由本文满足。
- `plan: required`：是。该变更跨 Kernel、App runtime、Server、CLI、Desktop UI、runner 生命周期、测试和用户文档，单批实现不可可信完成。
- 推荐方案：声明权限上限、使用时后置授权、一次性输入与持久 ambient authority 分流。
- NC-163 判定：真实能力缺口；关闭条件是 Phase A 的正式产品链和 L5 证据，不是 registry 已有方法或 runner 能接受 mount。
- Rust/CI 判定：Phase A 不需要 Rust runner 改动；产品层迭代不应反复触发 native matrix，最终候选再完整验证一次。
- 实施前最后门禁：把现有上位设计中的“已实现”表述拆成“底层投影已实现、产品授权闭环待 NC-163”，并由新的产品链证据替换 `PRT-FILE-001` 的假阳性。

## 参考资料

- [MDN：File System API / `showDirectoryPicker()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker)
- [File System Access API 规范](https://wicg.github.io/file-system-access/)
- [MDN：File API](https://developer.mozilla.org/en-US/docs/Web/API/File_API)
- [Apple：App Sandbox 中访问用户选择的文件](https://developer.apple.com/documentation/security/accessing-files-from-the-macos-app-sandbox)
- [Microsoft：文件访问权限与 FutureAccessList](https://learn.microsoft.com/en-us/windows/apps/develop/files/file-access-permissions)
- [Electron：原生 dialog API](https://www.electronjs.org/docs/latest/api/dialog)
- [XDG Desktop Portal：FileChooser](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.FileChooser.html)
