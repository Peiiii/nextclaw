# v0.25.18 Remote Cloudflare 配额统一

## 迭代完成说明

本迭代把 Remote 从独立的 `session 180/min` 产品限流，改为与 Cloudflare 官方资源口径一致的每日配额系统。普通用户不再受几分钟内的固定请求数约束，只受用户每日 Worker/DO 额度与平台每日总容量约束；连接数上限保留为宽松的极端失控保护，短窗口 runaway 先保持影子观测，避免在没有生产峰值样本时误伤用户。

Provider Gateway 现在逐事件记录 Worker request、Durable Object request、WebSocket upgrade、DO 入站消息 20:1、quota DO 自身调用，以及连接预留、实际消费、批量结算和释放。用户 summary 明确区分 `actualUsed`、`reserved`、`remaining`，并提供最近 30 分钟和 1 小时统计；Admin 同时看到 Cloudflare 免费计划总池、平台保留量、校准状态和可支持的满额重度用户数。

Platform Console 新增每日额度进度、资源明细、重置时间和近期用量；Platform Admin 新增平台容量面板。额度合同和 API 查询分别归 dashboard/admin-overview feature，旧全局 API 模块不再承载 v2 合同。Admin 入口迁移同时删除了用户 query 到 store 的镜像 effect，并把临时 `/me` 失败从“自动登出”改成显式恢复界面。

完整方案见 `docs/designs/2026-07-18-remote-cloudflare-quota-unification.design.md`。

## 测试/验证/验收方式

- Provider Gateway `tsc`、ESLint、build 通过；Remote quota 定向测试 14/14，通过 WebSocket 成本、拒绝请求记账、连接预留/结算/释放、20:1 DO 消息换算、UTC 00:00 重置、v1 state 隔离、2 MB 状态上限投影和 hibernation 恢复。
- Platform Console 与 Platform Admin 的 `tsc`、ESLint、production build 全部通过。
- Console Playwright 冒烟通过：每日额度、Worker/DO 进度、最近 30 分钟/1 小时统计、实例 ID 展示，以及 390px 视口无横向溢出。
- Admin Playwright 冒烟通过：平台 Worker/DO 总池、实际/预留/剩余、计划与校准信息均可见。
- `env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u http_proxy -u https_proxy -u all_proxy pnpm smoke:remote-relay` 通过：真实本地 Worker、CLI 登录、connector、WebSocket session、HTTP bridge、share revoke、offline transition 和额度结算全链路正常。
- `pnpm lint:maintainability:guard` 通过：0 error；`lint:new-code:governance` 与 governance backlog ratchet 通过。
- `git diff --cached --check` 通过；最终提交只包含本迭代文件，工作区中的实例列表分页等并行 WIP 未纳入。

## 发布/部署方式

- 远程 D1 migration 检查：`No migrations to apply`。
- Provider Gateway Worker 已部署，Version ID：`14f4e3c0-62bd-42a6-8c80-2e71c1554088`。
- Platform Console Pages 部署：`https://ad89deca.nextclaw-platform-console.pages.dev`；正式域名资源为 `index-CLQI9CNG.js` 与 `index-Cy-ZLY5b.css`。
- Platform Admin Pages 部署：`https://08908130.nextclaw-platform-admin.pages.dev`；正式域名资源为 `index-CeFJ4fGh.js` 与 `index-Dk_gqEsk.css`。
- 线上 `https://ai-gateway-api.nextclaw.io/health` 返回 200；用户/管理员 `/quota/v2` 未登录返回 401；旧用户/管理员 `/quota` 路由均返回 404，确认没有长期双轨。
- Console/Admin 正式域名与四个本次 JS/CSS 资源均返回 200。

## 用户/产品视角的验收步骤

1. 登录 `https://platform.nextclaw.io`，在首页确认 Remote 每日额度卡片展示总额度、实际已用、连接预留、剩余量和 UTC 重置时间。
2. 连续进行普通远程操作，确认不会再因为固定 `180/min` 出现 `REMOTE_SESSION_RATE_LIMITED`；额度进度按 Cloudflare 资源事件增长。
3. 查看最近 30 分钟与最近 1 小时统计，确认可以区分刚刚的使用量与全天累计。
4. 在实例列表确认每个实例展示后台实例 ID 并可复制，便于把用户反馈映射到具体运行实例。
5. 管理员登录 `https://platform-admin.nextclaw.io`，确认平台总池、实际/预留用量、20% 安全保留、免费计划口径和 bootstrap 校准状态可见。

## 可维护性总结汇总

这是新增且替换旧限制机制的用户能力。守卫统计总变更 `+2679/-1754`，非测试变更 `+2427/-1504`；增长集中在精确成本账本、产品 summary、两端 UI 与回归验证，同时删除了旧 session RPM 决策、v1 route/字段、平行 quota service 和 Admin 登录态镜像 effect。

可维护性守卫为 0 error、6 warning：`scripts/smoke` 保持既有 14/12 豁免且未增加根文件；Console smoke 从 500 行降到 491 行；relay controller、remote controller、quota decision/state 文件接近各自预算但未越线。quota transport 已收敛到 repository，响应构造与成本决策分离；前端合同归 feature，module-structure、命名、class arrow method、effect owner 和跨包导入检查全部通过。主观复核未发现需要新增 factory、adapter、fallback 或第二套账本的理由。

## NPM 包发布记录

不涉及 NPM 包发布。Provider Gateway Worker 与两个 Cloudflare Pages 项目是私有部署单元，本次不添加 `.changeset`；交付闭环由 D1 migration 检查、Worker/Pages 生产发布和线上定向验收完成。
