# 迭代完成说明

本次把 `platform-admin` 从单页平铺 dashboard，升级成轻量经典管控台结构，让后台正式具备“左侧导航 + 顶部全局栏 + 内容区分模块页面”的信息架构。

- 设计方案文档：
  [`docs/plans/2026-04-18-platform-admin-console-layout-design.md`](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-18-platform-admin-console-layout-design.md)
- `apps/platform-admin`
  - 新增经典控制台壳层：左侧一级导航、顶部栏、内容区
  - 一级页面拆分为：
    - `总览`
    - `Marketplace 审核`
    - `用户与额度`
    - `充值审核`
  - 现有 `Marketplace 审核` 逻辑整体复用，但从长页面抽离成独立页
  - `总览` 页统一承接平台概览、Remote 配额概览、营收与上游治理
  - `用户与额度` 页统一承接全局免费池和用户额度编辑
  - `充值审核` 页独立承接待处理充值申请
  - 使用 URL hash 完成轻量页面切换，不额外引入路由库
  - 新增 `scripts/smoke/platform-admin-smoke.mjs`，让后台首次具备独立 UI 冒烟能力
- `apps/platform-admin/README.md`
  - 补充了新的控制台结构说明和 UI 冒烟命令
- 根 `package.json`
  - 新增 `smoke:platform:admin`

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
   - 覆盖登录页、控制台壳层、四个一级页面切换与 Marketplace 详情区基础展示

线上 UI 冒烟：

- `PLATFORM_ADMIN_BASE_URL=https://platform-admin.nextclaw.io pnpm smoke:platform:admin`
- 结果：
  - 返回 `platform-admin smoke ok: https://platform-admin.nextclaw.io`

线上域名探测：

- `curl -I https://1c357a2c.nextclaw-platform-admin.pages.dev`
- `curl -I https://platform-admin.nextclaw.io`
- 两者均返回 `HTTP/2 200`

治理守卫：

- `pnpm lint:maintainability:guard`
- 结果：
  - 本次新增代码对应的 smoke 脚本维护性问题已清除
  - 当前仍被仓库内与本任务无关的既有阻塞卡住：`packages/nextclaw-core/src/agent` 目录预算被其它改动顶到硬阈值，导致整条守卫非绿

# 发布/部署方式

本次只涉及 `platform-admin` 前端发布，不涉及平台后端、数据库 migration 或 marketplace worker 重新部署。

发布命令：

- `pnpm deploy:platform:admin`

实际发布结果：

- Cloudflare Pages 预览地址：
  - `https://1c357a2c.nextclaw-platform-admin.pages.dev`
- 自定义正式域名：
  - `https://platform-admin.nextclaw.io`

说明：

- 生产域名 `platform-admin.nextclaw.io` 已返回 `200`
- 远端 UI 冒烟已在正式域名上通过

# 用户/产品视角的验收步骤

1. 打开 `https://platform-admin.nextclaw.io`
2. 确认未登录时可看到“登录管理后台”页面
3. 使用管理员账号登录
4. 登录后确认页面结构已变为经典控制台：
   - 左侧导航
   - 顶部全局栏
   - 中间内容区
5. 在左侧依次进入：
   - `总览`
   - `Marketplace 审核`
   - `用户与额度`
   - `充值审核`
6. 确认 `Marketplace 审核` 页面仍可查看队列、详情、`SKILL.md` 与 `marketplace.json`
7. 确认 `用户与额度` 页面仍可编辑全局免费池和用户额度
8. 确认 `充值审核` 页面仍可查看待处理充值申请

# 可维护性总结汇总

本次是否已尽最大努力优化可维护性：是。

本次是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。虽然本次新增了若干页面文件和一条 smoke 脚本，但这是把“一个继续膨胀的长 dashboard”拆回清晰页面边界的最小必要增长，没有继续把所有区块堆回同一文件。

本次是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：总代码和文件数是净增长，但同步换来了后台信息架构的收敛，`AdminDashboardPage` 不再继续承接所有治理区块；新增文件直接对应稳定模块边界，而不是补丁式 helper 堆叠。

抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰：是。当前边界为：

- `AdminDashboardPage` 只负责控制台壳层与当前页面装配
- `admin-overview-page.tsx` 承接总览与营收 / 上游视图
- `admin-user-quota-page.tsx` 承接额度治理
- `admin-recharge-review-page.tsx` 承接充值审核
- `admin-marketplace-review-section.tsx` 继续承接 Marketplace 审核主体

目录结构与文件组织是否满足当前项目治理要求：本次触达的 `apps/platform-admin/src/pages` 与 `scripts/smoke` 已按最小边界拆分；新增 smoke fixture 已从主脚本抽离，避免把单文件继续顶大。仓库仍存在与本次无关的 `packages/nextclaw-core/src/agent` 目录预算阻塞，本次未触达该目录。

长期目标对齐 / 可维护性推进：

- 这次改动顺着 NextClaw “统一入口、统一控制面”的长期方向前进了一小步，让平台治理能力从“能用但像临时工具页”升级为正式控制台入口。
- 这次顺手推进的维护性改进，是把单页平铺结构拆成稳定页面边界，并为后台补上独立 smoke 命令，避免后续继续在同一文件和同一手工验收路径里堆复杂度。

可维护性复核结论：保留债务经说明接受

本次顺手减债：是

no maintainability findings

代码增减报告：

- 新增：227 行
- 删除：705 行
- 净增：-478 行

非测试代码增减报告：

- 新增：210 行
- 删除：705 行
- 净增：-495 行

可维护性总结：

- 本次虽然新增了几个稳定页面文件和一条 smoke fixture，但总体上反而减少了代码量，原因是旧的平铺式 `AdminDashboardPage` 被显著收缩，页面职责被拆回了稳定边界。
- 当前保留债务不是这次实现本身，而是仓库内其它工作把 `packages/nextclaw-core/src/agent` 目录预算推到了硬阈值，导致守卫未全绿。
- 后续若后台继续扩模块，优先继续沿当前页面边界扩展，而不是把 `总览` 再次堆成超长页。

# NPM 包发布记录

不涉及 NPM 包发布。
