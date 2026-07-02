# nextclaw.net 国内技能市场完整镜像设计方案

## 背景

国内用户加载 NextClaw 技能市场时，核心问题不是缺一个域名，而是 `marketplace-api.nextclaw.io` 依赖海外链路和 Cloudflare 侧资源，导致技能市场列表、场景、详情和文件下载在中国大陆网络下不稳定。

`nextclaw.net` 已完成 ICP 备案，备案 ECS 为 `8.154.43.167`。这个域名和这台 ECS 的真正价值，是给 NextClaw 建一条中国大陆可达、可加速、可验证、可演进的 marketplace 国内链路。

一句话目标：

> 让国内用户打开 NextClaw 技能市场时，不再依赖海外实时链路；官方源仍归 `nextclaw.io`，国内访问走 `nextclaw.net` 的只读镜像。

## 用户真实目标

用户要的不是“备案页能过审”，也不是“域名能打开一个网页”，而是：

- 国内用户能稳定加载技能市场。
- 技能列表、推荐场景、详情、安装文件都能从国内链路返回。
- NextClaw 产品内能自动或显式切到国内源。
- `nextclaw.io` 继续作为全球官方事实源，不因为国内镜像引入第二套发布事实。
- 当前个人备案不能让站点表现得像企业产品官网或下载服务站，因此合规页面和产品镜像入口要分层处理。

## 现状依据

### 官方 Marketplace

当前官方 marketplace Worker 位于：

```text
https://marketplace-api.nextclaw.io
```

仓库证据：

- `workers/marketplace-api/wrangler.toml` 绑定 `marketplace-api.nextclaw.io`。
- `workers/marketplace-api/src/main.ts` 的 `/health` 返回 `storage: "d1+r2"`。
- 技能元数据来自 Cloudflare D1，技能文件来自 Cloudflare R2。
- `docs/workflows/marketplace-worker-deploy.md` 已把 D1/R2 Worker 作为官方发布链路。

当前读接口包括：

```text
GET /health
GET /api/v1/skills/items
GET /api/v1/skills/scenes
GET /api/v1/skills/items/:slug
GET /api/v1/skills/items/:slug/files
GET /api/v1/skills/items/:slug/files/blob?path=<path>
GET /api/v1/skills/items/:slug/content
GET /api/v1/skills/recommendations
GET /api/v1/plugins/items
GET /api/v1/mcp/items
```

写接口包括 publish/admin/user manage，国内镜像不得开放这些写接口。

### 客户端切换入口

仓库已有显式 marketplace base 配置能力：

- CLI `nextclaw skills install/search/info/update` 支持 `--api-base`。
- `packages/nextclaw-server/src/features/marketplace/utils/marketplace-catalog.utils.ts` 会读取 `options.marketplace.apiBaseUrl`，否则默认 `https://marketplace-api.nextclaw.io`。
- 默认常量在 `packages/nextclaw-server/src/features/marketplace/configs/marketplace.constants.config.ts`。

这说明国内镜像不需要改写官方 API 合同；只要提供兼容读接口，并让产品配置到国内源即可。

### 当前域名与服务器

真实公网 DNS 需要用 DoH 绕过本机代理 Fake-IP 后判断。本机普通 `dig` 会受到 `127.0.0.1:7890` 代理影响，返回的 `198.18.0.x` 不能作为公网证据。

截至 2026-07-02 21:51，DoH 结果：

```text
nextclaw.net     -> 8.154.43.167
www.nextclaw.net -> 8.154.43.167
api.nextclaw.net -> 8.154.43.167
dl.nextclaw.net  -> NXDOMAIN
market.nextclaw.net -> NXDOMAIN
```

备案 ECS `8.154.43.167` 已验证：

- `https://nextclaw.net/` 和 `https://www.nextclaw.net/` 返回 `微光札记`。
- `https://api.nextclaw.net/health` 返回国内只读镜像健康状态。
- 页面未暴露 `NextClaw`、`技能市场`、`下载资源`、`国内访问入口`。

## 核心判断

推荐做一套完整的“官方源 + 国内只读镜像 + 客户端源选择”架构。

不要做：

- 不要把 `nextclaw.net` CNAME 到 `nextclaw.io`。这不会解决国内链路问题。
- 不要把国内镜像做成第二个 publish/admin 后台。它会制造双事实源。
- 不要只做静态首页或只做 CDN。技能市场可用性取决于 API、详情、文件下载和客户端配置全链路。
- 不要在个人备案口径下把根域首页做成 NextClaw 官网、技能市场或下载站。

要做：

- `marketplace-api.nextclaw.io` 保持唯一官方事实源。
- 国内侧定时生成 snapshot。
- `api.nextclaw.net` 提供只读 API。
- `dl.nextclaw.net` 提供静态文件和 snapshot 下载。
- `market.nextclaw.net` 可作为国内技能市场 UI，但应在备案口径匹配后公开。
- NextClaw 客户端支持国内源配置、自动探测和失败切换。

## 终态架构

```text
Cloudflare Worker: marketplace-api.nextclaw.io
  D1: marketplace metadata
  R2: marketplace files
        |
        | scheduled mirror sync
        v
Domestic snapshot generator
        |
        +--> Aliyun OSS / ECS local cache
              |
              +--> dl.nextclaw.net     static snapshot and files
              +--> api.nextclaw.net    read-only compatible API
              +--> market.nextclaw.net optional domestic marketplace UI

NextClaw client
  default read source order: https://api.nextclaw.net -> https://marketplace-api.nextclaw.io
  explicit apiBaseUrl:       use the configured source only
```

## 域名设计

### `nextclaw.net`

用途：备案根域和保守入口。

当前个人备案阶段，根域继续展示个人技术记录站 `微光札记`，底部悬挂 ICP 备案号并链接工信部。

### `www.nextclaw.net`

用途：与根域一致。

`www` 应指向同一 ECS，避免审核或用户访问时看到不同内容。

### `api.nextclaw.net`

用途：国内只读 marketplace API。

必须兼容官方读接口。所有写接口返回明确错误：

```json
{
  "ok": false,
  "error": {
    "code": "MIRROR_READ_ONLY",
    "message": "domestic marketplace mirror is read-only"
  }
}
```

### `dl.nextclaw.net`

用途：snapshot、技能文件和后续 release 资源下载。

文件路径必须带 hash 或版本号，便于 CDN 长缓存。

### `market.nextclaw.net`

用途：国内技能市场 UI。

当前个人备案阶段不建议公开产品化 UI。若要完整公开，需要备案口径升级到能承载 NextClaw 产品/软件服务/下载/生态市场的主体和网站内容。

## Snapshot 合同

国内镜像以 snapshot 为事实输入，不直接读 Cloudflare D1/R2。

推荐目录：

```text
snapshot/
  manifest.json
  skills/
    items.page-1.json
    items.page-2.json
    scenes.json
    recommendations.default.json
    items/
      <slug>.json
    files/
      <slug>.json
      <slug>/
        <sha256>/
          SKILL.md
          ...
  plugins/
    items.page-1.json
  mcp/
    items.page-1.json
```

`manifest.json`：

```json
{
  "schemaVersion": 1,
  "source": "https://marketplace-api.nextclaw.io",
  "generatedAt": "2026-07-02T12:00:00.000Z",
  "skills": {
    "total": 36,
    "pages": 4,
    "fileCount": 120
  }
}
```

## 镜像同步策略

同步任务每 5 到 15 分钟执行一次：

1. 请求官方 `/health`。
2. 拉取 `/api/v1/skills/items?page=n&pageSize=100` 直到结束。
3. 拉取 `/api/v1/skills/scenes` 和 `/api/v1/skills/recommendations`。
4. 对每个 skill 拉取详情、files 列表、content。
5. 对 files/blob 下载文件并按 sha256 写入对象存储或本地 cache。
6. 生成新的 snapshot 到临时目录。
7. 校验 snapshot 完整性。
8. 原子切换 `current -> snapshot/<generatedAt>`。

同步失败时保留上一版 snapshot，不让国内 API 因官方源短暂不可达而整体失败。

## 国内 API 设计

第一版可以部署在备案 ECS 上，由 Nginx 反代到本机只读服务：

```text
Nginx :80/:443
  server_name api.nextclaw.net
    -> 127.0.0.1:8787
```

服务只读，读取本地 snapshot：

```text
/opt/nextclaw-marketplace-mirror/current
```

必须支持：

```text
GET /health
GET /api/v1/skills/items
GET /api/v1/skills/scenes
GET /api/v1/skills/items/:slug
GET /api/v1/skills/items/:slug/files
GET /api/v1/skills/items/:slug/files/blob?path=<path>
GET /api/v1/skills/items/:slug/content
GET /api/v1/skills/recommendations
```

后续可以迁移到阿里云函数计算 + OSS + CDN，但第一版用 ECS 更快闭环，原因是：

- 服务器已经可用。
- Nginx 已部署。
- 可以直接做 systemd 服务和本机 cache。
- DNS 切换后马上可验证。

本次已落地的第一版使用仓库内运维资产：

```text
scripts/deploy/nextclaw-net-marketplace-mirror/
  marketplace-mirror-server.py
  nextclaw-marketplace-mirror-api.service
  nextclaw-marketplace-mirror-sync.service
  nextclaw-marketplace-mirror-sync.timer
  api-nextclaw-net.nginx.conf
```

ECS 部署路径：

```text
/opt/nextclaw-marketplace-mirror/marketplace-mirror-server.py
/etc/systemd/system/nextclaw-marketplace-mirror-api.service
/etc/systemd/system/nextclaw-marketplace-mirror-sync.service
/etc/systemd/system/nextclaw-marketplace-mirror-sync.timer
/etc/nginx/conf.d/api-nextclaw-net.conf
```

运行方式：

- API 常驻服务：`nextclaw-marketplace-mirror-api.service`
- 定时同步：`nextclaw-marketplace-mirror-sync.timer`
- 同步周期：每 10 分钟
- 监听：`127.0.0.1:8787`
- Nginx 域名：`api.nextclaw.net`
- 数据目录：`/opt/nextclaw-marketplace-mirror`

同步器会预热技能列表、场景、推荐、详情、content、files 列表和 files/blob 文件。单个技能的官方源 404 会进入 manifest 的 `failed` 列表，不会伪装成功；核心列表或源站不可达则会让同步失败，避免生成错误 snapshot。

## 客户端接入与回退策略

### 核心策略

客户端不做阻塞式 `/health` 预探测。

原因是技能市场首屏最怕额外等待。预探测即使成功，也会在真实列表请求前多一次 RTT；预探测失败时还会把用户体验变成“先等 health 超时，再等真实请求”。更好的策略是：

1. 默认直接请求国内镜像 `https://api.nextclaw.net`。
2. 只有真实请求出现网络失败、超时、`408`、`429`、`5xx` 或无效响应时，才回退到官方源 `https://marketplace-api.nextclaw.io`。
3. `404`、`400` 等业务错误不自动切源，避免把真实“不存在/参数错”伪装成源站问题。
4. 显式配置 `apiBaseUrl` 时只使用用户指定源，不再暗中切换。
5. 写操作、发布操作和 admin 操作仍使用官方源默认值，不走只读镜像。

国内源使用短 deadline：

```text
api.nextclaw.net: 2s timeout, 2 attempts
official/custom: 12s timeout, 5 attempts
```

这个取舍的原则是：国内镜像正常时应该几十毫秒返回；如果 2 秒还没有结果，对用户来说它已经不是“加速源”，应立即让官方源兜底。官方源本来跨境较慢，所以保留更长 timeout。

### CLI

已有显式入口：

```bash
nextclaw marketplace skills search --api-base https://api.nextclaw.net
nextclaw skills install <slug> --api-base https://api.nextclaw.net
```

本次改造后，无显式 `--api-base` 的读路径默认使用：

```text
https://api.nextclaw.net -> https://marketplace-api.nextclaw.io
```

覆盖路径：

```text
nextclaw marketplace skills search
nextclaw marketplace skills info
nextclaw marketplace skills recommend
nextclaw skills install
nextclaw marketplace skills update
```

`nextclaw skills publish` / `nextclaw skills update <dir>` 这类发布写路径继续默认官方源。

### UI / Server

`nextclaw-server` 的 marketplace routes 是 UI 技能市场的统一代理 owner。本次改造后，server 默认 source order 为：

```text
https://api.nextclaw.net -> https://marketplace-api.nextclaw.io
```

覆盖路径：

```text
GET /api/marketplace/skills/scenes
GET /api/marketplace/skills/items
GET /api/marketplace/skills/items/:slug
GET /api/marketplace/skills/items/:slug/content
GET /api/marketplace/skills/recommendations
GET /api/marketplace/mcp/items
GET /api/marketplace/mcp/items/:slug
GET /api/marketplace/mcp/items/:slug/content
GET /api/marketplace/mcp/recommendations
```

本次暂不增加设置界面。原因是当前目标是让国内用户默认受益，而不是把网络链路选择推给用户；显式 `apiBaseUrl` 已可用于开发、调试和特殊环境。

## DNS 与 HTTPS

### 当前必须改的 DNS

在阿里云云解析中：

| 主机记录 | 类型 | 记录值 |
| --- | --- | --- |
| `@` | A | `8.154.43.167` |
| `www` | A | `8.154.43.167` |

完整上线国内镜像时再增加：

| 主机记录 | 类型 | 推荐记录值 |
| --- | --- | --- |
| `api` | A | `8.154.43.167` |
| `dl` | CNAME 或 A | OSS/CDN 域名或 `8.154.43.167` |
| `market` | CNAME 或 A | OSS/CDN 域名或 `8.154.43.167` |

当前 DoH 显示 `@`、`www`、`api` 均已指向 `8.154.43.167`；`dl` / `market` 仍未开通，避免在个人备案阶段扩大公开产品入口。

### HTTPS

DNS 指向 ECS 后，用 Certbot 申请：

```bash
certbot --nginx -d nextclaw.net -d www.nextclaw.net -d api.nextclaw.net
```

如果后续 `dl` / `market` 也走 ECS，再追加证书域名；如果走阿里云 CDN，则证书绑定在 CDN。

## 备案与合规边界

当前备案性质为个人。个人备案阶段可以承载保守的个人技术记录站，但不适合把根域直接做成 NextClaw 产品官网、下载站、技能市场或开放 API 服务宣传入口。

因此完整方案有两个层次：

- 技术完整：镜像 API、snapshot、客户端切源、DNS、HTTPS 都要闭合。
- 合规完整：产品化公开入口需要备案主体和网站内容与 NextClaw 产品服务相匹配。

如果坚持在当前个人备案下立即公开产品化 marketplace，风险是审核人员认为网站内容与备案信息不一致。

推荐取舍：

- `nextclaw.net` / `www.nextclaw.net` 保持个人技术记录站。
- `api.nextclaw.net` 先作为只读 API 技术服务入口，不在根域页面显著宣传。
- `market.nextclaw.net` 等产品 UI 等备案口径升级后公开。
- 真正面对用户的产品文案仍以 `nextclaw.io` 为官方入口，国内客户端只把 `api.nextclaw.net` 当加速源。

## 一次性完成清单

这不是阶段性停止清单，而是完整交付必须同时满足的清单：

1. 文档：本设计文档落地，并明确终态目标。
2. DNS：`@`、`www`、`api` 指向国内承载层。
3. 根域：`nextclaw.net` / `www.nextclaw.net` 返回备案一致页面，并悬挂 ICP 备案号。
4. 镜像同步：ECS 或函数计算能生成 marketplace snapshot。
5. API：`api.nextclaw.net` 返回兼容官方读接口。
6. 文件下载：`files/blob` 能从国内链路下载技能文件。
7. HTTPS：根域和 API 域名都有有效证书。
8. 客户端：CLI/UI 默认国内源直连，失败后官方源兜底，无阻塞预探测。
9. 验证：从非仓库环境验证列表、场景、详情、文件下载、客户端安装。
10. 安全：ECS SSH 改为 key 或强密码，安全组限制 22 端口。

截至 2026-07-02 21:51，技术链路已经推进到：

- ECS 镜像 API 已部署。
- 全量同步已在 ECS 上跑通。
- systemd API 服务已 active。
- systemd timer 已 active。
- Nginx 配置已通过 `nginx -t` 并 reload。
- 使用 `--resolve api.nextclaw.net:80:8.154.43.167` 模拟 DNS 后，`/health`、技能列表、技能详情、content、files/blob、只读写保护均已通过。
- 阿里云 DNS 已将 `@`、`www`、`api` 指向 `8.154.43.167`。
- HTTPS 证书已签发并部署到 `nextclaw.net`、`www.nextclaw.net`、`api.nextclaw.net`。
- certbot 自动续期 timer 已启用。
- 根站和笔记页已悬挂 `滇ICP备19003016号` 并链接工信部备案系统。

当前仍建议后续完成的事项：

- ECS SSH 切换到密钥登录或强密码，并收敛安全组 22 端口来源。
- 当 NextClaw 国内公开产品入口需要更强合规确定性时，再升级备案主体/网站内容口径后公开 `market.nextclaw.net`。

本次 DNS 自动化过程中的一段阻塞及解除：

- 本机没有 `aliyun` CLI 和 `~/.aliyun` 凭证。
- 后续改用 Chrome 插件通道成功接入用户当前 Chrome。
- 在阿里云 DNS 控制台完成 `@`、`www`、`api` 三条解析记录变更。
- DoH 验证三条记录均返回 `8.154.43.167`。

最终 DNS 记录：

| 主机记录 | 类型 | 记录值 | 目的 |
| --- | --- | --- | --- |
| `@` | A | `8.154.43.167` | 根域备案页 |
| `www` | A | `8.154.43.167` | www 备案页 |
| `api` | A | `8.154.43.167` | 国内技能市场只读 API |

## 本次执行状态

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| 终态设计文档 | 已完成 | 本文件已按“国内技能市场完整镜像”重写 |
| 官方源链路核实 | 已完成 | Worker 使用 D1 + R2，读接口已确认 |
| 客户端切源入口核实 | 已完成 | CLI 与 server 配置已有 api base 能力 |
| 备案 ECS 静态站 | 已完成 | `8.154.43.167` 返回 `微光札记` |
| 根域真实 DNS | 已完成 | DoH 显示 `nextclaw.net -> 8.154.43.167` |
| `api.nextclaw.net` DNS | 已完成 | DoH 显示 `api.nextclaw.net -> 8.154.43.167` |
| ICP 备案号悬挂 | 已完成 | 根站和笔记页悬挂 `滇ICP备19003016号` 并链接工信部 |
| HTTPS | 已完成 | Let's Encrypt 证书覆盖 `nextclaw.net`、`www.nextclaw.net`、`api.nextclaw.net` |
| 国内镜像服务部署 | 已完成 | ECS 已部署 systemd API 服务和 10 分钟同步 timer |
| ECS 全量同步 | 已完成 | 36 个技能、134 个文件已预热；5 个技能 content 在官方源返回 404 |
| 模拟 DNS 外部验收 | 已完成 | `--resolve api.nextclaw.net:80:8.154.43.167` 下 API、详情、文件、只读保护通过 |
| 定时同步验收 | 已完成 | timer 首次触发同步完成，下一次同步已排程 |
| 阿里云 DNS 自动修改 | 已完成 | 通过当前 Chrome 中的阿里云 DNS 控制台完成 |
| HTTPS 公网验收 | 已完成 | `https://api.nextclaw.net/health`、技能列表、文件 blob 均通过 |
| UI/server 默认读源改造 | 已完成 | 默认 `api.nextclaw.net -> marketplace-api.nextclaw.io`，失败才回退，无 `/health` 预探测 |
| CLI/安装读源改造 | 已完成 | 搜索、详情、推荐、安装、更新已安装技能默认国内源优先，发布写操作仍默认官方源 |

## 验收命令

DNS：

```bash
curl --noproxy '*' -sS 'https://dns.alidns.com/resolve?name=nextclaw.net&type=A'
curl --noproxy '*' -sS 'https://dns.alidns.com/resolve?name=www.nextclaw.net&type=A'
curl --noproxy '*' -sS 'https://dns.alidns.com/resolve?name=api.nextclaw.net&type=A'
```

根域：

```bash
curl --noproxy '*' -I https://nextclaw.net/
curl --noproxy '*' -sS https://nextclaw.net/ | rg '微光札记|ICP备|beian.miit.gov.cn'
```

镜像 API：

```bash
curl --noproxy '*' -sS https://api.nextclaw.net/health
curl --noproxy '*' -sS 'https://api.nextclaw.net/api/v1/skills/items?page=1&pageSize=5'
curl --noproxy '*' -sS https://api.nextclaw.net/api/v1/skills/scenes
curl --noproxy '*' -sS https://api.nextclaw.net/api/v1/skills/items/browser-control/files
```

DNS 生效前的模拟验收：

```bash
curl --noproxy '*' --resolve api.nextclaw.net:80:8.154.43.167 -sS http://api.nextclaw.net/health
curl --noproxy '*' --resolve api.nextclaw.net:80:8.154.43.167 -sS 'http://api.nextclaw.net/api/v1/skills/items?page=1&pageSize=2'
curl --noproxy '*' --resolve api.nextclaw.net:80:8.154.43.167 -sS http://api.nextclaw.net/api/v1/skills/items/browser-control
curl --noproxy '*' --resolve api.nextclaw.net:80:8.154.43.167 -sSI 'http://api.nextclaw.net/api/v1/skills/items/browser-control/files/blob?path=SKILL.md'
curl --noproxy '*' --resolve api.nextclaw.net:80:8.154.43.167 -X POST -sS http://api.nextclaw.net/api/v1/skills/items
```

客户端：

```bash
nextclaw marketplace skills search --json
nextclaw skills install browser-control --workdir /tmp/nextclaw-marketplace-smoke
```

## 非目标

- 不把国内镜像变成第二个 marketplace 发布后台。
- 不在个人备案根域公开包装成 NextClaw 企业官网。
- 不把设置界面作为第一版必需项；默认自动读源和显式 `apiBaseUrl` 已覆盖当前需求。

## 参考

- 阿里云备案后处理：<https://help.aliyun.com/zh/icp-filing/basic-icp-service/the-icp-record-post-processing-1>
- 阿里云 CDN 备案要求：<https://help.aliyun.com/zh/icp-filing/basic-icp-service/product-overview/use-alibaba-cloud-cdn>
- 阿里云修改解析记录：<https://help.aliyun.com/zh/dns/pubz-manage-resolution-records>
- Marketplace Worker 部署文档：`docs/workflows/marketplace-worker-deploy.md`
