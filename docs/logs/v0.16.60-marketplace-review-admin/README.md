# 迭代完成说明

本次交付把 marketplace skill 审核从隐藏的 worker admin API，升级为平台正式后台能力，直接承接到 `platform-admin + nextclaw-provider-gateway-api + marketplace-api` 这条正式治理链路里。

- 设计方案文档：
  [`docs/plans/2026-04-18-marketplace-review-admin-design.md`](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-18-marketplace-review-admin-design.md)
- `workers/marketplace-api`
  - 新增 `review_note` / `reviewed_at` migration
  - 新增 admin skill 列表、详情读取接口
  - 审核写入支持备注，并在重新发布时清空旧审核元数据
  - 将审核与文件读取责任拆到 `d1-marketplace-skill-admin-support.ts`，把超长数据源文件收回预算内
  - 将 admin skill 路由从 `main.ts` 抽到独立注册模块，避免主入口继续膨胀
  - 修复 admin 路由对内部 `MARKETPLACE_ADMIN_TOKEN` 的硬依赖：现在也接受平台侧 `role=admin` 的 Bearer token
- `workers/nextclaw-provider-gateway-api`
  - 新增 marketplace admin service，统一代理 marketplace admin API
  - 新增 `/platform/admin/marketplace/skills*` 后台接口
  - review 动作接入平台管理员鉴权与 audit log
  - 将新增 controller 放到 `controllers/marketplace/` 子目录，避免 controllers 目录直接文件数超限
  - 补充最小正式运维入口 `pnpm platform:admin:grant -- --email <email> --remote`，解决“管理后台已上线但生产库尚无 admin 账号”时的可恢复开通问题
  - 修复 provider 侧对 `MARKETPLACE_ADMIN_TOKEN` 缺失时的审核列表报错：现在默认透传当前管理员登录态到 marketplace admin API
- `apps/platform-admin`
  - 新增 `Marketplace 审核` 区块
  - 支持状态筛选、关键词搜索、分页、详情查看、审核备注、通过/拒绝
  - 详情区直接显示 `SKILL.md`、`marketplace.json` 和文件清单

# 测试/验证/验收方式

已执行：

- `pnpm -C workers/marketplace-api tsc`
- `pnpm -C workers/marketplace-api lint`
- `pnpm -C workers/marketplace-api build`
- `pnpm -C workers/nextclaw-provider-gateway-api tsc`
- `pnpm -C workers/nextclaw-provider-gateway-api build`
- `pnpm -C apps/platform-admin tsc`
- `pnpm -C apps/platform-admin lint`
- `pnpm -C apps/platform-admin build`

定向冒烟：

- 使用 `tsx` 直接执行 `workers/marketplace-api/src/main.ts`，对以下接口做本地伪环境冒烟，返回均为 `200`
  - `GET /api/v1/admin/skills/items`
  - `GET /api/v1/admin/skills/items/:selector`
  - `POST /api/v1/admin/skills/review`
- 使用 `tsx` 直接执行 `workers/nextclaw-provider-gateway-api/src/main.ts`，对以下接口做本地伪环境冒烟，返回均为 `200`
  - `GET /platform/admin/marketplace/skills`
  - `GET /platform/admin/marketplace/skills/:selector`
  - `POST /platform/admin/marketplace/skills/:selector/review`
  - 同时确认 review 后写入 1 条 audit log
- 使用 `pnpm platform:admin:grant -- --email 1535376447@qq.com --remote` 完成一次真实远端提权，并通过远端 D1 查询确认该账号 `role` 已从 `user` 变为 `admin`
- 真实线上链路验收：
  - 创建临时 `admin` 冒烟账号并登录 `https://ai-gateway-api.nextclaw.io/platform/auth/login`
  - 使用登录返回的 Bearer token 请求 `GET /platform/admin/marketplace/skills?publishStatus=all&page=1&pageSize=5`，返回 `200`
  - 使用同一 Bearer token 直接请求 `GET https://marketplace-api.nextclaw.io/api/v1/admin/skills/items?publishStatus=all&page=1&pageSize=5`，返回 `200`
  - 返回数据中确认包含待审核 skill `@peiiii/stock-briefing`，不再出现 `missing or invalid admin token`

已知验证缺口：

- `pnpm -C workers/nextclaw-provider-gateway-api lint` 仍被该 worker 内一批既有 warning 卡住，不是本次新增功能引入的 lint error
- `pnpm lint:maintainability:guard` 仍被仓库内既有问题 `packages/nextclaw-core/src/agent` 目录预算越界阻断；本次新增导致的 `marketplace-api` / `provider-gateway-api` 守卫错误已清除

# 发布/部署方式

本次发布涉及三个部署面：

1. Marketplace 审核数据源
   - `pnpm -C workers/marketplace-api db:migrate:skills:remote`
   - `pnpm -C workers/marketplace-api deploy`
2. 平台后台 API
   - `pnpm -C workers/nextclaw-provider-gateway-api deploy`
3. 平台管理后台前端
   - `pnpm deploy:platform:admin`

本批次额外运维动作：

- 涉及新的线上代码部署
- 涉及一次生产账号权限初始化：使用仓库内正式脚本把现有平台账号提升为管理员

部署依赖：

- Cloudflare 远端权限与 wrangler 登录态
- `MARKETPLACE_ADMIN_TOKEN` 等线上 secret 已配置

实际发布结果：

- `marketplace-api`
  - 已执行 `pnpm -C workers/marketplace-api db:migrate:skills:remote`
  - migration `0005_marketplace_skill_review_metadata_20260418.sql` 已成功应用
  - 已部署版本 ID：`e983da4f-3368-4176-9f90-e9f7cc863e5e`
  - 域名：`https://marketplace-api.nextclaw.io`
- `nextclaw-provider-gateway-api`
  - 已部署版本 ID：`77a61425-5a5e-42ed-a641-4ab9d5785363`
  - 域名：`https://ai-gateway-api.nextclaw.io`
- `marketplace-api`
  - 最新修复部署版本 ID：`8498d249-36e2-4fca-9b0b-0ede4636bc0e`
- `platform-admin`
  - 已部署 Pages URL：`https://c7597a56.nextclaw-platform-admin.pages.dev`

线上探测：

- `curl https://marketplace-api.nextclaw.io/health` 返回 `ok`
- `curl https://ai-gateway-api.nextclaw.io/health` 返回 `ok`
- `curl -I https://c7597a56.nextclaw-platform-admin.pages.dev` 返回 `HTTP/2 200`
- 使用真实管理员 Bearer token 请求后台审核列表，返回 `pending=1 / published=25 / rejected=0`，待审核项包含 `@peiiii/stock-briefing`

# 用户/产品视角的验收步骤

1. 管理员登录 `platform-admin`
2. 在 dashboard 中进入 `Marketplace 审核` 区块
3. 看到 `pending / published / rejected` 摘要计数
4. 在左侧队列里筛选并选中某个 scoped skill
5. 在右侧确认以下信息可见：
   - 包名、scope、作者、发布时间、更新时间
   - 标签、摘要、描述
   - `SKILL.md`
   - `marketplace.json`
   - 文件清单
6. 直接执行：
   - 通过：状态切到 `published`
   - 拒绝：必须填写备注，状态切到 `rejected`
7. 审核完成后刷新列表，确认状态、审核时间、备注同步更新
8. 对于通过的 skill，确认 marketplace 公共侧可见；对于拒绝的 skill，确认不会出现在公共 marketplace
9. 若生产环境尚无管理员账号，先执行 `pnpm platform:admin:grant -- --email <email> --remote`，再使用该账号的原平台密码登录管理后台

# 可维护性总结汇总

本次是否已尽最大努力优化可维护性：是。

本次是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。虽然需求本身新增了后台能力，不可避免带来净增，但在实现过程中主动做了三笔减债：

- 把 `workers/marketplace-api/src/infrastructure/d1-skill-data-source.ts` 中新增的审核/文件责任抽出为独立 support 模块
- 把 `workers/marketplace-api/src/main.ts` 的 admin skill 路由注册抽出，避免主入口继续膨胀
- 把 `provider-gateway-api` 新增 controller 收进 `controllers/marketplace/` 子目录，避免直接目录超限
- 本次 admin 开通补丁选择轻量运维脚本，而不是再做一套独立 bootstrap 页面或额外后台登录体系，避免把单次可恢复问题扩成长期维护面
- 本次审核链路修复选择“统一登录态优先，内部 token 兼容保留”，而不是继续把 provider 对内部 secret 的存在当成后台可用性的单点前提

本次是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：在总代码量上是净增长，但增长主要来自新增的正式审核能力；同时同步偿还了 `marketplace-api` 两个超预算热点和 `provider-gateway-api/controllers` 目录平铺问题，没有把复杂度直接叠加回原文件。

抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰：是。当前边界为：

- `marketplace-api` 负责真实审核数据源与状态写入
- `MarketplaceAdminService` 负责后台代理与远端调用
- `platform-admin` 的审核 UI 逻辑集中在独立 section 里，而不是继续堆进 `AdminDashboardPage`

目录结构与文件组织是否满足当前项目治理要求：本次触达目录内已做到不继续恶化；`marketplace-api` 与 `provider-gateway-api` 本次新增引起的硬性治理错误均已消除。仓库仍存在与本次无关的历史治理问题，例如 `packages/nextclaw-core/src/agent` 目录预算越界，本次未处理，下一步应在该目录内继续按职责拆分。

本次涉及代码可维护性评估，已基于一次独立于实现阶段的 `post-edit-maintainability-review` 思路完成复核。结论：

- 可维护性复核结论：保留债务经说明接受
- 本次顺手减债：是
- no maintainability findings
- 代码增减报告：
  - 新增：`1949` 行
  - 删除：`157` 行
  - 净增：`1792` 行
  - 说明：统计口径为 `git diff HEAD~1..HEAD -- docs/plans/2026-04-18-marketplace-review-admin-design.md docs/logs/v0.16.60-marketplace-review-admin/README.md apps/platform-admin workers/marketplace-api workers/nextclaw-provider-gateway-api`
- 非测试代码增减报告：
  - 新增：`1532` 行
  - 删除：`157` 行
  - 净增：`1375` 行
  - 说明：实现改动未触达测试文件，非测试代码净增长来自正式审核后台能力；文档增量为设计方案与迭代记录，共 `417` 行
- 可维护性总结：这次净增代码主要来自新增正式审核能力本身，但在接受增长前，已经先把 `marketplace-api` 的审核/文件职责拆到独立 support 模块、把 admin 路由从 `main.ts` 抽离、并把 provider controller 收进子目录，避免把新增复杂度直接堆回既有热点文件。当前边界总体更清晰，没有发现明显重复抽象或把业务编排继续塞回 React effect 的问题；后续继续扩展该后台时，优先关注 `apps/platform-admin/src/pages/admin-marketplace-review-section.tsx` 与 `workers/nextclaw-provider-gateway-api/src/types/platform.ts` 的体积增长，及时按子域拆分。

# NPM 包发布记录

不涉及 NPM 包发布。
