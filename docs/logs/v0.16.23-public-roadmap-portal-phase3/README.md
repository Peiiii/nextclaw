# v0.16.23-public-roadmap-portal-phase3

## 迭代完成说明

- 在 [`apps/public-roadmap-feedback-portal`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal) 完成第 3 期“社区反馈闭环”：
  - 新增共享社区契约：[`public-roadmap-feedback-portal.types.ts`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/shared/public-roadmap-feedback-portal.types.ts)
    - 补齐 `FeedbackEntry / FeedbackThread / CommentEntry / CreateFeedbackInput / CreateVoteResponse / CreateCommentResponse`
    - `PublicItemDetail` 现在会显式返回事项评论与关联建议
  - 新增社区数据面：
    - D1 migration：[`0002_community_feedback.sql`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/migrations/0002_community_feedback.sql)
    - repositories：
      - [`feedback-entry.repository.ts`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/server/repositories/feedback-entry.repository.ts)
      - [`comment.repository.ts`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/server/repositories/comment.repository.ts)
      - [`vote.repository.ts`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/server/repositories/vote.repository.ts)
    - 写侧 owner：[`portal-write.service.ts`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/server/portal-write.service.ts)
    - preview owner：
      - [`portal-preview.config.ts`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/server/preview/portal-preview.config.ts)
      - [`portal-preview-state.service.ts`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/server/preview/portal-preview-state.service.ts)
  - 扩展公开 API：
    - `GET /api/feedback`
    - `POST /api/feedback`
    - `POST /api/items/:itemId/votes`
    - `POST /api/items/:itemId/comments`
    - `POST /api/feedback/:feedbackId/votes`
    - `POST /api/feedback/:feedbackId/comments`
  - 前端新增社区反馈域：
    - presenter manager / store：
      - [`community-feedback.manager.ts`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/src/managers/community-feedback.manager.ts)
      - [`community-feedback.store.ts`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/src/stores/community-feedback.store.ts)
    - 交互界面：
      - [`community-feedback-section.tsx`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/src/features/community-feedback/components/community-feedback-section.tsx)
      - [`feedback-thread-card.tsx`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/src/features/community-feedback/components/feedback-thread-card.tsx)
      - [`item-detail-panel.tsx`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/src/features/item-detail/components/item-detail-panel.tsx)
      - [`comment-composer.tsx`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/src/shared/components/comment-composer.tsx)
  - 用户现在可以：
    - 提交公开建议
    - 给官方事项点赞和评论
    - 给社区建议点赞和评论
    - 在官方事项详情里直接看到关联建议
- 同批次收尾继续完成了真实 live 落地：
  - 创建远端 D1：`nextclaw-public-roadmap-portal`
  - 远端应用 migration：
    - `0001_public_roadmap_portal.sql`
    - `0002_community_feedback.sql`
  - 用真实 Linear `NC` team 数据完成首次远端同步，共写入 `59` 条官方事项和 `59` 条 source links
  - Cloudflare Worker 已部署到：
    - `https://nextclaw-public-roadmap-feedback-portal.15353764479037.workers.dev`
  - 当前 Worker live 配置：
    - `PUBLIC_ROADMAP_FEEDBACK_PORTAL_DATA_MODE=live`
    - `PUBLIC_ROADMAP_FEEDBACK_PORTAL_LINEAR_TEAM_KEY=NC`
    - `PUBLIC_ROADMAP_FEEDBACK_PORTAL_LINEAR_PUBLIC_LABELS=all`
  - 当前对外主入口已切到自定义域名：
    - `https://roadmap.nextclaw.io`
    - 备用入口仍保留：`https://nextclaw-public-roadmap-feedback-portal.15353764479037.workers.dev`
  - 当前 live 版本：
    - `19b9b097-231c-4153-a220-67ccb8e0702a`
  - 门户静态入口元信息已对齐主域名：
    - `canonical=https://roadmap.nextclaw.io`
    - `og:url=https://roadmap.nextclaw.io`
  - 补强 Linear provider：
    - 改为根级 `issues` 分页查询，避免 team issues 嵌套查询在真实工作区触发 complexity 超限
    - 支持显式 `all/*` 语义，在当前 team 没有 `public` 标签时也能同步全量公开事项
- 目录治理同步优化：
  - 把 preview 和 community 内部类型收进子目录，避免 `server/` 顶层继续越过维护性预算。
- 同批次验收修正继续补了一处公开路线图 UI 问题：
  - 修复 `Board` 视图在较窄屏幕或中等桌面宽度下把整页撑出屏幕、导致内容看不完整的问题。
  - 当前做法是在 [`roadmap-board.tsx`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/src/features/roadmap/components/roadmap-board.tsx) 增加局部横向滚动容器，并在 [`index.css`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/src/index.css) 把溢出约束收回 board 自身，而不是让整页产生横向超屏。
  - 后续又继续修正了一次真正的根因：把 [`portal-shell__content`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/src/index.css)、[`.panel`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/src/index.css) 和 `roadmap-board-scroller` 的宽度边界都锁到 `100%` 以内，避免 board 把父容器一起撑宽后再被外层裁掉，造成“只能看到左半部分”的问题。
  - 该修复已重新部署到 Cloudflare Worker：
    - 当前 live 版本：`685b20e7-6eb1-4642-b0e6-fe73279709e7`
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
  - 本地 Playwright 布局专项冒烟：
    - 在 `1280px` 视口下确认文档宽度不再超过视口宽度
    - 在 `390px` 视口下确认文档宽度不再超过视口宽度
    - 确认 `Board` 视图的横向溢出被限制在局部 board 容器内，而不是扩散到整页
    - 在 `1600px / 1280px / 390px` 三组视口下确认：
      - `.portal-shell__content` 没有被 board 撑出视口
      - `.roadmap-panel` 没有被 board 撑出视口
      - `.roadmap-board-scroller` 没有超出父容器右边界
      - board 的超宽只存在于局部 scroller 内部
  - 线上发布后验证：
    - `pnpm deploy:public-roadmap:portal`
    - `curl -I https://roadmap.nextclaw.io` 返回 `HTTP/2 200`
    - `curl https://roadmap.nextclaw.io/api/overview` 返回 `mode=live`，官方事项仍为 `59`
    - 线上 Playwright 宽度专项冒烟通过：`live-board-width-smoke: ok`
- 已通过的 live/部署侧验证：
  - `pnpm -C apps/public-roadmap-feedback-portal db:migrate:remote`
  - `linear auth whoami`
  - 使用真实 Linear token + `NC` team key 本地验证 provider 拉取成功，共 `59` 条事项
  - 远端 D1 验证：
    - `SELECT name FROM sqlite_master WHERE type='table'`
    - `SELECT name FROM d1_migrations`
    - `SELECT COUNT(*) FROM item_source_links WHERE provider = 'linear'` 返回 `59`
    - `SELECT title, public_phase, item_type FROM public_items WHERE source = 'linear' ORDER BY updated_at DESC LIMIT 5`
  - `pnpm -C apps/public-roadmap-feedback-portal run deploy`
  - `curl -I https://roadmap.nextclaw.io`
  - `curl https://roadmap.nextclaw.io/api/overview`
  - `curl 'https://roadmap.nextclaw.io/api/items?sort=recent&view=board'`
  - `curl https://roadmap.nextclaw.io/api/feedback`
  - Playwright 浏览器侧只读冒烟：
    - 访问 `https://roadmap.nextclaw.io`
    - 确认页面渲染出 `公开路线图与产品进展`
    - 确认页面渲染出 `社区建议与反馈`
    - 确认页面渲染出真实 Linear 事项：`NextClaw Apps`
    - 确认页面渲染出真实 Linear 事项：`有时候发了第一条消息后就被吞了`
- 冒烟覆盖的真实链路：
  - 打开首页并确认预览模式与社区反馈区可见
  - 提交一条新的公开建议并关联官方事项
  - 给该建议点赞并发表评论
  - 打开关联官方事项详情，确认建议联动可见
  - 给官方事项点赞并发表评论
- 全仓 `pnpm lint:maintainability:guard` 本次未能完整通过，但阻断原因已经确认与本次无关：
  - 当前工作区里已有他人/既有变更触发的文档命名问题：`docs/logs/v0.16.22-desktop-windows-startup-seed-metadata/GITHUB_RELEASE.md`
  - 与本次相关的新增应用子树治理和目录预算问题已修正，`apps/public-roadmap-feedback-portal` 自身的 diff-only 治理检查已通过。

## 发布/部署方式

- 本地开发：
  - `pnpm dev:public-roadmap:portal`
- 本地构建：
  - `pnpm build:public-roadmap:portal`
- 本地验证：
  - `pnpm validate:public-roadmap:portal`
- D1 migration：
  - `pnpm -C apps/public-roadmap-feedback-portal db:migrate:local`
  - `pnpm -C apps/public-roadmap-feedback-portal db:migrate:remote`
- Cloudflare Worker 部署：
  - `pnpm deploy:public-roadmap:portal`
  - 当前线上主域名：`https://roadmap.nextclaw.io`
  - 当前备用域名：`https://nextclaw-public-roadmap-feedback-portal.15353764479037.workers.dev`
- live mode 说明：
  - 官方路线图当前已走 `PUBLIC_ROADMAP_FEEDBACK_PORTAL_DATA_MODE=live + D1 + Linear sync`
  - 社区建议、评论、投票在 live mode 下写入 D1
  - 当前公开策略为 `PUBLIC_ROADMAP_FEEDBACK_PORTAL_LINEAR_PUBLIC_LABELS=all`，即先公开 `NC` team 的全部事项；后续如果你想收敛到标签白名单，只需把它改回具体标签列表并重新同步
  - preview mode 仍保留给本地开发与演示

## 用户/产品视角的验收步骤

1. 打开门户首页后，确认能看到 `公开路线图与产品进展`、`社区建议与反馈` 和预览模式提示。
2. 在“提交一个建议”表单里输入标题、类型、描述，必要时关联一个官方事项，然后提交。
3. 新建议应立即出现在社区反馈列表中，并可继续被点赞和评论。
4. 点击某个官方事项进入详情侧板后，应能看到：
   - 该事项的支持数、评论数、关联建议数
   - 该事项已有评论
   - 已关联到该事项的社区建议
5. 在事项详情里继续评论或点赞后，页面应刷新出最新信号。
6. 把环境切到 `live` 并执行 D1 migration 后，社区建议、评论、投票应持久化到 D1，而不是只存在 preview 内存态。
7. 当前版本已经接入 `NC` team 的真实 Linear 事项；至少可以在远端 D1 中确认 `59` 条官方事项已存在。
8. 通过 `https://roadmap.nextclaw.io/api/overview` 或首页 UI，应能看到真实事项，例如 `NextClaw Apps`、`有时候发了第一条消息后就被吞了`。

## 可维护性总结汇总

- 长期目标对齐 / 可维护性推进：
  - 这期不是单纯给路线图页加几个按钮，而是把“官方进展 + 外部反馈”统一进同一个公开入口，向 NextClaw 的统一入口目标推进了一步。
  - 同时仍然坚持“官方执行系统”和“社区互动数据面”分离，不把 Linear 直接变成公开评论系统，保持后续替换数据源和扩展反馈治理的空间。
- 可维护性复核结论：通过
- 本次顺手减债：是
- 代码增减报告：
  - 新增：2352 行
  - 删除：105 行
  - 净增：2247 行
- 非测试代码增减报告：
  - 新增：2318 行
  - 删除：95 行
  - 净增：2223 行
- no maintainability findings
- 可维护性总结：
  - 这次净增长属于新增能力的最小必要集合，但已经提前做了两笔关键减债：一是把 preview / community 责任压回子目录，二是把写侧逻辑收进 `PortalWriteService`，没有让评论、投票、建议提交流入 controller 或 React 组件。
  - 收尾阶段又顺手偿还了一笔真实环境债务：把 Linear provider 改成分页根查询，并加入显式 `all/*` 策略，不再把“有 `public` 标签”写死成唯一可运行路径。
  - 这次域名收尾没有继续引入新的业务层抽象，只是在现有 Worker 配置上补一条清晰的 custom domain route，并把页面 canonical / `og:url` 与主入口统一，保持部署入口单一、可预测。
  - 这次 board 超屏修复也保持了同样的收敛思路：只增加一个局部滚动容器，不改公开阶段模型、不新增状态或脚本，把溢出边界收回到组件本身，没有把复杂度转移到别的层。
  - 第二次修正又把问题继续收敛到了更本质的边界层：没有引入新的布局模式，只是把内容容器、panel 和 scroller 的最大宽度显式锁死，让“谁负责裁剪、谁负责滚动”重新变得清晰可预测。
  - 当前主要观察点是 [`portal-query.service.ts`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/server/portal-query.service.ts) 已明显变大；下一步如果继续扩展审核、合并或统计能力，应优先把 engagement 聚合和 thread 组装继续拆出稳定子 owner。
