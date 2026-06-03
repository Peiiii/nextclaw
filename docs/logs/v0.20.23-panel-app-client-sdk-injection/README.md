# v0.20.23 Panel App Client SDK Injection

## 迭代完成说明

本次根据 `docs/designs/2026-06-04-panel-app-client-sdk-injection-design.md` 落地 Panel App 标准 Client SDK 注入链路。

- 保留既有 `window.nextclaw.serviceActions` 与 `window.nextclaw.agent` bridge 链路。
- 新增 `window.nextclaw.client`，在已声明且已授权的 folder Panel App 中同步可用。
- `client` 使用标准 `@nextclaw/client-sdk` 的 `NextClawClient`，不做 API 裁剪、不做 method/endpoint 级授权。
- runtime token 统一作为 Panel App appId 归因凭证，不进入授权模型；`tabId` / iframe instance 不进入新模型。
- 新增 `.panel-app-client-grants.json` 持久化整体 client 授权。
- 新增 `/api/panel-app-client-sdk.js` 供应浏览器 IIFE bundle，并由 service 从安装态 `@nextclaw/client-sdk` 产物读取。
- 更新 Panel App 创建相关 skill，要求 AI 从已安装 NPM 包的类型/声明产物理解 Client SDK 形状，而不是假设能读取仓库源码。

## 测试/验证/验收方式

- `pnpm --dir packages/nextclaw-kernel tsc`
- `pnpm --dir packages/nextclaw-kernel test -- src/managers/__tests__/panel-app.manager.test.ts`
- `pnpm --dir packages/nextclaw-server tsc`
- `pnpm --dir packages/nextclaw-server test -- src/features/panel-apps/controllers/panel-apps.controller.test.ts src/features/service-apps/controllers/service-apps.controller.test.ts`
- `pnpm --dir packages/nextclaw-client-sdk tsc`
- `pnpm --dir packages/nextclaw-client-sdk build`
- `pnpm --dir packages/nextclaw-service tsc`
- `pnpm --dir packages/nextclaw-ui tsc`
- `pnpm --dir packages/nextclaw-ui test -- src/features/panel-apps/managers/panel-app-bridge.manager.test.ts src/features/service-apps/components/service-apps-panel.test.tsx`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- `rg` bundle 自检确认 `packages/nextclaw-client-sdk/dist/browser/browser-global-registration.utils.iife.js` 没有外部 NextClaw workspace import。
- `pnpm release:beta`
- `pnpm install`
- `pnpm pack --pack-destination /tmp/nextclaw-service-pack-test`，验证 `@nextclaw/service` tarball 中 workspace 依赖已解析为具体 beta 版本。
- `pnpm publish --tag beta --no-git-checks`，补发 `@nextclaw/service@0.2.10-beta.0`。
- `pnpm release:verify:published`
- `pnpm release:beta:runtime -- --version 0.21.4-beta.0`
- `npm install -g --prefix /tmp/nextclaw-beta-global-yciYkQ nextclaw@beta`
- `NEXTCLAW_HOME=/tmp/nextclaw-beta-home-GCpyo1 /tmp/nextclaw-beta-global-yciYkQ/bin/nextclaw restart --ui-port 48923 --start-timeout 45000`

## 发布/部署方式

已完成统一 NPM beta 发布。

- 功能提交：`86a0dc8f3 Add panel app client SDK injection`
- beta pre-mode 提交：`785c2fcbc Enter beta prerelease mode`
- release artifact 提交：`14c5730a9 chore: release beta batch`
- 发布入口：`pnpm release:beta`
- runtime channel：已触发 `npm-runtime-update-release` workflow，run `26903875954` 成功。
- runtime release：`nextclaw@0.21.4-beta.0`
- public beta manifest：四个平台均已验证为 `0.21.4-beta.0`，`hostKind = npm-runtime-bundle`。

发布过程中 `@nextclaw/service@0.2.10-beta.0` 第一次 publish 因新增 workspace 依赖尚未安装导致 `ERR_PNPM_CANNOT_RESOLVE_WORKSPACE_PROTOCOL`。已通过 `pnpm install` 修复 workspace 安装态，确认 tarball manifest 正确后补发成功。

## 用户/产品视角的验收步骤

1. 准备一个 folder Panel App，并在 `panel-app.json` 声明 `client: true`。
2. 首次从 Panel App 列表打开时，应触发一次整体 client 授权。
3. 授权成功后，iframe 中业务脚本应能同步读取 `window.nextclaw.client`。
4. 旧 bridge 能力仍可通过 `window.nextclaw.serviceActions` / `window.nextclaw.agent` 使用。
5. 未声明 `client: true` 或未授权的 Panel App 不应获得 injected client。

## 可维护性总结汇总

本次是新增用户能力，生产代码存在净增长。实现中做了以下收敛：

- `PanelAppManager` 保持在 500 行预算内，并将内容解析和 agent bridge 逻辑拆到明确 owner。
- Client SDK 注入逻辑收敛到独立 kernel util，浏览器全局注册收敛到 client-sdk 自身。
- service 侧 SDK 脚本读取工具下沉到 `shared/utils/panel-app-client-sdk/`，避免继续扩大拥挤的 root utils 目录。
- 维护性检查结果为 0 error；剩余 warning 主要是既有目录预算或接近预算文件提醒。
- 最新维护性统计：total `+947 / -273 / net +674`，non-test `+812 / -206 / net +606`。

已使用 `post-edit-maintainability-guard` 和治理检查完成收尾验证。

## NPM 包发布记录

本次已发布全量 public workspace beta batch，其中与本迭代直接相关的包版本包括：

- `@nextclaw/client-sdk@0.2.10-beta.0`
- `@nextclaw/core@0.13.10-beta.0`
- `@nextclaw/kernel@0.3.4-beta.0`
- `@nextclaw/server@0.13.10-beta.0`
- `@nextclaw/service@0.2.10-beta.0`
- `@nextclaw/ui@0.13.10-beta.0`
- `nextclaw@0.21.4-beta.0`

全量 batch 的 47 个 package tags 已推送到 `origin/master`。真实安装验证使用临时 npm prefix 安装 `nextclaw@beta`，`nextclaw --version` 与 `/api/app/meta.productVersion` 均为 `0.21.4-beta.0`。
