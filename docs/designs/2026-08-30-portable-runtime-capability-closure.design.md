# Portable Runtime 能力闭合设计

## 文档状态

- 日期：2026-08-30
- 状态：Implemented；作为 Portable Runtime 能力、验收和发布的当前设计事实源
- 上位目标：[Portable Capability Runtime 愿景与 MVP](./2026-08-28-portable-capability-runtime-mvp.design.md)
- 场景与成熟度来源：[全能力验证套件](./2026-08-28-portable-runtime-verification-suite.design.md)
- 执行 owner：[总体阶段计划](../plans/2026-08-28-portable-capability-runtime-overall.plan.md)

本文不改写早期探索史，而是关闭已经被实现和实测暴露的系统模型缺口：NextClaw 已经有可运行的 Action、KV、HTTP、Resident 和 Component Provider，但能力授权、Spin Factor 装配、跨入口调用、验收证据和发布判定仍未形成一条完整主链，导致局部发布被误报为整体完成。

## 一、用户任务与完成定义

普通用户从 Apps 启用一个可移植应用后，可以直接完成真实任务；需要文件、网络、Secret、AI 或外部资源时，产品只请求最小必要授权并给出可理解结果。用户可以从 Panel 或 Agent 操作同一应用，开发者和 QA 可以通过 CLI 复验同一已安装实例。产品内的“运行时验收与证据”显示每项能力的真实状态、最近验证环境和证据，不支持或未验证的能力绝不显示为通过。

整体完成不是“runner 能运行”或“某个版本已发布”，而是本设计的全部 Required 验收 ID 达到目标成熟度、真实产品面可复验、三平台交付与公开安装升级闭合。任何范围缩减必须由用户明确同意，不能由实现或发布过程静默改写。

## 二、统一主链与 owner

```text
.napp capability declaration
  -> Kernel AppPackage / Permission owner 解析用户授权与实例绑定
  -> ResolvedCapabilitySnapshot（只含本次实例可用事实）
  -> runner transport
  -> Spin Factors / WASI preopens / NextClaw Factor
  -> Rust Component
  -> observation + verification record
  -> Panel / Agent / CLI / 验收页 / release gate
```

- **Kernel** 是 App 身份、权限、Secret 引用、资源绑定、生命周期和验收记录的唯一产品 owner。
- **Spin** 是标准 WASI、filesystem、HTTP/networking、KV、SQLite、variables 和 LLM WIT 的执行表面；不拥有 NextClaw 产品身份和授权策略。
- **NextClaw Factor** 只保留 Spin/WASI 不表达的稳定产品能力：结构化日志上下文、受控跨 Component 调用、运行信息、事件/任务控制和 Agent 调用桥。
- **ServiceAppManager** 继续拥有 Service Action 与 Agent grant；Panel、Agent 与 CLI 必须收敛到同一 installed-app invocation owner，禁止各自拼装调用语义。
- **VerificationRecord owner** 位于 Kernel，记录真实调用和生命周期事实；验收页只投影，测试和发布门只查询，不允许 UI 硬编码“已通过”。

### 2.1 必须删除或替换的平行路径

- 以 JSON 文件实现的私有 KV 在迁移完成后删除，统一使用 Spin KV/SQLite storage owner；迁移必须保留已有 App 数据。
- `DummyFilesMounter` 替换为由 resolved grant 驱动的 NextClaw FilesMounter；不新造文件 WIT。
- 自定义 GET-only HTTP 仅在兼容迁移期保留；新 Guest 使用 Spin WASI HTTP + networking policy，最终只有一条授权与审计链。
- 开发者验证台的静态“01–07 已覆盖”改为真实 `PRT-*` 记录投影。
- `app call` 的源码开发实例语义保留，但不能冒充已安装应用；新增 installed-app CLI 调用入口并复用产品 invocation owner。

## 三、有限能力集合与边界

| 能力域 | 正式执行表面 | NextClaw 负责 | 默认策略 |
| --- | --- | --- | --- |
| assets / private data / temp | WASI filesystem preopen | 实例目录、配额、清理 | 自动提供，无用户提示 |
| user documents | WASI filesystem preopen | scope grant、canonical path、撤权、审计 | 显式授权；稳定 guest path，不泄露宿主路径 |
| outbound HTTP / sockets | Spin outbound HTTP/networking | 域名、scheme、port、私网与重定向策略 | 默认拒绝；禁止 listen/bind |
| KV / SQLite | Spin KV 与 SQLite | app/instance/namespace/database 隔离、迁移、配额 | manifest 声明后自动私有化提供 |
| variables / Secret | Spin variables surface + NextClaw provider | 引用、采集、轮换、撤权、脱敏 | 不进入 artifact、环境变量、日志或证据正文 |
| clocks / random / streams | Spin WASI | 配额、取消、observation | 默认可用但受资源预算 |
| Resident / event / scheduler | NextClaw host lifecycle | cursor、ack/retry、去重、停启与恢复 | 显式声明；宿主驱动 |
| progress / cancel / long task | NextClaw task contract | job 身份、状态机、取消与恢复 | 可观测且只影响目标实例 |
| model / Agent | Spin LLM surface + NextClaw provider/Agent bridge | provider/model grant、用量、审计、用户确认 | 默认拒绝；Secret 不进入 Guest |
| Component Provider | versioned capability import/export | 安装期解析、binding、兼容与循环检测 | 强类型版本合同；外部依赖明确标识 |
| native escape hatch | `native-process` | 安装提示、依赖诊断、AI 配置 | 非自包含、低推荐；不隐式 fallback |

外部 Redis、PostgreSQL、账号或付费服务可以通过 Provider/resource binding 使用，但安装前必须醒目标识，缺配置时允许安装但禁止启用，并提供 AI 可执行的 inspect/setup/bind/verify/unbind。它是特殊需求逃生口，不是默认推荐路径，也不影响自包含应用的分发。

### 3.1 Secret binding 合同

- App manifest 只声明 `permissions.secrets[]` 的稳定 slot：`id/title/description/required`，不包含值、环境变量名或 Provider 配置。
- App registry 为实例保存 `secretBindings: Record<slotId, SecretRef>`；`SecretRef` 复用 NextClaw 现有 `env | file | exec` provider 合同，只包含 source/provider/id，不保存明文。
- 安装可以在缺绑定时完成；required slot 未绑定或解析失败时状态为 `needs-configuration` 并禁止 enable，错误包含 slot 和 AI 可执行 bind/verify 动作，不回显 ref 解析值。
- 每次实例化前由 Kernel 使用现有 Secret resolver 解析最新值，形成只在内存和 runner 私有控制管道存在的 capability snapshot；值不得进入 manifest、registry、命令行参数、环境变量、日志、VerificationRecord、错误或 app cache key。cache key 只使用不可逆 digest/generation，轮换或撤权后重建目标实例。
- Guest 只经 Spin Variables/WASI config surface 按 slot id 读取已声明且已绑定的值。未声明、未绑定、跨 App 或撤销后的读取返回稳定 `SECRET_*` 错误。
- UI/CLI/Agent 支持 inspect/bind/verify/unbind；AI 可以完成可代理配置，用户只处理登录、授权或付费。卸载 purge 删除 binding；retain-data 不保留 active Secret 权限。

## 四、文件授权模型

三类文件不能混为一种授权：

1. 包内只读 assets 映射为 `/app`；随 artifact 校验，不弹授权。
2. App 私有 data/cache/temp 映射为稳定虚拟路径；由实例生命周期和配额管理，不弹授权。
3. 用户 Documents/workspace 仅在明确 grant 后映射为 `/documents/<scope-id>`；read 与 read-write 分离，canonicalize 后固定目录句柄，拒绝 `..`、symlink escape、设备文件和越权 rename/link。撤权后新调用立即失效，长任务在下一安全检查点取消。

这不是 Spin 的能力缺失。Spin/WASI 已提供 capability-safe 文件描述符；缺口是 NextClaw 没有把 schema v2 的产品 grant 投影到 Spin preopen。

## 五、验收事实模型

每次可引用验收产生不可伪造的结构化记录：

```text
verificationRunId, acceptanceId, scenarioVersion, status,
startedAt, finishedAt, environment, appId, componentId, role,
entrySurface, instanceId, actionOrEvent, callId, traceId,
capabilityDecisions, inputDigest, outputDigest, dataVersion,
observation, error, recovery, evidenceRefs
```

- `status` 只有 `passed | failed | blocked | not-supported | not-run`。
- L0–L3 不能显示绿色“通过”；用户可用核心能力至少 L4，数据、权限、Resident、恢复和生命周期至少 L5。
- Secret、文件正文和敏感输入只存 digest/脱敏摘要。
- 每个状态都来自最近一次与当前 runtime/app/scenario 版本匹配的记录；代码或版本变化使相关记录过期，不沿用绿灯。
- 验收页可单项运行、查看最近证据和导出；需要人工动作的场景显示等待步骤，不伪造自动通过。
- 稳定 ID、Required、场景版本、适用平台和证据新鲜度只有一个可机读 contract owner；Panel 和发布脚本不得各自维护 ID 副本。
- Kernel acceptance runner 只允许调用已注册的编号检查器，检查器亲自执行业务与故障链并写入 record；不提供任意「写通过」的 API。
- 三平台、开发者和发布证据由 CI 同一 contract 导出机器可验证的 evidence artifact；发布门合并本地场景与 CI 场景，只要一个 Required ID 缺失、失败或过期就拒绝 stable。

## 六、稳定验收 ID

以下 ID 是整体完成门；重命名 Panel、Component 或测试文件不得改变 ID。

| ID | 用户可观察合同 | 目标 |
| --- | --- | --- |
| PRT-EXEC-001 | 同一 Rust Component artifact 在正式 runner 执行 Action，错误可理解 | L5 |
| PRT-DATA-001 | KV/SQLite 写读、并发与跨重启一致，App/namespace 隔离 | L5 |
| PRT-FILE-001 | assets/private/temp 可用且隔离；授权目录只按 scope/mode 可见 | L5 |
| PRT-NET-001 | 允许目标可访问；域外、私网、DNS rebinding、越权重定向被拒绝 | L5 |
| PRT-SECRET-001 | Secret 可授权、轮换、撤销且不泄露 | L5 |
| PRT-RES-001 | Resident 关 Panel 后持续；停用后不再暴露或执行，重新启用后恢复且不重复 | L5 |
| PRT-EVENT-001 | scheduler/event 具备 cursor、ack/retry、去重与顺序合同 | L5 |
| PRT-TASK-001 | 长任务可查询进度、取消、超时和恢复，隔离目标实例 | L5 |
| PRT-STREAM-001 | 流式输入输出具备背压、取消、断连与资源上限 | L4 |
| PRT-AGENT-001 | Agent 经显式 grant 调用与 Panel 相同 Action 和数据 | L5 |
| PRT-AI-001 | Guest 经授权调用模型或 Agent，保留用量与审计 | L4 |
| PRT-COMP-001 | 版本化 Provider 绑定、调用、缺失/不兼容诊断与升级成立 | L5 |
| PRT-ENTRY-001 | Panel、Agent、installed-app CLI 共享 action/call/trace/dataVersion | L5 |
| PRT-LIFE-001 | install/enable/disable/update/rollback/uninstall 保留或清除语义正确 | L5 |
| PRT-BOUND-001 | 多 App 数据、权限、资源和故障隔离，OOM/timeout 不拖垮宿主 | L5 |
| PRT-PERF-001 | 等价 workload 的 RSS/增量/P50/P95/CPU/Resident 密度证据 | L4 |
| PRT-DX-001 | 干净环境由 Rust 模板完成 doctor→build→test→pack→install→invoke | L5 |
| PRT-DIST-001 | macOS arm64、Windows x64、Linux x64 构建、安装、升级和代表 Action | L5 |
| PRT-EVID-001 | 产品内状态矩阵、编号运行、持久证据与导出均由真实记录驱动 | L5 |
| PRT-REF-001 | GitHub Issue Watcher 或等价真实 App 闭合 HTTP+Secret+数据+Panel+Agent | L5 |
| PRT-DOCS-001 | 用户功能、授权、开发、限制、错误和三平台状态与实现一致 | L5 |
| PRT-REL-001 | 稳定发布只在全部 Required ID 有当前证据时放行，公开安装升级可复验 | L5 |

发布门不要求每次重复昂贵的全部测试：实现期走定向快速漏斗，最终候选才运行完整矩阵；未触达的有效证据可按代码/合同影响图复用。任何 Required ID 为 failed、blocked、not-supported、not-run 或过期时，整体状态都不能是完成。

### 6.1 验收 contract 与发布接线状态（2026-08-30）

- Kernel 的 `portable-runtime-acceptance.types.ts` 是 22 个 ID、i18n title/description key、checker key、分类、Required、场景版本、证据来源和适用平台的唯一机器事实源；UI、CLI、Server 和发布脚本只消费该公共 contract，不维护 Panel 常量或反向解析文档。macOS target 统一使用产品 canonical 的 `darwin-arm64`。
- 当前 `VerificationRecord` 已携带 product/runtime/implementation fingerprint；v1 历史记录保留为可审计但必定 stale。评估器只会把 acceptance ID、scenario、fingerprint、App、环境和 contract 全部匹配的最新 `passed` 判为 current-passed；尚无匹配记录时是 missing，不会默认通过。
- 已提供结构化 candidate artifact 的 prepare/validate 与 fail-closed stable gate。稳定发布仅在 CI 合并 macOS arm64、Windows x64、Linux x64 三个平台证据且除 `PRT-REL-001` 外全部 Required ID 为 current-passed 时放行，避免把本版本公开发布证据放到发布前伪造。
- runner、Kernel、开发者链路、性能、参考 App 与文档验证器都直接产出带来源和检查项的证据；CI 拒绝缺平台、缺来源、缺检查项、失败或陈旧证据。Panel、CLI 与 Server 已投影同一 contract 和持久 VerificationRecord，支持按编号运行、查询与导出。
- 发布完成后由自动流程验证 NPM latest、四个平台 Runtime manifest/产物、稳定 Desktop Release/manifest/APT 和中英文公开文档，再写入真实 `PRT-REL-001` 并运行 postpublish gate。只有 postpublish gate 全部 22 项 current-passed，父目标才允许完成。

## 七、产品信息架构

- Apps 默认入口仍是“日常小工具箱”等普通场景，不展示 WASM 术语。
- 每个普通 Panel 只增加轻量“已验证能力”区域，显示最近状态并链接证据。
- 第五个后置 Panel 改为“运行时验收与证据”：先能力矩阵，再编号场景的运行、最近证据和导出。
- Service Apps 继续承担 Agent Action grant；验收页提供与业务动作一致的提示词和调用证据。
- CLI 增加对已安装 App 的调用与验收查询/导出；开发源码 `app call` 保持独立语义。
- 用户文档讲功能、用途、权限和用法；开发者文档单独讲 architecture、WIT/Factor、能力矩阵、错误与版本合同。

## 八、生命周期与失败矩阵

| 状态 | 必须成立的行为 |
| --- | --- |
| install / needs-capability / needs-configuration | 可安装、不可误启用，显示结构化原因和 AI 可执行修复动作 |
| enable | 解析最新 grant/binding，生成 capability snapshot，验证 Guest exports 与资源就绪 |
| running | 每次调用带 instance/call/trace 身份；资源预算、撤权与审计生效 |
| cancel / timeout / OOM | 只终止目标 job/instance；数据保持事务边界；返回稳定错误与 recovery 状态 |
| disable / revoke | 停止 Resident 和新调用；撤权资源不可再访问 |
| restart / host upgrade | 从持久 cursor/data 恢复且不重复副作用；旧证据按版本失效 |
| app update / rollback | WIT、Provider 和数据迁移预检；失败保持旧版本可用 |
| uninstall retain / purge | 明确保留或删除数据、grant、binding、Secret ref 和验收记录索引 |

### 8.1 Job、stream 与 Resident event 合同

短 Action 继续走同步 invocation；长任务显式声明为 job，不把 timeout 或杀共享 runner 冒充 cancel。唯一调用主链保持 `ServiceAppManager -> PortableServiceAppRuntimeService -> runner`，Kernel 在 App instance `stateDirectory` 中拥有 Job/Event journal，VerificationRecord 只记录脱敏验收证据。

Job 状态机固定为：

```text
queued -> starting -> running -> succeeded
                          |-> cancel-requested -> cancelled
                          |-> timed-out
                          |-> failed
                          |-> interrupted
```

- terminal 不可回写；宿主重启把未完成 job 标为 `interrupted`，不自动重放副作用。重试产生新 job 和 `retryOf`；只有 Guest 自己使用幂等键/checkpoint 时才允许业务 resume。
- runner protocol 升级为 0.2 JSONL，保留单一 IPC：`start-job/cancel-job/job-status` request，以及带 `jobId/sequence` 的 `job-progress/stream-chunk/job-terminal` event。stdin reader、dispatcher、唯一 stdout writer 分离，控制请求不能排在长调用后面。
- 每个短 Action/job 使用独立 Store/execution context；Resident/Provider 各有串行 instance lane。取消先用 per-job token，再用 fuel/epoch interruption 重置目标 lane；只有 runner 进程崩溃才恢复全部长期角色，单 job 超时禁止 `failAll + SIGKILL`。
- NextClaw task WIT 只补 `report-progress/emit-chunk/check-cancelled`。标准 HTTP/body 等继续使用 WASI streams，不新造数据流。runner→Kernel 使用有界 channel；初始上限为每 job 256 事件或 1 MiB、进度 10 条/秒，满时阻塞并在 deadline 后返回 `STREAM_BACKPRESSURE_TIMEOUT`。
- Kernel journal 是进度/输出事实源，UI/CLI/Agent watch 是可丢失投影；断线使用 `afterSequence` 重放，窗口外返回 `STREAM_CURSOR_EXPIRED`。UI 断开不默认取消后台任务。

Resident event 使用 durable inbox：

```text
received -> pending -> leased -> acked
                     -> retry-wait -> leased
                     -> dead-letter
```

- `eventId` 是去重键；只承诺同一 `streamKey` 顺序，初版每个 Resident 单 lane；投递语义是 at-least-once，不宣传 exactly-once。
- 新 ABI 返回强类型 `ack | retry(delayMs)` disposition；ack 持久化后才推进 cursor。lease 过期可重送，默认最多五次指数退避，随后进入可 inspect/replay 的 dead-letter。
- disable/revoke 停止新 lease；Guest 使用 eventId 在私有 KV/SQLite 做业务幂等。0.1 任意 JSON 返回仅作既有包迁移兼容，新模板/check/pack 统一生成并校验 0.2。

资源默认值由 Kernel 夹紧：单 Action/job 64 MiB、显式 timeout、最大累计输出和事件数、取消 grace period；所有事实带 app/instance/component/call/trace/job 身份。

### 8.2 Guest 调用模型与 Agent

- Spin LLM WIT 可以作为本地模型 adapter，但正式默认路径不能使用 Spin remote engine 绕过 NextClaw 的模型目录、授权、Secret、用量和审计。
- NextClaw Factor 提供两个方向明确的 capability：短且受限的 `model-complete`，以及始终异步返回 handle 的 `agent-start`。App 只声明 capability slot，不能在 Guest 中任选四处 provider/model/Agent。
- runner 不持有模型或 Agent 凭证。在 `0.2` 双向 JSONL 中，NextClaw Factor 发出带 `hostCallId/jobId/callId/traceId`
  的 `host-call-request`，Kernel client 调用现有 owner 后回送 `resolve-host-call`。stdin reader 和 Guest 执行必须并发，
  否则 Guest 等待回调时会把自己锁死。请求与回复都受独立 timeout、取消和字节上限约束，不得复用 stderr、env 或第二条 IPC。
- Kernel 把 slot 绑定到已配置模型或可调用 Agent；模型调用复用现有 provider/usage owner，Agent 调用复用 AgentRun ingress/manager，并记录 `parentCorrelationId=callId` 与 app/component/job 身份。
- Agent 结果通过同一 Job event 返回；Agent session journal 仍是结果事实源，Job journal 只存关联 ID、状态和脱敏摘要。cancel-job 调现有 abort；未真正中止时只能保持 `cancel-requested`。
- 未 grant 必须拒绝；凭证永不进入 Guest、runner env、artifact、日志或验收正文。Service→Agent 是独立显式 grant，不能倒用 Agent→Service Action grant。

## 九、取舍、保留与非目标

- 选择 Spin Factors，而不是继续扩展自定义 host WIT，因为标准能力已存在且安全边界更成熟；NextClaw 仍拥有产品授权和策略，避免框架接管产品。
- 不用一组业务专用 Host API 追逐上层需求；基础能力集合有限，特殊重依赖走 Provider/native escape hatch。
- 不建设多语言官方矩阵、完整 POSIX/shell、任意宿主文件系统、默认开放 socket、GPU/设备 API 或分布式 runner。
- 不增加第二 App 类型、第二 Marketplace、第二数据目录或运行时隐式 fallback。
- `app doctor --fix` 暂不自动修改系统工具链；现有精确诊断和平台命令足够，AI 可执行显式安装步骤。

## 十、Design Ready 判定

主链有唯一 owner；标准能力复用 Spin，产品策略归 Kernel；普通用户任务、失败与恢复、跨入口和证据生命周期均已定义；验收 ID 有明确产品表面和目标等级；平行路径及删除点明确；非目标不会掩盖本轮已确认缺口。后续实现若发现新的公共状态、协议或授权分叉，必须先更新本文，再同步总体计划。
