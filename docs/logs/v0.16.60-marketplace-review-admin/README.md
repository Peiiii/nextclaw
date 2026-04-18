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
- `workers/nextclaw-provider-gateway-api`
  - 新增 marketplace admin service，统一代理 marketplace admin API
  - 新增 `/platform/admin/marketplace/skills*` 后台接口
  - review 动作接入平台管理员鉴权与 audit log
  - 将新增 controller 放到 `controllers/marketplace/` 子目录，避免 controllers 目录直接文件数超限
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

部署依赖：

- Cloudflare 远端权限与 wrangler 登录态
- `MARKETPLACE_ADMIN_TOKEN` 等线上 secret 已配置

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

# 可维护性总结汇总

本次是否已尽最大努力优化可维护性：是。

本次是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。虽然需求本身新增了后台能力，不可避免带来净增，但在实现过程中主动做了三笔减债：

- 把 `workers/marketplace-api/src/infrastructure/d1-skill-data-source.ts` 中新增的审核/文件责任抽出为独立 support 模块
- 把 `workers/marketplace-api/src/main.ts` 的 admin skill 路由注册抽出，避免主入口继续膨胀
- 把 `provider-gateway-api` 新增 controller 收进 `controllers/marketplace/` 子目录，避免直接目录超限

本次是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：在总代码量上是净增长，但增长主要来自新增的正式审核能力；同时同步偿还了 `marketplace-api` 两个超预算热点和 `provider-gateway-api/controllers` 目录平铺问题，没有把复杂度直接叠加回原文件。

抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰：是。当前边界为：

- `marketplace-api` 负责真实审核数据源与状态写入
- `MarketplaceAdminService` 负责后台代理与远端调用
- `platform-admin` 的审核 UI 逻辑集中在独立 section 里，而不是继续堆进 `AdminDashboardPage`

目录结构与文件组织是否满足当前项目治理要求：本次触达目录内已做到不继续恶化；`marketplace-api` 与 `provider-gateway-api` 本次新增引起的硬性治理错误均已消除。仓库仍存在与本次无关的历史治理问题，例如 `packages/nextclaw-core/src/agent` 目录预算越界，本次未处理，下一步应在该目录内继续按职责拆分。

本次涉及代码可维护性评估，已基于一次独立于实现阶段的 `post-edit-maintainability-review` 思路完成复核。结论：

- 可维护性复核结论：保留债务经说明接受
- 本次顺手减债：是
- 代码增减报告：本次需在最终提交前以 staged diff 为准复核；当前实现层面属于新增能力带来的净增长，但已通过拆分 support / route registry / 独立 section 把增长压回到最小必要范围
- 非测试代码增减报告：本次改动全部为非测试代码；最终以 staged diff 为准复核
- 可维护性总结：本次没有把审核能力硬塞回现有大文件，而是用更清晰的后端代理、worker support 和前端 section 边界承接新增复杂度。仍保留的债务主要是 `types/platform.ts` 与新 support 文件接近预算上限，后续若继续扩展 marketplace 后台，优先从类型拆分与 marketplace 子域模块化入手。

# NPM 包发布记录

不涉及 NPM 包发布。
