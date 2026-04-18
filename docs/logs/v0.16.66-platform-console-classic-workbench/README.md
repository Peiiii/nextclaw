# 迭代完成说明

本次把用户侧 `platform-console` 从原先的“冷蓝色营销感 + 顶部横向导航 + 内容卡片堆叠”结构，收敛成与 `platform-admin` 同体系的经典用户工作台。

设计方案文档：

- [`docs/plans/2026-04-18-platform-console-classic-workbench-alignment-design.md`](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-18-platform-console-classic-workbench-alignment-design.md)

本次最终交付结果：

- `apps/platform-console`
  - 新增 `ConsoleShell`、`ConsolePage` 等用户侧框架组件，统一为固定左侧导航、固定顶部栏、内容区独立滚动的经典工作台骨架
  - 新增 `user-console-navigation.ts`，把用户入口明确收敛成：
    - `我的实例`
    - `账号`
  - 新增 `user-account-page.tsx`，把账号设置从首页长卡片中独立成稳定页面
  - `App.tsx` 改为基于当前 pathname 装配用户工作台壳层，而不再用顶部横向按钮模拟路由
  - `UserDashboardPage.tsx` 重排为经典工作台首页：
    - 顶部摘要指标卡
    - Remote 额度面板
    - 我的实例工作台
    - 用量与充值占位面板
  - `LoginPage.tsx` 与 `SharePage.tsx` 的视觉统一到 NextClaw 暖中性色 + olive brand 语言
  - `button/card/input/table`、`LocaleSwitcher`、`index.css`、`tailwind.config.js` 全部对齐到与 `platform-admin` 同一套基础视觉体系
- `scripts/smoke/platform-console-smoke.mjs`
  - 将断言更新为新的工作台壳层和新首页结构
- `apps/platform-console/README.md`
  - 更新为当前经典用户工作台结构说明和 UI 冒烟命令

# 测试/验证/验收方式

已执行：

- `pnpm -C apps/platform-console tsc`
- `pnpm -C apps/platform-console lint`
- `pnpm -C apps/platform-console build`

本地 UI 冒烟：

1. 启动本地预览：
   - `pnpm -C apps/platform-console preview --host 127.0.0.1 --port 4173 --strictPort`
2. 执行：
   - `PLATFORM_CONSOLE_BASE_URL=http://127.0.0.1:4173 pnpm smoke:platform:console`
3. 结果：
   - 返回 `[platform-console-smoke] passed for http://127.0.0.1:4173`
   - 覆盖首页、账号页、远程打开、分享、归档、恢复、删除、语言切换与登录页

线上验证：

- `curl -I https://platform.nextclaw.io`
- `PLATFORM_CONSOLE_BASE_URL=https://platform.nextclaw.io pnpm smoke:platform:console`

结果：

- `https://platform.nextclaw.io` 返回 `HTTP/2 200`
- 线上冒烟返回 `[platform-console-smoke] passed for https://platform.nextclaw.io`

治理守卫：

- `pnpm lint:maintainability:guard`

结果：

- 本次 `platform-console` 改动没有新增维护性守卫错误
- 当前整条守卫仍为非绿，但阻塞点来自仓库内其它并行改动，而不是本次用户工作台重构本身
- 当前可见的无关阻塞包括：
  - `packages/nextclaw-core/src/agent` 目录预算越线
  - `packages/nextclaw-ui/src/components/config/ProviderForm.tsx` 缺少热点债务记录
- 本次范围内的关注点是：
  - `apps/platform-console/src/pages/UserDashboardPage.tsx` 仍接近文件预算上限，但已顺手把首页摘要条抽成独立组件，避免继续膨胀

# 发布/部署方式

本次只涉及 `platform-console` 前端发布，不涉及平台后端、数据库 migration 或管理后台重复发布。

发布命令：

- `pnpm deploy:platform:console`

实际发布结果：

- Cloudflare Pages 部署地址：
  - `https://92ab660b.nextclaw-platform-console.pages.dev`
- 自定义正式域名：
  - `https://platform.nextclaw.io`

说明：

- 自定义域名已正常返回 `200`
- 正式域名上的线上 UI 冒烟已通过

# 用户/产品视角的验收步骤

1. 打开 `https://platform.nextclaw.io`
2. 确认未登录时看到的是暖中性色登录页，而不是旧的冷蓝营销感布局
3. 登录后确认整体结构已变成经典用户工作台：
   - 左侧固定导航
   - 顶部固定全局栏
   - 中间内容区独立滚动
4. 确认左侧只保留：
   - `我的实例`
   - `账号`
5. 在 `我的实例` 页确认第一屏是摘要指标卡，而不是旧的大块卡片拼接
6. 确认 `Remote 额度与用量`、实例工作台、分享面板和 `用量与充值` 占位模块仍可正常展示
7. 进入 `账号` 页，确认用户名设置、个人发布 scope、网页地址和 CLI 兜底命令都还在
8. 通过分享 / 打开实例 / 归档 / 恢复 / 删除等动作确认原有能力仍可继续使用

# 可维护性总结汇总

本次是否已尽最大努力优化可维护性：是。

本次是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。本次没有继续在旧首页上叠加新壳层，而是直接删除顶部横向导航式装配，改成稳定的工作台骨架；账号页面也没有继续挤在首页里，而是拆成明确路由页面。

本次是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：总代码会有小幅净增长，因为此前用户平台根本没有独立工作台壳层和页面级框架组件；这部分增长已经压到最小必要范围，主要用于补齐此前不存在的壳层、导航和复用组件。

抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰：是。

- `ConsoleShell` 负责用户工作台骨架
- `ConsolePage` 负责页面标准容器
- `user-console-navigation.ts` 负责用户工作台导航描述
- `UserDashboardPage.tsx` 承接首页工作台内容
- `UserAccountPage.tsx` 承接账号入口

目录结构与文件组织是否满足当前项目治理要求：本次触达范围内满足。新增的 `apps/platform-console/src/components/console` 与 `apps/platform-console/src/pages` 角色边界清晰，没有继续把壳层逻辑和页面内容混在 `App.tsx` 里。

长期目标对齐 / 可维护性推进：

- 这次改动顺着 NextClaw “统一入口、统一控制面、统一体验”的长期方向推进了一步，让用户平台和管理后台第一次有了清晰的一致性。
- 这次最关键的维护性推进，不是新增业务功能，而是把用户平台从“单页拼装 UI”收敛成稳定工作台模板，降低后续继续长歪、继续分裂设计语言的概率。

可维护性复核结论：保留债务经说明接受

本次顺手减债：是

no maintainability findings

代码增减报告：

- 新增：808 行
- 删除：190 行
- 净增：618 行

非测试代码增减报告：

- 新增：808 行
- 删除：190 行
- 净增：618 行

可维护性总结：

- 这次真正收敛的是用户平台的框架层，不是只给旧页面换了一层颜色。
- 当前保留债务主要来自仓库里其它并行改动触发的守卫错误；本次范围内最大的 watchpoint 是 `UserDashboardPage.tsx` 仍然接近预算上限，后续再扩功能时应优先继续拆稳定子块，而不是继续把首页做大。
- 新增代码主要是此前不存在的工作台骨架和页面边界，已经尽量压缩到本次交付所需的最小必要量。

# NPM 包发布记录

不涉及 NPM 包发布。
