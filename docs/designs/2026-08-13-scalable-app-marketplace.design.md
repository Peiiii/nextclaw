# NextClaw 可规模化应用市场方案设计

## 1. 决策摘要

NextClaw 应用市场采用以下单一主链：

> D1 继续作为应用、版本、审核与可见性的事实来源；公开浏览通过专门的目录读模型提供游标分页与全文搜索；公开 JSON 在 Cloudflare Edge 缓存；图标、封面和安装包使用内容寻址的不可变 R2 对象；安装由 NextClaw 本机已有的持久化异步任务负责。

它既不是“客户端下载全量目录”，也不是“每次浏览直接扫描交易表”。静态化只用于首页栏目、热门查询响应和不可变资产，不建立第二个完整 Catalog 事实源。

本次落地覆盖可以从当前少量应用平滑扩展到数十万条目的基础主干：

- `v2` 游标分页目录，不计算每页精确总数；
- 公开状态、排序和筛选组合索引；
- D1 FTS5 搜索投影，由数据库触发器与 canonical 表同步；
- 列表、详情、Registry metadata 的边缘缓存、`ETag` 与后台重验证；
- 内容哈希进入图片和安装包的 R2 key，公开响应长期不可变缓存；
- UI 与公开站点按页消费，不再请求 `pageSize=100` 后在客户端完成全量搜索；
- 现有 `v1` 页码接口保留为兼容边界，明确不再是产品主链。

## 2. 用户任务

用户从 NextClaw 的“添加应用”或 `apps.nextclaw.io` 进入，为了浏览、搜索、判断并安装应用，应当先看到一页可用结果，能够继续加载后续结果，打开详情后确认权限和版本；安装开始后可以离开当前页面，并在全局应用管理中继续看到真实进度和最终结果。

成功不是“接口返回了 JSON”，而是：

1. 应用数量增长时，首次进入不会下载全量目录；
2. 搜索在服务端执行，并能继续翻页；
3. 发布、下架或隐藏应用后，公开目录最终收敛到 canonical 状态；
4. 同一版本的图片和安装包 URL 不变且内容不变；
5. 浏览、详情和安装互不阻塞。

## 3. 现状证据与第一个违约边界

当前公开链路为：

```text
客户端打开市场
  -> GET /api/v1/apps/items?page=1&pageSize=100
  -> Worker
  -> 串行 COUNT(*)
  -> OFFSET 分页查询 marketplace_app_items
  -> 客户端全量筛选和搜索
```

已经确认的问题：

- 当前客户端固定请求 `pageSize=100`，应用超过 100 后会静默缺失；
- 每次列表先执行精确 `COUNT(*)`，再执行行查询，两次数据库往返串行；
- 深页使用 `OFFSET`，页码越深，需要跳过的记录越多；
- 搜索使用多个 `LOWER(column) LIKE '%query%'`，不能利用普通 B-tree 索引；
- 标签保存在 JSON 文本中并使用模糊匹配；
- 图片和 bundle 的 R2 key 不含内容哈希，发布覆盖后却仍可能被缓存为同一 URL；
- 图片和 bundle 只缓存 300 秒，且通过 Worker 每次先查 D1 再读取 R2；
- 列表和详情 JSON 没有公开缓存合同、`ETag` 或条件请求；
- 当前线上 4.7 KB 列表响应实测约 1.2–5.9 秒，说明动态读取链路在少量数据时已经无法提供可靠首屏延迟。

第一个架构违约边界是公开目录读取：消费者在读取 canonical 交易表，而不是读取面向发现的、可分页、可索引、可缓存的公开投影。

## 4. 候选方案比较

| 方案 | 说明 | 规模化 | 一致性与恢复 | 成本 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 全量 `catalog.json` | 发布时生成完整文件，客户端整体下载 | 差；体积、失效和客户端解析随应用数线性增长 | 简单但粒度过粗 | 低 | 只适合作为小型目录或离线快照，不作为主链 |
| 原表查询 + Edge Cache | 保留页码、LIKE、COUNT，只缓存响应 | 中低；热点快，长尾搜索和深页仍退化 | 简单 | 低 | 可做临时优化，不足以成为终局 |
| D1 canonical + D1 搜索投影 + 游标 API + Edge/CDN | 写模型与读模型分离，但仍在同一受控数据库内 | 中高；可支撑早中期生态，且能平滑换搜索引擎 | 搜索投影可重建，owner 清晰 | 中 | 本次推荐并落地 |
| D1 canonical + 外部搜索集群 + 事件总线 | 独立 Elasticsearch/Typesense/OpenSearch | 高 | 需要 outbox、消费幂等和重建工具 | 高 | 搜索规模或排序复杂度超出 D1 后升级 |

推荐第三种。它牺牲了“所有读取都直接查一张表”的表面简单性，但换来正确的数据量边界，并保留未来替换搜索引擎的清晰缝隙。现在直接引入外部搜索集群没有真实流量依据，会制造额外发布、监控和一致性成本。

## 5. Owner 与主链

### 5.1 唯一事实 owner

`marketplace_app_items`、`marketplace_app_versions` 和审核/可见性字段仍然是 canonical owner：

- 应用身份、slug 和发布者；
- 公开、隐藏、删除和审核状态；
- 当前版本和历史版本；
- manifest、权限与内容哈希；
- 文件和 bundle 的存储引用。

FTS 表、HTTP 缓存与客户端 Query Cache 都是可丢弃、可重建的派生状态，不得反向写回 canonical 数据。

### 5.2 公开目录读模型

```text
GET /api/v2/apps/items
  -> 解析并校验 query
  -> D1 first-unconstrained Session（启用读副本后就近读）
  -> 搜索投影/组合索引
  -> limit + 1 判断 hasMore
  -> 输出 opaque nextCursor
  -> Edge Cache + ETag
```

公开列表只返回卡片需要的字段，不返回 description、manifest、permissions、历史版本或文件清单。

### 5.3 发布主链

```text
发布请求
  -> 校验 bundle 和文件
  -> 写入内容寻址 R2 对象
  -> 更新 version/item canonical 表
  -> D1 trigger 同步 FTS 投影
  -> 新 revision 令新请求自然使用新 cache key/ETag
```

本次不增加单独队列，因为 D1 trigger 已能在同一数据库事务语义内维护轻量搜索投影。未来切到外部搜索服务时，再由 transactional outbox 取代 trigger；不得让请求代码同时写 D1 和远端搜索服务。

### 5.4 资产与安装包

R2 key 采用内容寻址：

```text
apps/{appId}/bundles/{version}/{sha256}.napp
apps/{appId}/files/{sha256}/{relativePath}
```

公开 URL 可以继续经过 Registry Worker，以保持现有 Registry 合同和私有 Registry 能力；但响应必须：

- 使用内容哈希 `ETag`；
- `Cache-Control: public, max-age=31536000, immutable`；
- 支持 `If-None-Match`；
- bundle 支持 `Range` 和 `HEAD`；
- 同一 URL 永不返回不同内容。

未来如果给 R2 配置独立自定义域名，只需要让映射器输出该域名，不改变 canonical 数据和安装协议。

## 6. API 合同

### 6.1 v2 列表与搜索

```http
GET /api/v2/apps/items?limit=24&cursor=<opaque>&q=notes&tag=personal&sort=relevance
```

约束：

- `limit` 默认 24，最大 50；
- `cursor` 是带版本的 opaque Base64URL JSON，客户端不得解析或修改；
- cursor 绑定 `q`、`tag` 与 `sort` 的查询指纹，跨查询复用返回 400；
- `sort=featured`：`featured DESC, updated_at DESC, id DESC`；
- `sort=updated`：`updated_at DESC, id DESC`；
- `sort=relevance` 仅在有 `q` 时成立，使用 FTS `bm25`，再以 `updated_at` 和 `id` 稳定打破同分；无 `q` 时等价于 `featured`；
- 返回 `limit + 1` 行，只用多取的一行计算 `hasMore`，不计算精确总数。

响应：

```json
{
  "ok": true,
  "data": {
    "items": [],
    "nextCursor": "...",
    "hasMore": true,
    "query": "notes",
    "tag": "personal",
    "sort": "relevance"
  }
}
```

应用市场展示精确全量数量不是完成用户任务的必要条件。若未来运营后台需要精确统计，使用独立聚合，不把 `COUNT(*)` 放回消费者热路径。

### 6.2 v1 兼容接口

`GET /api/v1/apps/items` 暂时保持原响应结构，供旧桌面版本和镜像脚本使用。它不是新客户端主链，也不承诺深页性能。

退出条件：所有受支持的 NextClaw 客户端、官网和镜像工具都迁移到 v2 后，经过至少一个稳定发布周期再移除；移除前通过访问日志确认无受支持消费者。

### 6.3 详情和 Registry metadata

- `GET /api/v1/apps/items/:selector`：短时公开缓存和后台重验证；
- `GET /api/v1/apps/registry/:appId`：短时公开缓存和后台重验证；
- 返回 `ETag`，匹配 `If-None-Match` 时返回 304；
- 详情不嵌入文件内容；README 和截图按需读取。

### 6.4 缓存策略

| 资源 | Browser TTL | Edge TTL / SWR | 说明 |
| --- | ---: | ---: | --- |
| v2 首页、分类和搜索页 | 60 秒 | 300 秒 / 600 秒 | Query string 是 cache key 的一部分 |
| 详情与 Registry metadata | 60 秒 | 300 秒 / 600 秒 | ETag 条件请求 |
| 图标、封面、截图 | 1 年 | 1 年 | 内容寻址，immutable |
| bundle | 1 年 | 1 年 | 内容寻址，immutable，Range |
| 用户、管理员和发布接口 | 0 | 0 | `private, no-store` |

## 7. 数据库设计

新增 migration：

1. 补充公开排序组合索引：

```sql
(publish_status, owner_visibility, owner_deleted_at, featured DESC, updated_at DESC, id DESC)
(publish_status, owner_visibility, owner_deleted_at, updated_at DESC, id DESC)
```

2. 建立 `marketplace_app_search` FTS5：

```text
item_id UNINDEXED
slug
app_id
name
summary
description
tags
author
publisher_name
```

3. 用 insert/update/delete trigger 维护投影，并对已有 canonical 行 backfill。

搜索输入会被分词、转义并改写成前缀查询。FTS 不可用、损坏或漂移时视为服务端故障，不回退到全表 `%LIKE%` 扫描；恢复方式是从 canonical 表重建投影。

## 8. 客户端功能地图

| 场景 | 用户看到什么 | 动作 | owner | 失败/恢复 |
| --- | --- | --- | --- | --- |
| 首次进入 | 首批 skeleton，随后最多 24 个卡片 | 浏览、筛选、搜索 | v2 目录 API | 显式错误和重试，不阻塞已安装应用 |
| 继续浏览 | 已有卡片保持，底部显示加载动作 | 加载更多 | opaque cursor | 失败只影响下一页，可重试 |
| 搜索 | 输入稳定后请求服务端结果 | 修改关键词 | v2 FTS 读模型 | 新查询取消/忽略旧响应 |
| 分类 | 分类切换后读取对应第一页 | 切换 tag/filter | v2 query | 保持统一 tab/chip 宽度和反馈 |
| 详情 | 单应用资料、权限和版本 | 返回、安装、更新 | detail API | 详情失败不清空目录 |
| 安装 | 立即进入 queued 并显示阶段进度 | 离开市场、回看进度 | 本机 `AppPackageOperationManager` | 持久化恢复、失败重试、回滚 |
| 刷新/重进 | 缓存结果先可见，再按 TTL 重验证 | 继续浏览 | Query Cache + Edge | 缓存不是事实 owner |

官网的搜索、分类和翻页使用同一 v2 API。发布者页改为服务端 `publisher` 过滤，而不是拉 100 条后在浏览器过滤。

## 9. 状态与不变量

必须长期成立：

1. 公开列表只包含 `published + public + not deleted` 的应用；
2. cursor 只在产生它的同一查询中有效；
3. 每一页排序稳定，无重复或跳项；
4. 搜索投影可从 canonical 表完全重建；
5. 内容寻址 URL 的字节内容永不改变；
6. list/detail/read 不产生隐藏写入；
7. 安装任务不属于市场弹窗生命周期；
8. 客户端缓存、Edge Cache 和 FTS 都不能成为事实 owner。

## 10. 失败与恢复边界

- D1 暂时失败：Edge 可在 SWR 窗口继续提供最近成功的公开响应；没有缓存时返回显式错误；
- FTS 查询失败：返回服务错误并告警，不执行退化全表扫描；
- cursor 非法、过期或跨查询：400，客户端从第一页重新开始；
- 发布写入 R2 成功但数据库失败：对象以内容哈希命名，可安全成为待回收 orphan；后续 GC 按数据库引用清理；
- 资产数据库记录存在但 R2 丢失：返回 404/服务错误并告警，不能用占位内容伪装成功；
- bundle 下载中断：Range 可用于重试；当前客户端仍可整包重试，未来可增加断点续传而不改变 URL；
- 应用发布后短时间仍看到旧列表：允许最多 Edge TTL + SWR 的最终一致性；详情与安装使用 Registry metadata 再确认当前版本。

## 11. 规模升级阈值

先用测量结果升级，不按应用数拍脑袋：

- D1 FTS 的 P95 查询时间持续超过目标，或相关性、语言分词、同义词、拼写纠错成为核心需求时，引入独立搜索系统；
- 搜索索引更新需要跨系统时，增加 transactional outbox 与幂等消费者；
- 个性化推荐出现后，推荐是独立投影，不能塞进目录 SQL；
- 全球读取仍受 D1 主库距离影响时，启用 D1 read replication，并让公开 reader 使用 `withSession("first-unconstrained")`；
- 中国大陆访问需要独立合规节点或镜像时，沿已有 marketplace mirror 合同同步 v2 分页投影与内容寻址资产，不修改客户端语义。

## 12. 明确非目标

本次不做：

- 付费、订阅、退款和税务；
- 评论、评分、防刷与排行算法；
- 个性化推荐；
- 外部 Elasticsearch/OpenSearch 集群；
- 未经授权部署 Worker、执行远端 migration、切 DNS 或配置 R2 自定义域名；
- 用本地全量 Catalog 替代在线市场。

这些非目标不掩盖主路径：浏览、搜索、详情、安装、更新、回滚和卸载已有或在本次主干中闭合。

## 13. 最小充分验证

### 协议与数据库

- migration 能从空库和已有数据安全执行；
- FTS trigger 对 insert/update/delete 的投影正确；
- cursor 编解码、篡改、跨查询和末页行为有单元测试；
- 公开可见性、排序稳定性、搜索和 tag 过滤有 repository 测试；
- v1 响应合同保持兼容；
- JSON 缓存头、ETag/304、资产 immutable、HEAD 和 Range 有路由测试。

### 客户端

- 首次只请求 24 条；
- 搜索和分类发送服务端 query，不做全量目录过滤；
- `hasMore` 时能加载下一页并去重；
- 切换查询不会拼接旧页；
- 详情和异步安装原路径不回归。

### 工程质量

- Worker、UI、官网相关测试通过；
- 触达 TypeScript 包分别通过 `tsc`；
- targeted lint 和生产 build 通过；
- 本地 Worker 使用真实 migration 和种子数据做 HTTP smoke；
- 用不少于 10 万条合成应用对游标分页查询执行 query plan 与基准，证明热路径不使用 OFFSET 或全表 `%LIKE%`；
- 生产延迟只在获准部署后验证，未部署前不得声称线上性能已经改善。

## 14. 本地落地与验证记录

2026-08-13 已完成本方案的源码落地，并在隔离环境验证以下主链：

### 14.1 Registry 与 10 万条目录

- 从空 D1 依次执行现有 migration 到 `0012`，无跳步或手工补表；
- 写入 100,000 条合成应用后，canonical 条目为 100,000、FTS 条目为 100,000、标准化标签条目为 150,000；
- `featured` 首屏和第二页均返回 24 条，cursor 连续且不重复；搜索 `needle` 连续读取 5 页，共 100 条，全部唯一并正确到达末页；
- cursor 跨查询复用返回 400；
- 公开默认排序的 query plan 使用 `idx_marketplace_app_items_public_featured_cursor`，没有 `OFFSET` 或临时排序；
- 12 轮未复用浏览器缓存的本地 HTTP 探针中，首屏中位数约 9.9ms、搜索约 8.9ms、标签过滤约 8.2ms。它只证明本地查询复杂度和实现路径，不代表生产网络延迟；
- FTS/标签 trigger 的独立探针证明：update 后旧搜索词和旧标签均为 0，新搜索词和新标签均为 1；delete 后两类派生行均为 0；
- JSON 响应验证 `ETag / 304` 与 Edge Cache 命中；图片和 bundle 验证内容哈希 URL、`immutable`、`HEAD`、`Range 206` 和条件请求。

### 14.2 NextClaw 本机与公开站

- 本机市场改为按页消费 v2：首批 24 条、服务端搜索/分类、加载更多去重，查询切换不会拼接旧页；
- 公开站的首页、目录与发布者页使用同一 v2 reader；搜索输入即时显示，但 Registry 请求延迟 250ms 合并，翻页 cursor 写入 URL，可通过浏览器前进/后退恢复；
- 安装、更新、版本切换和卸载共用持久化 operation owner；启动请求立即返回，市场可继续滚动或关闭，应用库读取同一进度；
- 进程恢复时仍处于活动态的 operation 被标记为 `interrupted`；内置应用卸载意图持久化，重建 kernel 后不会自动复活；
- 真实本机 `http://localhost:5174` 已复验：应用市场可打开、目录可加载、三类一级 tab 宽度稳定、弹窗无横向溢出、可见封面自然尺寸正确、版本切换和卸载入口存在；
- Worker、kernel、app-runtime、server、client SDK、UI 与公开站的定向测试和 TypeScript 检查通过；Worker/UI/公开站定向 lint 与公开站 production build 通过。kernel 全量 lint 仅报告本轮范围外既有测试文件的 4 个 warning，没有新增 warning。

## 15. 兼容边界与发布顺序

本地完成不等于生产已经启用。2026-08-13 当前生产 `apps-registry.nextclaw.io` 的 v2 路由仍返回 404，v1 正常；因此客户端暂时只在 v2 明确返回 `404 / 405 / 501` 时回退 v1。网络失败、500 或非法响应不会回退，避免用过期目录掩盖真实服务故障。兼容模式最多读取旧接口允许的 100 条，只用于跨版本过渡，不是规模化主链。

本次开发中曾出现新版前端先热更新、生产 Registry 尚无 v2，导致用户看到“应用市场暂时不可用”的回归。后续发布必须严格按以下顺序闭合：

1. 对远端 D1 执行 `0012` migration，并核对 FTS/标签 backfill 行数；
2. 部署 Worker，直接探测 v2 首屏、搜索、cursor、详情、资产、bundle 与 v1 兼容接口；
3. 确认生产 v2 可用后，才发布 `apps.nextclaw.io` 与 NextClaw 客户端；
4. 观察受支持客户端的 v2 命中率和错误率；至少经过一个稳定发布周期后，再移除临时 v1 fallback；
5. 启用 D1 Read Replication 后复验公开 reader 的 Session 路径与生产 P95。

远端 migration、Worker/网站部署和客户端发布会改变外部状态，当前未获得明确授权，因此没有执行。发布前不得把本地 10 万条验证描述成线上已经完成扩容。
