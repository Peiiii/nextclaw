# NextClaw 国内文档镜像与产品内路由设计方案

## 背景

NextClaw 当前公开文档站是：

```text
https://docs.nextclaw.io
```

它部署在 Cloudflare Pages 上，对海外用户是合理选择，但对中国大陆用户存在链路不稳定和加载偏慢的问题。用户真正要解决的不是“多一个域名”，而是让国内用户在 NextClaw 产品里打开文档时，默认走中国大陆可达、备案合规、可验证、可回退的访问链路。

`nextclaw.net` 已完成备案，已有备案 ECS `8.154.43.167`。这给文档站提供了一个低风险切入点：先把同一份 `apps/docs` 构建产物镜像到国内服务器，再让产品内文档入口按本地信号选择文档域名。

## 目标

- `docs.nextclaw.io` 继续作为全球默认文档站和官方事实源。
- `docs.nextclaw.net` 作为国内文档镜像，部署同一份 `apps/docs` 静态产物。
- NextClaw 产品内打开文档时，对中文或中国大陆时区用户默认使用 `docs.nextclaw.net`。
- 不做每次打开前的网络探测、IP 查询或阻塞式测速，避免为了“智能”牺牲打开速度。
- 保留明确回退能力：非国内用户继续走 `docs.nextclaw.io`；发布环境可通过 env 强制指定文档域名。
- 代码 owner 清晰，文档域名选择只收敛在 DocBrowser URL owner，不散落到页面组件。

## 非目标

- 不把 `nextclaw.net` 根域改成产品官网。本次只新增文档子域。
- 不引入第二套文档内容源。文档内容仍然只从 `apps/docs` 构建。
- 不在客户端做实时 IP 地理位置判断。IP 查询慢、不稳定，还会引入隐私和第三方依赖。
- 不把国内文档镜像和技能市场镜像混成一个服务。二者共享域名体系，但部署、缓存和健康检查独立。

## 当前依据

仓库现状：

- 文档源码位于 `apps/docs`。
- 现有全球发布脚本是 `deploy:docs`，构建 `apps/docs/.vitepress/dist` 后部署到 Cloudflare Pages。
- 产品内文档浏览器 URL 逻辑位于 `packages/nextclaw-ui/src/shared/components/doc-browser/utils/doc-browser-url.utils.ts`。
- 设置页等外链入口已经通过 DocBrowser context 复用文档 URL owner。
- `docs/workflows/docs-single-source.md` 已规定公开文档页面来自 `apps/docs/**`，内部工程文档来自 `docs/**`。

备案与域名判断：

- 主域名已备案时，子域名通常不需要单独新增备案；但子域名实际接入、解析和展示内容仍要与接入商和备案主体口径保持一致。
- 本次子域名建议为 `docs.nextclaw.net`，避免占用根域和 `api.nextclaw.net`。

## 架构方案

```text
apps/docs
  |
  | pnpm --filter @nextclaw/docs build
  v
apps/docs/.vitepress/dist
  |
  +--> Cloudflare Pages
  |      https://docs.nextclaw.io
  |
  +--> Aliyun ECS / Nginx
         https://docs.nextclaw.net

NextClaw product
  |
  +--> explicit env override: VITE_NEXTCLAW_DOCS_BASE_URL
  +--> zh language or Asia/Shanghai timezone: https://docs.nextclaw.net
  +--> default: https://docs.nextclaw.io
```

核心思想是“一份内容源，两条发布链路，一个客户端 URL owner”：

- 内容源单一，避免国内文档和海外文档漂移。
- 发布链路双活，全球和国内分别服务各自网络环境。
- 客户端只决定 URL，不复制文档逻辑、不探测网络、不耦合部署细节。

## 域名与 DNS

推荐域名：

```text
docs.nextclaw.net
```

DNS 记录：

```text
docs.nextclaw.net  A  8.154.43.167
```

后续如果迁移到阿里云 OSS + CDN，可以把 `docs.nextclaw.net` 从 A 记录切到 CDN CNAME，但产品内代码不需要改，因为它只依赖稳定域名。

## 国内服务器部署

ECS 上使用 Nginx 承载静态文件：

```text
/var/www/docs.nextclaw.net
```

Nginx 行为：

- `server_name docs.nextclaw.net`
- 静态文件直接返回。
- VitePress 路由使用 `try_files $uri $uri.html $uri/ /index.html` 兜底，确保无扩展路径能命中生成的 `.html` 页面。
- `/health` 返回轻量 JSON，便于部署后 smoke。
- 资源文件设置较长缓存，HTML 走短缓存，兼顾发布更新和加载速度。

发布命令：

```text
pnpm deploy:docs:cn
```

部署脚本默认不会覆盖远端已有 Nginx 配置，避免 certbot 写入的 HTTPS 配置在后续静态资源发布时被冲掉。首次安装或明确要重装 HTTP 模板时，才使用：

```text
NEXTCLAW_DOCS_ECS_FORCE_NGINX_CONFIG=1 pnpm deploy:docs:cn
```

完整双链路发布命令：

```text
pnpm deploy:docs:all
```

## 产品内路由策略

文档 URL 选择顺序：

1. 若 `VITE_NEXTCLAW_DOCS_BASE_URL` 存在且合法，强制使用该域名。
2. 若用户语言为中文，使用 `VITE_NEXTCLAW_DOCS_CN_BASE_URL` 或默认 `https://docs.nextclaw.net`。
3. 若浏览器时区为 `Asia/Shanghai`，使用国内镜像。
4. 其他情况使用 `https://docs.nextclaw.io`。

这个策略是有意保守的：

- 中文用户打开文档不需要先等待测速。
- 海外用户不会被错误导到国内链路。
- CI、预览环境和紧急回退可以通过 env 直接指定文档站。
- 未来要做 UI 配置时，可以在这个 URL owner 上方加 `Auto / Global / Mainland China`，不需要改每个入口。

## 回退策略

短期回退：

- 发布环境设置 `VITE_NEXTCLAW_DOCS_BASE_URL=https://docs.nextclaw.io`，强制所有用户回到全球站。
- 或者将 `VITE_NEXTCLAW_DOCS_CN_BASE_URL` 指到可用的临时镜像。

中期回退：

- 若 `docs.nextclaw.net` 故障，DNS 可临时切回可用静态源。
- 客户端不做阻塞探测；真实加载失败交给 iframe/browser 原生错误面板，避免每次打开都拖慢。

长期增强：

- 在设置页加入文档源选项：`自动`、`全球站`、`中国大陆镜像`。
- 在 DocBrowser iframe 加载失败后提供一次性“打开全球站”按钮，但不在成功路径上增加探测。

## 实施清单

- [x] 增加 `docs.nextclaw.net` 文档域名识别。
- [x] 增加 `getDocsBaseUrl()` 和 `getDocsUrl()`，由 DocBrowser URL owner 统一决定文档域名。
- [x] 设置页文档链接改为走文档 URL owner。
- [x] 增加 `VITE_NEXTCLAW_DOCS_BASE_URL` 和 `VITE_NEXTCLAW_DOCS_CN_BASE_URL` 类型声明。
- [x] 增加文档 URL 策略单元测试。
- [x] 增加 ECS Nginx 静态镜像配置。
- [x] 增加国内文档镜像部署脚本与 npm script。
- [x] 在阿里云 DNS 添加 `docs.nextclaw.net -> 8.154.43.167`。
- [x] 首次部署后申请 HTTPS 证书。
- [x] 线上 smoke：`https://docs.nextclaw.net/zh/guide/getting-started`。

## 验证标准

代码验证：

- URL 单元测试覆盖英文默认、中文默认、env override、官方 URL 重写和国内域名识别。
- `@nextclaw/ui` TypeScript 检查通过。
- 相关文件 ESLint 通过。
- docs 构建通过。

部署验证：

- DNS 公网解析到 `8.154.43.167`。
- Nginx 配置 `nginx -t` 通过。
- `/health` 返回 200。
- `/zh/guide/getting-started` 返回 200。
- 页面 HTML 中能看到 VitePress 资源引用。

效果验证：

- 中文环境 `getDefaultDocsUrl()` 返回 `https://docs.nextclaw.net/zh/guide/getting-started`。
- 英文环境 `getDefaultDocsUrl()` 返回 `https://docs.nextclaw.io/en/guide/getting-started`。
- 强制 env override 时，两种语言都使用指定文档域名。

## 取舍说明

本方案没有选择“打开前先测速再决定域名”，因为这会把文档打开路径变成网络探测路径：慢网络下更慢，失败时更难判断，且每次打开都消耗额外请求。更好的方式是让默认选择足够接近用户环境，再保留明确兜底。

本方案也没有把国内镜像做成第二文档源，因为文档漂移会让用户看到不一致内容，长期维护成本高于收益。同一份 `apps/docs` 构建产物同时发布到两个站点，是当前最稳妥、最容易验证的路径。
