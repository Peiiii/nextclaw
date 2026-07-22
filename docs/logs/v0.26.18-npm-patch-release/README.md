# NextClaw 0.27.2 NPM Patch 发布

## 迭代完成说明

本次发布目标为 `nextclaw@0.27.2`，采用 full public workspace patch batch，共 49 个公开包。发布批次统一交付四项已提交能力：会话级待发送队列、技能预览引用持久化、动态高度聊天滚动稳定性，以及 Remote 断线快速恢复与真实运行状态 owner 修正。

Remote 修复的根因不是域名过期或实例丢失，而是已成功连接后的 `1006` 断线仍沿用历史握手失败次数，最终把重连退避推高到约 34 分钟。修复后，握手失败仍指数退避；一旦连接成功，之后的异常断线从基础延迟开始新一轮重连。实例 ID、默认域名和自定义域名均保持原有稳定合同。

本次不配图：Remote 重连、排队与滚动都属于跨时间行为，静态截图不能证明结果。X 帖不适用：这是稳定性 patch，不扩大为社交媒体发布。

## 测试/验证/验收方式

发布准备阶段已完成：

- NPM 身份：`peiiii`。
- 本地 `master` 与 `origin/master` 已对齐，Remote 根因修复提交为 `517e816e5`。
- `pnpm release:check:health`、`pnpm release:check-readmes`：通过。
- `pnpm release:auto:changeset`、`pnpm release:version`：完成 full public workspace 版本化，`nextclaw` 为 `0.27.2`。
- `NEXTCLAW_RELEASE_CHECK_RESET=1 pnpm release:check:strict`：从空 checkpoint 完成 49 个公开包的 build、TypeScript 与 lint，0 个阻断错误；输出中的 lint 项均为既有 warning。
- Remote 定向回归：4 个文件、16 项测试通过；连续三次握手失败为 `3s -> 6s -> 12s`，成功 `open` 后再发生 `1006`，下一次延迟回到 `3s`。
- `pnpm smoke:remote-relay`：通过实例复用、端口区分、默认/自定义双域名、域名去重占用、owner 打开、分享撤销与 offline 转换。
- 当前源码生产 Relay 验收：隔离实例重启前后复用同一实例 ID 与默认域名，页面均为 HTTP 200 且不含 offline 文案。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet` 与 scoped maintainability guard：通过。
- `pnpm -C apps/docs build` 与结构化发布说明 JSON 解析：通过。
- `packages/nextclaw/resources/update-bundle-public.pem` 已存在且非空；workspace tarball 不含 `workspace:*`，并包含 app CLI、launcher CLI、内置更新公钥与完整 `ui-dist`。
- `pnpm release:publish`：49/49 个公开包发布成功，registry 逐包校验通过；49 个 Changesets tag 已推送。
- `nextclaw@0.27.2` 的 `latest` 已生效，registry integrity 为 `sha512-wh/US/J30vfNWSa4BRdmsH3piNPGMmoAumXcFA3XS+pOgU9dWFF8VGZQ43mYi8nsLS2GKcTpkm5rps9vjYgLIQ==`。
- 公开安装冒烟：从 registry 安装 `nextclaw@0.27.2` 后，`--version` 返回 `0.27.2`，发布 manifest 无 `workspace:*` 依赖。
- Stable runtime workflow [`29942908684`](https://github.com/Peiiii/nextclaw/actions/runs/29942908684)：darwin-arm64、darwin-x64、linux-x64、win32-x64 四平台构建、签名、Release asset 上传与 gh-pages 发布全部成功。
- 四份公开 stable manifest 均为 `latestVersion=0.27.2`、`minimumLauncherVersion=0.18.11`、`hostKind=npm-runtime-bundle`；bundle hash、bundle signature 和 manifest signature 均非空，`releaseNotesUrl` 指向本次英文说明。
- 旧版升级实测：隔离安装公开 `nextclaw@0.27.1`，未注入自定义公钥，状态依次为 `update-available`、`downloaded`、`restart-required`，同一 CLI 入口最终返回 `0.27.2`。
- Docs Deploy workflow [`29942902213`](https://github.com/Peiiii/nextclaw/actions/runs/29942902213)：全球站和国内站部署成功；第一次 verify 从 GitHub runner 连接国内 CDN 超时，实时本地同制品校验已通过，failed-job rerun 后 workflow attempt 2 全绿。两个生产域的中英文说明与结构化 JSON 均返回 HTTP 200，manifest 提交和 tree hash 一致。
- 本机安装态：从 0.27.1 应用 stable 更新并重启，PID `42987 -> 72926`；`nextclaw --version` 为 `0.27.2`，状态健康、更新状态 `up-to-date`、Remote Doctor 5/5 检查通过，真实 owner 为端口 55667 的 managed service。
- 本机实际域名验收：实例 ID 保持 `82bcca90-a43a-43c1-84d9-730a3dc1a9e5`；默认域名 `nc-82bcca90a43a43c184d9730a3dc1a9e5.claw.cool` 与自定义域名 `peiiii.claw.cool` 经 owner session 均为 HTTP 200 且 `offline=false`。

## 发布/部署方式

- NPM：使用仓库标准 `pnpm release:publish` 发布 49 个公开包，不使用 raw `npm publish`。
- Runtime update：已通过 stable runtime workflow 发布 `0.27.2`，GitHub Release 为 [`nextclaw@0.27.2`](https://github.com/Peiiii/nextclaw/releases/tag/nextclaw%400.27.2)。
- Docs：中英文更新说明与结构化 JSON 已发布，全球站和国内站通过同提交、同 tree hash 验证。
- 本机：当前安装态已更新到 `nextclaw@0.27.2` 并重启 managed service，Remote 与两个实际域名均已通过验收。
- Desktop installer / manifest：不适用，本次不发布新的桌面安装包。
- 数据库 migration / 独立后端部署：不适用，本次没有数据库、Relay worker、域名映射或平台 API 变更。

## 用户/产品视角的验收步骤

1. 在回复期间向两个不同会话继续发送消息，确认排队互不阻塞，切换会话或刷新后仍可管理。
2. 点击消息中的技能引用，确认可以打开对应 `SKILL.md` 预览。
3. 在 Mermaid 异步改变高度或加载历史消息时向上阅读，确认视图位置稳定。
4. 让已成功连接的 Remote WebSocket 异常断开，确认下一轮从基础延迟重连，而不是等待几十分钟。
5. 重启 NextClaw，确认实例 ID、默认域名和自定义域名不变，两个域名都恢复到 HTTP 200。

## 可维护性总结汇总

Remote 修复的 scoped maintainability 结果为总计 `+202 / -30 / net +172`，其中非测试代码 `+17 / -30 / net -13`，满足非功能改动净增门槛。正向减债包括删除 ownership 失败时的共享状态写入、一次性状态转发 helper 与未消费字段，并把连接计数、状态发布和运行状态读取收敛到各自唯一 owner。

本次发布操作只新增必要的版本号、changelog、产品更新说明、结构化 JSON 和发布记录，不新增产品语义源码。发布闭环继续运行严格 release check、governance、公开安装升级冒烟与生成产物清理，防止源码正确但制品或更新通道漂移。

## NPM 包发布记录

- 发布批次：49 个公开包 full public workspace patch。
- 主包：`nextclaw@0.27.2`。
- Remote 关键包：`@nextclaw/remote@0.3.15`、`@nextclaw/service@0.3.15`、`@nextclaw/ui@0.15.15`、`@nextclaw/kernel@0.6.15`。
- 当前状态：registry publish、49 个 tag、stable runtime、公开安装/升级、Docs Deploy 与本机更新重启均已闭环。
- `@nextclaw/desktop` 是 private workspace package，只同步内部版本元数据，不进入 NPM publish。
