# v0.18.86 NPM UI Dist Stale Release Guard

## 迭代完成说明

本次完成 `nextclaw@0.19.14` NPM patch 发布，用于修复 `nextclaw@0.19.12` 已显示新版号但从 NPM 全局安装时仍可能携带旧 UI 功能的问题。

根因是 `nextclaw@0.19.12` 发布包内的 `packages/nextclaw/ui-dist` 没有与当前 `@nextclaw/ui/dist` 构建产物同步。CLI 与页面左上角版本号来自 `nextclaw` 包版本和 `/api/app/meta.productVersion`，因此可以显示 `0.19.12`；但浏览器实际加载的 JS/CSS 静态资源仍是旧 `ui-dist`，导致功能表现落后于版本号。

根因确认方式：
- 对比线上 NPM 包 tarball 与本地当前 UI 构建产物，发现 `nextclaw@0.19.12` 包内 asset hash 与当前 UI 构建不一致。
- 隔离安装 `nextclaw@latest` 后读取包内 `ui-dist/index.html`，确认修复后的 `0.19.14` 已指向新 asset。
- 用隔离 `NEXTCLAW_HOME` 启动 `nextclaw serve`，确认 `/api/app/meta` 返回 `productVersion: 0.19.14`，页面入口加载同一组新 asset。

修复不是只改版本号，而是重新构建并同步 `@nextclaw/ui/dist -> packages/nextclaw/ui-dist`，再给发布校验脚本增加 `nextclaw` 专属防呆：发布前比较源 UI `dist/index.html` 与打包 UI `ui-dist/index.html`，不一致时阻断 prepack。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui build`
- `pnpm -C packages/nextclaw build`
- `pnpm -C packages/nextclaw tsc`
- `pnpm -C packages/nextclaw lint`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-ui test src/platforms/desktop/components/desktop-app-shell.test.tsx`
- `pnpm exec eslint scripts/release/verify-package-release-artifacts.mjs packages/nextclaw-ui/src/platforms/desktop/components/desktop-app-shell.tsx packages/nextclaw-ui/src/platforms/desktop/components/desktop-app-shell.test.tsx`
- `pnpm release:check`
- `pnpm release:check-readmes && pnpm release:check:groups`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`
- 隔离前缀安装 `nextclaw@latest`，确认 `nextclaw --version` 为 `0.19.14`，包内 `ui-dist/index.html` 指向 `assets/index-Cuwst6cc.js` 与 `assets/index-dlcqieQ0.css`。
- 隔离 `NEXTCLAW_HOME` 启动 `nextclaw serve --ui-port 55914`，确认 `/api/app/meta` 为 `0.19.14` 且入口资源为同一组新 asset。

已知验证缺口：
- `pnpm -C packages/nextclaw-ui lint` 仍被既有无关 lint 存量问题阻塞；本次触达文件的定向 eslint 已通过。

## 发布/部署方式
- `pnpm release:publish`
- `npm view nextclaw dist-tags --json`
- 隔离环境真实安装 `npm install --prefix <tmp> nextclaw@latest`

不涉及数据库 migration、后端服务 deploy 或远程 API 冒烟。本次问题位于 NPM 包内置 UI 静态产物与发布检查链路。

未执行 git commit、push、PR 或 runtime update channel 发布。当前用户报告的路径是 `npm i -g nextclaw@latest`，已由 `nextclaw@0.19.14` NPM 包修复；runtime channel 的 `0.19.12` bundle 本身此前已被验证加载正确 UI 资源，不是本次 NPM 包陈旧问题的触发路径。

## 用户/产品视角的验收步骤

1. 运行 `npm i -g nextclaw@latest`。
2. 运行 `nextclaw --version`，应返回 `0.19.14`。
3. 启动或重启 NextClaw。
4. 打开页面，左上角版本应为 `0.19.14`。
5. 确认页面功能与当前新 UI 一致；若浏览器标签页此前已打开，执行一次硬刷新。

## 可维护性总结汇总

- 本次优先通过重新生成并删除旧 `ui-dist` 静态资源来收敛发布产物，没有保留平行旧 bundle。
- 发布防呆集中在既有 `scripts/release/verify-package-release-artifacts.mjs`，没有新增第二套发布脚本或临时检查入口。
- `post-edit-maintainability-guard` 已通过，非功能改动的非测试代码净增为 `0`。
- `lint:new-code:governance` 与 `check:governance-backlog-ratchet` 已通过，文件组织和命名未引入新增治理问题。
- 已使用 `post-edit-maintainability-review` 规则做收尾判断：本次边界清晰，防呆 owner 位于 release artifact verifier，后续发布会在 prepack 阶段更早失败。

## NPM 包发布记录
- 本次需要发布：需要。原因是 `nextclaw@0.19.12` 已经发布到 NPM，无法修改既有 tarball，只能通过 patch 版本把正确 UI 产物交付给 `latest` 用户。
- 已发布包：
  - `nextclaw@0.19.14`
- 未发布包：
  - `@nextclaw/ui` 未发布。本次用户安装路径消费的是 `nextclaw` 主包内置 `ui-dist`，修复面是重新打包并发布 `nextclaw`。
- 当前 registry 状态：
  - `nextclaw@latest` 指向 `0.19.14`
  - `nextclaw@beta` 仍为 `0.18.12-beta.22`
