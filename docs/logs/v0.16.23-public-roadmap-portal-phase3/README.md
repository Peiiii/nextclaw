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
  - 这次还继续修复了上一版收尾带来的回归：由于把 `max-content` 和 `fr` 列宽组合在一起，导致每列被算得过宽，视觉上只剩接近单列。现已改回固定列宽的多列 board，在保留局部横向滚动的同时恢复多列看板效果。
  - 该修复已重新部署到 Cloudflare Worker：
    - 当前 live 版本：`695d15de-20fe-46a7-b846-768a2ba00d2c`
- 同批次继续推进了一版“公开产品进展门户”信息架构重构：
  - 在 [`overview-section.tsx`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/src/features/overview/components/overview-section.tsx) 把首屏从纯标题 + 数据卡升级为“方向说明 + 三个入口卡”：
    - `查看路线图`
    - `参与反馈`
    - `看最近交付`
  - 新增 [`portal-section-nav.tsx`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/src/shared/components/portal-section-nav.tsx)，提供 sticky 模块导航：
    - `方向总览`
    - `产品路线图`
    - `社区反馈`
    - `近期交付`
  - 在 [`panel.tsx`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/src/shared/components/panel.tsx) 给各主模块开放 `id`，让模块导航和首屏入口可以直接跳转到对应模块。
  - 在 [`app.tsx`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/src/app/app.tsx) 把门户导航提升为全局一级结构，而不是继续让用户只能靠长滚动寻找模块。
  - 在 [`index.css`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/src/index.css) 加入平滑滚动、scroll margin、首屏入口卡和 sticky nav 的门户化样式，让用户在首屏就知道页面不止一个模块。
  - 最后又把导航行为进一步校准成“原位出现，到顶部阈值后再吸顶”的吊顶式导航，而不是一开始就固定悬浮；同时把横向裁剪从 `portal-shell` 移到 `body`，避免 sticky 约束容器错误导致导航无法吸顶。
  - 该门户导航版本已重新部署到 Cloudflare Worker：
    - 当前 live 版本：`4abe8e46-b652-46a3-a9d7-12db0341f0f1`
- 同批次继续把门户节奏收成“模块级一屏体验”：
  - 在 [`roadmap-section.tsx`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/src/features/roadmap/components/roadmap-section.tsx)、[`community-feedback-section.tsx`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/src/features/community-feedback/components/community-feedback-section.tsx) 和 [`updates-section.tsx`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/src/features/updates/components/updates-section.tsx) 为路线图、社区反馈、近期交付三大模块补齐统一的 `portal-stage-panel` / `portal-stage-panel__body` 骨架。
  - 在 [`index.css`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/src/index.css) 把桌面端模块明确收成接近一屏的固定 panel：
    - `Roadmap` 模块头部和筛选保留在上方，事项内容区改为模块内滚动
    - `Community` 模块左侧表单保持独立布局，右侧“社区声音”线程列表改为内部滚动
    - `Updates` 模块标题保留在上方，timeline 列表改为内部滚动
  - 同时保留移动端降级策略：手机与窄屏下不强行做一屏模块，而是恢复自然长页面，避免出现难用的嵌套滚动体验。
  - 这次修正解决的是更本质的节奏问题：此前虽然已有门户导航，但后 3 个模块仍会被长列表继续撑高，用户很容易滚很久才意识到页面还有后续模块；现在桌面端每个主模块都更像一个独立页面，真正长的内容被收回到模块内部。
  - 该布局版本已重新部署到 Cloudflare Worker：
    - 当前 live 版本：`d274ed33-3745-4dc0-b8d9-116927b4d079`
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
    - 线上 Playwright 多列专项冒烟通过：`live-board-multi-column-smoke: ok`
  - 本地多列专项验证：
    - 在 `1600px` 视口下确认 board 至少可同时看到 `4` 列
    - 在 `1280px` 视口下确认 board 至少可同时看到 `3` 列
    - 同时确认文档、panel 与 scroller 都没有再次超出视口右边界
  - 本地门户导航专项验证：
    - 确认首屏出现 `查看路线图 / 参与反馈 / 看最近交付`
    - 确认 sticky 导航出现 `方向总览 / 产品路线图 / 社区反馈 / 近期交付`
    - 点击 `社区反馈` 后，对应模块会进入可视区
    - 点击 `近期交付` 后，对应模块会进入可视区
    - 验证结果：`portal-nav-smoke: ok`
  - 本地吸顶阈值专项验证：
    - 首屏时导航仍处于原始布局位置，不会一开始就悬浮
    - 向下滚动后，导航会在顶部阈值附近吸住
    - 点击锚点后，目标模块不会被吸顶导航遮挡
    - 验证结果：`sticky-threshold-nav-smoke: ok`
  - 本地一屏模块布局专项验证：
    - 在 `1440x1100` 视口下确认 `Roadmap / Community / Updates` 三个主模块都被收成接近一屏的 panel，高度不再继续被长列表撑高
    - 确认 `.roadmap-panel__body` 会在桌面端接管纵向滚动，路线图列表不会再把整个文档无限拉长
    - 确认 `.community-panel__thread-list` 会在桌面端接管线程列表滚动，左侧建议表单保持独立布局
    - 确认 `.updates-timeline` 作为内部 scroll 区存在，已交付列表不会把整个模块继续拉长
    - 在 `390x844` 视口下确认上述内部滚动容器全部回退为自然文档流
    - 验证结果：`portal-fullpage-section-smoke: ok`
  - 线上一屏模块布局专项验证：
    - 访问 `https://roadmap.nextclaw.io`
    - 确认主域名已经返回新资源：`index-DULzvzP5.css` / `index-LVAHr0p7.js`
    - 在 `1440x1100` 视口下确认 `Roadmap / Community / Updates` 三个主模块都保持接近一屏
    - 在 `390x844` 视口下确认内部滚动容器都回退为自然文档流
    - 验证结果：`live-portal-fullpage-section-smoke: ok`
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
  - `curl -I https://roadmap.nextclaw.io` 返回 `HTTP/2 200`
  - `curl https://roadmap.nextclaw.io/api/overview` 返回 `mode=live`，官方事项仍为 `59`
  - 线上吸顶导航专项冒烟通过：`live-sticky-threshold-nav-smoke: ok`
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
9. 在桌面端浏览门户时，`产品路线图`、`社区反馈`、`近期交付` 三个模块都应各自接近一整屏；用户滚到模块内时，真正变长的应该是该模块自己的列表区，而不是整页继续被单个模块拖着走。
10. 在移动端浏览门户时，不应出现强制一屏模块造成的怪异嵌套滚动；页面应恢复自然纵向浏览体验。

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
  - 这次回归修复进一步说明了为什么边界修正和列宽策略要分开治理：父容器负责约束 `100%` 边界，board 自己负责稳定列宽；两者职责分清后，既不会超屏，也不会退化成单列。
  - 这轮“进展门户化”信息架构新增是有意识的最小必要集合：没有引入新的状态层、router、tab 系统或额外查询逻辑，而是优先复用现有模块，只补了入口卡、sticky nav 和锚点边界。按当前 diff 单独看，本轮增量约为 `新增 239 行 / 删除 33 行 / 净增 206 行`，主要集中在首屏与导航样式。
  - 这次吸顶行为调整同样控制在最小改动范围内：没有新增脚本或滚动监听，只是利用 CSS sticky 和正确的 overflow 边界来完成“原位 -> 吸顶”的行为，把复杂度留在浏览器原生能力里。
  - 这次一屏模块优化继续沿用了同样的收敛思路：没有引入新的路由、分页、脚本滚动控制或额外状态，而是给三个现有模块补统一的 panel/body 骨架，再把滚动责任重新分配给模块内部。按本轮 diff 单独看，代码约为 `新增 238 行 / 删除 137 行 / 净增 101 行`，且全部集中在既有 section 组件与样式层，没有继续扩大目录或文件面。
  - 当前主要观察点是 [`portal-query.service.ts`](/Users/peiwang/Projects/nextbot/apps/public-roadmap-feedback-portal/server/portal-query.service.ts) 已明显变大；下一步如果继续扩展审核、合并或统计能力，应优先把 engagement 聚合和 thread 组装继续拆出稳定子 owner。
