# 迭代完成说明

本迭代用于持续治理 `packages/nextclaw-ui` 的目录组织可维护性债务，目标是在不引入新用户能力的前提下，按高置信批次逐层收敛目录平铺、角色混杂与命名漂移问题，使模块逐步符合仓库治理规范。

当前战役范围：

- 优先处理 `nextclaw-ui` 中直接代码文件数超预算、可稳定按子域/角色收拢的热点目录
- 每次只推进一个高置信批次，完成后立即验证、执行治理守卫与主观复核
- 每完成一个目录层级优化并确认仍可正常运行，就提交一个独立 commit
- 执行约定：每一轮完成并提交后自动进入下一轮，不等待额外人工催促；只有遇到低置信阻塞或治理硬失败时才停下并记录原因

当前进展请见：

- [work/working-notes.md](/Users/peiwang/Projects/nextbot/docs/logs/v0.16.85-nextclaw-ui-directory-governance-campaign/work/working-notes.md)
- [work/state.json](/Users/peiwang/Projects/nextbot/docs/logs/v0.16.85-nextclaw-ui-directory-governance-campaign/work/state.json)

当前已确认的关键根因：

- [packages/nextclaw-ui/module-structure.config.json](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/module-structure.config.json) 将该模块声明为 `frontend-l3`
- 该协议下 allowed roots 只有 `app`、`features`、`shared`、`platforms`
- 当前 `rootPolicy=contract-only`，因此 `nextclaw-ui` 后续不再允许触碰 legacy roots（如 `components`、`lib`、`api`、`hooks`）中的文件；所有新增与后续迁移都必须直接落在 allowed roots（`app`、`features`、`shared`、`platforms`）
- 首批尝试在 `components/config` 下新建 provider 子树已被治理闸门阻断，并已回撤代码尝试；后续必须改成 contract-aligned 的迁移路径
- 第一批真正通过治理的落点是把 `components/config/security-config.tsx` 的真实实现迁入 `features/system-status/components/security-config.tsx`，旧路径只保留薄转发入口，从而在不碰 `app.tsx` 历史命名冲突的前提下完成一次 allowed-root 迁移
- 第二批通过治理的落点是把 `components/config/runtime-presence-card.tsx` 的真实实现迁入 `features/system-status/components/runtime-presence-card.tsx`，旧路径收窄为兼容导出，并顺手消除了重复的卡片壳结构
- 第三批通过治理的落点是把通用布局壳 `components/config/config-split-page.tsx` 的真实实现迁入 `shared/components/config-split-page.tsx`，旧路径仅保留兼容导出，为多个配置页面后续继续脱离 legacy root 铺平道路
- 第四批通过治理的落点是把 `provider-pill-selector.tsx` 与 `provider-status-badge.tsx` 迁入 `shared/components/`，旧路径只保留兼容导出，开始把 provider 相关小型通用 UI 原件从 `components/config` 中剥离出来
- 第五批通过治理的落点是把 `provider-enabled-field.tsx` 迁入 `shared/components/`，旧路径只保留兼容导出，继续把 provider 配置表单中的通用开关行从 `components/config` 中抽离
- 第六批通过治理的落点是把 `provider-advanced-settings-section.tsx` 迁入 `shared/components/`，旧路径只保留兼容导出，开始把 provider 表单中的较大子区块从 `components/config` 中迁出
- 第七批通过治理的落点是把 `provider-auth-section.tsx` 迁入 `shared/components/`，旧路径只保留兼容导出，provider 表单中最稳定的授权子区块也开始脱离 `components/config`
- 第八批通过治理的落点是建立 `features/channels`，并把 `channel-form-fields.ts` 与 `channel-form-fields-section.tsx` 的真实实现迁入 `features/channels/utils` 与 `features/channels/components`，legacy 路径只保留兼容导出
- 第九批通过治理的落点是把 `runtime-config-agent.utils.ts` 的真实实现迁入 `features/system-status/utils`，legacy 路径只保留兼容导出，进一步把运行时配置支撑逻辑从 `components/config` 中抽离
- 第十批通过治理的落点是把 `channel-form-fields.test.ts` 迁入 `features/channels/utils/channel-form-fields.utils.test.ts`，让 `channels` feature 的测试与其真实实现一起归位
- 第十一批通过治理的落点是按 `system-status` 语义线成组收敛：把 `runtime-control-card.tsx` 的真实实现迁入 `features/system-status/components/runtime-control-card.tsx`，同时把 `runtime-control-card.test.tsx` 与 `runtime-presence-card.test.tsx` 一并迁入 `features/system-status/components/`，旧路径只保留兼容导出
- 第十二批通过治理的落点是建立 `features/chat/index.ts`，并把 `chat-inline-token.utils`、`chat-composer-state`、`chat-session-display`、`chat-session-route`、`chat-recent-models.manager`、`chat-recent-skills.manager` 这条纯支撑线连同三份测试一起迁入 `features/chat`，旧路径只保留薄转发入口
- 第十三批通过治理的落点是继续沿 `features/chat` 扩张第二条支撑线：把 `chat-input.types.ts`、`chat-session-preference-governance.ts`、`chat-session-preference-sync.ts` 连同同步测试一起迁入 `features/chat/types`、`features/chat/utils` 与 `features/chat/managers`，旧路径只保留薄转发入口
- 第十四批通过治理的落点是继续沿 `features/chat` 扩张稳定组件线：把 `chat-session-type-option-item.tsx`、`chat-session-workspace-file-preview.tsx` 及其测试一起迁入 `features/chat/components`，把 `chat-sidebar-project-groups.tsx`、`containers/chat-sidebar.tsx` 与 `chat-session-workspace-panel.tsx` 的真实消费改到 `@/features/chat` 根入口，同时把旧路径收窄为薄转发入口
- 第十五批通过治理的落点是继续沿 `features/chat` 扩张侧栏与工作区面板组件线：把 `chat-sidebar-list-mode-switch.tsx`、`chat-sidebar-session-item.tsx`、`chat-sidebar-project-groups.tsx`、`chat-session-workspace-panel-nav.tsx`、`chat-session-workspace-panel.tsx` 与 `workspace/chat-session-workspace-file-breadcrumbs.tsx` 一起迁入 `features/chat/components`，把 `chat-conversation-panel.tsx`、`chat-conversation-panel.test.tsx` 与 `containers/chat-sidebar.tsx` 的真实消费统一切到 `@/features/chat` 根入口，同时把旧路径收窄为薄转发入口
- 第十六批通过治理的落点是收紧模块结构合同本身：把 `packages/nextclaw-ui/module-structure.config.json` 的 `rootPolicy` 从 `legacy-frozen` 提升到 `contract-only`，并把治理测试改成“触达已存在 legacy root 文件也直接报错”，彻底关闭“历史问题只 warning、不拦截”的放水路径
- 第十七批通过治理的落点是沿 `features/chat` 继续吃掉顶层入口支撑件：把 `ChatWelcome.tsx` 与 `useChatSessionTypeState.ts` 连同测试一起迁入 `features/chat/components` 与 `features/chat/hooks`，直接删除 legacy 实现文件，并在 `tsconfig.json`、`vite.config.ts` 与 `vitest.config.ts` 中补精确路径映射，让尚未迁出的旧导入在 strict `contract-only` 下继续解析到 allowed roots，而不是再次触碰 legacy 文件
- 第十八批通过治理的落点是继续吃掉 `components/chat` 顶层最高权重面板线：把 `chat-conversation-panel.tsx` 与 `chat-conversation-panel.test.tsx` 迁入 `features/chat/components/conversation/`，把 `chat-page-runtime.test.ts` 迁入 `features/chat/pages/ncp-chat-page.test.ts`，并仅为仍保留在 legacy 的 `chat-page-shell.tsx` 补一条精确路径映射到新 panel 实现，避免继续回写 legacy 页面壳
- 第十九批通过治理的落点是继续吃掉剩余页面入口链：把 `chat-page-shell.tsx` 迁入 `features/chat/components/layout/chat-page-shell.tsx`，把 `chat-page.tsx` 迁入 `features/chat/pages/chat-page.tsx`，并通过精确路径映射让 `app.tsx` 与 legacy `ncp-chat-page.tsx` 继续解析到 allowed roots 下的新实现
- 第二十批通过治理的落点是一次性吃掉剩余 `ncp` 页面装配链：把 `ncp-chat-page.tsx` 迁入 `features/chat/pages/ncp-chat-page.tsx`，把 `ncp-chat-page-data.ts` 与 `page/ncp-chat-derived-state.ts` 迁入 `features/chat/hooks/`，把散落的 `ncp-chat-page-data.test.ts` 合并回 `features/chat/pages/ncp-chat-page.test.ts`，并让新页面实现只依赖 `features/chat` 自己的 utils / hooks 根
- 第二十一批通过治理的落点是继续吃掉 `ncp` 运行时 hooks 与 contract 测试链：把 `session-conversation` 子树整体迁入 `features/chat/hooks/runtime/`，把 `ncp-app-client-fetch.ts` 与其测试迁入 `features/chat/utils/ncp-app-client-fetch.utils.ts`，把 `useHydratedNcpAgent.test.tsx` 与 `useNcpAgentRuntime.test.tsx` 一并迁入 `features/chat/hooks/runtime/`，并把 `ncp-chat-page.tsx`、`chat-session-workspace-panel.tsx`、`chat-session-workspace-panel-nav.tsx` 与 `chat-conversation-panel.test.tsx` 的真实消费全部切到新路径
- 第二十二批通过治理的落点是一次性吃掉 `components/chat/ncp` 的 manager / adapter / list-view 主链：把 `ncp-chat.presenter.ts`、`ncp-chat-input.manager.ts`、`ncp-chat-thread.manager.ts` 迁入 `features/chat/managers/`，把 `ncp-session-adapter.ts` 迁入 `features/chat/utils/ncp-session-adapter.utils.ts`，把 `use-ncp-session-list-view.ts` 迁入 `features/chat/hooks/use-ncp-session-list-view.ts`，并把四个相邻测试一起迁入 feature 内部；对仍留在 legacy roots 的真实消费方不再回写文件本体，而是通过 `tsconfig.json`、`vite.config.ts` 与 `vitest.config.ts` 的精确 alias 承接旧导入，继续保持 strict `contract-only`
- 第二十三批通过治理的落点是继续从 `components/config` 吃掉页面级卡片实现：把 `runtime-security-card.tsx` 迁入 `features/system-status/components/runtime-security-card.tsx`，让 `security-config.tsx` 直接消费新的 allowed-root 实现，并在新落点内顺手收敛卡片壳与 setup / configured 两段稳定结构；同轮还确认 `ChannelForm` / `ChannelsList` / `weixin-channel-auth-section` 的整组迁移当前会触发 effect-boundary、函数预算与非功能净增阻塞，因此被明确降级为否决候选，而不是带病推进

# 测试 / 验证 / 验收方式

当前为进行中迭代。每个批次默认执行以下最小验证并把结果增量补充到本文件与 `work/` 状态中：

- 受影响范围的测试或类型检查
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths <touched-files...>`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- 一次独立于实现阶段的可维护性复核

本轮额外确认：

- 已执行一次真实失败验证，确认 legacy-root 直拆会同时触发 `module-structure`、目录预算和非功能净增闸门
- 已回撤失败代码路径，当前仓库未保留这次未通过治理检查的半成品结构
- 当前首个成功批次已完成以下验证：
- 当前第二个成功批次已完成以下验证：
  - `pnpm --filter @nextclaw/ui exec vitest run src/app.test.tsx`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/security-config.tsx packages/nextclaw-ui/src/features/system-status/index.ts packages/nextclaw-ui/src/features/system-status/components/security-config.tsx`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/security-config.tsx packages/nextclaw-ui/src/features/system-status/index.ts packages/nextclaw-ui/src/features/system-status/components/security-config.tsx`
  - `pnpm check:governance-backlog-ratchet`
- 第十七批验证命令：
  - `pnpm --filter @nextclaw/ui exec vitest run src/components/chat/chat-conversation-panel.test.tsx src/features/chat/components/chat-welcome.test.tsx src/features/chat/hooks/use-chat-session-type-state.test.tsx`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `node --test scripts/governance/module-structure/lint-new-code-module-structure.test.mjs`
  - `pnpm lint:new-code:governance -- --files packages/nextclaw-ui/src/features/chat/components/chat-welcome.tsx packages/nextclaw-ui/src/features/chat/components/chat-welcome.test.tsx packages/nextclaw-ui/src/features/chat/hooks/use-chat-session-type-state.ts packages/nextclaw-ui/src/features/chat/hooks/use-chat-session-type-state.test.tsx packages/nextclaw-ui/src/features/chat/index.ts packages/nextclaw-ui/src/components/chat/ChatWelcome.tsx packages/nextclaw-ui/src/components/chat/ChatWelcome.test.tsx packages/nextclaw-ui/src/components/chat/useChatSessionTypeState.ts packages/nextclaw-ui/src/components/chat/useChatSessionTypeState.test.tsx packages/nextclaw-ui/tsconfig.json packages/nextclaw-ui/vite.config.ts packages/nextclaw-ui/vitest.config.ts`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/features/chat/components/chat-welcome.tsx packages/nextclaw-ui/src/features/chat/components/chat-welcome.test.tsx packages/nextclaw-ui/src/features/chat/hooks/use-chat-session-type-state.ts packages/nextclaw-ui/src/features/chat/hooks/use-chat-session-type-state.test.tsx packages/nextclaw-ui/src/features/chat/index.ts packages/nextclaw-ui/src/components/chat/ChatWelcome.tsx packages/nextclaw-ui/src/components/chat/ChatWelcome.test.tsx packages/nextclaw-ui/src/components/chat/useChatSessionTypeState.ts packages/nextclaw-ui/src/components/chat/useChatSessionTypeState.test.tsx packages/nextclaw-ui/tsconfig.json packages/nextclaw-ui/vite.config.ts packages/nextclaw-ui/vitest.config.ts`
  - `pnpm check:governance-backlog-ratchet`
- 第十八批验证命令：
  - `pnpm --filter @nextclaw/ui exec vitest run src/features/chat/components/conversation/chat-conversation-panel.test.tsx src/features/chat/pages/ncp-chat-page.test.ts src/components/chat/ncp/ncp-chat-page-data.test.ts`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- --files packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-panel.tsx packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-panel.test.tsx packages/nextclaw-ui/src/features/chat/pages/ncp-chat-page.test.ts packages/nextclaw-ui/src/components/chat/chat-conversation-panel.tsx packages/nextclaw-ui/src/components/chat/chat-conversation-panel.test.tsx packages/nextclaw-ui/src/components/chat/chat-page-runtime.test.ts packages/nextclaw-ui/tsconfig.json packages/nextclaw-ui/vite.config.ts packages/nextclaw-ui/vitest.config.ts`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-panel.tsx packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-panel.test.tsx packages/nextclaw-ui/src/features/chat/pages/ncp-chat-page.test.ts packages/nextclaw-ui/src/components/chat/chat-conversation-panel.tsx packages/nextclaw-ui/src/components/chat/chat-conversation-panel.test.tsx packages/nextclaw-ui/src/components/chat/chat-page-runtime.test.ts packages/nextclaw-ui/tsconfig.json packages/nextclaw-ui/vite.config.ts packages/nextclaw-ui/vitest.config.ts`
  - `pnpm check:governance-backlog-ratchet`
- 第十九批验证命令：
  - `pnpm --filter @nextclaw/ui exec vitest run src/features/chat/components/conversation/chat-conversation-panel.test.tsx src/features/chat/pages/ncp-chat-page.test.ts src/components/chat/ncp/ncp-chat-page-data.test.ts`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- --files packages/nextclaw-ui/src/features/chat/components/layout/chat-page-shell.tsx packages/nextclaw-ui/src/features/chat/pages/chat-page.tsx packages/nextclaw-ui/src/components/chat/chat-page-shell.tsx packages/nextclaw-ui/src/components/chat/chat-page.tsx packages/nextclaw-ui/tsconfig.json packages/nextclaw-ui/vite.config.ts packages/nextclaw-ui/vitest.config.ts`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/features/chat/components/layout/chat-page-shell.tsx packages/nextclaw-ui/src/features/chat/pages/chat-page.tsx packages/nextclaw-ui/src/components/chat/chat-page-shell.tsx packages/nextclaw-ui/src/components/chat/chat-page.tsx packages/nextclaw-ui/tsconfig.json packages/nextclaw-ui/vite.config.ts packages/nextclaw-ui/vitest.config.ts`
  - `pnpm check:governance-backlog-ratchet`
- 第二十批验证命令：
  - `pnpm --filter @nextclaw/ui exec vitest run src/features/chat/pages/ncp-chat-page.test.ts`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- --files packages/nextclaw-ui/src/features/chat/pages/ncp-chat-page.tsx packages/nextclaw-ui/src/features/chat/hooks/use-ncp-chat-page-data.ts packages/nextclaw-ui/src/features/chat/hooks/use-ncp-chat-derived-state.ts packages/nextclaw-ui/src/features/chat/pages/chat-page.tsx packages/nextclaw-ui/src/features/chat/pages/ncp-chat-page.test.ts`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-page.tsx packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-page-data.ts packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-page-data.test.ts packages/nextclaw-ui/src/components/chat/ncp/page/ncp-chat-derived-state.ts packages/nextclaw-ui/src/features/chat/pages/ncp-chat-page.tsx packages/nextclaw-ui/src/features/chat/hooks/use-ncp-chat-page-data.ts packages/nextclaw-ui/src/features/chat/hooks/use-ncp-chat-derived-state.ts packages/nextclaw-ui/src/features/chat/pages/chat-page.tsx packages/nextclaw-ui/src/features/chat/pages/ncp-chat-page.test.ts`
  - `pnpm check:governance-backlog-ratchet`
- 第二十一批验证命令：
  - `pnpm --filter @nextclaw/ui exec vitest run src/features/chat/hooks/runtime/use-ncp-session-conversation.test.tsx src/features/chat/utils/ncp-app-client-fetch.utils.test.ts src/features/chat/hooks/runtime/use-hydrated-ncp-agent.test.tsx src/features/chat/hooks/runtime/use-ncp-agent-runtime.test.tsx src/features/chat/components/conversation/chat-conversation-panel.test.tsx src/features/chat/pages/ncp-chat-page.test.ts`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- --files packages/nextclaw-ui/src/features/chat/hooks/runtime/use-ncp-child-session-tabs-view.ts packages/nextclaw-ui/src/features/chat/hooks/runtime/use-ncp-session-conversation.ts packages/nextclaw-ui/src/features/chat/hooks/runtime/use-ncp-session-conversation.test.tsx packages/nextclaw-ui/src/features/chat/hooks/runtime/use-hydrated-ncp-agent.test.tsx packages/nextclaw-ui/src/features/chat/hooks/runtime/use-ncp-agent-runtime.test.tsx packages/nextclaw-ui/src/features/chat/utils/ncp-app-client-fetch.utils.ts packages/nextclaw-ui/src/features/chat/utils/ncp-app-client-fetch.utils.test.ts packages/nextclaw-ui/src/features/chat/pages/ncp-chat-page.tsx packages/nextclaw-ui/src/features/chat/components/chat-session-workspace-panel.tsx packages/nextclaw-ui/src/features/chat/components/chat-session-workspace-panel-nav.tsx packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-panel.test.tsx`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/chat/ncp/ncp-app-client-fetch.ts packages/nextclaw-ui/src/components/chat/ncp/ncp-app-client-fetch.test.ts packages/nextclaw-ui/src/components/chat/ncp/session-conversation/use-ncp-child-session-tabs-view.ts packages/nextclaw-ui/src/components/chat/ncp/session-conversation/use-ncp-session-conversation.ts packages/nextclaw-ui/src/components/chat/ncp/session-conversation/use-ncp-session-conversation.test.tsx packages/nextclaw-ui/src/components/chat/useHydratedNcpAgent.test.tsx packages/nextclaw-ui/src/components/chat/useNcpAgentRuntime.test.tsx packages/nextclaw-ui/src/features/chat/hooks/runtime/use-ncp-child-session-tabs-view.ts packages/nextclaw-ui/src/features/chat/hooks/runtime/use-ncp-session-conversation.ts packages/nextclaw-ui/src/features/chat/hooks/runtime/use-ncp-session-conversation.test.tsx packages/nextclaw-ui/src/features/chat/hooks/runtime/use-hydrated-ncp-agent.test.tsx packages/nextclaw-ui/src/features/chat/hooks/runtime/use-ncp-agent-runtime.test.tsx packages/nextclaw-ui/src/features/chat/utils/ncp-app-client-fetch.utils.ts packages/nextclaw-ui/src/features/chat/utils/ncp-app-client-fetch.utils.test.ts packages/nextclaw-ui/src/features/chat/pages/ncp-chat-page.tsx packages/nextclaw-ui/src/features/chat/components/chat-session-workspace-panel.tsx packages/nextclaw-ui/src/features/chat/components/chat-session-workspace-panel-nav.tsx packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-panel.test.tsx`
  - `pnpm check:governance-backlog-ratchet`
- 第二十二批验证命令：
  - `pnpm --filter @nextclaw/ui exec vitest run src/features/chat/managers/ncp-chat-thread.manager.test.ts src/features/chat/managers/ncp-chat-input.manager.test.ts src/features/chat/utils/ncp-session-adapter.utils.test.ts src/features/chat/utils/ncp-session-adapter.utils.cancelled-tool.test.ts src/features/chat/pages/ncp-chat-page.test.ts src/components/chat/containers/chat-sidebar.test.tsx`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- --files packages/nextclaw-ui/src/features/chat/managers/ncp-chat-presenter.manager.ts packages/nextclaw-ui/src/features/chat/managers/ncp-chat-input.manager.ts packages/nextclaw-ui/src/features/chat/managers/ncp-chat-thread.manager.ts packages/nextclaw-ui/src/features/chat/managers/ncp-chat-input.manager.test.ts packages/nextclaw-ui/src/features/chat/managers/ncp-chat-thread.manager.test.ts packages/nextclaw-ui/src/features/chat/utils/ncp-session-adapter.utils.ts packages/nextclaw-ui/src/features/chat/utils/ncp-session-adapter.utils.test.ts packages/nextclaw-ui/src/features/chat/utils/ncp-session-adapter.utils.cancelled-tool.test.ts packages/nextclaw-ui/src/features/chat/hooks/use-ncp-session-list-view.ts packages/nextclaw-ui/src/features/chat/components/chat-sidebar-project-groups.tsx packages/nextclaw-ui/src/features/chat/hooks/runtime/use-ncp-child-session-tabs-view.ts packages/nextclaw-ui/src/features/chat/hooks/use-ncp-chat-derived-state.ts packages/nextclaw-ui/src/features/chat/hooks/use-ncp-chat-page-data.ts packages/nextclaw-ui/src/features/chat/index.ts packages/nextclaw-ui/src/features/chat/pages/ncp-chat-page.tsx`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/chat/ncp/ncp-chat.presenter.ts packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-input.manager.ts packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-thread.manager.ts packages/nextclaw-ui/src/components/chat/ncp/ncp-session-adapter.ts packages/nextclaw-ui/src/components/chat/ncp/use-ncp-session-list-view.ts packages/nextclaw-ui/src/components/chat/ncp/tests/ncp-chat-input.manager.test.ts packages/nextclaw-ui/src/components/chat/ncp/tests/ncp-chat-thread.manager.test.ts packages/nextclaw-ui/src/components/chat/ncp/ncp-session-adapter.test.ts packages/nextclaw-ui/src/components/chat/ncp/__tests__/ncp-session-adapter.cancelled-tool.test.ts packages/nextclaw-ui/src/features/chat/managers/ncp-chat-presenter.manager.ts packages/nextclaw-ui/src/features/chat/managers/ncp-chat-input.manager.ts packages/nextclaw-ui/src/features/chat/managers/ncp-chat-thread.manager.ts packages/nextclaw-ui/src/features/chat/managers/ncp-chat-input.manager.test.ts packages/nextclaw-ui/src/features/chat/managers/ncp-chat-thread.manager.test.ts packages/nextclaw-ui/src/features/chat/utils/ncp-session-adapter.utils.ts packages/nextclaw-ui/src/features/chat/utils/ncp-session-adapter.utils.test.ts packages/nextclaw-ui/src/features/chat/utils/ncp-session-adapter.utils.cancelled-tool.test.ts packages/nextclaw-ui/src/features/chat/hooks/use-ncp-session-list-view.ts packages/nextclaw-ui/src/features/chat/components/chat-sidebar-project-groups.tsx packages/nextclaw-ui/src/features/chat/hooks/runtime/use-ncp-child-session-tabs-view.ts packages/nextclaw-ui/src/features/chat/hooks/use-ncp-chat-derived-state.ts packages/nextclaw-ui/src/features/chat/hooks/use-ncp-chat-page-data.ts packages/nextclaw-ui/src/features/chat/index.ts packages/nextclaw-ui/src/features/chat/pages/ncp-chat-page.tsx packages/nextclaw-ui/tsconfig.json packages/nextclaw-ui/vite.config.ts packages/nextclaw-ui/vitest.config.ts`
  - `pnpm check:governance-backlog-ratchet`
- 第二十三批验证命令：
  - `pnpm --filter @nextclaw/ui exec vitest run src/app.test.tsx`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- --files packages/nextclaw-ui/src/features/system-status/components/runtime-security-card.tsx packages/nextclaw-ui/src/features/system-status/components/security-config.tsx`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/runtime-security-card.tsx packages/nextclaw-ui/src/features/system-status/components/runtime-security-card.tsx packages/nextclaw-ui/src/features/system-status/components/security-config.tsx packages/nextclaw-ui/src/features/system-status/index.ts`
  - `pnpm check:governance-backlog-ratchet`
- 第二批验证命令：
  - `pnpm --filter @nextclaw/ui exec vitest run src/components/config/runtime-presence-card.test.tsx`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/runtime-presence-card.tsx packages/nextclaw-ui/src/features/system-status/components/runtime-presence-card.tsx`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/runtime-presence-card.tsx packages/nextclaw-ui/src/features/system-status/components/runtime-presence-card.tsx`
  - `pnpm check:governance-backlog-ratchet`
- 第三批验证命令：
  - `pnpm --filter @nextclaw/ui exec vitest run src/components/config/SearchConfig.test.tsx`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/config-split-page.tsx packages/nextclaw-ui/src/shared/components/config-split-page.tsx`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/config-split-page.tsx packages/nextclaw-ui/src/shared/components/config-split-page.tsx`
  - `pnpm check:governance-backlog-ratchet`
- 第四批验证命令：
  - `pnpm --filter @nextclaw/ui exec vitest run src/components/config/providers-list.test.tsx`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/provider-pill-selector.tsx packages/nextclaw-ui/src/components/config/provider-status-badge.tsx packages/nextclaw-ui/src/shared/components/provider-pill-selector.tsx packages/nextclaw-ui/src/shared/components/provider-status-badge.tsx`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/provider-pill-selector.tsx packages/nextclaw-ui/src/components/config/provider-status-badge.tsx packages/nextclaw-ui/src/shared/components/provider-pill-selector.tsx packages/nextclaw-ui/src/shared/components/provider-status-badge.tsx`
  - `pnpm check:governance-backlog-ratchet`
- 第五批验证命令：
  - `pnpm --filter @nextclaw/ui exec vitest run src/components/config/providers-list.test.tsx`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/provider-enabled-field.tsx packages/nextclaw-ui/src/shared/components/provider-enabled-field.tsx`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/provider-enabled-field.tsx packages/nextclaw-ui/src/shared/components/provider-enabled-field.tsx`
  - `pnpm check:governance-backlog-ratchet`
- 第六批验证命令：
  - `pnpm --filter @nextclaw/ui exec vitest run src/components/config/providers-list.test.tsx`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/provider-advanced-settings-section.tsx packages/nextclaw-ui/src/shared/components/provider-advanced-settings-section.tsx`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/provider-advanced-settings-section.tsx packages/nextclaw-ui/src/shared/components/provider-advanced-settings-section.tsx`
  - `pnpm check:governance-backlog-ratchet`
- 第七批验证命令：
  - `pnpm --filter @nextclaw/ui exec vitest run src/components/config/providers-list.test.tsx`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/provider-auth-section.tsx packages/nextclaw-ui/src/shared/components/provider-auth-section.tsx`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/provider-auth-section.tsx packages/nextclaw-ui/src/shared/components/provider-auth-section.tsx`
  - `pnpm check:governance-backlog-ratchet`
- 第八批验证命令：
  - `pnpm --filter @nextclaw/ui exec vitest run src/components/config/channel-form-fields.test.ts`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/channel-form-fields.ts packages/nextclaw-ui/src/components/config/channel-form-fields-section.tsx packages/nextclaw-ui/src/features/channels/index.ts packages/nextclaw-ui/src/features/channels/components/channel-form-fields-section.tsx packages/nextclaw-ui/src/features/channels/utils/channel-form-fields.utils.ts`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/channel-form-fields.ts packages/nextclaw-ui/src/components/config/channel-form-fields-section.tsx packages/nextclaw-ui/src/features/channels/index.ts packages/nextclaw-ui/src/features/channels/components/channel-form-fields-section.tsx packages/nextclaw-ui/src/features/channels/utils/channel-form-fields.utils.ts`
  - `pnpm check:governance-backlog-ratchet`
- 第九批验证命令：
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/runtime-config-agent.utils.ts packages/nextclaw-ui/src/features/system-status/utils/runtime-config-agent.utils.ts`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/runtime-config-agent.utils.ts packages/nextclaw-ui/src/features/system-status/utils/runtime-config-agent.utils.ts`
  - `pnpm check:governance-backlog-ratchet`
- 第十批验证命令：
  - `pnpm --filter @nextclaw/ui exec vitest run src/features/channels/utils/channel-form-fields.utils.test.ts`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/channel-form-fields.test.ts packages/nextclaw-ui/src/features/channels/utils/channel-form-fields.utils.test.ts`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/channel-form-fields.test.ts packages/nextclaw-ui/src/features/channels/utils/channel-form-fields.utils.test.ts`
  - `pnpm check:governance-backlog-ratchet`
- 第十一批验证命令：
  - `pnpm --filter @nextclaw/ui exec vitest run src/features/system-status/components/runtime-control-card.test.tsx src/features/system-status/components/runtime-presence-card.test.tsx src/app.test.tsx`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/runtime-control-card.tsx packages/nextclaw-ui/src/components/config/runtime-control-card.test.tsx packages/nextclaw-ui/src/components/config/runtime-presence-card.test.tsx packages/nextclaw-ui/src/features/system-status/components/security-config.tsx packages/nextclaw-ui/src/features/system-status/components/runtime-control-card.tsx packages/nextclaw-ui/src/features/system-status/components/runtime-control-card.test.tsx packages/nextclaw-ui/src/features/system-status/components/runtime-presence-card.test.tsx`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/runtime-control-card.tsx packages/nextclaw-ui/src/components/config/runtime-control-card.test.tsx packages/nextclaw-ui/src/components/config/runtime-presence-card.test.tsx packages/nextclaw-ui/src/features/system-status/components/security-config.tsx packages/nextclaw-ui/src/features/system-status/components/runtime-control-card.tsx packages/nextclaw-ui/src/features/system-status/components/runtime-control-card.test.tsx packages/nextclaw-ui/src/features/system-status/components/runtime-presence-card.test.tsx`
  - `pnpm check:governance-backlog-ratchet`
- 第十二批验证命令：
  - `pnpm --filter @nextclaw/ui exec vitest run src/features/chat/utils/chat-inline-token.utils.test.ts src/features/chat/utils/chat-composer-state.utils.test.ts src/features/chat/utils/chat-session-display.utils.test.ts`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/chat/chat-inline-token.utils.ts packages/nextclaw-ui/src/components/chat/chat-inline-token.utils.test.ts packages/nextclaw-ui/src/components/chat/chat-composer-state.ts packages/nextclaw-ui/src/components/chat/chat-composer-state.test.ts packages/nextclaw-ui/src/components/chat/chat-session-display.ts packages/nextclaw-ui/src/components/chat/chat-session-display.test.ts packages/nextclaw-ui/src/components/chat/chat-session-route.ts packages/nextclaw-ui/src/components/chat/chat-recent-models.manager.ts packages/nextclaw-ui/src/components/chat/chat-recent-skills.manager.ts packages/nextclaw-ui/src/features/chat/index.ts packages/nextclaw-ui/src/features/chat/utils/chat-inline-token.utils.ts packages/nextclaw-ui/src/features/chat/utils/chat-inline-token.utils.test.ts packages/nextclaw-ui/src/features/chat/utils/chat-composer-state.utils.ts packages/nextclaw-ui/src/features/chat/utils/chat-composer-state.utils.test.ts packages/nextclaw-ui/src/features/chat/utils/chat-session-display.utils.ts packages/nextclaw-ui/src/features/chat/utils/chat-session-display.utils.test.ts packages/nextclaw-ui/src/features/chat/utils/chat-session-route.utils.ts packages/nextclaw-ui/src/features/chat/managers/chat-recent-models.manager.ts packages/nextclaw-ui/src/features/chat/managers/chat-recent-skills.manager.ts`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/chat/chat-inline-token.utils.ts packages/nextclaw-ui/src/components/chat/chat-inline-token.utils.test.ts packages/nextclaw-ui/src/components/chat/chat-composer-state.ts packages/nextclaw-ui/src/components/chat/chat-composer-state.test.ts packages/nextclaw-ui/src/components/chat/chat-session-display.ts packages/nextclaw-ui/src/components/chat/chat-session-display.test.ts packages/nextclaw-ui/src/components/chat/chat-session-route.ts packages/nextclaw-ui/src/components/chat/chat-recent-models.manager.ts packages/nextclaw-ui/src/components/chat/chat-recent-skills.manager.ts packages/nextclaw-ui/src/features/chat/index.ts packages/nextclaw-ui/src/features/chat/utils/chat-inline-token.utils.ts packages/nextclaw-ui/src/features/chat/utils/chat-inline-token.utils.test.ts packages/nextclaw-ui/src/features/chat/utils/chat-composer-state.utils.ts packages/nextclaw-ui/src/features/chat/utils/chat-composer-state.utils.test.ts packages/nextclaw-ui/src/features/chat/utils/chat-session-display.utils.ts packages/nextclaw-ui/src/features/chat/utils/chat-session-display.utils.test.ts packages/nextclaw-ui/src/features/chat/utils/chat-session-route.utils.ts packages/nextclaw-ui/src/features/chat/managers/chat-recent-models.manager.ts packages/nextclaw-ui/src/features/chat/managers/chat-recent-skills.manager.ts`
  - `pnpm check:governance-backlog-ratchet`
- 第十三批验证命令：
  - `pnpm --filter @nextclaw/ui exec vitest run src/features/chat/managers/chat-session-preference-sync.manager.test.ts src/components/chat/chat-page-runtime.test.ts`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/chat/chat-input.types.ts packages/nextclaw-ui/src/components/chat/chat-session-preference-governance.ts packages/nextclaw-ui/src/components/chat/chat-session-preference-sync.ts packages/nextclaw-ui/src/components/chat/chat-session-preference-sync.test.ts packages/nextclaw-ui/src/features/chat/index.ts packages/nextclaw-ui/src/features/chat/types/chat-input.types.ts packages/nextclaw-ui/src/features/chat/utils/chat-session-preference-governance.utils.ts packages/nextclaw-ui/src/features/chat/managers/chat-session-preference-sync.manager.ts packages/nextclaw-ui/src/features/chat/managers/chat-session-preference-sync.manager.test.ts`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/chat/chat-input.types.ts packages/nextclaw-ui/src/components/chat/chat-session-preference-governance.ts packages/nextclaw-ui/src/components/chat/chat-session-preference-sync.ts packages/nextclaw-ui/src/components/chat/chat-session-preference-sync.test.ts packages/nextclaw-ui/src/features/chat/index.ts packages/nextclaw-ui/src/features/chat/types/chat-input.types.ts packages/nextclaw-ui/src/features/chat/utils/chat-session-preference-governance.utils.ts packages/nextclaw-ui/src/features/chat/managers/chat-session-preference-sync.manager.ts packages/nextclaw-ui/src/features/chat/managers/chat-session-preference-sync.manager.test.ts`
  - `pnpm check:governance-backlog-ratchet`
- 验证结果：
  - 路由相关测试通过，说明配置页入口仍可正常装载
  - 类型检查通过
  - 治理检查通过；仅保留一条历史告警，提示 `components/config` 目录本身仍超预算，但本批次没有继续恶化该问题
  - 非测试代码净变化为负值，符合“非功能批次不得净增”的要求
  - `runtime-presence-card` 的测试通过，说明桌面态与本地服务态的关键展示/交互仍可工作
  - `config-split-page` 迁移后受影响页面测试仍通过，且第三批非测试代码净变化为 `0`
  - `provider` 相关列表测试通过，且第四批非测试代码净变化为负值
  - `provider-enabled-field` 第五批验证通过，非测试代码净变化继续为负值
  - `provider-advanced-settings-section` 第六批验证通过，非测试代码净变化继续为负值
  - `provider-auth-section` 第七批验证通过，非测试代码净变化继续为负值
  - `channels` feature 第八批验证通过，非测试代码净变化继续为负值
  - `runtime-config-agent.utils` 第九批验证通过，非测试代码净变化继续为负值
  - `channels` feature 的测试第十批验证通过，且非测试代码净变化为 `0`
  - `system-status` 第十一批验证通过，`runtime-control-card` 实现与两份运行时测试同时归位，非测试代码净变化为负值
  - `chat` feature 第十二批验证通过，`features/chat` 入口与一整条纯支撑线同时建立，非测试代码净变化继续为负值
  - `chat` feature 第十三批验证通过，`session-preference` 支撑线完成归位，非测试代码净变化继续为负值
  - `chat` feature 第十四批验证通过，稳定组件子块与真实消费方一起切到 feature 根入口，非测试代码净变化为 `-14`
  - `chat` feature 第十五批验证通过，侧栏与工作区面板组件线完成归位，非测试代码净变化为 `-30`
  - 第十六批验证通过后，`nextclaw-ui` 将进入严格 `contract-only` 模式；后续再触碰 legacy root 文件会被治理闸门直接拦截，不再只是 warning
  - 第十七批验证通过，`ChatWelcome` 与 `useChatSessionTypeState` 已从 `components/chat` 顶层移入 `features/chat`；模块结构治理测试、UI 用例、类型检查、治理守卫与 maintainability guard 全部通过，非测试代码净变化为 `-11`
  - 第十八批验证通过，`chat-conversation-panel` 面板线与 `chat-page-runtime` 测试已脱离 `components/chat` 顶层；治理守卫、类型检查、UI 用例与 ratchet 全部通过，非测试代码净变化为 `-1`
  - 第十九批验证通过，`chat-page-shell` 与 `chat-page` 已脱离 `components/chat` 顶层；治理守卫、类型检查、UI 用例与 ratchet 全部通过，非测试代码净变化为 `-1`
  - 第二十批验证通过，`ncp-chat-page` 页面装配链已脱离 `components/chat/ncp`；治理守卫、类型检查、UI 用例与 ratchet 全部通过，非测试代码净变化为 `0`
  - 第二十一批验证通过，`session-conversation` 运行时 hooks、`ncp-app-client-fetch` 与两条 runtime contract 测试已归位到 `features/chat`；治理守卫、类型检查、UI 用例与 ratchet 全部通过，非测试代码净变化为 `0`
  - 第二十二批验证通过，`components/chat/ncp` 的 manager / adapter / list-view 主链与四个相邻测试已脱离 legacy root；治理守卫、类型检查、UI 用例与 ratchet 全部通过，非测试代码净变化为 `-2`
  - 第二十三批验证通过，`runtime-security-card` 已脱离 `components/config` 并由 `features/system-status/components` 直接承接；治理守卫、类型检查、UI 用例与 ratchet 全部通过，非测试代码净变化为 `-12`

# 发布 / 部署方式

本迭代聚焦目录治理，不涉及独立部署。若某批次仅调整前端源码目录结构，则以通过最小验证并合入代码为生效方式。

# 用户 / 产品视角的验收步骤

1. 打开 [packages/nextclaw-ui/src](</Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src>)，确认热点目录不再长期维持大规模平铺。
2. 检查 [work/working-notes.md](/Users/peiwang/Projects/nextbot/docs/logs/v0.16.85-nextclaw-ui-directory-governance-campaign/work/working-notes.md)，确认当前活跃批次、已完成批次与下一步持续更新。
3. 检查对应 commit 与验证记录，确认每一层目录优化都在可运行前提下独立收敛。
4. 若当前尚未出现目录优化 commit，先检查 [work/working-notes.md](/Users/peiwang/Projects/nextbot/docs/logs/v0.16.85-nextclaw-ui-directory-governance-campaign/work/working-notes.md) 中记录的阻塞与下一步，确认战役没有在错误路径上继续累积垃圾改动。
5. 当前至少应看到二十三处 contract-aligned 的治理结果：除了前二十二处治理样例外，还应看到 `components/config/runtime-security-card.tsx` 已从 legacy root 移入 `features/system-status/components/runtime-security-card.tsx`，`security-config.tsx` 直接消费新的 allowed-root 实现，而被证伪的 `ChannelForm` / `ChannelsList` / `weixin-channel-auth-section` 大批次方案已明确记入否决候选，不再作为“带病也推进”的路径。

# 可维护性总结汇总

本次是否已尽最大努力优化可维护性：是。第二十三批继续从 `components/config` 吃掉页面级实现，把 `runtime-security-card` 迁入 `features/system-status/components`，并同步把 `security-config` 的真实消费切到 allowed roots；同时没有硬推那条已经被验证为低置信的 `features/channels` 大批次路径，而是把它明确降级为否决候选。

是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。第二十三批没有新增用户能力，只做卡片实现归位与消费方切根；新文件内部顺手收敛出稳定的卡片壳与两段局部结构，没有把复杂度换个目录继续保留。对于 `ChannelForm` 这条线，当前选择的是及时止损而不是继续叠补丁。

是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：是。第二十三批代码净变化为 `-12`，非测试代码净变化为 `-12`；`components/config` 再少一个页面级实现文件，`features/system-status/components` 的语义聚合继续加强，且这次没有引入新的 alias 或 shim 膨胀。

抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。`runtime-security-card` 现在与 `security-config` 同属 `features/system-status/components/`，运行时安全相关 UI 不再散落在 `components/config`；新文件内部把重复卡片壳与两段稳定内容提成局部子组件，属于就地减复杂度，而不是再抽一层无意义公共件。

目录结构与文件组织是否满足当前项目治理要求：仍未完全满足，但第二十三批之后 `components/config` 又少了一块运行时安全卡片实现，`features/system-status` 对这一语义线的承接更完整。`packages/nextclaw-ui/src/components/config`、`components/chat`、`components/ui`、`lib`、`api` 依旧是历史债务热点；其中 `ChannelForm` / `ChannelsList` / `weixin-channel-auth-section` 当前不是高置信目录迁移候选，后续要么等待更成组的 feature-root 方案，要么先转向 `components/chat` 与其它 `components/config` 页面级实现。当前 strict 合同没有被放宽，后续整理仍必须直接在 allowed roots 完成。

若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：适用。第二十三批独立复核结论为“通过，继续推进下一层级”。代码增减报告：新增 `265` 行，删除 `277` 行，净增 `-12` 行。非测试代码增减报告：新增 `265` 行，删除 `277` 行，净增 `-12` 行。可维护性总结：这一批把 `runtime-security-card` 彻底拖进了 `features/system-status/components`，并把真实消费切到 allowed roots；strict 合同、治理守卫、非功能净增和 backlog ratchet 全部通过。同步记录的结论是：`ChannelForm` / `ChannelsList` / `weixin-channel-auth-section` 这条线在当前形态下需要结构重写才能过治理，因此被明确从“高置信自动推进”队列移除，避免后续继续吞吐浪费。

# NPM 包发布记录

不涉及 NPM 包发布。
