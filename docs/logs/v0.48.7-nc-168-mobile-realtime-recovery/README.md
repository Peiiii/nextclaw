# NC-168 手机浏览器实时连接恢复

## 迭代完成说明

本次修复解决手机浏览器连接 VPS 上的 NextClaw 后，锁屏、切后台或短暂断网恢复时页面可能持续断联、只能刷新页面的问题。

根因是浏览器端 AppEvent WebSocket 只在收到 `close` 时进入重连。移动浏览器或中间网络设备静默回收连接后，旧 socket 仍可能报告为 `OPEN`，因而不会触发已有重连逻辑。修前通过可控 Mock WebSocket 保留“服务端已不可达但 socket 仍为 `OPEN`”的状态，确认页面恢复可见时不会创建新连接，直连与远程两条测试均稳定失败。

修复在浏览器生命周期边界监听页面恢复可见和网络恢复事件，由直连与远程 transport 各自淘汰旧 socket、建立新连接，并继续复用既有 `connection.open` 会话同步链路。远程 pending request/stream 在换连时明确失败，不自动重放可能有副作用的操作，因此修复命中连接 owner，而不是通过整页刷新掩盖症状。设计与故障模型见 [`2026-09-06-mobile-realtime-recovery.design.md`](../../designs/2026-09-06-mobile-realtime-recovery.design.md)。

主线实现提交：`e6de142d0a2fec7d4158a19708e832285a719631`。

## 测试/验证/验收方式

- 修前基线：直连和远程测试共 2 个用例失败，失败点均为假活 socket 未被关闭且未创建替换连接。
- 修后定向测试：5 个相关测试文件、23 个用例通过，覆盖浏览器恢复触发、直连 VPS、远程 multiplex、连接事件 consumer 和会话 query cache。
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- 触达文件定向 ESLint：通过。
- `pnpm lint:new-code:governance`、diff-only maintainability 与 `git diff --check`：通过。
- `pnpm -C packages/nextclaw-ui build`、`pnpm -C packages/nextclaw build`、`pnpm -C packages/nextclaw prepack`：通过；构建 HTML 引用的 56 个入口资源全部存在。

## 发布/部署方式

- 代码已推送至 `origin/master`。
- 未执行 NPM、GitHub Release 或桌面版发布。
- 2026-09-07 08:45 CST，将主线提交 `e6de142d0` 构建出的 `ui-dist` 热更新到登记 VPS 的 active runtime `0.48.3`。
- 远端先校验上传包 SHA-256 和 HTML 资源闭包，再在同一文件系统内替换 active runtime 的 UI 目录并重启 `nextclaw` systemd 服务。
- 部署与回滚资产保存在私有环境记录所登记的 `20260907-084547-nc-168-mobile-realtime` 热更新目录；旧 UI 完整保留。
- 部署后 systemd 为 `active`，本机与公网健康检查通过，公网 HTML 与部署目录哈希一致，56 个引用资源全部返回 `200`。

## 用户/产品视角的验收步骤

1. 用手机浏览器打开 VPS 上的 NextClaw 并进入一个正在运行或可观察状态变化的会话。
2. 锁屏或把浏览器切到后台，再恢复到前台；页面应自动重建实时连接，无需整页刷新。
3. 在 Wi-Fi 与蜂窝网络之间切换，或短暂断网后恢复；页面应重新同步会话和任务状态。
4. 确认恢复后消息不重复、任务不重复提交，最终状态与刷新页面后看到的服务端事实一致。

真实 iOS/Android、运营商网络和特定反向代理组合仍属于环境抽样；自动化资产已经稳定覆盖导致本问题的假活 socket 边界。

## 可维护性总结汇总

- 浏览器恢复事件由 `BrowserRealtimeRecoveryService` 单一拥有，直连与远程 transport 继续各自完整拥有 socket 状态和连接生命周期。
- 没有引入整页 reload、请求自动重放、兼容开关或第二套会话补数路径。
- 新抽象有两个真实消费者，消除了生命周期监听重复；目录、文件角色和公共导入治理均通过。
- 自动 maintainability guard 无 finding；因新增共享 owner，额外完成主观边界复核，未发现未关闭问题。

## NPM 包发布记录

`@nextclaw/ui` 需要随后续统一发布进入用户版本，changeset 已准备；本次未发布 NPM 包。
