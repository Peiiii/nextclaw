# v0.18.53 NextClaw Autostart Skill

## 迭代完成说明

本次新增产品内置 skill `nextclaw-autostart`，位置为 `packages/nextclaw-core/src/features/agent/shared/skills/nextclaw-autostart/SKILL.md`，用于指导 NextClaw 开机自启动、系统重启后恢复、LaunchAgent/systemd/Windows Scheduled Task 注册与诊断。

同时修正一次流程误判：产品需要支持的 skill 必须进入 NextClaw 产品内置或 marketplace skill 体系，不能用 `.agents/skills/*` 这类仓库开发治理 skill 代替。该教训已补入 `nextclaw-marketplace-skill-integration`。

同批修复两个 skills 使用问题：

- 新会话未 materialize 前，技能查询改用服务端已支持的 `draft-session` 合同，避免新会话输入框 skill picker 为空。
- skill picker 的选项文本区域改为可选中文本，只有右侧圆形按钮负责添加/移除技能，避免用户复制描述文本时触发选择并关闭面板。
- 统一补齐所有产品内置 skill 的 `description_zh`，并新增测试要求内置 skill 同时具备英文 `description` 和中文描述字段。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-core test -- src/features/agent/features/tests/skills.test.ts`
- `pnpm -C packages/nextclaw-core tsc`
- `pnpm -C packages/nextclaw-core lint`
- `pnpm -C packages/nextclaw-core build`
- 脚本复扫 `packages/nextclaw-core/src/features/agent/shared/skills` 与 `packages/nextclaw-core/dist/skills`，确认所有内置 skill 都具备 `description` 与 `description_zh`/`descriptionZh`
- `pnpm -C packages/nextclaw-ui test -- src/features/chat/hooks/use-ncp-chat-page-data.test.tsx src/features/chat/pages/ncp-chat-page.test.ts src/shared/lib/api/ncp-session.test.ts`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-ui exec eslint src/features/chat/hooks/use-ncp-chat-page-data.ts src/features/chat/hooks/use-ncp-chat-page-data.test.tsx src/features/chat/pages/ncp-chat-page.test.ts`
- `pnpm -C packages/nextclaw-agent-chat-ui test -- src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx`
- `pnpm -C packages/nextclaw-agent-chat-ui tsc`
- `pnpm -C packages/nextclaw-agent-chat-ui exec eslint src/components/chat/ui/chat-input-bar/chat-input-bar-skill-picker.tsx src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx src/components/chat/ui/chat-message-list/chat-message-list.tsx vite.config.ts`
- `pnpm -C packages/nextclaw-agent-chat-ui build`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-core/src/features/agent/features/tests/skills.test.ts packages/nextclaw-core/src/features/agent/shared/skills/README.md packages/nextclaw-core/src/features/agent/shared/skills/nextclaw-autostart/SKILL.md .agents/skills/nextclaw-marketplace-skill-integration/SKILL.md`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/features/chat/hooks/use-ncp-chat-page-data.ts packages/nextclaw-ui/src/features/chat/hooks/use-ncp-chat-page-data.test.tsx packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/chat-input-bar-skill-picker.tsx packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx packages/nextclaw-agent-chat-ui/tsconfig.json packages/nextclaw-agent-chat-ui/vite.config.ts packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-list.tsx`

已知验证说明：

- `pnpm -C packages/nextclaw-ui lint` 被既有非本次错误阻塞，已改跑触达文件 targeted ESLint。
- `pnpm -C packages/nextclaw-agent-chat-ui lint` 被既有 `chat-composer-plugins.tsx` React hooks immutability 错误阻塞，已改跑触达文件 targeted ESLint。

## 发布/部署方式

不涉及部署。若发布 NPM 包，`@nextclaw/core` build 会通过 `scripts/copy-skills.mjs` 将内置 skill 复制到 `dist/skills`。

## 用户/产品视角的验收步骤

1. 在 NextClaw 的内置 skills 列表中能看到 `nextclaw-autostart`。
2. 用户询问开机自启动、重启后恢复、`nextclaw start` 重启丢失等问题时，AI 能加载该 skill 并区分 CLI 安装、后台启动与宿主自启动注册。
3. build 后 `packages/nextclaw-core/dist/skills/nextclaw-autostart/SKILL.md` 存在。
4. 打开新会话页时，skill picker 能从 `draft-session` 查询到可用技能。
5. 打开 skill picker 后，点击技能描述/文本区域不会选中技能或关闭面板；点击右侧圆形按钮才会添加/移除技能。
6. 中文界面下，所有内置 skill 都能提供中文说明，不再只依赖英文 `description` 或 marketplace 中文兜底。

## 可维护性总结汇总

这是新增用户可见能力和同批 skills 体验修复。内置 skill 内容集中在产品 skill 目录；新会话技能加载修复保持生产代码净增 0；skill picker 交互修复通过删除测试死代码抵消测试膨胀，并补齐 `@/` alias 以满足模块结构治理。双语补齐只增加 skill metadata，并由 loader 测试防止后续回退。当前维护性检查仍提示 chat input bar 与 chat message list 目录接近/超过预算，后续应拆分测试 fixtures 与列表子组件。

## NPM 包发布记录

本次未发布 NPM 包。后续发版时需包含 `@nextclaw/core` 的内置 skill 资源更新。
