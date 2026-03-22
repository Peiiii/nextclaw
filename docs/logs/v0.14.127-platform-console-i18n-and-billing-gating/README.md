# v0.14.127 Platform Console I18n And Billing Gating

相关方案文档：[Platform Console 国际化与 Billing 模块收敛方案](/Users/tongwenwen/Projects/Peiiii/nextclaw/docs/plans/2026-03-23-platform-console-i18n-and-billing-split-plan.md)

## 迭代完成说明

- 为 `apps/platform-console` 新增轻量国际化基础设施，包含 locale store、translator service、locale switcher，以及 `zh-CN` / `en-US` 两份 JSON 文案文件。
- 将 `App.tsx`、`LoginPage.tsx`、`SharePage.tsx`、`UserDashboardPage.tsx` 的首批用户可见文案切换为 JSON key 驱动。
- 将用户首页收敛为“实例中心 + 分享管理”，移除 billing 的真实额度、充值、流水透出，改为 `Coming soon / 即将上线` 占位。
- 新增 `scripts/platform-console-i18n-check.mjs` 用于校验双语 key 一致性。
- 新增 `scripts/platform-console-smoke.mjs` 用于验证登录页和用户首页的中英文切换，以及 billing 模块收敛结果。

## 测试/验证/验收方式

- `pnpm -C apps/platform-console build`
- `pnpm -C apps/platform-console lint`
- `pnpm -C apps/platform-console tsc`
- `node scripts/platform-console-i18n-check.mjs`
- `pnpm smoke:platform:console`
- `node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths apps/platform-console/src/App.tsx apps/platform-console/src/pages/LoginPage.tsx apps/platform-console/src/pages/SharePage.tsx apps/platform-console/src/pages/UserDashboardPage.tsx apps/platform-console/src/i18n/i18n.service.ts apps/platform-console/src/i18n/locale.store.ts apps/platform-console/src/components/locale-switcher.tsx scripts/platform-console-i18n-check.mjs scripts/platform-console-smoke.mjs docs/logs/v0.14.127-platform-console-i18n-and-billing-gating/README.md`

## 发布/部署方式

- 本轮仅涉及 `platform-console` 前端与本地验证脚本，不涉及数据库 migration。
- 发布命令：`pnpm deploy:platform:console`
- 线上验收可复用：`PLATFORM_CONSOLE_BASE_URL=https://platform.nextclaw.io pnpm smoke:platform:console`

## 用户/产品视角的验收步骤

1. 打开 `https://platform.nextclaw.io`，默认应能进入登录页，并看到语言切换器。
2. 在登录页切换 `English / 中文`，首页标题、说明、按钮文案应即时切换。
3. 登录后进入用户首页，应看到“我的实例 / My Instances”作为主模块。
4. 首页不应再显示真实额度、充值入口、消费流水等 billing UI。
5. 首页应显示 `Coming soon / 即将上线` 的 billing 占位卡片。
