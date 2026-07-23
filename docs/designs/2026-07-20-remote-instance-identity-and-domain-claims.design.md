# Remote 实例身份与双固定域名占用方案

日期：2026-07-20，2026-07-21 修订双域名模型，2026-07-23 补充连接可观测性与离线恢复

## 1. 背景与目标

Remote 当前把 `NEXTCLAW_HOME/remote/device.json` 中的随机 UUID 作为远端实例身份。只要换一个数据目录或重新初始化环境，同一台设备上的同一个服务端口就会注册成新实例。平台打开实例时又使用一次性 session ID 生成 `r-<session>.claw.cool`，所以用户看到的是重复且难辨认的实例列表，以及每次打开都会变化的域名。

本次目标是把两个概念拆清楚：

- 实例身份：同一设备上的同一监听端口始终指向同一个 Remote 实例。
- 系统默认域名：每个实例自动获得一个随机、稳定、不可修改的 `<system-prefix>.claw.cool`，作为永久保底入口。
- 用户自定义域名：owner 可选配一个稳定、可修改、可释放且全局唯一的 `<custom-prefix>.claw.cool`；设置后不替换系统默认域名。
- 访问会话：owner 打开实例仍需创建可撤销的鉴权 session，但默认入口使用实例稳定域名；分享链接继续使用 `r-<session>.claw.cool`，保留分享撤销和 origin 隔离能力。
- 域名占用：保留域名不可领取，一个有效 claim 只能属于一个实例；数据模型预留过期时间，本阶段不运行自动过期任务。

该设计服务于 NextClaw 的“统一入口与能力编排”愿景：用户识别和访问的是稳定设备能力，而不是每次启动或每次打开产生的技术会话。

## 2. 现状证据与根因

当前端到端链路为：

1. Remote connector 从当前数据目录读取或生成随机 `deviceInstallId`。
2. Gateway 仅按 `remote_devices.device_install_id` upsert。
3. 因此同一设备、同一端口在不同数据目录中会产生多个数据库记录。
4. owner 打开实例时创建新的 `remote_sessions.id`，并直接把它放进 `r-<session>.<baseDomain>`。
5. 平台列表只突出设备名和状态，相同设备名、不同端口及历史随机 ID 在视觉上几乎不可区分。

生产数据中已观察到同一设备名对应大量不同安装 ID，且存在相同本地端口的重复记录。这证明问题不是纯 UI 展示，而是实例身份 owner 选错。

## 3. 核心模型与 owner

### 3.1 稳定实例身份

实例 identity key 定义为：

```text
v2-<sha256(deviceFingerprint + "\0" + normalizedLocalPort)>
```

- `deviceFingerprint` 由 connector 在本地获取稳定机器标识并先做哈希；原始机器标识不上传。
- 首选来源依次为显式 `NEXTCLAW_REMOTE_DEVICE_ID`、操作系统机器 ID、物理网卡地址集合。
- 若运行环境确实无法取得稳定机器标识，才退回现有 `device.json` UUID。此退路可预测且保留旧环境可用性，但会明确限制跨数据目录收敛能力。
- `normalizedLocalPort` 从最终 `localOrigin` 解析；显式默认端口也规范为 `80` 或 `443`。
- 不把 host 纳入 identity。Remote 当前代理的是本机服务，`127.0.0.1`、`localhost` 的写法差异不应制造新实例。

connector 是设备事实 owner；Gateway 只接收不可逆派生后的 identity key，并继续使用 `remote_devices.device_install_id` 唯一索引作为注册幂等边界。字段名暂不迁移，以保持旧 connector 兼容。

### 3.2 旧实例迁移

新 connector 注册时同时上报当前数据目录原有的 legacy install ID。Gateway 仅在以下条件全部成立时原位升级旧记录：

- legacy ID 与 v2 identity key 不同；
- legacy 记录属于当前登录用户；
- v2 identity key 尚未被其他记录占用。

这样可让常用实例保留数据库 ID、归档状态和域名 claim，同时避免根据设备名等弱信号误合并历史数据。无法证明归属的旧记录不自动删除，用户仍可手动归档或删除。

### 3.3 双固定域名 claim

域名是独立于实例主体的多值事实，使用 `remote_instance_domains` 作为唯一 owner：

```sql
prefix TEXT PRIMARY KEY
instance_id TEXT NOT NULL
kind TEXT NOT NULL CHECK (kind IN ('system', 'custom'))
claimed_at TEXT NOT NULL
expires_at TEXT NULL
UNIQUE(instance_id, kind)
```

- `system`：系统为每个实例自动创建一个随机前缀；永不过期、不可修改、不可释放，随实例删除才删除。
- `custom`：用户可选配置一个前缀；可修改或主动释放，支持 `expires_at` 合同，但本阶段不运行自动过期任务。
- `prefix` 主键统一覆盖两类域名的全局占用，避免两个实例或两种域名跨列撞名。
- 新实例默认前缀使用保留命名空间 `i-<随机十六进制>`；已有实例保留 `0013` 生成的 `nc-<instance UUID 去连字符>`，避免上线后默认入口再次变化。
- 同一实例的两个 claim 都映射到相同 `instance_id`，因此代理、鉴权、session、Panel sandbox 不需要第二套实现。

规则由 Gateway 的单一 domain service owner 管理：

- 先 `trim` 并转为小写。
- 只允许 DNS label：1–63 字符，首尾必须是字母或数字，中间可含 `-`。
- `remote` 等平台固定入口前缀保留。
- 所有 `r-` 开头名称保留给 session host，`i-` 与 `nc-` 保留给系统默认域名。
- 未过期 claim 全局唯一，包含已归档实例。
- 修改自定义名称时只替换 `custom` claim；`system` claim 始终保留。
- 删除自定义名称只释放 `custom` claim；删除实例通过外键级联释放两类 claim。

唯一性最终由数据库索引保证，service 的预查询只用于返回更友好的错误；并发竞争仍捕获唯一约束并统一返回“已被占用”。

### 3.4 访问域名与 session

owner 打开实例：

1. 创建或刷新 owner access session 和 HttpOnly cookie。
2. API 同时返回 session `openUrl`、共享固定入口 `fixedDomainOpenUrl`、`systemDomainOpenUrl` 和可选的 `customDomainOpenUrl`。
3. 新平台 UI 有自定义域名时默认打开自定义域名，否则打开系统默认域名；两个固定 hostname 都可用于同一个 owner session。
4. `instanceDomainOpenUrl` 是尚未发布的中间合同，不保留兼容 alias；所有已知调用方在同一批次迁移到明确的双域名字段。

分享访问继续使用 `r-<session>.<baseDomain>`。稳定实例域名不能替代分享域名，因为分享需要按 grant/session 独立撤销，而且不同分享会话需要 origin 隔离。

特殊 panel sandbox 请求不能只凭稳定 hostname 获得权限。Gateway 必须先把 hostname 映射到实例，再验证该实例存在有效 owner session；session host 的既有受限回退保持不变。

### 3.5 连接可用性与运行状态 owner

固定域名只保证入口身份稳定，真正在线仍依赖 connector 到 Relay 的唯一 WebSocket。连接生命周期继续归 `RemoteConnector`，但必须守住两个不变量：

- 只有尚未完成 WebSocket `open` 的连续握手失败才累计指数退避；一旦连接成功，历史失败计数立即清零。之后发生的 `1006` 等断线属于新的重连周期，从基础延迟重新开始，不能继承数小时运行前的历史失败并等待几十分钟。
- Remote 运行状态只由取得本地 ownership lease 的进程发布。竞争失败的开发进程只记录诊断日志，不得把“already owned”写成共享 Remote 状态；读取状态时优先采用仍存活的 managed service owner，UI runtime 状态只能代表其自身进程，且不能跨 PID 继承。

重连仍使用单一主路径：握手失败按 `3s` 起步指数退避并保留上限与 jitter，成功连接后的下一次异常断线重新从基础延迟开始。不新增第二套 watchdog、轮询器或按错误文案特判的 fallback。

### 3.6 连接可观测性与离线恢复

2026-07-23 的真实安装态日志显示，同一 managed service 进程在约 17 小时内发生 69 次 WebSocket `1006` 非正常断开。每次 connector 都在约 3–5 秒内恢复，但浏览器导航如果刚好落在这个窗口，会得到 `Remote device connector is offline.`；现有错误页不会自动重试，因而一次短断线会表现成持续离线。与此同时，`remote status/doctor` 在恢复后只保留最新的 `connected` 和空 `lastError`，无法回答断线次数、最近一次关闭码、恢复耗时或连接心跳是否正常。

可观测性继续由现有 owner 完成，不新增平行诊断服务：

- `RemoteConnector` 是本机连接生命周期的 `information expert`，负责维护当前进程内的连接诊断快照：观测起点、connection ID、当前连接时间、心跳发送/确认时间、断线总数、最近一次断线详情、连续握手失败、下次重试时间和最近恢复耗时。
- connector 每个连接周期生成一个不含凭据的 `connectionId`，同时写入本机结构化日志、运行状态和 Relay attachment。客户端与云端因此能围绕同一个 ID 对齐事件，而不再依赖时间戳猜测。
- 现有 25 秒 keepalive 升级为带 `heartbeatId` 的双向 `connector.ping` / `connector.pong`。Relay 在配额计数前处理控制帧，心跳不再混入用户 WebSocket 消息用量。只有 Relay 明确通过 `connector.ready` 声明支持确认帧后，客户端才启用超时判断，以保证新旧 Worker/connector 滚动发布兼容。
- Relay 的 connector `connected`、`closed`、`error` 事件写入 Cloudflare Workers 结构化日志，包含 connection ID、实例 ID、关闭码、原因、clean 标记、持续时间和浏览器连接数；不记录 token、cookie 或请求正文。
- Relay 在 HTTP 或浏览器 WebSocket 请求撞上 connector 离线时生成 `incidentId`，同时写日志并通过 `x-nextclaw-incident-id` 响应头返回。HTML 导航展示该编号并自动重试，短断线恢复后无需用户反复刷新；API 请求仍保持明确的 `503`。
- `nextclaw remote doctor --json` 与 UI Remote doctor 继续读取同一 canonical runtime snapshot，输出稳定性检查和连接诊断字段，不解析日志、不触发重连，保持查询纯读。

这套设计落实 `single-domain-owner`、`information-expert` 与 `cqs-pure-read`：connector/Relay 分别记录自己亲历的事实，status/doctor 只消费事实。结构化日志保留完整时间线，状态快照保留“当前值 + 最近事故 + 累计次数”，两者互补而不双写业务状态。

明确不做：

- 不把 D1 `remote_devices.status` 扩成事件仓库，避免每次心跳或断线产生数据库审计写入。
- 不把 `1006` 武断归因于本地网络、代理或 Cloudflare；在云端关闭原因缺失的情况下只记录已证实的 transport abnormal close。新的双端 correlation 证据用于下一次把责任层定位到本机、网络边缘或 Relay。
- 不用自动刷新掩盖终态鉴权错误；只有 connector 短暂离线 `503` 自动重试，session 过期、撤销、域名不匹配仍展示明确原因并要求重新打开。

## 4. API 与界面

实例 view 增加：

```ts
systemDomainPrefix: string;
systemDomain: string | null;
systemDomainClaimedAt: string;
customDomainPrefix: string | null;
customDomain: string | null;
customDomainClaimedAt: string | null;
customDomainExpiresAt: string | null;
```

新增接口：

```http
PUT /platform/remote/instances/:instanceId/domain
Content-Type: application/json

{ "prefix": "my-mac" }
```

`PUT` 只设置或修改自定义域名；`DELETE` 释放自定义域名。成功返回更新后的实例；失败区分：格式非法、保留名称、名称已占用、实例不存在。归档实例保留 claim，但平台只允许 owner 修改自己的实例。

```http
DELETE /platform/remote/instances/:instanceId/domain
```

平台控制台与 Gateway 分属不同 origin，因此 `/platform/*` 的 CORS 合同必须同时允许 `PUT` 与 `DELETE`。该要求必须由源码回归断言和生产 `OPTIONS` 预检共同验证，避免出现“按钮与 API 都实现了，但浏览器在到达 controller 前拦截”的假完成。

列表交互调整：

- 明确展示本地 origin/端口，让同设备上的不同实例可辨认。
- 同时展示只读的系统默认域名和可编辑的自定义域名。
- 没有自定义域名时明确显示“设置自定义域名”；已有时显示“修改”和“移除”，默认域名始终留在同一实例表面。
- 主操作只保留一个“打开”，优先自定义域名，否则使用系统默认域名。
- 分享管理继续使用 session 域名，不把固定域名暴露为公开分享地址。

## 5. 数据迁移与兼容

- `0013` 已在线上应用，不能修改或回滚。新增 `0014` 创建 claim 表：为每个实例写入系统 claim；若 `0013.domain_prefix` 不等于该实例的 `nc-<UUID>` 默认值，则把它作为 custom claim 一并保留。
- `0013` 的三个 `remote_devices.domain_*` 字段迁移后只作为已发布过渡数据，不再是运行时事实源；新代码只读写 claim 表。确认所有环境完成 `0014` 后再通过独立 migration 清理旧列，不在本轮制造双写。
- 旧 connector 仍可用随机 install ID 注册；Gateway 接受旧 `deviceInstallId` 和新 `instanceInstallId` 字段。
- 新 connector 的 legacy ID 仅用于可证明的原位迁移，不按 display name、平台或端口猜测合并。
- 既有 `remote.claw.cool` 与 `r-<session>.claw.cool` 保持可用，避免已打开页面和旧平台版本立即失效。

## 6. 非目标与关键取舍

- 本次不批量猜测并删除历史重复实例。缺少可靠设备证据时，自动合并会造成错误归属和数据丢失。
- 本次不实现自动过期调度，只建立 `expires_at` 合同和领取时的过期判断能力。
- 本次不把自定义域名扩展到任意顶级域名或用户自带域名。
- 本次不让固定实例域名替代分享 session 域名。
- 本次不新增多层 resolver/factory；identity 归 connector class，claim 归 Gateway domain service，列表状态归现有 dashboard feature。

## 7. 验收标准

### 身份

- 同一设备、同一端口在不同 `NEXTCLAW_HOME` 下生成相同 v2 identity key。
- 同一设备不同端口、不同设备同一端口生成不同 key。
- legacy 实例可在同用户、无冲突条件下原位迁移。
- 重启或重新注册只更新同一数据库实例，不增加列表项。

### 域名

- 新旧实例都有一个非空、稳定、不可修改的系统默认域名。
- owner 可新增、修改或释放自定义域名；大小写和空白规范化后持久化。
- 设置自定义域名后，系统默认域名仍保留且两个 hostname 都解析到同一实例。
- 实例列表必须同时显示“默认域名”和“自定义域名”；未配置自定义域名时也必须显示设置入口。
- 非法、保留、已占用前缀被拒绝；并发唯一性由数据库约束兜底。
- 归档不释放，删除释放；当前 claim 不自动过期。
- owner 打开优先落到自定义域名，没有自定义域名时落到系统默认域名；重复打开相应 hostname 不变。
- 分享链接仍是 session hostname，撤销与隔离语义不变。

### 工程验证

- connector identity 定向单测。
- connector 重连策略覆盖“连续握手失败增长退避”和“成功连接后 `1006` 从基础延迟重试”。
- ownership 竞争失败不得写共享运行状态；并存 managed service 与 UI runtime 时，状态读取必须命中真实在线 owner。
- Gateway repository/domain/controller/session/panel 定向测试。
- platform console 列表、域名编辑、冲突反馈和打开行为 smoke。
- remote relay 真实链路 smoke，覆盖系统默认域名、自定义域名、移除后默认域名保留和 session 分享域名。
- 安装态真实断联恢复验收：Relay 观察到 connector 离线后，下一次连接在基础重连窗口内恢复，固定域名重新返回产品页面而不是长期 503 offline。
- 故障注入必须证明：`1006` 后本机状态保留关闭码、断线次数和恢复耗时；成功重连不会清除最近事故；同一 connection ID 可在 connector 与 Relay 两端日志关联。
- 心跳合同必须证明：Relay 返回匹配的 pong，控制帧不消耗业务配额；未声明 heartbeat capability 的旧 Relay 不触发客户端误判；声明后心跳超时进入唯一重连主路径。
- 离线导航必须返回 incident ID、`Retry-After` 并自动重试；非导航/API 请求仍返回原始 `503`，session 过期等终态错误不得自动重试。
- `remote doctor --json` 在当前已恢复为 connected 时仍能报告本进程累计断线、最近关闭事实与恢复耗时，避免“当前绿色覆盖历史事故”。
- 生产环境 `OPTIONS` 预检必须包含 `DELETE`，并在真实登录态完成设置、重复占用拒绝、释放和默认域名继续打开。
- 所有触达 TypeScript workspace 的 `tsc`、新代码治理、可维护性 guard 和 backlog ratchet 通过。
