# v0.22.13 国内文档镜像路由

## 迭代完成说明

本次完成了 NextClaw 国内文档访问链路的设计、产品内路由改造和线上镜像部署。

完成内容：

- 新增设计文档 `docs/designs/2026-07-07-domestic-docs-mirror-routing.design.md`，明确 `docs.nextclaw.io` 作为全球默认文档站、`docs.nextclaw.net` 作为国内镜像站。
- 在阿里云云解析为 `nextclaw.net` 新增 `docs` A 记录，指向备案 ECS `8.154.43.167`。
- 在 ECS 上部署 `apps/docs/.vitepress/dist` 到 `/var/www/docs.nextclaw.net`，并通过 Nginx 提供静态站点。
- 为 `docs.nextclaw.net` 申请并启用 Let's Encrypt HTTPS 证书，certbot 自动续期已配置。
- 将国内镜像服务器初始化、日常部署和线上验收脚本沉淀到仓库，避免服务器状态只依赖手工操作记录。
- 在 DocBrowser URL owner 中新增文档域名选择逻辑：
  - `VITE_NEXTCLAW_DOCS_BASE_URL` 可强制指定文档站。
  - 中文语言或 `Asia/Shanghai` 时区默认使用 `https://docs.nextclaw.net`。
  - 其他环境继续使用 `https://docs.nextclaw.io`。
- 设置页模型选择帮助链接改为复用统一文档 URL owner。
- 新增 `deploy:docs:global`、`deploy:docs:cn`、`deploy:docs:all`，其中国内部署脚本使用 tar + scp 适配当前 ECS。
- 新增 `deploy:docs:cn:bootstrap`、`deploy:docs:cn:verify`、`deploy:docs:cn:full`，分别覆盖首次装机/重建、线上验收和完整国内发布闭环。

根因与确认：

- 原问题不是文档内容缺失，而是国内用户访问 `docs.nextclaw.io` 时经过海外/Cloudflare 链路，TLS 和首包耗时明显偏高。
- 通过 `curl` 对比确认：当前环境下 `docs.nextclaw.net` 总耗时约 0.09s，`docs.nextclaw.io` 约 1.17s 到 1.85s。
- 修复目标是建立国内可达的镜像链路，并让产品内入口自动选择该链路，而不是在每次打开文档前做阻塞式测速或 IP 探测。

## 测试/验证/验收方式

已执行：

```bash
pnpm -C packages/nextclaw-ui exec vitest run src/shared/components/doc-browser/__tests__/doc-browser-url.utils.test.ts
pnpm -C packages/nextclaw-ui tsc
pnpm -C packages/nextclaw-ui exec eslint src/shared/components/doc-browser/utils/doc-browser-url.utils.ts src/shared/components/doc-browser/doc-browser-context.tsx src/shared/components/doc-browser/doc-browser.tsx src/features/settings/pages/model-config-page.tsx src/shared/components/doc-browser/__tests__/doc-browser-url.utils.test.ts
pnpm --filter @nextclaw/docs build
node --check scripts/deploy/nextclaw-net-docs-mirror/docs-mirror-config.mjs
node --check scripts/deploy/nextclaw-net-docs-mirror/docs-mirror-runner.mjs
node --check scripts/deploy/nextclaw-net-docs-mirror/bootstrap-ecs-docs-mirror.mjs
node --check scripts/deploy/nextclaw-net-docs-mirror/deploy-docs-to-ecs.mjs
node --check scripts/deploy/nextclaw-net-docs-mirror/verify-docs-mirror.mjs
pnpm deploy:docs:cn:verify
pnpm lint:new-code:governance
pnpm check:governance-backlog-ratchet
node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs
```

线上验证：

```bash
curl -I https://docs.nextclaw.net/health
curl -I https://docs.nextclaw.net/zh/guide/getting-started
curl -sS -L https://docs.nextclaw.net/zh/guide/getting-started | rg "快速开始|NextClaw 是什么|安装方式"
```

结果：

- URL 策略单元测试 7 个用例全部通过。
- `@nextclaw/ui` TypeScript 检查通过。
- 相关文件 ESLint 通过。
- docs build 通过。
- 国内镜像脚本语法检查通过。
- `pnpm deploy:docs:cn:verify` 通过，当前环境多次观测到 `docs.nextclaw.net` 中文页面为几十毫秒量级，`docs.nextclaw.io` 参考页面约 0.8s 到 1.0s。
- `https://docs.nextclaw.net/health` 返回 200。
- `https://docs.nextclaw.net/zh/guide/getting-started` 返回 200，并命中真正的“快速开始”页面。
- 治理检查通过。
- 可维护性 guard 通过，报告的 warning 来自工作区既有 landing/docs 脚本 WIP 和 DocBrowser 文件接近预算，不阻塞本次提交。

## 发布/部署方式

本次已经完成线上部署：

- DNS：`docs.nextclaw.net A 8.154.43.167`
- HTTP：Nginx 静态站点
- HTTPS：certbot + Let's Encrypt
- 静态产物：`apps/docs/.vitepress/dist`

后续发布命令：

```bash
pnpm deploy:docs:cn:bootstrap
pnpm deploy:docs:cn
pnpm deploy:docs:cn:verify
pnpm deploy:docs:cn:full
pnpm deploy:docs:global
pnpm deploy:docs:all
```

命令分工：

- `deploy:docs:cn:bootstrap`：首次装机或重建 ECS，安装/启用 Nginx 和 certbot，缺证书时申请 HTTPS。
- `deploy:docs:cn`：日常构建并发布静态产物。
- `deploy:docs:cn:verify`：只读验收线上 DNS、健康检查和真实中文页面。
- `deploy:docs:cn:full`：国内链路完整闭环。

国内部署脚本默认不会覆盖远端已有 Nginx 配置，避免覆盖 certbot 写入的 HTTPS 配置。如需强制重装 HTTP 模板，可以使用 `NEXTCLAW_DOCS_ECS_FORCE_NGINX_CONFIG=1 pnpm deploy:docs:cn`，但正常日常发布不应使用该开关。

## 用户/产品视角的验收步骤

1. 中文用户或中国大陆时区用户在 NextClaw 产品内打开文档入口。
2. 文档入口应进入 `https://docs.nextclaw.net/zh/...`。
3. 页面应正常展示中文文档内容，而不是跳转页或 Nginx 默认页。
4. 海外英文环境仍应默认进入 `https://docs.nextclaw.io/en/...`。
5. 若国内镜像异常，发布环境可设置 `VITE_NEXTCLAW_DOCS_BASE_URL=https://docs.nextclaw.io` 强制回退全球站。

## 可维护性总结汇总

本次遵守单一 owner 原则，将文档 URL 决策集中在 `doc-browser-url.utils.ts`，没有把国内域名判断散落到页面、组件或设置页。

维护性取舍：

- 没有引入阻塞式 IP 探测或测速，避免每次打开文档都增加失败点和延迟。
- 没有做第二套文档源，继续复用 `apps/docs` 单一内容源。
- 新增部署脚本独立在 `scripts/deploy/nextclaw-net-docs-mirror`，不污染 docs 或 UI 运行时代码。
- 服务器侧操作被拆成 config、runner、bootstrap、deploy、verify 五个职责，避免单个脚本继续膨胀。
- `post-edit-maintainability-guard` 已执行；相关 governance 检查通过。
- `DocBrowser` 文件接近预算但本次只增加 1 行净变化，核心复杂度收敛在 URL utility。

## NPM 包发布记录

需要进入后续统一 NPM 发布：

- 包：`@nextclaw/ui`
- 原因：产品内文档 URL 默认行为发生用户可见变化，中文/大陆环境会自动走国内文档镜像。
- 当前状态：已添加 `.changeset/quiet-docs-mirror-routing.md`，标记 patch。
- 发布状态：待统一发布。
