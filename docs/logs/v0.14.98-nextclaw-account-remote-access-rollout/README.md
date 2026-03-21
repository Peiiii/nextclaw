# v0.14.98-nextclaw-account-remote-access-rollout

相关方案：

- [账号登录与远程访问产品设计](../../plans/2026-03-21-nextclaw-account-and-remote-access-product-design.md)
- [远程访问整体执行计划](../../plans/2026-03-21-nextclaw-remote-access-overall-execution-plan.md)

## 迭代完成说明

- 在 `nextclaw-ui` 引入全局 `AppPresenter`，新增账号 `store/manager/panel`，把 NextClaw 账号登录抽成可被全局唤起的基础能力。
- 重写远程访问页面，默认只暴露账号登录、开启/关闭远程访问、设备状态、设备名和 `NextClaw Web` 入口；服务控制、平台 API Base、诊断结果全部下沉到“高级设置”。
- 在设置侧边栏新增统一账号入口，已登录时展示账号邮箱，未登录时展示“登录 NextClaw”态。
- 调整 `platform-console` 用户设备页文案，把开发者命令口径改成普通用户口径，按钮改为“在网页中打开”。
- 更新 `nextclaw` 打包产物中的 `ui-dist`，确保 CLI/UI 分发包内也带上新的远程访问体验。

## 测试/验证/验收方式

- 代码校验：
  - `pnpm -C packages/nextclaw-ui tsc`
  - `pnpm -C packages/nextclaw-ui build`
  - `pnpm -C packages/nextclaw-ui lint`
  - `pnpm -C apps/platform-console tsc`
  - `pnpm -C apps/platform-console build`
  - `pnpm -C apps/platform-console lint`
  - `pnpm -C packages/nextclaw build`
- 运行态冒烟：
  - 在隔离目录启动临时实例：
    - `NEXTCLAW_HOME=/tmp/nextclaw-remote-access-smoke node packages/nextclaw/dist/cli/index.js serve --ui-port 18821`
  - 验证远程状态接口：
    - `curl -s http://127.0.0.1:18821/api/remote/status`
  - 验证页面真实渲染：
    - 使用 Playwright 打开 `http://127.0.0.1:18821/remote`
    - 观察点：页面包含 `Remote Access/远程访问`、`NextClaw Web`、`登录并开启远程访问/Sign In and Enable Remote Access`
- 说明：
  - `packages/nextclaw-ui lint` 存在仓库历史告警，但本次改动未新增新的 lint error。

## 发布/部署方式

- NPM 发布：
  - 新增 changeset，覆盖 `@nextclaw/ui` 与 `nextclaw`
  - 执行 `pnpm release:version`
  - 执行 `pnpm release:publish`
- 平台部署：
  - 本次仅前端文案与交互改动，后端与数据库无变更，`platform:db:migrate:remote` 不适用
  - 执行 `pnpm deploy:platform:console`
- 提交：
  - 仅提交本次改动文件，避开工作区内其它无关脏改动

## 用户/产品视角的验收步骤

1. 打开桌面端设置页，能在侧边栏底部看到 `NextClaw 账号` 入口；未登录时显示未连接状态，已登录时显示邮箱。
2. 打开“远程访问”页面，默认只看到远程访问开关、设备名、连接状态和 `NextClaw Web` 主入口，不再暴露开发者心智的底层参数。
3. 未登录时点击“登录并开启远程访问”，应拉起浏览器登录；登录完成后，远程访问应自动继续开启，不需要用户再理解 `platform.nextclaw.io` 或手动拼操作步骤。
4. 开启成功后，页面显示“这台设备已经可在网页中打开”，点击 `前往 NextClaw Web` 可进入网页版设备列表。
5. 在网页版设备页中，这台设备会以普通用户可理解的方式出现，点击“在网页中打开”即可继续使用。
