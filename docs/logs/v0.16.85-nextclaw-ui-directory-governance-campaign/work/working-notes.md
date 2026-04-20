# 当前目标

- 战役名称：`nextclaw-ui` 目录组织自治治理战役
- 本轮目标：沿着已经验证通过的 contract-aligned 路径，继续把 `components/config` 中适合归入既有 feature 的页面实现迁入 allowed roots
- 成功判定：每完成一个 legacy 页面实现的真实迁移，就通过最小验证、更新状态记录，并提交一个独立 commit

# 当前事实

- `packages/nextclaw-ui/src/components/config` 当前直接代码文件数为 `37`
- `packages/nextclaw-ui/src/components/chat` 当前直接代码文件数为 `35`
- `packages/nextclaw-ui/src/lib` 当前直接代码文件数为 `28`
- `packages/nextclaw-ui/src/api` 当前直接代码文件数为 `26`
- `packages/nextclaw-ui/src/components/ui` 当前直接代码文件数为 `22`
- `packages/nextclaw-ui/module-structure.config.json` 将该包声明为 `frontend-l3` 协议，allowed roots 只有 `app`、`features`、`shared`、`platforms`
- 当前 `rootPolicy=legacy-frozen`，不能继续在 `components`、`lib`、`api`、`hooks` 等 legacy roots 下新增新层级或新文件
- 首批尝试在 `components/config` 下新建 provider 子树，真实验证后被 `module-structure`、目录预算和非功能净增闸门阻断，代码尝试已回撤
- 当前仓库存在与本战役无关的未提交改动，本轮必须避免触碰这些路径

# 关键约束 / 不变量

- 必须遵守 `docs/VISION.md`
- 必须遵守 `AGENTS.md` 的 Rulebook / Project Rulebook 与 `docs/logs` 规则
- 必须遵守 `commands/commands.md` 中与治理相关的执行入口
- 当前任务属于非功能改动，默认以 `非测试代码净增 <= 0` 为硬门槛
- 仅在高置信时持续自治推进
- 低置信决策必须停下并记录阻塞原因
- 任何新目录层级都必须先满足 `frontend-l3` 的 allowed roots 约束

# 治理机制核对

- 本轮直接依赖的规则：`business-logic-must-use-class`、`class-over-function-sprawl`、`stateless-utility-first`、`ordinary-function-no-input-mutation`、`class-arrow-methods-by-default`、`react-effect-boundary-only`
- 本轮直接依赖的命令 / skill：`/validate`、`/maintainability-review`、`autonomous-maintainability-campaign`、`iteration-work-notes`、`post-edit-maintainability-guard`、`post-edit-maintainability-review`、`file-organization-governance`、`role-first-file-organization`、`collapsible-feature-root-architecture`
- 本轮是否属于非功能改动：是
- 本轮是否命中 hotspot / 目录预算 / 命名治理等专项场景：命中目录预算、命名治理和 module-structure 合同治理
- 执行节奏约定：每一轮完成、验证、提交后自动进入下一轮；只有在低置信阻塞或治理硬失败时才暂停并记录
- 用户明确追加要求：不要等待用户再次发话。后续默认策略是“每完成一轮之后自动进行下一轮”，把这条要求视为本战役的持续执行约束，而不是一次性提醒

# 候选问题批次

- [x] `components/config` 合同校准与失败路径回收
- [x] `security-config` 迁入 `features/system-status` 并保留 legacy 薄转发入口
- [x] `runtime-presence-card` 迁入 `features/system-status/components` 并保留 legacy 薄转发入口
- [x] `config-split-page` 迁入 `shared/components` 并保留 legacy 薄转发入口
- [x] `provider-pill-selector` 与 `provider-status-badge` 迁入 `shared/components`
- [x] `provider-enabled-field` 迁入 `shared/components`
- [x] `provider-advanced-settings-section` 迁入 `shared/components`
- [x] `provider-auth-section` 迁入 `shared/components`
- [x] 建立 `features/channels`，并迁入 `channel-form-fields` 与 `channel-form-fields-section`
- [x] `runtime-config-agent.utils` 迁入 `features/system-status/utils`
- [x] `channel-form-fields.test.ts` 迁入 `features/channels/utils`
- [x] 按 `system-status` 语义线成组迁入 `runtime-control-card` 与相关测试
- [ ] 继续从 `components/config` 里挑选下一个已是 kebab-case、能挂入既有 feature 的页面
- [ ] `components/chat` 顶层平铺目录收敛
- [ ] `lib` 混合关注点收敛
- [ ] `api` 契约/客户端/类型拆分

# 当前活跃批次

- 名称：`components/config` allowed-root 连续迁移
- 选中原因：`security-config` 已证明“真实实现迁入 feature、旧路径缩成薄转发”是可通过治理的正确路径
- 预计最小闭环：继续选一个语义稳定、命名已合规的小页面文件，复制同样模式拿到第二个独立 commit

# 已完成

- 新建本次战役的迭代留痕目录与 `work/` 状态文件
- 盘点 `nextclaw-ui` 目录热点，确认首批目标为 `components/config`
- 验证并确认 `nextclaw-ui` 受 `frontend-l3 + legacy-frozen` 合同约束
- 完整跑过一次失败路径并回撤代码尝试，避免把未通过治理检查的半成品留在工作区
- 完成 `components/config/security-config.tsx -> features/system-status/components/security-config.tsx` 的真实实现迁移
- 把 legacy 路径收窄为兼容导出，避免触碰 `app.tsx` 与 `src/app/` 的历史命名冲突
- 通过本批次最小验证：
  - `pnpm --filter @nextclaw/ui exec vitest run src/app.test.tsx`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/security-config.tsx packages/nextclaw-ui/src/features/system-status/index.ts packages/nextclaw-ui/src/features/system-status/components/security-config.tsx`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/security-config.tsx packages/nextclaw-ui/src/features/system-status/index.ts packages/nextclaw-ui/src/features/system-status/components/security-config.tsx`
  - `pnpm check:governance-backlog-ratchet`
- 完成 `components/config/runtime-presence-card.tsx -> features/system-status/components/runtime-presence-card.tsx` 的真实实现迁移
- 在新文件中新增 `PresenceCardFrame`，消除重复的卡片壳结构，确保不是只换目录而是顺手降低重复度
- 通过第二批最小验证：
  - `pnpm --filter @nextclaw/ui exec vitest run src/components/config/runtime-presence-card.test.tsx`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/runtime-presence-card.tsx packages/nextclaw-ui/src/features/system-status/components/runtime-presence-card.tsx`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/runtime-presence-card.tsx packages/nextclaw-ui/src/features/system-status/components/runtime-presence-card.tsx`
  - `pnpm check:governance-backlog-ratchet`
- 完成 `components/config/config-split-page.tsx -> shared/components/config-split-page.tsx` 的真实实现迁移
- 打通 `shared` 允许根路径，后续 `ChannelForm`、`ProvidersList`、`SearchConfig` 等多个页面都可沿这条路径继续脱离 legacy root
- 通过第三批最小验证：
  - `pnpm --filter @nextclaw/ui exec vitest run src/components/config/SearchConfig.test.tsx`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/config-split-page.tsx packages/nextclaw-ui/src/shared/components/config-split-page.tsx`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/config-split-page.tsx packages/nextclaw-ui/src/shared/components/config-split-page.tsx`
  - `pnpm check:governance-backlog-ratchet`
- 完成 `components/config/provider-pill-selector.tsx` 与 `components/config/provider-status-badge.tsx` 的真实实现迁移
- `shared/components` 开始承接 provider 相关小型通用 UI 原件，不再只承接布局壳
- 通过第四批最小验证：
  - `pnpm --filter @nextclaw/ui exec vitest run src/components/config/providers-list.test.tsx`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/provider-pill-selector.tsx packages/nextclaw-ui/src/components/config/provider-status-badge.tsx packages/nextclaw-ui/src/shared/components/provider-pill-selector.tsx packages/nextclaw-ui/src/shared/components/provider-status-badge.tsx`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/provider-pill-selector.tsx packages/nextclaw-ui/src/components/config/provider-status-badge.tsx packages/nextclaw-ui/src/shared/components/provider-pill-selector.tsx packages/nextclaw-ui/src/shared/components/provider-status-badge.tsx`
  - `pnpm check:governance-backlog-ratchet`
- 完成 `components/config/provider-enabled-field.tsx -> shared/components/provider-enabled-field.tsx` 的真实实现迁移
- `shared/components` 继续承接 provider 配置表单里的通用开关行，证明可以逐步把 provider 表单拆成更细颗粒度的共享原件
- 通过第五批最小验证：
  - `pnpm --filter @nextclaw/ui exec vitest run src/components/config/providers-list.test.tsx`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/provider-enabled-field.tsx packages/nextclaw-ui/src/shared/components/provider-enabled-field.tsx`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/provider-enabled-field.tsx packages/nextclaw-ui/src/shared/components/provider-enabled-field.tsx`
  - `pnpm check:governance-backlog-ratchet`
- 完成 `components/config/provider-advanced-settings-section.tsx -> shared/components/provider-advanced-settings-section.tsx` 的真实实现迁移
- `shared/components` 开始承接 provider 表单里的稳定子区块，不再只接小型原件
- 通过第六批最小验证：
  - `pnpm --filter @nextclaw/ui exec vitest run src/components/config/providers-list.test.tsx`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/provider-advanced-settings-section.tsx packages/nextclaw-ui/src/shared/components/provider-advanced-settings-section.tsx`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/provider-advanced-settings-section.tsx packages/nextclaw-ui/src/shared/components/provider-advanced-settings-section.tsx`
  - `pnpm check:governance-backlog-ratchet`
- 完成 `components/config/provider-auth-section.tsx -> shared/components/provider-auth-section.tsx` 的真实实现迁移
- provider 表单中的授权区块也已进入 `shared/components`，说明这条路径已经覆盖到 provider 表单的大部分稳定子区块
- 通过第七批最小验证：
  - `pnpm --filter @nextclaw/ui exec vitest run src/components/config/providers-list.test.tsx`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/provider-auth-section.tsx packages/nextclaw-ui/src/shared/components/provider-auth-section.tsx`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/provider-auth-section.tsx packages/nextclaw-ui/src/shared/components/provider-auth-section.tsx`
  - `pnpm check:governance-backlog-ratchet`
- 建立 `features/channels/index.ts`
- 完成 `components/config/channel-form-fields.ts -> features/channels/utils/channel-form-fields.utils.ts` 的真实实现迁移
- 完成 `components/config/channel-form-fields-section.tsx -> features/channels/components/channel-form-fields-section.tsx` 的真实实现迁移
- `ChannelForm` 这条链开始形成自己的 feature 语义边界，不再只是在 `components/config` 下堆内部支撑件
- 通过第八批最小验证：
  - `pnpm --filter @nextclaw/ui exec vitest run src/components/config/channel-form-fields.test.ts`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/channel-form-fields.ts packages/nextclaw-ui/src/components/config/channel-form-fields-section.tsx packages/nextclaw-ui/src/features/channels/index.ts packages/nextclaw-ui/src/features/channels/components/channel-form-fields-section.tsx packages/nextclaw-ui/src/features/channels/utils/channel-form-fields.utils.ts`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/channel-form-fields.ts packages/nextclaw-ui/src/components/config/channel-form-fields-section.tsx packages/nextclaw-ui/src/features/channels/index.ts packages/nextclaw-ui/src/features/channels/components/channel-form-fields-section.tsx packages/nextclaw-ui/src/features/channels/utils/channel-form-fields.utils.ts`
  - `pnpm check:governance-backlog-ratchet`
- 完成 `components/config/runtime-config-agent.utils.ts -> features/system-status/utils/runtime-config-agent.utils.ts` 的真实实现迁移
- 运行时配置的纯工具能力开始回收到 `system-status` feature 语义边界内，而不是继续散落在 `components/config`
- 通过第九批最小验证：
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/runtime-config-agent.utils.ts packages/nextclaw-ui/src/features/system-status/utils/runtime-config-agent.utils.ts`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/runtime-config-agent.utils.ts packages/nextclaw-ui/src/features/system-status/utils/runtime-config-agent.utils.ts`
  - `pnpm check:governance-backlog-ratchet`
- 完成 `components/config/channel-form-fields.test.ts -> features/channels/utils/channel-form-fields.utils.test.ts` 的测试归位
- `features/channels` 不再只有实现文件，测试也开始跟着真实实现一起沉淀到 feature 内部
- 通过第十批最小验证：
  - `pnpm --filter @nextclaw/ui exec vitest run src/features/channels/utils/channel-form-fields.utils.test.ts`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/channel-form-fields.test.ts packages/nextclaw-ui/src/features/channels/utils/channel-form-fields.utils.test.ts`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/channel-form-fields.test.ts packages/nextclaw-ui/src/features/channels/utils/channel-form-fields.utils.test.ts`
  - `pnpm check:governance-backlog-ratchet`
- 完成 `components/config/runtime-control-card.tsx -> features/system-status/components/runtime-control-card.tsx` 的真实实现迁移
- 完成 `components/config/runtime-control-card.test.tsx -> features/system-status/components/runtime-control-card.test.tsx` 的测试归位
- 完成 `components/config/runtime-presence-card.test.tsx -> features/system-status/components/runtime-presence-card.test.tsx` 的测试归位
- 这一批不再按单文件推进，而是按 `system-status` 语义线成组收敛，实现 + 相邻测试一起归位，吞吐量显著高于前一轮
- 通过第十一批最小验证：
  - `pnpm --filter @nextclaw/ui exec vitest run src/features/system-status/components/runtime-control-card.test.tsx src/features/system-status/components/runtime-presence-card.test.tsx src/app.test.tsx`
  - `pnpm --filter @nextclaw/ui exec tsc --noEmit`
  - `pnpm lint:new-code:governance -- packages/nextclaw-ui/src/components/config/runtime-control-card.tsx packages/nextclaw-ui/src/components/config/runtime-control-card.test.tsx packages/nextclaw-ui/src/components/config/runtime-presence-card.test.tsx packages/nextclaw-ui/src/features/system-status/components/security-config.tsx packages/nextclaw-ui/src/features/system-status/components/runtime-control-card.tsx packages/nextclaw-ui/src/features/system-status/components/runtime-control-card.test.tsx packages/nextclaw-ui/src/features/system-status/components/runtime-presence-card.test.tsx`
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-ui/src/components/config/runtime-control-card.tsx packages/nextclaw-ui/src/components/config/runtime-control-card.test.tsx packages/nextclaw-ui/src/components/config/runtime-presence-card.test.tsx packages/nextclaw-ui/src/features/system-status/components/security-config.tsx packages/nextclaw-ui/src/features/system-status/components/runtime-control-card.tsx packages/nextclaw-ui/src/features/system-status/components/runtime-control-card.test.tsx packages/nextclaw-ui/src/features/system-status/components/runtime-presence-card.test.tsx`
  - `pnpm check:governance-backlog-ratchet`

# 已排除项

- 暂不触达已有未提交的内核相关改动路径
- 暂不把低置信的跨 feature 重组和产品语义调整混入本轮目录治理
- 排除继续在 `components/config`、`components/chat`、`lib`、`api` 等 legacy roots 下直接新增子树的做法
- 排除 `desktop-update-config` 当前版本的直接迁移方案：会引入新的长函数文件预算问题，并通过平台根导出带来循环依赖/测试语义偏移风险

# 关键决策

- 当前战役新建独立迭代目录 `v0.16.85-nextclaw-ui-directory-governance-campaign`，因为这不是上一次 skill 创建迭代的同批次续改
- 第一批原定直拆 `components/config`，但经真实验证后确认与模块结构合同冲突，必须改成“先迁入 allowed roots，再做子树收敛”
- 在新的高置信批次形成前，不保留任何未通过治理闸门的代码结构尝试
- `security-config` 这一步不再修改 `app.tsx`，而是通过 legacy 薄转发过渡，避免触发 `src/app.tsx` 与 `src/app/` 的 file-directory collision 治理规则
- `runtime-presence-card` 证明除了整页配置入口外，较小的运行时卡片也可以按“真实实现迁入 feature + legacy 薄转发”模式逐步抽离
- `config-split-page` 证明通用布局壳也可以按“真实实现迁入 shared + legacy 薄转发”模式抽离，allowed roots 不只限于 feature
- `provider-pill-selector` 与 `provider-status-badge` 证明 `shared/components` 可以继续承接更细粒度的通用 UI 原件，而不需要把所有复用都留在 `components/config`
- `provider-enabled-field` 进一步证明 provider 表单中的小型通用控件也可以稳定迁入 `shared/components`
- `provider-advanced-settings-section` 进一步证明 provider 表单里的稳定子区块也可以迁入 `shared/components`，后续可以继续抽离 `provider-auth-section`
- `provider-auth-section` 已经完成，说明 `provider-form-support.ts` 之外的主要 provider 表单子块都在向 `shared/components` 收拢
- `features/channels` 已经建立，说明 `components/config` 不只是能向 `shared` 收缩，也能向新的 feature root 收缩；下一步可以继续评估 `ChannelForm` / `ChannelsList` 周边子模块是否适合并入这个 feature
- `runtime-config-agent.utils` 已完成，说明除了 UI 子块外，`components/config` 里的纯工具逻辑也能按语义回收到既有 feature
- `channel-form-fields.utils.test.ts` 已完成，说明 `features/channels` 这条线现在可以继续同时承接实现与测试，不必长期让测试挂在 legacy 根目录
- `runtime-control-card` 与 `runtime-presence-card` 的测试现已随 `system-status` feature 一起归位，说明后续可以按“同一语义线的实现 + 测试 + 薄转发入口”成组推进，而不是继续一批只搬一个点

# 下一步

- 继续扫描 `components/config` 里已是 kebab-case 的页面、卡片或通用 UI 原件，优先按语义线成组打包，而不是单点迁移；当前优先观察 `system-status` 剩余卡片、`channels` 页面壳与 `shared/components` 中可连带迁移的小型原件
- 只有当无法找到可挂入既有 feature 的小文件时，才重新评估是否需要新增 `shared` 或新的 feature root

# 停止原因 / 阻塞

- 当前前两个高置信批次都已形成并通过验证，剩余阻塞不在已完成批次本身，而在后续候选项必须继续满足：allowed roots、目录预算、命名治理、非功能净增 `<= 0`
- `components/config` 的历史目录预算债务依旧存在，意味着后续批次必须优先搬实现在旧根目录的页面，而不是新增任何新平铺文件

# 交接提醒

- 若上下文压缩，下一轮先重读本文件和 `state.json`
- 下一轮不要再从 legacy `components/config` 里直接长新目录，而要延续“真实实现迁入 feature + legacy 薄转发”的模式
