# Host Capability 与 SkillHub 外部入口

## 迭代完成说明

本次完成 Skill Marketplace 的 SkillHub 外部来源入口，并新增通用宿主能力 owner：

- 新增 UI 侧 `HostCapabilityManager`，统一承接打开外部 URL 这类宿主能力 primitive。
- 新增 desktop main 侧 `DesktopHostCapabilityService`，通过现有 `window.nextclawDesktop.host` bridge 调用系统默认浏览器。
- 新增纯展示基础组件 `ExternalActionLink`，统一 primary 色外部跳转链接样式。
- Marketplace tab 行右侧新增 SkillHub 外部入口，文案走 marketplace i18n owner。
- 主 UI 内既有外部打开入口收敛到 `hostCapabilityManager.openExternalUrl(...)`，覆盖账号浏览器登录、provider device auth、release notes。
- 修正本批次暴露出的治理规则：新增治理脚本前必须证明其解决通用、反复、高影响的问题类别；不为一次性坏味道保留窄脚本。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui test -- src/shared/lib/host-capabilities/host-capability.manager.test.ts src/features/marketplace/components/marketplace-page.test.tsx`
  - 结果：通过，2 个 test file，9 个测试。
- `rm -rf /tmp/nextclaw-desktop-host-test && pnpm -C apps/desktop exec tsc -p tsconfig.json --outDir /tmp/nextclaw-desktop-host-test --noEmit false && node --test /tmp/nextclaw-desktop-host-test/src/services/desktop-host-capability.service.test.js`
  - 结果：通过，3 个 desktop host capability 测试。
- `pnpm -C packages/nextclaw-ui tsc`
  - 结果：通过。
- `pnpm -C apps/desktop tsc`
  - 结果：通过。
- `pnpm -C packages/nextclaw-ui exec eslint <touched ui files>`
  - 结果：通过，仅有 `ProviderForm` 既有超长函数 warning。
- `pnpm -C apps/desktop exec eslint <touched desktop files>`
  - 结果：通过。
- `pnpm lint:new-code:governance`
  - 结果：通过。
- `pnpm check:governance-backlog-ratchet`
  - 结果：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <touched files>`
  - 结果：通过，有既有维护性 warning，未出现阻塞错误。
- `pnpm check:generated-clean`
  - 结果：通过，生成产物干净。

## 发布/部署方式

本次只在本地源码落地，未执行发布、部署或桌面打包。

## 用户/产品视角的验收步骤

1. 打开 Skill Marketplace 的全部技能页。
2. 确认 tab 行最右侧出现 `SkillHub` 按钮。
3. 点击该按钮。
4. 在桌面端应通过系统默认浏览器打开 `https://skillhub.cn/`；Web/PWA 环境 fallback 到新浏览器标签。

## 可维护性总结汇总

本次新增的是用户可见能力与通用宿主能力 owner，因此生产代码有必要增长。实现中避免了 SkillHub 专用 bridge，复用现有 `window.nextclawDesktop` 桌面 bridge，并把主 UI 的外部 URL 打开动作收敛到同一 manager，减少后续平行入口。

Maintainability guard 通过；仍有既有 warning：

- `packages/nextclaw-ui/src/shared/components/config/provider-form.tsx` 仍超过文件与函数预算，本次保持 `delta=0`，未继续膨胀。
- `packages/nextclaw-ui/src/features/marketplace/components/marketplace-page.tsx` 接近预算，后续拆分时应优先抽出页面头部和列表编排。
- `packages/nextclaw-ui/src/shared/lib/i18n` 目录已有记录例外，本次只在现有 marketplace i18n owner 中增加文案。

本次正向动作：职责收敛与复用。外部 URL 打开从多个 UI 调用点收敛到 `HostCapabilityManager`，desktop 执行落到 `DesktopHostCapabilityService`；SkillHub 入口视觉复用纯展示 `ExternalActionLink`，避免 feature 组件手写跳转链接样式。

## NPM 包发布记录

本次未执行 NPM 发布，已新增 `.changeset/skillhub-marketplace-link.md` 记录用户可见 UI 变更。

受影响但未发布的包/应用：

- `@nextclaw/ui`：需要后续统一发布，patch changeset 已记录。
- `@nextclaw/desktop`：private desktop app，不进入 NPM changeset；如需桌面安装包更新，后续走 desktop release 流程。

如需进入发布批次，后续应按统一 release 流程评估 changeset、desktop 打包和用户可见变更说明。
