# v0.16.20-public-roadmap-portal-phase1

## 迭代完成说明

- 新增应用：[`apps/public-roadmap-feedback-portal`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal)
  - 基于 `React + Vite + Hono + Cloudflare Worker` 搭出首个可部署的公开路线图门户。
  - 第一期开启 **只读预览模式**：通过统一公开领域模型和预览数据源，先交付一个可访问、可演示、可继续扩展的公开路线图 MVP。
- 新增共享契约：[`public-roadmap-feedback-portal.types.ts`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/shared/public-roadmap-feedback-portal.types.ts)
  - 把 `publicPhase / type / source / overview / item detail` 等公开语义固定下来。
  - 明确不把 Linear 原始结构直接暴露到公共 API。
- 新增后端只读链路：
  - [`portal.controller.ts`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/server/portal.controller.ts)
  - [`portal-query.service.ts`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/server/portal-query.service.ts)
  - [`portal-preview.config.ts`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/server/portal-preview.config.ts)
  - 提供 `/api/overview`、`/api/items`、`/api/items/:itemId`、`/api/updates`。
- 新增前端展示层：
  - 首页概览
  - 路线图 `board/list` 双视图
  - 已交付更新流
  - 事项详情侧板
- 新增前端 owner 边界：
  - [`portal-presenter.service.tsx`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/src/app/portal-presenter.service.tsx)
  - [`roadmap-view.manager.ts`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/src/managers/roadmap-view.manager.ts)
  - [`item-detail.manager.ts`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/src/managers/item-detail.manager.ts)
  - [`roadmap-view.store.ts`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/src/stores/roadmap-view.store.ts)
  - [`item-detail.store.ts`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/src/stores/item-detail.store.ts)
- 根脚本新增：
  - `dev:public-roadmap:portal`
  - `build:public-roadmap:portal`
  - `lint:public-roadmap:portal`
  - `tsc:public-roadmap:portal`
  - `smoke:public-roadmap:portal`
  - `validate:public-roadmap:portal`
  - `deploy:public-roadmap:portal`
- 相关设计文档：
  - [public-roadmap-feedback-portal-design.md](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-14-public-roadmap-feedback-portal-design.md)
  - [public-roadmap-feedback-portal-implementation-plan.md](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-14-public-roadmap-feedback-portal-implementation-plan.md)

## 测试/验证/验收方式

- 已通过：
  - `pnpm build:public-roadmap:portal`
  - `pnpm lint:public-roadmap:portal`
  - `pnpm tsc:public-roadmap:portal`
  - `pnpm smoke:public-roadmap:portal`
  - `pnpm validate:public-roadmap:portal`
  - `pnpm lint:new-code:governance -- apps/public-roadmap-feedback-portal`
- 额外说明：
  - `pnpm lint:maintainability:guard` 的全仓执行被一个**与本次无关的既有工作区改动**阻断：`apps/docs/.vitepress/data/project-pulse.generated.mjs`
  - 针对本次新增应用路径的 diff-only 治理检查已经通过，因此这次第一期自己的代码边界、命名和 owner 治理是干净的。

## 发布/部署方式

- 本地启动：
  - `pnpm dev:public-roadmap:portal`
- 本地构建：
  - `pnpm build:public-roadmap:portal`
- Cloudflare Worker 部署：
  - `pnpm deploy:public-roadmap:portal`
- 当前部署说明：
  - `wrangler.toml` 已配置 `assets` 与 Worker 入口，但第一期仍是 `workers_dev` 模式，未绑定正式自定义域名。

## 用户/产品视角的验收步骤

1. 打开门户首页后，可以立即看到 `公开路线图与产品进展` 的主标题和四张概览卡片。
2. 首屏能看见 `Phase 1 preview data` 提示，明确这是一版只读预览而不是实时 Linear 数据。
3. 在 `公开阶段视图` 区域，用户可以切换 `Board / List`。
4. 用户可以按 `阶段 / 类型 / 排序` 过滤事项。
5. 点击任意事项后，右侧会打开详情侧板，展示公开阶段、事项类型、最近更新、反馈信号与相关事项。
6. 在 `近期已交付` 区域，用户可以看到已进入 `Shipped` 的事项时间线。

## 可维护性总结汇总

- 长期目标对齐 / 可维护性推进：
  - 本次是在往 “统一入口” 的长期方向推进一小步：不是再造一个独立的宣传页，而是先落地一个能承接公开产品脉搏的真实入口。
  - 这次刻意只做 **只读公开路线图 MVP**，没有把 Linear 同步、社区反馈、投票评论、审核后台一口气混进第一期，避免把三个复杂度层面一起耦死。
- 可维护性复核结论：通过
- 本次顺手减债：是
- 代码增减报告：
  - 新增：2315 行
  - 删除：3 行
  - 净增：2312 行
- 非测试代码增减报告：
  - 新增：2315 行
  - 删除：3 行
  - 净增：2312 行
- no maintainability findings
- 本次是否已尽最大努力优化可维护性：是
  - 第一期开工前先冻结了目录与 owner 边界，后续实现都围绕这些边界展开，没有边做边长歪。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是
  - 这次没有顺手塞入写侧反馈、数据库、同步链路和后台界面，而是把第一期严格收缩为只读垂直切片。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：出现净增长，但属于最小必要
  - 原因：这是一个全新应用的首期落地，必须新增最小可运行骨架、共享契约、只读 API、UI 与 smoke。
  - 同步偿还的维护性债务：
    - 把组件强制回收到 `components/` 目录，满足仓库角色治理
    - 把 `zustand` store 收缩为 `snapshot + setSnapshot` 单入口，动作统一回收给 manager
    - 把 presenter 角色收敛进 `app` 内的 service owner，避免生成新的不受治理角色名
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是
  - 后端只有 `controller -> query service -> preview config` 三层。
  - 前端只有 `app service -> manager -> store -> feature components -> shared components`。
  - 没有为了“看起来高级”而额外造 repository、adapter、D1、评论系统等暂时不用的壳层。
- 目录结构与文件组织是否满足当前项目治理要求：满足
  - 本次新增应用目录遵循 `single app root + feature/components + manager/store/service` 边界。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：已执行独立复核
  - 结论：这次增长虽然明显，但已经压到当前阶段的最佳实践最小集；若继续缩减，只能牺牲“可跑的垂直切片”本身，而不是删除多余层。
