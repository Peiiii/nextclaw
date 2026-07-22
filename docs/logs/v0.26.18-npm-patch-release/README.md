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
- `packages/nextclaw/resources/update-bundle-public.pem` 已存在且非空；发布 tarball、registry、stable runtime、公开升级、本机更新重启与 Docs Deploy 结果将在发布后回填。

## 发布/部署方式

- NPM：使用仓库标准 `pnpm release:publish` 发布 49 个公开包，不使用 raw `npm publish`。
- Runtime update：发布 `0.27.2` stable runtime channel，并等待四平台 workflow 完成。
- Docs：发布中英文更新说明与结构化 JSON，验证全球站和国内站同产物。
- 本机：公开发布验证完成后，将当前安装态更新到 `nextclaw@0.27.2` 并重启 managed service，再验证 Remote 状态与两个实际域名。
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
- 当前状态：版本化与严格发布检查已通过；registry publish、tag、stable runtime 与公开升级验证待发布后回填。
- `@nextclaw/desktop` 是 private workspace package，只同步内部版本元数据，不进入 NPM publish。
