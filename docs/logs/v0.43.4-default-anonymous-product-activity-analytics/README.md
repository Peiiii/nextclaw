# v0.43.4 默认匿名产品活跃统计

## 迭代完成说明

本次把此前“默认关闭、稳定安装标识、登录后账号归并”的产品活跃统计替换为默认开启的匿名周期回执。根因确认来自生产 D1：旧统计只有一条内部验证记录，真实用户链路没有数据；客户端配置默认关闭且存量配置缺省时仍解析为关闭，因此线上统计页无法获得真实活跃数据。

新链路由 Kernel 继续拥有“请求已接受 / 运行成功”事实，Service 为当日、当前自然周和当前自然月分别生成互不关联的一次性 UUID 回执，Worker 只保存周期、指标和低基数发行维度。协议不再发送账号、令牌、稳定安装标识、消息、工具参数、文件、URL、IP、User-Agent 或诊断日志。配置升级为 schema v2：新装和旧 schema 首次迁移默认开启，用户明确关闭后的 v2 配置保持关闭。

实现设计见 [默认匿名产品活跃统计设计](../../designs/2026-08-25-default-anonymous-product-activity-analytics.design.md)，待发布说明见 [anonymous-activity-receipts changeset](../../../.changeset/anonymous-activity-receipts.md)。

## 测试/验证/验收方式

- Core 配置迁移定向测试通过：默认启用、旧 schema 一次迁移、v2 明确关闭持久保留。
- Service 上报器 4 个定向测试通过：关闭清理、六类独立回执、并发串行化、非 2xx 重试及相同 UUID 去重。
- Kernel 产品活动事件 5 个测试、Server 状态接口 2 个测试、UI 隐私页测试通过。
- Core、Service、Server、Client SDK、UI、Worker、Platform Admin 的匹配范围 TypeScript 检查通过；触达文件定向 ESLint 零告警。
- Worker SQLite 集成测试通过：v2 严格字段、周期口径、筛选、趋势、过期/未知/v1 输入拒绝与重复回执幂等。
- 本地 D1 `0017` 迁移成功；新增文件治理检查和 diff-only maintainability guard 通过。
- 生产 Worker 健康检查返回 200；v1 请求返回 `INVALID_ANALYTICS_SCHEMA`；六类 internal 回执均返回 202，远程 D1 查询确认每类各一条，重复投递后同一 receipt 仍只有一条。
- 生产表结构只含 `receipt_id / metric / period_kind / period_start / audience / environment / release_channel / platform / app_version / received_at`。
- 正式管理后台浏览器真实登录验收：默认 external 为 0，切换 internal 后 DAU、WAU、MAU 与三项成功活跃均为 1，当日趋势为“活跃 1、成功 1”。
- 中英文正式文档页均返回 200，并包含默认匿名统计及不采集长期安装标识的说明。

## 发布/部署方式

- 生产 D1 已应用 `0017-anonymous-product-activity-aggregates.sql`，并通过远程只读查询确认。
- `nextclaw-provider-gateway-api` 已部署，Worker Version ID：`4db82a9c-d8c5-498e-824f-4617ac7913fc`。
- Platform Admin Pages 已部署：`https://208f444f.nextclaw-platform-admin.pages.dev`；正式域 `https://platform-admin.nextclaw.io` 冒烟和真实数据验收通过。
- Docs Pages 已部署：`https://eae17e7a.nextclaw-docs.pages.dev`；正式域 `https://docs.nextclaw.io` 中英文页面验证通过。
- 本轮人工本机 Cloudflare 部署使用既有 Wrangler 登录态，不属于无人值守发布。外部变更命令实测：D1 迁移约 3.4 秒、Worker 部署约 12.8 秒、Admin 构建部署约 26.0 秒、Docs 上传部署约 33.1 秒；最慢步骤为 Docs Pages 上传约 27.1 秒。失败重试为 0。
- 用户已明确授权本地提交；未推送，也未发布 NPM、Runtime channel 或 Desktop。客户端能力随用户下一次统一新版发布生效。

## 用户/产品视角的验收步骤

1. 发布包含本 changeset 的新版 NextClaw。
2. 在新装或旧 schema 用户环境完成一次请求，打开 **设置 → 隐私与统计**，确认默认开启并能看到最近尝试、最近成功、错误和待发送回执数。
3. 登录 `https://platform-admin.nextclaw.io`，保持 external / production / stable，确认真实新版客户端活动开始进入当日、自然周、自然月指标。
4. 切换到 internal，可看到本轮隔离冒烟数据为 DAU/WAU/MAU 各 1，成功活跃各 1。
5. 用户关闭匿名统计后，后续不再产生网络投递，本机待发送回执被清除。

## 可维护性总结汇总

本轮删除旧稳定安装身份、账号归并和 identified/anonymous 双指标主链路，只保留一个匿名周期回执 owner。状态归 Service、聚合归 Worker、展示归 Platform Admin，未新增兼容双写或隐藏 fallback。

自动维护性检查最初发现 `server-api.types.ts` 越过 900 行预算；已将配置状态合同拆入 `server-api-config.types.ts`，并把新路由测试放入既有 `__tests__` 边界。复检无 error。剩余 warning 为历史目录例外、接近预算文件和 Service 上报器必要增长；经主观复核，无重复 owner、无复杂度藏入 wrapper、无未关闭 finding。新增路径满足当前文件组织治理。

## NPM 包发布记录

需要随下一次统一新版发布，但本轮未执行 NPM 发布：

- `nextclaw`：待统一发布。
- `@nextclaw/core`：待统一发布。
- `@nextclaw/service`：待统一发布。
- `@nextclaw/server`：待统一发布。
- `@nextclaw/client-sdk`：待统一发布。
- `@nextclaw/ui`：待统一发布。

触发条件是用户执行下一次 NextClaw 新版发布；Worker、生产 D1、Platform Admin 和 Docs 已先行完成，无外部阻塞。
