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

# 发布 / 部署方式

本迭代聚焦目录治理，不涉及独立部署。若某批次仅调整前端源码目录结构，则以通过最小验证并合入代码为生效方式。

# 用户 / 产品视角的验收步骤

1. 打开 [packages/nextclaw-ui/src](</Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src>)，确认热点目录不再长期维持大规模平铺。
2. 检查 [work/working-notes.md](/Users/peiwang/Projects/nextbot/docs/logs/v0.16.85-nextclaw-ui-directory-governance-campaign/work/working-notes.md)，确认当前活跃批次、已完成批次与下一步持续更新。
3. 检查对应 commit 与验证记录，确认每一层目录优化都在可运行前提下独立收敛。
4. 若当前尚未出现目录优化 commit，先检查 [work/working-notes.md](/Users/peiwang/Projects/nextbot/docs/logs/v0.16.85-nextclaw-ui-directory-governance-campaign/work/working-notes.md) 中记录的阻塞与下一步，确认战役没有在错误路径上继续累积垃圾改动。
5. 当前至少应看到十六处 contract-aligned 的治理结果：除了前十五处迁移样例外，还应看到 `packages/nextclaw-ui/module-structure.config.json` 已切到严格 `contract-only`，后续任何 legacy root 触达都会被治理闸门直接阻断。

# 可维护性总结汇总

本次是否已尽最大努力优化可维护性：是，就当前这一批次而言已经做到最小必要收敛。我们没有继续扩张 legacy roots，而是把一个已有系统状态页面的真实实现迁入 allowed root，并保留最薄兼容入口，避免一次性撕裂历史调用面。

是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。本批次没有新增用户能力，只做实现归位与兼容出口收窄；旧文件由完整页面实现降为单行转发，复杂度明显下降。

是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：是。当前十五个成功批次中，除第三批与第十批为零增长外，其余批次都实现了非测试代码负增长；`components/config/security-config.tsx`、`components/config/runtime-presence-card.tsx`、`components/config/runtime-control-card.tsx`、`components/config/config-split-page.tsx`、`components/config/provider-pill-selector.tsx`、`components/config/provider-status-badge.tsx`、`components/config/provider-enabled-field.tsx`、`components/config/provider-advanced-settings-section.tsx`、`components/config/provider-auth-section.tsx`、`components/config/channel-form-fields.ts`、`components/config/channel-form-fields-section.tsx` 与 `components/config/runtime-config-agent.utils.ts` 都已经收窄为兼容出口；`components/chat` 现在已经把两条完整的纯支撑线、稳定组件子块和一整条侧栏/工作区面板组件线迁入 `features/chat`。`components/config` 与 `components/chat` 顶层文件数虽仍未收敛到预算内，但都没有继续恶化，并且已拿到可复制的 feature 化路径。

抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。`security-config` 与 `runtime-presence-card` 都属于系统状态与运行环境展示面，落到既有 `features/system-status` 更符合模块边界；`config-split-page`、`provider-pill-selector`、`provider-status-badge`、`provider-enabled-field`、`provider-advanced-settings-section`、`provider-auth-section` 则是跨多个配置页面复用的 UI 原件或稳定子区块，迁入 `shared/components` 后边界更清晰；`channel-form-fields` 与 `channel-form-fields-section` 开始形成独立的 `features/channels` 语义边界；`runtime-config-agent.utils` 进一步把运行时配置辅助逻辑收回 `features/system-status`；`chat-session-type-option-item` 与 `chat-session-workspace-file-preview` 让 `features/chat` 从纯支撑线扩展到可被侧栏与工作区面板直接消费的稳定组件边界；本批次继续把 `chat` 侧栏与 workspace panel 的成组组件收回 `features/chat/components`，让 `features/chat` 开始具备承接完整面板子系统的能力。整个过程没有引入新的假角色目录或额外 helper。

目录结构与文件组织是否满足当前项目治理要求：治理合同已经收紧到严格模式，但现状仍未完全满足。`packages/nextclaw-ui/src/components/config`、`components/chat`、`components/ui`、`lib`、`api` 等目录依旧是历史债务热点；区别在于从这一批开始，`nextclaw-ui` 不再允许继续触碰这些 legacy roots 并“边改边过”，后续所有整理都必须直接在 allowed roots 完成并沿真实消费链整体切换。

若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：适用。本批次独立复核结论为“通过，继续推进下一层级”。原因是这一步确实减少了 legacy 目录中的实质实现代码，且没有把复杂度转移成新的横向耦合；唯一保留风险是 `components/config` 的目录预算债务仍在，需要后续连续批次继续偿还。

# NPM 包发布记录

不涉及 NPM 包发布。
