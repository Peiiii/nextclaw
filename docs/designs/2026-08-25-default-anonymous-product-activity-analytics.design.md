# 默认开启的匿名产品活跃统计设计

## 背景与问题

本设计替代 [2026-08-20-product-activity-analytics.design.md](./2026-08-20-product-activity-analytics.design.md) 中“长期安装标识、可选账号归并、默认关闭”的统计合同。

线上 D1 在 2026-08-20 验收后没有收到真实客户端活动。根因不是管理端查询错误，而是客户端默认关闭统计；同时，旧协议会长期保存安装 HMAC，并在登录后关联平台账号。这个模型即使不上传消息内容，也属于可跨周期关联的假名化使用数据，不适合静默默认开启。

用户任务是：普通用户正常使用 NextClaw 时，产品默认贡献不可关联到账号或长期设备身份的活跃汇总；用户能在“隐私与统计”中看清数据范围并随时关闭；平台管理员能看到可信的日、周、月活跃安装估算和成功活跃趋势。

## 成功标准

1. 新安装和迁移到匿名 v2 的安装默认开启基础活跃统计，关闭后立即停止上报并持续保持关闭；
2. 请求不包含长期安装 ID、平台令牌、账号 ID、消息内容、会话/项目/文件标识、URL、IP、User-Agent 或硬件信息；
3. 服务端无法用数据库字段把同一安装的日、周、月回执或相邻周期回执关联起来；
4. 管理端展示当日、当前自然周、当前自然月的活跃安装回执和成功活跃回执，以及最近 30 日趋势；
5. 上报失败不影响 Agent run，并且客户端保留可观察的最近尝试、最近成功和最近错误；
6. 协议拒绝未知字段、错误周期、过期时间、无效枚举和超量请求；
7. 旧假名化表不再写入，匿名 v2 可以独立验证和回滚。

## 方案比较

### 方案 A：保留长期安装 ID，直接默认开启

优点是可以精确计算滚动 7/30 日去重和账号跨设备归并，改动最少。缺点是长期安装 HMAC、精确日期和账号关联共同形成可持续轨迹，默认开启需要更重的合法依据、同意与用户权利流程，也更容易被用户和安全工具理解为跟踪器。放弃。

### 方案 B：保留旧协议，首次引导主动选择

优点是法律与信任边界清楚，并保留精确指标。缺点是仍然是主动加入统计，无法解决产品大盘长期为零和样本偏差。适合增强分析，不适合作为默认基础指标。首版不建设第二套增强分析。

### 方案 C：匿名周期回执默认开启

客户端在日、自然周、自然月三个互不关联的周期中，分别最多发送一次“活跃”和一次“成功活跃”回执。每个回执使用独立随机 ID，只承担单次传输重试幂等；服务端不保存安装身份或账号映射，也不记录回执之间的关系。管理端直接按周期和低基数维度计数。

该方案牺牲滚动 WAU/MAU、留存和单用户轨迹，换取默认开启所需的最小数据面、可解释性和低安全风险。选择本方案。

## 用户可见功能

| 场景 | 用户看到什么 | 动作 | owner | 失败与恢复 |
| --- | --- | --- | --- | --- |
| 新安装或匿名 v2 升级 | “匿名使用统计”默认开启，并明确说明不含账号和长期设备标识 | 可立即关闭 | Core 配置 | 关闭值持久化，后续升级不得重新开启 |
| 正常使用 | Agent 请求和结果不受统计影响 | 无额外操作 | Kernel 活动语义、Service 传输 | 上报失败只更新状态，下一次同类活动重试 |
| 隐私与统计 | 当前开关、统计人群、允许/排除字段、最近尝试、最近成功、最近错误 | 开关、选择 external/internal/qa | Service reporter 状态、Server 投影 | 状态读取失败显示未知，不伪装成功 |
| 管理大盘 | 今日、本自然周、本自然月、成功活跃、30 日趋势 | 切换人群 | Worker 聚合、Admin 展示 | 空数据明确表示尚未收到匿名回执 |

用户关闭统计时不删除历史服务端聚合，因为服务端没有能够定位该安装历史回执的身份；界面必须明确这一点。关闭后删除本地尚未发送的回执和周期状态，只保留“已关闭”配置。

## 统一事件与状态模型

Kernel 继续拥有“什么是人类活动”的唯一语义，只发出：

- `intent_accepted`：人类直接或渠道请求进入真实 Agent run；
- `run_succeeded`：对应 run 正常完成。

cron、child session 和内部系统续跑继续排除。Kernel 不知道统计默认值、周期、回执或网络。

Service 的 `ProductActivityReporter` 是匿名传输 owner。它把 Kernel 信号映射为 `active` 或 `successful`，并分别计算 `Asia/Shanghai` 的：

- `day`：`YYYY-MM-DD`；
- `week`：以周一为起点的自然周首日；
- `month`：自然月首日。

每个 `periodKind + periodStart + metric` 在本地状态中拥有独立随机 `receiptId`。状态只保留当前日、周、月的待发送或已发送回执，不存在安装级根 ID，也不从一个 ID 派生其它 ID。所有写入通过 reporter 内部串行队列完成，防止同一进程并发 run 重复创建回执。

回执只有在 Worker 返回 `202` 后标记成功；网络失败、超时和非 2xx 都记录状态并在下一次同类活动重试同一回执。重试不能生成新 ID。关闭统计时清除待发送状态。

## 协议与数据模型

`POST /platform/analytics/activity` 升级为 schema v2，每次只接收一个匿名回执：

```json
{
  "schemaVersion": 2,
  "receiptId": "随机 UUID",
  "metric": "active",
  "periodKind": "day",
  "periodStart": "2026-08-25",
  "occurredAt": "2026-08-25T12:00:00.000Z",
  "audience": "external",
  "environment": "production",
  "releaseChannel": "stable",
  "platform": "macos",
  "appVersion": "0.43"
}
```

禁止 Authorization；Worker 不解析可选登录态。`receiptId` 只用于同一回执重试幂等，不代表安装或用户。Worker 校验周期首日必须与 `occurredAt` 在上海时区对应，接受时间偏差最多七天。

新增 `anonymous_product_activity_receipts`：

- `receipt_id` 主键；
- `metric`、`period_kind`、`period_start`；
- `audience`、`environment`、`release_channel`、`platform`、`app_version`；
- `received_at`。

重复 `receipt_id` 使用 `INSERT OR IGNORE`，不会重复计数。不同回执之间没有安装、账号、批次或父子字段。日回执保留 180 天；周/月回执首批同样保留 180 天，超期在写入时惰性删除。旧 `product_analytics_installations` 和 `product_activity_daily` 不再读写，仅为已部署 Worker 回滚保留；后续确认无需回滚后再单独删除。

管理查询继续支持 audience、environment、releaseChannel 和 days。DAU 取当日日 active 回执；WAU 改为当前自然周 active 回执；MAU 改为当前自然月 active 回执，不再声称滚动 7/30 日去重。成功指标使用相同周期。移除匿名安装/已识别用户/识别率，因为匿名 v2 不存在账号归并。

## 默认值与迁移

`productAnalytics` 配置新增 `schemaVersion: 2`，默认 `{ schemaVersion: 2, enabled: true, audience: "external" }`。

旧 v1 的 `enabled` 控制的是长期安装标识协议，无法与匿名 v2 等价。配置加载器执行一次确定迁移：缺少 `schemaVersion` 的旧配置升级到 v2，并设为默认开启；升级后用户任何一次关闭都会以 `schemaVersion: 2, enabled: false` 持久化，后续不得重新开启。旧 `product-analytics/installation.json` 在 reporter 首次运行时删除，不读取或转换其中 UUID。

该迁移明确改变旧默认行为，因此用户说明和隐私设置必须同步写明“匿名统计默认开启、可随时关闭”。不能用旧 false 作为兼容 fallback，否则现有安装继续没有数据；不能在设置读取路径触发网络，上报只由真实人类活动触发。

## 用户文案与文档

隐私设置使用结果化表述：

- 标题：`匿名使用统计`；
- 开关说明：`默认开启。只发送是否使用成功、日期周期、系统类别、版本和发布通道。`；
- 收集范围：活动/成功布尔值、日/周/月周期、external/internal/qa、环境、通道、系统、版本、随机单次回执；
- 排除范围：账号、登录令牌、长期安装或设备标识、消息、回复、工具数据、会话/项目/文件、URL、IP、User-Agent、诊断日志；
- 状态：最近尝试、最近成功、最近错误；
- 关闭说明：关闭后停止发送并清除本地待发送回执；已汇总的匿名计数无法定位到当前安装，因此不能按安装删除。

英文文案保持同等语义，不把 anonymous receipt 表述为用户或精确设备人数。用户文档同步说明指标是“活跃安装估算”，自然周/月不是滚动窗口。

## 失败、安全与滥用边界

- 上报运行在 NextClaw 主进程，不创建隐藏 daemon、额外自启动项或管理员权限；
- 只连接平台 API 解析出的 NextClaw 第一方 HTTPS 基址；
- 单回执三秒超时，不无限重试，不在后台空转；
- 非 2xx 是可观察失败，不能吞掉后伪装为成功；
- 公开端点可能被伪造数据污染，指标只用于产品趋势，不用于计费、安全决策或对外精确披露；
- Worker 严格白名单、固定低基数枚举和时间窗口，禁止任意属性；
- 不以 IP 做去重、风控或补充身份，也不把 Cloudflare 网络日志并入产品统计表。

## Owner 与抽象审计

- Kernel 保留人类活动判定，不新增 analytics manager；
- Service reporter 直接拥有周期状态、重试和传输，不新增 adapter/factory；
- Worker service/repository 直接替换旧身份归并语义，不并存 v1/v2 正常写路径；
- Admin 继续消费 Worker 聚合，不自行重算指标；
- Server 只通过可选只读 status host 投影 reporter 状态，不接管状态文件。

保留的新增名词只有 `anonymous receipt` 和三个周期，它们分别保护传输幂等与活跃窗口不变量。删除长期 installation identity、账号 Authorization、用户归并指标和静默 HTTP 失败。延后增强分析、留存、滚动窗口、差分隐私和第三方分析 SDK。

## 验证标准

1. Core：新默认值、v1→v2 一次迁移、v2 关闭持续保持、未知字段拒绝；
2. Kernel：直接、渠道、cron、child、成功和失败 run 语义保持；
3. Service：周期计算、六种回执、跨周期 ID 不关联、并发串行、成功持久化、同 ID 重试、非 2xx/超时状态、关闭清理旧 UUID；
4. Server/SDK/UI：状态只读投影、开关更新、默认 UI、最近状态和中英文数据边界；
5. Worker：schema v2 白名单、周期校验、无 Authorization 依赖、receipt 幂等、日/周/月计数、成功指标、受众/环境/通道过滤、趋势和清理；
6. Admin：删除身份归并展示，周/月口径文案准确；
7. 运行所有触达包的定向测试与 TypeScript `tsc`，应用本地 D1 migration，运行 Platform Admin build/smoke，并做 diff-only maintainability Review；
8. 通过本地真实 reporter→HTTP→SQLite 回放证明 producer、transport、owner、consumer 一致；随后应用生产 D1 migration、部署 Worker 与 Platform Admin，并用 `internal` 匿名回执完成生产端到端 smoke；
9. 生产验证完成后清理 smoke 回执或将其稳定隔离在 internal 视图，确认 external 默认视图不被验收污染；客户端 NPM/Desktop 新版仍由用户发布。

## 非目标与交付边界

- 不构建用户画像、留存、漏斗、页面点击或工具级分析；
- 不承诺匿名回执等于精确自然人数；
- 不删除旧 D1 表和 `users.analytics_audience` 列；
- 不把匿名统计扩展到启动、心跳、cron 或子 Agent；
- 本任务完成源码、迁移、用户文档、生产 D1、Worker、Platform Admin 和线上 smoke；用户后续明确授权本地提交，但不 push，也不发布 NPM/Desktop/runtime channel。用户发布包含本改动的客户端新版后，真实活动无需额外平台操作即可进入网页大盘。
