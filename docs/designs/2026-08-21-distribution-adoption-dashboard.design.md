# 发行与采用大盘设计

## 目标

让平台管理员在同一处查看 NextClaw 各发布物的公开下载信号：GitHub Release 文件的累计下载、从本功能上线后开始积累的 GitHub 每日增量，以及 npm `nextclaw` 包最近 30 日的公开日下载量。它是“分发与采用”视图，不替代产品活跃统计。

用户任务是：管理员打开 Platform Admin 首页即可看到上一完整统计日的数据；需要最新值时点击“刷新实时数据”，并能按发布物确认累计、今日和昨日的变化及数据是否成功同步。面对历史 Release 资产时，管理员还必须能在可读的单页范围内定位指定发布物，而不是在数千行中滚动查找。

## 口径与非目标

| 信号 | 定义 | 不代表 |
| --- | --- | --- |
| GitHub Release 下载 | 单个 Release asset 的 GitHub `download_count` 累计值 | 独立用户、安装成功或实际使用 |
| GitHub 日增量 | 相邻上海时区日快照的累计差值 | 上线前的历史日下载 |
| npm 下载 | npm API 返回的 `nextclaw` 公开日下载量 | 具体版本/平台、独立用户或运行成功 |
| 产品活跃 | 用户主动同意统计后，提交 Agent 请求的去重主体 | 下载或升级规模 |

不采集 IP、用户标识、设备指纹、安装标识、请求内容或 GitHub/npm 原始访问日志。管理端继续将产品活跃和发行采用分为独立区域，禁止相加或互相推导。

## 主链路

```text
GitHub Release API ─┐
                    ├─ Worker DistributionAdoptionService ─→ D1 快照 ─→ 管理员 API ─→ Platform Admin
npm Downloads API ──┘                    ↑
                                      手动刷新 / 两小时 Cron
```

1. `DistributionAdoptionService` 是唯一 producer：读取 GitHub 的全部 Release asset 和 npm 最近 30 日下载数据，归类平台、架构与发布物类型。
2. D1 是唯一状态 owner：`distribution_download_assets` 保存最近累计值；`distribution_download_daily` 保存按日快照；`distribution_download_sync_state` 保存最近一次同步事实。
3. Worker Cron 每两小时更新当前值；上海时区零点后的那一次同步同时把前一日 GitHub 累计数固化为日快照。
4. 管理员手动刷新复用同一同步入口，并以 5 分钟冷却复用最近成功值，避免将点击刷新变成绕过上游 API 配额的平行路径。
5. 管理员 API 只允许 admin token 读取和刷新；前端不持有任何 GitHub/npm 凭据。

## GitHub 每日快照限制

GitHub API 对 Release asset 只提供当前累计 `download_count`。因此：

- 首次同步前的每日增量不可可靠回填，界面显示为 `—`；
- 首个相邻日快照完成后，昨天与今天的增量开始可信；
- 当前累计值始终可见；
- npm 日下载由上游直接提供，可回填最近 30 日，但上游完整日数据存在自然延迟。

禁止用资产创建时间、发布时下载数或其他估算方法伪造 GitHub 历史日增量。

## 交互合同

| 场景 | 可见行为 |
| --- | --- |
| 首次进入 | 读取 D1 快照，显示最近成功同步时间；无快照时显示空态而不是 0 |
| 正常浏览 | 顶部显示 GitHub 累计、今日/昨日增量、npm 最近完整日；发布物表格默认每页 10 条，最多 20 条 |
| 查找发布物 | 搜索匹配发布物名称与 Release tag；类别和平台筛选与搜索共同生效，任一条件变化后返回第 1 页 |
| 翻页 | 显示当前范围、总数和页码；上一页/下一页在边界禁用，筛选无结果时显示空态而不是空白表格 |
| 排序 | 发布物、类别、平台、累计、今日与昨日表头均可点击；首次点击升序、再次点击降序，显示方向和 `aria-sort` 状态，并在全量筛选结果后、分页前排序 |
| 点击刷新 | 使用真实 `<button>`，显示“刷新中”，成功后替换当前快照，五分钟内复用已同步数据 |
| 上游失败 | 保留最后成功值，显示来源与最近失败原因，不覆盖为 0 |
| 新功能首日 | GitHub 今日/昨日无相邻快照时显示 `—`，说明从首个日快照开始可信 |

### 发布物列表数据合同

- `GET /platform/admin/distribution/overview` 接收 `page`、`pageSize`、`q`、`artifactKind` 和 `platform`；`pageSize` 只允许 10 或 20。
- Worker/D1 owner 在服务端计算筛选、总数和当前页，只将当前页记录返回给前端；不得把全量 Release 资产传给浏览器后伪分页。
- 前端 query state 只归 `AdminOverviewPage`，表格组件只持有输入草稿与展示/回调。刷新成功后失效当前所有发行列表 query，从而保留用户当前筛选条件重新读取。
- 默认顺序继续按 Release、类别、文件名稳定排序；管理员可按可见列切换升/降序，排序参数随筛选和翻页保留。

## 发布物分类

- `npm_runtime_bundle`：`nextclaw@*` Release 的 `nextclaw-runtime-*`。
- `desktop_installer`：DMG、EXE、DEB、AppImage。
- `desktop_portable`：Portable 与 unpacked ZIP。
- `desktop_runtime_bundle`：Desktop Release 的 `nextclaw-bundle-*`。
- `update_metadata`：manifest、latest、blockmap、公钥等技术文件。
- `other`：未命中上述规则的 Release asset，保留在表中防止静默漏数。

## 验证标准

- Worker 解析测试覆盖 runtime bundle、Desktop 安装包、更新元数据、npm 日数据排序和上海时区日快照窗口。
- Worker 和 Admin 的 TypeScript 检查通过。
- Worker build、产品活跃既有回归测试、Admin production build 通过。
- 部署前应用 D1 migration；部署后以管理员身份触发一次刷新，确认两条上游来源状态与数据表写入。
- Platform Admin 线上浏览器验证刷新按钮、加载态、结果更新与移动端表格横向浏览。
- 使用超过 20 条的真实生产数据验证默认 10 条、20 条切换、搜索、类别/平台筛选、无结果空态与前后翻页；确认请求和响应不再传输全量 GitHub 资产。

## 非目标

- 不把 GitHub/npm 下载估算成用户数。
- 不追踪单次安装、更新成功、启动成功或真实活跃；这些需要独立、最小化且可授权的客户端事件合同。
- 不增加外部分析 SDK、第三方数据仓库或客户端隐私采集。
