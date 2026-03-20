# v0.14.89-nextclaw-ui-dist-pack-guard

## 迭代完成说明

- 修复 `packages/nextclaw/scripts/copy-ui-dist.mjs`：不再允许在 `@nextclaw/ui` 的构建产物缺失或不完整时“跳过复制”，改为直接失败，并校验 `index.html` 与 `assets/` 是否齐全，避免把残缺的 `ui-dist` 发布到 npm。
- 修复 `packages/nextclaw/src/cli/commands/service.ts`：`nextclaw start` 在检测不到前端静态资源时不再继续启动一个注定返回 404 的后台服务，而是直接给出明确错误。
- 排查确认 npm registry 上 `nextclaw@0.13.13` 的 tarball 缺少 `ui-dist/index.html` 与 `ui-dist/assets/*`，本次修复用于阻断同类坏包再次发布。

## 测试/验证/验收方式

- 执行 `pnpm -C packages/nextclaw build`
- 执行 `pnpm -C packages/nextclaw lint`
- 执行 `pnpm -C packages/nextclaw tsc`
- 执行 `npm view nextclaw version dist.tarball`，确认线上最新版为 `0.13.13` 并定位到对应 tarball。
- 执行 `npm pack nextclaw@0.13.13` 并检查 tarball 内容，确认缺少 `ui-dist/index.html` 与 `ui-dist/assets/*`，成功复现坏包根因。
- 执行 `pnpm -C packages/nextclaw pack --pack-destination <tmp>` 并检查 tarball 内容，确认当前仓库打出的包包含 `package/ui-dist/index.html` 与 `package/ui-dist/assets/*`。
- 临时移走 `packages/nextclaw-ui/dist` 后再次触发打包，确认新的保护会直接失败，不再允许残缺 UI 资源进入发布包。

## 发布/部署方式

- 先执行 `pnpm -C packages/nextclaw-ui build`
- 再执行 `pnpm -C packages/nextclaw build`
- 按 [`docs/workflows/npm-release-process.md`](../../workflows/npm-release-process.md) 执行 changeset/version/publish
- 发布前必须额外检查 `nextclaw` tarball，确认包含 `ui-dist/index.html` 与至少一个 `ui-dist/assets/*`
- 发布后建议补发修复版本并在 release note 中明确说明 `0.13.13` 的 npm 包前端资源不完整，升级到修复版

## 用户/产品视角的验收步骤

- 安装修复版 `nextclaw`
- 执行 `nextclaw start`
- 观察终端：若前端资源缺失，应直接看到明确错误，而不是启动成功后浏览器 404
- 在正常安装包场景下打开启动输出里的 UI 地址，确认页面能正常加载而不是显示 `404 not found`
