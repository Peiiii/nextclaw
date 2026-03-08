# v0.12.43-admin-console-independent-site

## 1) 迭代完成说明（改了什么）

本次将管理后台从用户前端中彻底拆分为独立站点，实现“admin 独立前端网站”。

- 新增独立管理站：`apps/platform-admin`
  - 独立 Vite 应用、独立页面标题（`NextClaw Admin Console`）
  - 独立登录页（管理后台登录语义）
  - 仅展示管理能力页面（平台总览、用户调账、充值审核）
  - 非 admin 登录时显示“仅管理员可访问”，不再降级为用户页面
- 用户站点 `apps/platform-console` 调整
  - 删除“管理后台”入口与 tab 切换逻辑
  - 只保留用户前端能力（账单、充值申请、流水）
- 根目录 `pnpm` 命令补齐
  - 新增：
    - `dev:platform:admin`
    - `dev:platform:admin:stack`
    - `dev:platform:admin:stack:migrate`
  - `build/lint/tsc` 已纳入 `apps/platform-admin`
- 一键联启脚本增强：`scripts/dev-platform-runner.mjs`
  - 支持 `--admin` 模式，启动独立管理站
  - 输出区分 `Frontend (user/admin)`

## 2) 测试/验证/验收方式

- 工程验证
  - `pnpm -C apps/platform-console build && pnpm -C apps/platform-console lint && pnpm -C apps/platform-console tsc`
  - `pnpm -C apps/platform-admin build && pnpm -C apps/platform-admin lint && pnpm -C apps/platform-admin tsc`
  - `node scripts/dev-platform-runner.mjs --check`
  - `node scripts/dev-platform-runner.mjs --admin --check`
- 冒烟验证（隔离目录）
  - 用户站：`pnpm dev:platform:stack:migrate` 后访问用户站端口，页面 title 为 `NextClaw Platform Console`
  - 管理站：`pnpm dev:platform:admin:stack` 后访问管理站端口，页面 title 为 `NextClaw Admin Console`
  - 结论：用户/管理两站可独立启动并独立访问

## 3) 发布/部署方式

- 用户站发布
  1. `pnpm -C apps/platform-console build`
  2. 发布 `apps/platform-console/dist`
- 管理站发布
  1. `pnpm -C apps/platform-admin build`
  2. 发布 `apps/platform-admin/dist`
- 平台后端（如有变更）
  1. `pnpm platform:db:migrate:remote`
  2. `pnpm -C workers/nextclaw-provider-gateway-api deploy`

## 4) 用户/产品视角的验收步骤

1. 执行 `pnpm dev:platform:stack:migrate`，打开用户站，确认只看到用户能力，无“管理后台”入口。
2. 执行 `pnpm dev:platform:admin:stack`，打开管理站，确认是独立站点。
3. 使用非 admin 账号登录管理站，确认被拒绝访问（仅管理员可访问）。
4. 使用 admin 账号登录管理站，确认可进入管理能力页面。
