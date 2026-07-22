# v0.26.17 Remote connector 断线恢复

## 迭代完成说明

- 根因：`RemoteConnector` 把每次已成功 `open` 后发生的 `1006` 断线仍计为连续连接失败，成功连接期间又没有清零计数。多次断线后，重连延迟从 3 秒累积到 30 分钟上限并叠加 jitter，固定域名因此在实例仍存在时长期返回 `Remote device connector is offline.`。
- 复现确认：本机安装态 PID 42987 在 2026-07-23 00:44:49 发生 `1006` 后记录 `Reconnecting in 2061.9s`，直到 01:19:11 才恢复连接，实际离线约 34 分钟；期间本机 UI/API 健康，证明域名、实例和主服务并未丢失。
- 次要状态问题：竞争 Remote ownership 失败的开发进程会把 `already owned` 写入自己的 UI runtime；状态读取又优先 UI runtime，导致 CLI/Doctor 显示竞争进程错误而不是 managed service 的真实连接状态。
- 修复方式：WebSocket `open` 成功即结束此前的握手失败序列，之后的异常断线从基础延迟开始新一轮重连；未取得 ownership 的进程只记录诊断日志，不发布 Remote 状态；状态读取优先仍存活的 managed service，UI runtime 状态不再跨 PID 继承。
- 修复命中根因：没有增加 watchdog、轮询或错误文案特判，而是在连接生命周期与状态 owner 的现有唯一主链路中恢复两个不变量。设计合同同步更新于 `docs/designs/2026-07-20-remote-instance-identity-and-domain-claims.design.md`。

## 测试/验证/验收方式

- 定向回归：`pnpm -C packages/nextclaw-service exec vitest run src/services/remote/remote-connector.service.test.ts src/utils/runtime/service-remote-runtime.utils.test.ts src/utils/remote/remote-runtime-support.utils.test.ts src/stores/local-ui-runtime.store.test.ts`，4 个文件、16 项测试通过。
- 重连策略回归覆盖：连续三次握手失败的延迟为 `3s -> 6s -> 12s`；随后一次 WebSocket 成功 `open` 再发生 `1006`，下一次延迟回到 `3s`，不是继续增长到 `24s`。
- TypeScript：`pnpm -C packages/nextclaw-remote tsc` 与 `pnpm -C packages/nextclaw-service tsc` 通过。
- ESLint：`pnpm -C packages/nextclaw-remote lint` 与 `pnpm -C packages/nextclaw-service lint` 通过，无 error；本次触达文件 targeted ESLint 为 0 error、0 warning。
- Remote Relay 全链路 smoke：`pnpm smoke:remote-relay` 通过，覆盖实例复用、不同端口拆分、默认/自定义双域名、占用去重、owner 打开、分享撤销、移除自定义域名后默认域名保留，以及 connector 停止后的 offline 转换。
- 当前源码生产 Relay 验收：隔离 home、端口 61614 的源码实例连接真实 `ai-gateway-api.nextclaw.io`；重启前后实例 ID 均为 `b961976a-52e8-4b7e-a257-ba2df285ebbf`，默认域名均为 `i-89c467ed31ef405d8632.claw.cool`，登录后页面两次均返回 HTTP 200 且不含 offline 文案。
- 当前用户实例线上复核：旧版本等待 2061.9 秒后恢复；默认域名 `nc-82bcca90a43a43c184d9730a3dc1a9e5.claw.cool` 与自定义域名 `peiiii.claw.cool` 均返回 HTTP 200，证明此前失败是 connector 空窗而非域名丢失。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet` 与 scoped non-feature maintainability guard 通过。

## 发布/部署方式

- 已添加 patch changeset：`@nextclaw/remote`、`@nextclaw/service`、`nextclaw`。
- 本轮需要进入下一次 stable full public workspace NPM patch batch，并发布对应 stable runtime update channel。
- 数据库 migration 与 Gateway 独立部署不适用：本次未改数据库、域名映射、Relay worker 或平台 API，只修复本机 connector 生命周期与状态读取。
- Desktop installer / manifest 不适用：本次目标是 NPM 安装态与 stable runtime channel。

## 用户/产品视角的验收步骤

1. 启动 Remote 并分别打开实例的默认域名和自定义域名，确认两者都进入同一实例。
2. 让已连接 WebSocket 异常断开，确认状态短暂进入重连，而不是累计到几十分钟的 offline。
3. 在另一个开发进程使用同一配置启动 UI，确认 Remote 状态仍以真正持有 ownership 的 managed service 为准。
4. 重启 NextClaw，确认实例 ID、默认域名和自定义域名不变，两个域名恢复后都返回产品页面。

## 可维护性总结汇总

- Scoped maintainability：总计 `+202 / -30 / net +172`，其中非测试代码 `+17 / -30 / net -13`，满足非功能改动净增门槛。
- 正向减债：删除 ownership 失败时的共享状态写入；删除 `RemoteConnector` 中只做一次转发的状态 helper 和未被消费的 `lastError` 返回字段；把原有测试文件改名为与 `services/*.service.test.ts` 角色一致，并按行为拆分过长 describe。
- owner 更清晰：连接是否成功由 connector 生命周期产生，重连计数由同一 connector owner 决定；Remote 状态只由持有 ownership 的进程发布。
- 没有新增 fallback、兼容桥、第二重连器、文件角色或额外抽象；`post-edit-maintainability-review` 结论为通过，无 maintainability findings。

## NPM 包发布记录

- 已随 `nextclaw@0.27.2` full public workspace patch batch 统一发布并完成 registry 校验。
- `@nextclaw/remote@0.3.15`、`@nextclaw/service@0.3.15` 与 `nextclaw@0.27.2` 已发布，`latest`、tag、tarball、stable runtime 和公开升级链路均已闭环。
- 本机安装态已从 0.27.1 更新并重启到 0.27.2；PID 由 42987 变为 72926，Remote 状态为 `connected`，默认域名与自定义域名均返回 HTTP 200 且不含 offline 文案。完整发布证据见 `docs/logs/v0.26.18-npm-patch-release/README.md`。
