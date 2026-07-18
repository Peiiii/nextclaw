# v0.25.13 remote quota lease persistence

## 迭代完成说明

- 现象：远程页面在普通使用中返回 `REMOTE_SESSION_RATE_LIMITED`，线上配置为每个 access session 每分钟 180 次，固定窗口结束后重置；用户样本中的 `retryAfterSeconds: 9` 表示距离该分钟窗口重置还剩约 9 秒。
- 直接触发：WebSocket quota 每次预租 10 条 browser command，并在配额状态里立即把 10 条全部计入 session window；但 relay 只把剩余租约放在实例内存 `Map`。
- 生成路径：relay 使用 Cloudflare Durable Object Hibernation WebSocket API。休眠会丢弃内存但保留 WebSocket attachment，所以下一次低频交互会重新预租 10 条；同一激活期的并发消息还会在异步配额请求返回前共同读到 0，从而重复预租。
- 回归证据：修复前，10 次跨激活消息发起 10 次租约，本应为 1 次；加入 attachment 持久化后，5 条并发消息仍发起 5 次租约，本应为 1 次。两层放大都由同一个 lifecycle 回归测试稳定复现。
- 修复：租约余量随 browser WebSocket attachment 持久化，跨 hibernation 恢复；browser command 的 attachment 读、配额消费、attachment 写由 Durable Object `blockConcurrencyWhile` 保持原子顺序；request、stream.open 与 stream.cancel 复用一条 quota 消费路径。
- 阈值判断：本次不调整 180/min。修复后它代表每 session 持续每秒 3 条 request/stream.open 指令，stream event/response 不按每个下行分片计数；当前事故由最高约 10 倍的记账放大解释，先修记账 owner 比提高阈值更正确。

## 测试/验证/验收方式

- `pnpm -C workers/nextclaw-provider-gateway-api tsc`：通过。
- `pnpm -C workers/nextclaw-provider-gateway-api lint`：通过，0 warning。
- `pnpm -C workers/nextclaw-provider-gateway-api test:quota`：通过，11/11；新增 burst ordering + Durable Object reactivation 回归。
- 回归先红后绿：原实现分别得到 `10 !== 1` 与 `5 !== 1`，最终同一组 10 条消息只租约一次且按原顺序转发。
- `env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u http_proxy -u https_proxy -u all_proxy pnpm smoke:remote-relay`：通过；真实本地 Worker、CLI connector、session open、HTTP bridge、share revoke 与 offline transition 全链路正常。

## 发布/部署方式

- 已通过 `pnpm -C workers/nextclaw-provider-gateway-api run deploy` 发布，Cloudflare Worker Version ID 为 `4ed26dda-6b59-4d6d-9ea9-83fdb4b01cf1`；不需要 D1 migration。
- `https://ai-gateway-api.nextclaw.io/health` 与 `https://remote.claw.cool/health` 均返回 `200` 和 `service: nextclaw-provider-gateway-api`。
- platform console 实例 ID 展示已在上一迭代独立部署，本次只发布远程 relay/quota 运行链路。

## 用户/产品视角的验收步骤

1. 从 `platform.nextclaw.io` 打开一个在线实例，记录列表中的后台实例 ID。
2. 保持同一个远程页面，间隔超过 Durable Object 空闲休眠时间后继续执行多次普通操作。
3. 再执行会并发加载多项数据的页面切换，确认不会因为一组动作被重复预租而很快出现 `REMOTE_SESSION_RATE_LIMITED`。
4. 若一分钟内真实发出超过 180 条 request/stream.open，仍应收到 429 与准确的 `retryAfterSeconds`；窗口重置后恢复。

## 可维护性总结汇总

- 非测试生产源码新增 33 行、删除 36 行，净减少 3 行，满足非功能改动净增不大于 0 的门槛。
- 正向减债：删除只在内存存在的租约 owner；合并 request/stream/cancel 的重复 quota 分支；删除 Durable Object 中无效的 `waitUntil` 包装，让 WebSocket handler 直接返回真实 Promise。
- 新增一个生命周期回归文件，并纳入现有 `test:quota` 唯一入口；没有新建运行时 service、adapter、fallback 或平行计费路径。
- maintainability guard：0 error、0 warning；`lint:new-code:governance`、governance backlog ratchet 与 generated-clean 均通过。
- `post-edit-maintainability-review` 结论：通过；计数状态回到 WebSocket attachment owner，并使用 Durable Object 原生并发门，没有保留内存租约或新建平行队列。

## NPM 包发布记录

不涉及 NPM 包发布。provider gateway Worker 是私有部署单元，本次不添加 `.changeset`；交付闭环是 Worker 发布与线上定向验收。
