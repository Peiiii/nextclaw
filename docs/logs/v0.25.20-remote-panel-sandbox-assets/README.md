# v0.25.20 远程访问面板应用沙箱资源恢复

## 迭代完成说明

本次修复远程访问页面中面板小应用样式和脚本丢失的问题。真实浏览器证据显示，面板应用的 HTML 能在沙箱 iframe 中打开，但 `styles.css` 的 `CSSStyleSheet` 未挂载，标题保持浏览器默认的黑色 32px；同一内容页直接作为顶层页面打开时样式正常。直接访问签名 CSS URL 返回 `404 Remote access session not found.`，证明故障位于远程网关会话解析，而不是 CSS 构建或面板应用本身。

根因是 iframe 为保持隔离而没有 `allow-same-origin`，浏览器把其来源视为 opaque/null origin，解析 HTML 时加载的 `<link>` 与 `<script>` 不会携带 `SameSite=Lax` 的远程 HttpOnly 会话 Cookie。修复保留沙箱隔离，只在远程代理 Controller 中为明确的面板沙箱请求按当前 `r-<sessionId>` 主机恢复活动会话：签名面板资源与公开 SDK 只允许 `GET/HEAD`，运行时 API 还必须来自 null origin 并携带 `x-nextclaw-panel-bridge-session`，预检也必须声明该请求头。普通页面、普通 API、带无效 Cookie 的请求仍沿用原认证链路；后端继续校验会话状态、过期时间和分享授权，本地面板资源仍校验签名 token，运行时 API 仍校验面板 bridge token。

实现同时把重复的远程实例所有权校验、`Vary: Cookie` 构造和代理请求头过滤收敛到单一表达，避免修复变成平行认证路径或让 Controller 继续膨胀。没有添加 `allow-same-origin`、宽泛 CORS、Cookie 降级或无条件 host-session 回退。

## 测试/验证/验收方式

- `pnpm -C workers/nextclaw-provider-gateway-api tsc`：通过。
- `pnpm -C workers/nextclaw-provider-gateway-api lint`：通过，0 error / 0 warning。
- `pnpm -C workers/nextclaw-provider-gateway-api build`：通过。
- `node workers/nextclaw-provider-gateway-api/tests/remote-panel-app-session.test.mjs`：通过；覆盖签名资源、公开 SDK、null-origin bridge API、预检，以及普通 API、伪造 Origin、非 API 路径、缺 bridge header、非法 host 等拒绝场景。
- 新版 Cloudflare 配额合同的 14 项定向测试通过，确认本次部署源与线上 Durable Object schema 兼容。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet` 与 maintainability guard：通过；守卫 0 error / 1 warning，warning 是 `remote.controller.ts` 仍接近 600 行预算，但本次从 512 行降到 483 行。
- 线上真实浏览器验收直接使用用户当前 Chrome 配置和原远程访问 URL 完成。刷新后，外链 `styles.css` 已作为启用状态的 LINK 样式表进入 `document.styleSheets`，签名 `app.js` 已加载，ECharts 生成 2 个 canvas；标题计算样式为 `20px / 700 / rgb(228, 231, 255)`，页面背景为 `rgb(10, 14, 39)`，与修复前默认黑色 32px 标题形成明确对照。
- 页面 DOM 完整呈现深色主题、指标卡、时间范围与坐标轴控件、16 个标的、年度涨跌表和详情表。浏览器日志没有面板应用自身错误；现存错误均来自用户 Chrome 扩展尝试在 sandbox iframe 中访问 `localStorage`，不影响面板应用资源或交互。

## 发布/部署方式

本次仅涉及 `nextclaw-provider-gateway-api` Cloudflare Worker。数据库 schema、migration、NPM 包、Desktop 安装包和 NextClaw 宿主重启均不涉及。

首次部署误从早于 `8b1cfeb9a` 的隔离基线生成，旧配额代码无法读取线上 v2 Durable Object 状态，真实浏览器暴露 `REMOTE_QUOTA_GUARD_UNAVAILABLE`。发现后立即回滚到稳定版本 `14f4e3c0-62bd-42a6-8c80-2e71c1554088` 并确认配额调用恢复；最终部署改为基于包含正式配额统一提交的最新 `master` 构建，防止运行时 schema 回退。最终 Worker Version ID 为 `6fe6cc80-470d-4179-be39-a2e18aea7ffd`。

部署后本地远程连接器曾因一次 WebSocket 1006 非正常关闭进入退避等待；通过产品既有的 `/api/remote/service/restart` 仅重启远程连接器（未重启 NextClaw 宿主），状态恢复为 `connected` 后在同一 Chrome 标签页完成上述验收。

## 用户/产品视角的验收步骤

1. 保持原远程访问链接不变，在用户当前 Chrome 配置中刷新页面。
2. 打开“半导体 10 年”面板应用，确认深色主题、卡片、按钮、表格与图表样式恢复，不再显示浏览器默认大号黑字。
3. 确认面板应用脚本成功执行，图表节点已生成，时间范围与线性/对数控件可正常呈现。
4. 确认样式资源请求成功，普通无 Cookie API 仍不能借 host session 越过认证，远程配额守卫没有降级。

## 可维护性总结汇总

本次定向变更总代码 `+172/-95`、净增 77 行；排除测试后生产代码 `+93/-95`、净减 2 行。正向减债包括：Controller 从 512 行降到 483 行，合并重复实例鉴权，移除重复的响应头分支与代理头数组构造，并把无状态的沙箱请求判定放入独立 `utils` owner。守卫为 0 error / 1 warning；唯一 warning 是 Controller 仍接近 600 行预算，但本次净减 29 行，没有继续膨胀。没有新增兼容分支、隐式 fallback、假 service 或双认证 owner。

## NPM 包发布记录

- NPM 包：不涉及；改动只部署私有 Cloudflare Worker，因此不添加 changeset，也不执行 NPM publish。
- GitHub release / Desktop release：不涉及。
