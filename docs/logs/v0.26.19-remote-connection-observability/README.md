# v0.26.19 Remote 连接可观测性与离线恢复

## 迭代完成说明

- 已证实的直接现象：本机安装态同一 managed service 进程在约 17 小时内记录 69 次 WebSocket `1006` 非正常断开；每次都在约 3–5 秒内重新连接。浏览器导航落入这个短窗口时会得到 `Remote device connector is offline.`，旧错误页又不会自动重试，因此短暂断线会表现成持续离线。
- 已证实的诊断缺口：connector 恢复后会把 `lastError` 清空，`remote status/doctor` 只能看到当前 `connected`；Relay 的 `webSocketClose/webSocketError` 又丢弃关闭元数据，无法用同一个连接标识对齐本机与云端事件。
- 已区分的另一条失败链：浏览器 owner session 过期或撤销也会让已有页面不可用。这属于访问会话终态错误，不应与 connector 离线混为一谈，更不能靠自动刷新掩盖。
- 当前不能武断确认的底层责任层：历史证据只能证明 transport abnormal close，不能进一步断言是本地代理、网络、Cloudflare 边缘还是 Relay 主动关闭。本轮通过双端 connection ID、关闭元数据和心跳证据，让下一次异常可以继续定位责任层。
- 本机 connector 现在保留当前进程内的 canonical 诊断快照：观测起点、connection ID、连接时间、心跳发送/确认、累计断线、最近断线详情、连续握手失败、重试计划和恢复耗时。成功重连不再清除最近事故。
- Relay 现在返回 `connector.ready` capability，处理不计业务配额的 `connector.ping/pong`，并记录连接、关闭、错误和离线请求结构化事件。新 connector 只有在 Relay 明确声明心跳确认能力后才启用超时，兼容滚动发布期间的旧 Worker。
- connector 离线的 HTTP/浏览器请求会生成 incident ID，返回 `Retry-After` 和 `x-nextclaw-incident-id`。HTML 导航展示 incident ID 并自动重试；API 保持原始 `503`；session 过期、撤销等终态错误不自动刷新。
- 设计合同已同步到 `docs/designs/2026-07-20-remote-instance-identity-and-domain-claims.design.md`。

## 测试/验证/验收方式

- TypeScript：`@nextclaw/remote`、`@nextclaw/service`、`@nextclaw/server`、`@nextclaw/ui` 与 Gateway Worker 的 `tsc` 通过。
- connector 故障注入：Remote 定向测试 9 项通过，覆盖双向心跳、旧 Relay compatibility、声明能力后的心跳超时、握手失败指数退避、成功连接后退避重置、`1006` 事故保留和恢复耗时。
- `1006` 恢复断言：首次 connection `1006` 后在 3 秒恢复；再经历一次干净关闭和第三次连接，最近事故仍指向首次 `1006`，恢复时间不会被后续连接错误覆盖。
- Worker 配额与生命周期：16 项 quota/relay 测试通过；心跳返回匹配 pong 且不产生配额报告；close/error 双事件只记录一次，关闭码 `1006` 与 clean 标记进入结构化日志，设备转为 offline。
- 离线页面：connector offline 页面包含 incident ID、`Retry-After`、手动重试和自动刷新；session expired 页面没有自动刷新。
- Gateway Remote 回归：remote panel、实例列表、域名占用测试通过。
- 真实本地 Relay smoke：`pnpm smoke:remote-relay` 通过，覆盖实例复用、不同端口拆分、默认/自定义双域名、占用去重、心跳空闲、owner 打开、分享撤销、释放自定义域名后默认域名保留，以及 connector 停止后的 offline 转换。
- 治理：`pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet` 和 feature maintainability guard 通过。

## 发布/部署方式

- Gateway Worker：需要部署当前源码，并用真实 connector 验证同一 connection ID 出现在本机与 Cloudflare 两端、心跳确认生效、临时 offline 响应带 incident ID。
- NPM：已添加 `nextclaw`、`@nextclaw/remote`、`@nextclaw/service`、`@nextclaw/server`、`@nextclaw/ui` patch changeset；需要进入下一次 full public workspace stable patch batch。
- 数据库 migration 不适用：本次不新增事件表，不把 `remote_devices` 扩成日志仓库。
- Desktop installer 不适用：本次目标是 Gateway Worker、NPM runtime 与 stable update channel。
- 本机安装态需要在公开版本发布后更新并重启，再验证 CLI/Remote doctor、心跳确认和两个固定域名。

## 用户/产品视角的验收步骤

1. 执行 `nextclaw remote status --json`，确认 `runtime.connection` 中有 connection ID、心跳时间和断线累计字段。
2. 执行 `nextclaw remote doctor --json`，即使当前已恢复为 connected，也应看到 `connection-stability` 检查与最近事故。
3. 注入一次 `1006`，确认状态记录关闭码、断线时间和重试时间；恢复后记录恢复时间与耗时，但最近事故不被清空。
4. 在 connector 短暂离线时直接导航固定域名，确认页面显示 incident ID 并自动重试；connector 恢复后无需手工反复刷新。
5. 让 owner session 过期，确认页面明确要求重新打开实例，且不会无限自动刷新。
6. 使用同一 connection ID 查询本机日志和 Cloudflare Worker 日志，判断下一次断线是只在客户端观察到、只在 Relay 观察到，还是两端都观察到。

## 可维护性总结汇总

- Feature maintainability guard：0 error；总代码变更 `+2529 / -1002 / net +1527`，非测试 `+2081 / -986 / net +1095`。本次是新增用户可观察能力，不适用非功能改动净增 `<= 0` 门槛。
- 正向减债：把 Remote 包根目录的历史类型、controller、manager、store 和 error utility 迁入角色目录；把单次 WebSocket 会话收敛为独立生命周期 owner；把 Server Remote API 类型从 869 行主类型文件拆出，使主文件降到 761 行；把 Gateway response presentation 从 576 行 controller 抽到纯 utils，使 controller 降到 528 行。
- `RemoteConnector` 只负责跨周期编排，`RemoteConnectorSocketSession` 负责单连接与心跳，Relay observability service 负责结构化事件与 incident ID；没有新增第二状态源、第二重连器或日志解析型 doctor。
- 剩余警告：Relay Durable Object controller 为 588 行，仍接近 600 行预算；后续拆分缝是 pending relay response lifecycle 与 browser client lifecycle。`service-remote-runtime.utils.ts` 仍是历史编排逻辑位于 utils 的 adopted drift，本轮只让既有 logger 转发结构化上下文，没有扩大其职责。
- `post-edit-maintainability-review` 结论：当前 owner、文件角色和失败状态区分均比改动前清晰；上述两个历史热点未构成本轮阻塞，但应避免继续向原文件堆叠职责。

## NPM 包发布记录

- 待 full public workspace stable patch 发布完成后回填版本、registry、tag、stable runtime、公开升级和本机更新重启证据。
