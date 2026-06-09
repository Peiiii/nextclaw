# UI 目录组织治理

## 迭代完成说明

- 将设置/配置页面从 `shared/components` 回迁到 `features/settings/pages`。
- 将 provider/secrets 配置业务组件回迁到 `features/settings/components/config`，将 provider 表单纯计算逻辑回迁到 `features/settings/utils`。
- 将 cron 面板从 `shared/components` 回迁到 `features/cron/components`，cron query hooks 回迁到 `features/cron/hooks`。
- 将 NCP session query hooks 从 `shared/hooks/use-config.ts` 回迁到 `features/chat/hooks/use-ncp-session-queries.ts`。
- 将 `useAppMeta` 从配置大桶拆到 `shared/hooks/use-app-meta.ts`。
- 将 chat session preference 的 React 同步 hook 从 `.utils.ts` 拆到 `hooks/use-chat-session-preference-sync.ts`，保留 utils 文件为纯计算规则。
- 合并无独立 owner 的 `use-chat-session-label.ts` 到 `use-chat-session-update.ts`。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui test -- src/features/settings/pages/__tests__/model-config-page.test.tsx src/features/settings/pages/__tests__/search-config-page.test.tsx src/features/settings/pages/__tests__/providers-config-page.test.tsx src/features/settings/pages/__tests__/secrets-config-page.test.tsx src/features/settings/utils/__tests__/provider-form-support.utils.test.ts src/features/chat/hooks/__tests__/use-chat-session-preference-sync.test.tsx src/features/chat/hooks/__tests__/use-ncp-chat-page-data.test.tsx src/features/chat/components/layout/__tests__/chat-sidebar.test.tsx src/features/chat/components/conversation/__tests__/chat-conversation-panel.test.tsx src/features/chat/components/layout/__tests__/chat-page-shell.test.tsx`
  - 结果：10 个测试文件、58 个测试通过。
- `pnpm -C packages/nextclaw-ui tsc`
  - 结果：通过。
- `pnpm -C packages/nextclaw-ui lint`
  - 结果：通过；保留既有 warning。
- `pnpm lint:new-code:governance`
  - 结果：通过。
- `pnpm check:governance-backlog-ratchet`
  - 结果：通过。
- `node .agents/skills/file-organization-governance/scripts/enhanced-check-organization.js packages/nextclaw-ui/src`
  - 结果：目录热点从 4 个降到 3 个；`shared/components` 业务配置页面与 chat hooks 超阈值问题已收敛，剩余 `chat/utils`、`chat/utils/__tests__`、`shared/components/ui` 仍是后续结构债务。

## 发布/部署方式

- 本次未执行发布或部署。
- 不涉及数据库 migration。
- 不涉及线上 smoke。

## 用户/产品视角的验收步骤

- 打开模型、搜索、providers、secrets 设置页，确认路由仍能加载对应页面。
- 打开 chat 页，确认 cron 面板入口和会话侧栏仍能正常渲染。
- 本次为目录与 owner 落位治理，不新增用户可见能力。

## 可维护性总结汇总

- 本次使用 `post-edit-maintainability-review` 做收尾判断。
- scoped maintainability guard：
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
  - 结果：通过；总计 `+90 / -308 / net -218`，非测试 `+87 / -305 / net -218`。
- 全工作区 maintainability guard：
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`
  - 结果：失败；非测试净增 `+288`，主要统计到当前并行 chat show-content WIP 和 shared/ui 新文件，非本次目录整理闭环单独结果。
- 正向减债动作：删除与职责收敛。
- 质量与可维护性提升证明：`shared/components` 不再承接 settings/cron 业务页面，`shared/hooks/use-config.ts` 不再混入 NCP session 和 cron query owner，chat preference utils 回到纯计算角色。
- 剩余债务：`features/chat/utils` 和 `shared/components/ui` 仍是目录热点，需要后续按子域/基础 UI 模型继续拆分。

## NPM 包发布记录

不涉及 NPM 包发布。
