# v0.14.135 Remote Auth Expiry User Facing Recovery

## 迭代完成说明

- 将 remote access 页面里直接暴露给普通用户的底层错误 `Invalid or expired token.` 改成产品化状态与恢复引导。
- 新增 `remote-access-feedback.service`，统一把 remote runtime 错误映射为用户视角的标题、描述、提示文案与主操作。
- 针对登录失效场景新增“重新登录并恢复远程访问”主按钮，直接走浏览器登录流，并在登录完成后自动触发 remote repair。
- 补齐文案与页面测试，确保页面不再直接显示 token / bearer 这类后端术语。

## 测试 / 验证 / 验收方式

- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui test -- --run src/remote/remote-access-feedback.service.test.ts src/components/remote/RemoteAccessPage.test.tsx`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui build`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui lint`
- `PATH=/opt/homebrew/bin:$PATH node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/components/remote/RemoteAccessPage.tsx packages/nextclaw-ui/src/components/remote/RemoteAccessPage.test.tsx packages/nextclaw-ui/src/remote/remote-access-feedback.service.ts packages/nextclaw-ui/src/remote/remote-access-feedback.service.test.ts packages/nextclaw-ui/src/remote/managers/remote-access.manager.ts packages/nextclaw-ui/src/account/managers/account.manager.ts packages/nextclaw-ui/src/account/stores/account.store.ts packages/nextclaw-ui/src/lib/i18n.remote.ts`

## 发布 / 部署方式

- 本次仅完成本地实现、验证与提交，未执行发布或部署。
- 不适用原因：这是一次前端用户体验修复，当前目标是先收敛错误展示与恢复流程；若后续需要发版，可沿用既有前端 release 流程。

## 用户 / 产品视角的验收步骤

1. 保持 remote access 为已开启状态，并让平台登录态失效。
2. 打开 NextClaw 本地 UI 的 Remote Access 页面。
3. 确认页面标题显示“登录已过期，请重新登录 NextClaw”，而不是 raw token 错误。
4. 确认主按钮显示“重新登录并恢复远程访问”。
5. 点击主按钮后，浏览器登录页被拉起；完成登录后，页面自动恢复 remote access，而不是要求用户手动排查 token 或重配设备。
