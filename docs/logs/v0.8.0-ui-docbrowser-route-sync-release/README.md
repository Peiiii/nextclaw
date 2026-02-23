# v0.8.0-ui-docbrowser-route-sync-release

## 迭代完成说明（改了什么）

本次迭代聚焦 UI 文档浏览器体验优化：

1. DocBrowser 支持与文档 iframe 路由变化同步（解决地址栏状态不同步）。
2. Doc link 拦截器支持跳过显式外链（`data-doc-external`），避免误拦截“外部打开”。
3. URL 输入体验与文案优化，降低用户在内嵌文档中的跳转成本。
4. 文档站点补充路由变化上报脚本，确保 UI 与 docs 页协同。

## 测试 / 验证 / 验收方式

### 工程验证

- `pnpm release:publish`（内含 `build`、`lint`、`tsc` 全量校验）

### 冒烟验证

- 启动本地 UI：`NEXTCLAW_HOME=/tmp/... pnpm -C packages/nextclaw dev:build ui --port 18896`
- 访问首页：`curl -fsS http://127.0.0.1:18896/`
- 验收观察点：页面可正常返回 HTML，且无启动报错。

## 发布 / 部署方式

1. NPM 发布：`pnpm release:version && pnpm release:publish`
2. 文档部署：`pnpm deploy:docs`（Cloudflare Pages）

## 用户/产品视角验收步骤

1. 升级到最新版本并启动 UI。
2. 打开内置文档浏览器，进入 docs 站点后在站内跳转。
3. 观察地址栏会随路由变化更新。
4. 点击“外部打开”应使用外部方式打开，而不是被内嵌拦截。
5. 验收通过标准：文档浏览跳转流畅、状态一致、外链行为符合预期。

## 本次执行结果（2026-02-23）

- 已发布 NPM：`nextclaw@0.8.0`、`@nextclaw/ui@0.5.0`
- 已部署 Docs（Cloudflare Pages）：`https://e18b5498.nextclaw-docs.pages.dev`
