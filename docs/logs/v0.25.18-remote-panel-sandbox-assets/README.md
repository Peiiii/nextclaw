# v0.25.18 远程访问面板应用沙箱资源恢复

## 迭代完成说明

本次修复远程访问页面中面板小应用样式和脚本丢失的问题。真实浏览器证据显示，面板应用的 HTML 能在沙箱 iframe 中打开，但 `styles.css` 的 `CSSStyleSheet` 未挂载，标题保持浏览器默认的黑色 32px；同一内容页直接作为顶层页面打开时样式正常。直接访问签名 CSS URL 返回 `404 Remote access session not found.`，证明故障位于远程网关会话解析，而不是 CSS 构建或面板应用本身。

根因是 iframe 为保持隔离而没有 `allow-same-origin`，浏览器把其来源视为 opaque/null origin，解析 HTML 时加载的 `<link>` 与 `<script>` 不会携带 `SameSite=Lax` 的远程 HttpOnly 会话 Cookie。修复保留沙箱隔离，只在远程代理 Controller 中为明确的面板沙箱请求按当前 `r-<sessionId>` 主机恢复活动会话：签名面板资源与公开 SDK 只允许 `GET/HEAD`，运行时 API 还必须来自 null origin 并携带 `x-nextclaw-panel-bridge-session`，预检也必须声明该请求头。普通页面、普通 API、带无效 Cookie 的请求仍沿用原认证链路；后端继续校验会话状态、过期时间和分享授权，本地面板资源仍校验签名 token，运行时 API 仍校验面板 bridge token。

实现同时把重复的远程实例所有权校验、`Vary: Cookie` 构造和代理请求头过滤收敛到单一表达，避免修复变成平行认证路径或让 Controller 继续膨胀。没有添加 `allow-same-origin`、宽泛 CORS、Cookie 降级或无条件 host-session 回退。

## 测试/验证/验收方式

- `pnpm -C workers/nextclaw-provider-gateway-api tsc`：通过。
- `pnpm -C workers/nextclaw-provider-gateway-api lint`：通过，0 error / 0 warning。
- `pnpm -C workers/nextclaw-provider-gateway-api build`：通过。
- `node workers/nextclaw-provider-gateway-api/tests/remote-panel-app-session.test.mjs`：通过；覆盖签名资源、公开 SDK、null-origin bridge API、预检，以及普通 API、伪造 Origin、非 API 路径、缺 bridge header、非法 host 等拒绝场景。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`：通过，0 error / 0 warning。
- 线上真实浏览器验收将在网关 Worker 部署后，直接刷新用户已经打开的远程访问标签页完成；结果在部署后回填本记录。

## 发布/部署方式

本次仅涉及 `nextclaw-provider-gateway-api` Cloudflare Worker。数据库 schema、migration、NPM 包、Desktop 安装包和 NextClaw 宿主重启均不涉及。部署命令为 `pnpm -C workers/nextclaw-provider-gateway-api deploy`，部署结果与线上浏览器冒烟在执行后回填。

## 用户/产品视角的验收步骤

1. 保持原远程访问链接不变，刷新用户已经打开的浏览器标签页。
2. 打开“半导体 10 年”面板应用，确认深色主题、卡片、按钮、表格与图表样式恢复，不再显示浏览器默认大号黑字。
3. 确认面板应用脚本成功执行，图表节点已生成，时间范围与线性/对数控件可正常呈现。
4. 确认样式资源请求成功，且普通无 Cookie API 仍不能借 host session 越过认证。

## 可维护性总结汇总

本次定向变更总代码 `+172/-95`、净增 77 行；排除测试后生产代码 `+93/-95`、净减 2 行。正向减债包括：Controller 从 506 行降到 498 行，合并重复实例鉴权，移除重复的响应头分支与代理头数组构造，并把无状态的沙箱请求判定放入独立 `utils` owner。可维护性守卫为 0 error / 0 warning，没有新增兼容分支、隐式 fallback、假 service 或双认证 owner。

## NPM 包发布记录

- NPM 包：不涉及；改动只部署私有 Cloudflare Worker，因此不添加 changeset，也不执行 NPM publish。
- GitHub release / Desktop release：不涉及。
