# 迭代完成说明

本批次围绕 `platform-admin` 完成了两段连续收尾：

1. 先把原先平铺式后台拆成 `总览 / Marketplace 审核 / 用户与额度 / 充值审核` 四个一级页面，并补上独立 UI 冒烟。
2. 再把第一版壳层继续收敛成“经典后台控制台模板”，重点修正用户明确指出的几个问题：
   - 侧边栏不再承载大段说明文案，只保留一级导航
   - 顶部改成经典固定全局栏，页面说明只保留一行
   - 内容区独立滚动，形成稳定控制台骨架
   - 视觉不再自创，统一回到 NextClaw UI 的暖中性色和 olive brand 语言

设计文档：

- 初版控制台拆页方案：
  [`docs/plans/2026-04-18-platform-admin-console-layout-design.md`](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-18-platform-admin-console-layout-design.md)
- 经典后台模板优化方案：
  [`docs/plans/2026-04-18-platform-admin-classic-console-optimization-design.md`](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-18-platform-admin-classic-console-optimization-design.md)

本批次最终交付结果：

- `apps/platform-admin`
  - 新增 `AdminShell`、`AdminPage` 等后台框架组件，形成固定侧边栏、固定顶部栏、内容区滚动的经典骨架
  - `AdminDashboardPage` 不再承载所有区块拼装，只负责壳层和路由页面装配
  - `admin-overview-page.tsx` 删除了不必要的 Hero 化入口块，收敛成指标卡 + 配额面板 + 营收治理
  - `admin-user-quota-page.tsx` 重排成经典治理页结构：节标题 + 工具栏 + 表格
  - `admin-recharge-review-page.tsx` 重排成经典审核台结构：状态切换 + 审核表格 + 分页
  - `admin-marketplace-review-section.tsx` 保留正确的双栏审核工作台，但视觉和框架统一到新控制台模板
  - `admin-console-navigation.ts` 删掉导航项冗余说明字段，避免侧边栏继续变成说明区
  - `index.css`、`tailwind.config.js`、基础 UI 组件统一为暖中性色 + olive brand
- `scripts/smoke/platform-admin-smoke.mjs`
  - 将断言同步到新的经典控制台结构，保证本地与线上冒烟都基于最新页面骨架
- `apps/platform-admin/README.md`
  - 更新为当前最终控制台结构说明

# 测试/验证/验收方式

已执行：

- `pnpm -C apps/platform-admin tsc`
- `pnpm -C apps/platform-admin lint`
- `pnpm -C apps/platform-admin build`

本地 UI 冒烟：

1. 启动本地预览：
   - `pnpm -C apps/platform-admin preview --host 127.0.0.1 --port 4177 --strictPort`
2. 执行：
   - `PLATFORM_ADMIN_BASE_URL=http://127.0.0.1:4177 pnpm smoke:platform:admin`
3. 结果：
   - 返回 `platform-admin smoke ok: http://127.0.0.1:4177`
   - 覆盖登录页、控制台壳层、四个一级页面切换与 Marketplace 审核详情工作台

线上验证：

- `curl -I https://platform-admin.nextclaw.io`
- `PLATFORM_ADMIN_BASE_URL=https://platform-admin.nextclaw.io pnpm smoke:platform:admin`

结果：

- `https://platform-admin.nextclaw.io` 返回 `HTTP/2 200`
- 线上冒烟返回 `platform-admin smoke ok: https://platform-admin.nextclaw.io`

治理守卫：

- `pnpm lint:maintainability:guard`

结果：

- 本次 `platform-admin` 相关文件未引入新的维护性守卫错误
- 当前整条守卫仍为非绿，但阻塞点来自仓库内其它并行改动，而不是本次后台重构本身
- 目前已观察到的无关阻塞包括：
  - `packages/nextclaw-core/src/agent` 目录预算越线
  - `packages/nextclaw-ui/src/components/config/ChannelForm.tsx`
  - `packages/nextclaw-ui/src/components/config/ProviderForm.tsx`
  - `packages/nextclaw-ui/src/components/config/SearchConfig.tsx`

# 发布/部署方式

本次只涉及 `platform-admin` 前端发布，不涉及平台后端、数据库 migration 或 marketplace worker 重发。

发布命令：

- `pnpm deploy:platform:admin`

实际发布结果：

- Cloudflare Pages 部署地址：
  - `https://664a4575.nextclaw-platform-admin.pages.dev`
- 自定义正式域名：
  - `https://platform-admin.nextclaw.io`

说明：

- 自定义域名已正常返回 `200`
- 线上 UI 冒烟已直接在正式域名上通过

# 用户/产品视角的验收步骤

1. 打开 `https://platform-admin.nextclaw.io`
2. 确认未登录时显示“登录管理后台”
3. 使用管理员账号登录
4. 登录后确认页面已是经典控制台结构：
   - 左侧仅保留一级导航
   - 顶部为固定全局栏
   - 中间内容区独立滚动
5. 依次进入：
   - `总览`
   - `Marketplace 审核`
   - `用户与额度`
   - `充值审核`
6. 确认 `总览` 页第一屏是指标卡，而不是介绍型 Hero
7. 确认 `Marketplace 审核` 页仍可查看队列、详情、`SKILL.md` 与 `marketplace.json`
8. 确认 `用户与额度` 页仍可搜索用户并编辑额度
9. 确认 `充值审核` 页仍可处理待审核申请

# 可维护性总结汇总

本次是否已尽最大努力优化可维护性：是。

本次是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。本次续改没有继续在第一版壳层上打补丁，而是直接删掉了侧边栏冗余说明、总览页大块介绍式内容和页面级重复框架，改用更稳定、更少 surprise 的经典后台模板。

本次是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：页面内部复杂度和后续扩展复杂度是明显下降的，但从旧平铺后台到最终经典控制台模板的整批 diff 仍然是净增长。这部分增长已经压到当前可接受的最小必要范围，因为我们需要补齐此前完全不存在的后台骨架组件、独立页面边界、顶部栏/侧边栏结构以及相应 smoke 校验；与此同时，旧的超大 `AdminDashboardPage.tsx` 已被删减了 616 行。

抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰：是。

- `AdminShell` 负责控制台骨架
- `AdminPage / AdminToolbar / AdminSurface / AdminMetricCard` 负责后台共用框架表面
- `AdminDashboardPage` 只负责装配当前页面
- 各一级页面分别承接各自治理职责
- `admin-marketplace-review-section.tsx` 继续保留为 Marketplace 审核主体，不再反向污染全局壳层

目录结构与文件组织是否满足当前项目治理要求：本次触达范围内满足。`apps/platform-admin/src/components/admin` 与 `apps/platform-admin/src/pages` 的角色边界比上一版清晰；仓库里仍存在其它目录预算超限问题，但不在本次改动范围内。

长期目标对齐 / 可维护性推进：

- 这次续改顺着 NextClaw “统一入口、统一控制面”的长期目标继续推进了一步，把后台从“能用的治理页集合”收敛成了“正式控制台入口”。
- 这次最关键的维护性推进，不是新增花哨能力，而是把后台骨架沉淀成可复用模板，降低后续治理页面继续长歪、继续平铺、继续文案化的概率。

可维护性复核结论：保留债务经说明接受

本次顺手减债：是

no maintainability findings

代码增减报告：

- 新增：1582 行
- 删除：791 行
- 净增：791 行

非测试代码增减报告：

- 新增：1582 行
- 删除：791 行
- 净增：791 行

可维护性总结：

- 这次改动真正降低的是后台框架复杂度和后续扩展成本，而不是再叠一层视觉包装。
- 虽然整批 diff 仍净增 791 行，但增长已经是完成“从无到有的正式控制台骨架”所需的最小必要量；我们已经通过删掉旧 `AdminDashboardPage` 的超长拼接逻辑、删除侧边栏冗余说明和去掉总览页介绍型区块，尽量把增长压回到稳定基础设施本身。
- 本次保留债务不是 `platform-admin` 自身结构问题，而是仓库其它并行改动导致的维护性守卫非绿。
- 后续若继续加治理模块，应该优先沿当前壳层与页面框架扩展，而不是把 `总览` 或侧边栏重新堆回说明式长页面。

# NPM 包发布记录

不涉及 NPM 包发布。
