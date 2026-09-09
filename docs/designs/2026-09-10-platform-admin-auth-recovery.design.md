# Platform Admin 过期登录态恢复设计

## 背景与问题

`platform-admin.nextclaw.io` 会从 `localStorage` 恢复 `nextclaw.platform.token`，再通过 `GET /platform/auth/me` 校验管理员身份。当前查询沿用 TanStack Query 的默认重试策略：过期 token 收到 `401` 后仍会继续重试，页面在此期间只显示“加载登录态...”。用户因此会把确定性的登录失效误认为站点卡死。

线上复现已经确认：无 token 时登录页正常；用户浏览器中存在过期 token 时先持续显示加载态，最终显示 `Invalid or expired token.`。生产 API 对无效 token 正确返回 `401`，缺口位于管理后台客户端的错误分类与恢复行为。

## 用户任务与可观察结果

管理员从管理后台入口重进或刷新时：

- 有效 token：继续进入管理后台。
- 过期或无效 token：首次校验失败后立即清除本地 token，并返回登录页，不重复发送确定失败的认证请求。
- 网络错误或服务端错误：保留 token，显示现有错误页，允许用户重试页面或主动退出，不把瞬态故障伪装成登录失效。
- 非管理员账号：保持现有“仅管理员可访问”反馈与主动切换账号路径。

## Owner 与主链路

主链路保持单一：

`localStorage token -> auth store -> App /me query -> API client HTTP error -> auth store logout -> LoginPage`

- API client 拥有 HTTP 边界事实，抛出带 `status` 的错误，避免 UI 依赖错误文案判断。
- `App` 拥有启动时登录态校验编排，只对 `401` 禁止重试并触发 `logout`。
- auth store 继续拥有 token 的持久化与清理，不新增平行 token owner。
- 不修改 Worker 鉴权协议；`401` 已是正确的远端合同。

## 失败与恢复约束

- `401` 是确定性凭据失效，采用 fail-fast；不提供兼容重试或隐藏 fallback。
- `429`、网络错误和 `5xx` 不自动清除 token，避免瞬态故障迫使用户重新登录。
- 自动清理只发生在启动校验读取路径内，不引入新的 API、副作用型读取或后台循环。
- 不按 `Invalid or expired token.` 文案识别错误，防止上游文案变化破坏恢复行为。

## Active acceptance contract

- contract-id：`AC-ADMIN-AUTH-1`
- parent-goal：过期管理后台登录态可立即、可预测地恢复，并将修复部署到生产入口。
- scope-revision：1（用户已授权修复、交付与部署）

| ID | Required | 合同 | 初始状态 |
| --- | --- | --- | --- |
| A1 | true | 过期 token 首次校验返回 401 后立即清除并显示登录页 | not-run |
| A2 | true | 401 校验不发生查询重试 | not-run |
| A3 | true | 非 401 失败保留 token 并显示错误反馈 | not-run |
| A4 | true | Platform Admin 定向回归、TypeScript、lint 与生产构建通过 | not-run |
| A5 | true | 修复产物部署到 `platform-admin.nextclaw.io`，线上过期 token 场景通过 | not-run |

## 验证与交付边界

- 在现有 Platform Admin smoke 中增加过期 token 与非认证错误场景，直接统计 `/platform/auth/me` 请求次数并检查持久 token。
- 运行 Platform Admin `tsc`、lint、build 与 smoke；源码完成后执行 diff-only maintainability Review。
- 使用仓库现有 `deploy:platform:admin` 交付 Cloudflare Pages，不部署无关 backend 或用户前端。
- 部署后通过真实生产域验证匿名登录页、无效 token 恢复、静态资源与健康响应。

## 非目标

- 不改变 token 格式、服务端过期策略或管理员权限模型。
- 不新增 refresh token、会话续期、兼容 API 或全局请求框架。
- 不改造 Platform Console 的普通用户登录态；本次证据只命中独立管理后台。

## 设计审计

该方案只补齐一个 owner 内跨 API 边界与 UI 恢复的局部合同：保留既有 store、查询和页面结构，仅让 HTTP status 成为结构化事实。它不引入新的抽象层或公共协议；若仅在 UI 比较错误文案，会把上游展示文本误当合同，因此不采用。
