# v0.9.17 Domestic Marketplace Mirror Fallback

## 迭代完成说明

本次完成 `nextclaw.net` 国内技能市场镜像的方案设计、部署资产沉淀、客户端默认读源改造和验证闭环。

核心交付：

- 新增 `docs/designs/2026-07-02-nextclaw-net-domestic-marketplace-mirror.design.md`，记录 nextclaw.net 国内只读镜像、DNS、HTTPS、ICP 边界和客户端回退策略。
- 新增 `scripts/deploy/nextclaw-net-marketplace-mirror/` 运维资产，沉淀 ECS 只读镜像服务、systemd API、同步 timer 与 Nginx 配置。
- `nextclaw-server` UI marketplace 代理默认改为 `https://api.nextclaw.net -> https://marketplace-api.nextclaw.io`。
- `nextclaw-service` marketplace 读/安装/更新已安装技能路径默认改为国内镜像优先，官方源兜底。
- 发布/admin 写路径仍默认使用官方源，避免只读镜像承载写事实。

本次关键取舍：

- 不做阻塞 `/health` 预探测，避免首屏多一次 RTT。
- 只有真实请求网络失败、超时、`408`、`429`、`5xx` 或无效响应时回退。
- `400` / `404` 等业务错误不自动切源，避免掩盖真实合同问题。
- 暂不增加设置界面；默认自动策略让国内用户直接受益，显式 `apiBaseUrl` 继续用于开发和特殊环境。

## 测试/验证/验收方式

已通过：

- `./node_modules/.bin/vitest run src/app/router.marketplace-content.test.ts`（`packages/nextclaw-server`，5 tests）
- `./node_modules/.bin/vitest run src/services/marketplace/skills-query.service.test.ts src/controllers/commands/marketplace-skill-install-command.controller.test.ts`（`packages/nextclaw-service`，9 tests）
- `./node_modules/.bin/tsc -p tsconfig.json`（`packages/nextclaw-server`）
- `./node_modules/.bin/tsc -p tsconfig.json`（`packages/nextclaw-service`）
- Targeted ESLint on all touched TypeScript files
- `node scripts/governance/checks/lint-new-code-governance.mjs`
- `node scripts/governance/backlog/check-governance-backlog-ratchet.mjs`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`

公网镜像 smoke：

- `https://api.nextclaw.net/health` 返回 `storage: "snapshot-mirror"`。
- `https://api.nextclaw.net/api/v1/skills/items?page=1&pageSize=3` 返回 36 个技能中的分页数据。
- `https://api.nextclaw.net/api/v1/skills/scenes` 返回场景列表。
- `https://api.nextclaw.net/api/v1/skills/items/browser-control` 返回详情。
- `https://api.nextclaw.net/api/v1/skills/items/browser-control/files/blob?path=SKILL.md` 返回 200 和 `x-nextclaw-mirror-cache: hit`。

产品路径 smoke：

- `createUiRouter` 默认配置请求 `/api/marketplace/skills/items?page=1&pageSize=2` 返回 `status: 200`、`total: 36`。
- `installMarketplaceSkill({ slug: "browser-control" })` 在临时 workspace 中完成安装，`SKILL.md` 存在。

说明：

- `pnpm -C ...` 在当前非 TTY 环境触发 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`，因此验证改用包内 `node_modules/.bin` 直接执行，未修改依赖目录。

## 发布/部署方式

远程部署：

- ECS `8.154.43.167` 已部署国内只读镜像 API。
- `api.nextclaw.net` 已通过阿里云 DNS 指向 ECS。
- `nextclaw.net`、`www.nextclaw.net`、`api.nextclaw.net` 已签发并部署 HTTPS 证书。
- systemd API 服务和 10 分钟同步 timer 已启用。

代码发布：

- 本次尚未执行 git commit、push、PR。
- 不涉及数据库 migration。
- 不涉及 NPM 包发布；需要后续跟随正常产品发布批次进入用户安装版本。

## 用户/产品视角的验收步骤

1. 打开 NextClaw 技能市场，默认应直接通过 `api.nextclaw.net` 获取列表。
2. 技能列表、场景、详情、content 和文件下载在国内链路可用。
3. 如果 `api.nextclaw.net` 返回 `5xx` 或网络失败，客户端自动回退到 `marketplace-api.nextclaw.io`。
4. 用户显式配置 `apiBaseUrl` 时，仅使用指定源。
5. 技能发布、admin 写操作仍走官方源，不写入国内镜像。

## 可维护性总结汇总

已使用 `post-edit-maintainability-guard` 与主观复核。

本次是新增用户可见能力，生产代码有净增长；增长主要来自：

- source policy 独立 utility，避免把 fallback 策略散落到 controller。
- route/service 边界测试，锁定无预探测和失败回退行为。
- read/write 源策略分离，避免只读镜像污染发布写路径。

本次顺手减债：

- 将 marketplace 读源顺序、timeout、fallback 判定拆到 `marketplace-read-source.utils.ts`，降低 catalog/client utility 继续膨胀。
- `marketplace-client.utils.ts` 不再触发近 400 行预算 warning。

剩余 warning：

- `packages/nextclaw-server/src/app` 和 `packages/nextclaw-service/src/controllers/commands` 是既有目录预算债务。
- `marketplace-catalog.utils.ts` 与 `marketplace-skill-lifecycle.utils.ts` 仍接近文件预算，后续若继续扩展 marketplace，应优先拆更细读模型或安装生命周期 owner。

## NPM 包发布记录

不涉及 NPM 包发布。
