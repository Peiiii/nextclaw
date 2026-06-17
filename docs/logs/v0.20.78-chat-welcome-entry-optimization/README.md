# v0.20.78 Chat Welcome Entry Optimization

## 迭代完成说明

阶段完成。本迭代目标是把新会话入口从底部输入栏升级为居中的意图入口，同时把 welcome 相关逻辑收敛为 chat 内部子 feature，并完成至少 30 项代码可维护性、清晰度、解耦可插拔和克制 UI 优化。

当前已完成的第一批方向：

- welcome UI 已迁入 `features/chat/features/welcome/` 子 feature。
- welcome 显示规则已从 conversation panel 抽到 welcome util。
- 新会话 welcome 使用嵌入式 input surface，复用原输入链路，不复制 composer。
- 新会话 project 选择使用已有 session project dialog，并默认使用配置里的 workspace。
- welcome 左下方已支持 project、agent、session type 三类上下文选择。
- project 选择升级为历史项目 popover，列表区可滚动，底部固定“打开文件夹”操作。
- agent 选择入口展示头像与名称。
- welcome 引导卡片点击后填入示例 prompt，并把光标定位到 prompt 末尾。
- 模型选择器支持搜索、收藏/取消收藏，收藏模型置顶展示。
- 新增 kernel 通用偏好 KV manager/store，并通过 server preferences route 与 UI API 持久化模型收藏。
- chat 输入相关浮层统一增加可用高度约束和边界 padding，覆盖模型搜索、普通选择、技能选择、slash 菜单、welcome 项目、Agent 和会话类型面板。
- 浮层碰撞边界默认合同已下沉到 shared UI / agent-chat-ui primitive，业务面板不再重复声明固定 `collisionPadding`。
- 模型选择面板最新收紧为 `18rem` 设计上限，shared UI / agent-chat-ui Popover 与 Select 均保留 `2rem` 视口边距，并让长列表在内部滚动。
- 模型收藏星标补充 toggle 状态语义，`aria-pressed` 会随收藏状态变化。
- 相关规范已补充到 `collapsible-feature-root-architecture` skill。

详细进展见 [work/working-notes.md](work/working-notes.md) 与 [work/goal-progress.md](work/goal-progress.md)。

## 测试/验证/验收方式

已执行：

- `pnpm --filter @nextclaw/ui test -- src/features/chat/features/welcome/components/__tests__/chat-welcome.test.tsx src/features/chat/features/welcome/components/__tests__/chat-conversation-welcome.test.tsx src/features/chat/features/welcome/utils/__tests__/chat-welcome-draft.utils.test.ts src/features/chat/features/welcome/utils/__tests__/chat-welcome-project-options.utils.test.ts src/features/chat/features/welcome/utils/__tests__/chat-welcome-visibility.utils.test.ts src/features/chat/components/conversation/__tests__/chat-conversation-panel.test.tsx src/features/chat/managers/__tests__/chat-input.manager.test.ts src/features/chat/features/input/utils/__tests__/ncp-chat-input-availability.utils.test.ts`
- `pnpm --filter @nextclaw/agent-chat-ui test -- src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/agent-chat-ui tsc`
- `pnpm --filter @nextclaw/ui lint`
- `pnpm --filter @nextclaw/agent-chat-ui lint`
- `pnpm --filter @nextclaw/ui build`
- `pnpm --filter @nextclaw/agent-chat-ui build`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `pnpm check:generated-clean`
- `pnpm --filter @nextclaw/ui test -- src/features/chat/components/conversation/__tests__/chat-conversation-panel.test.tsx src/features/chat/features/welcome/components/__tests__/chat-conversation-welcome.test.tsx`
- `pnpm --filter @nextclaw/ui test -- src/features/chat/features/welcome/components/__tests__/chat-welcome.test.tsx src/features/chat/features/welcome/components/__tests__/chat-conversation-welcome.test.tsx src/features/chat/features/welcome/utils/__tests__/chat-welcome-selection.utils.test.ts src/features/chat/managers/__tests__/chat-input.manager.test.ts src/features/chat/features/input/utils/__tests__/chat-input-bar.utils.test.ts`
- `pnpm --filter @nextclaw/agent-chat-ui test -- src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx src/components/chat/ui/chat-input-bar/chat-input-bar-toolbar.test.tsx src/components/chat/ui/chat-input-bar/chat-slash-menu.test.tsx`
- `pnpm --filter @nextclaw/kernel test -- src/managers/__tests__/preference.manager.test.ts`
- `pnpm --filter @nextclaw/server test -- src/features/preferences/controllers/preferences.controller.test.ts`
- `pnpm --filter @nextclaw/kernel tsc`
- `pnpm --filter @nextclaw/server tsc`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/agent-chat-ui tsc`
- `pnpm --filter @nextclaw/kernel lint`
- `pnpm --filter @nextclaw/server lint`
- `pnpm --filter @nextclaw/ui lint`
- `pnpm --filter @nextclaw/agent-chat-ui lint`
- `pnpm --filter @nextclaw/ui build`
- `pnpm --filter @nextclaw/agent-chat-ui build`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `pnpm check:generated-clean`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths ...`
- 本地 dev UI 冒烟：`http://127.0.0.1:5176/chat/draft`，在 `1200x560` 小高度视口验证 welcome 输入栏、模型搜索面板、技能面板、slash 菜单、project 面板、Agent 面板、session type 面板不贴边/不越界；最新 DOM 边界为 model `24-337`、skill `24-337`、slash `275-536`、project `200-395`、agent `114-402`、session type `178-395`；点击“智能对话”卡片后输入框填入 prompt，selection anchor/focus 都等于文本长度。
- `pnpm --filter @nextclaw/agent-chat-ui test -- src/components/chat/view-models/chat-ui.contract.test.ts src/components/chat/ui/chat-message-list/chat-message-list.test.tsx`
- `pnpm --filter @nextclaw/agent-chat-ui test`
- `pnpm --filter @nextclaw/agent-chat-ui test -- src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx src/components/chat/ui/chat-input-bar/chat-input-bar-toolbar.test.tsx src/components/chat/ui/chat-input-bar/chat-slash-menu.test.tsx`
- `pnpm --filter @nextclaw/agent-chat-ui tsc`
- `pnpm --filter @nextclaw/agent-chat-ui lint`
- `pnpm --filter @nextclaw/ui test -- src/features/chat/features/welcome src/features/chat/components/layout/__tests__/chat-conversation-panel.test.tsx`
- `pnpm --filter @nextclaw/ui test -- src/features/chat/features/session-type/components/__tests__/chat-sidebar-create-menu.test.tsx src/features/chat/components/layout/__tests__/chat-sidebar.test.tsx src/features/chat/features/session/components/session-header/__tests__/chat-session-project-badge.test.tsx`
- `pnpm --filter @nextclaw/ui test -- src/features/chat/features/welcome src/features/chat/features/session-type/components/__tests__/chat-sidebar-create-menu.test.tsx src/features/chat/features/session/components/session-header/__tests__/chat-session-project-badge.test.tsx`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/ui lint`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- 本地 dev UI 冒烟：`http://127.0.0.1:5174/chat/draft`，用系统 Chrome 在 `1200x560`、`1200x440`、`1200x360` 视口读取 Radix portal DOM 边界。`1200x560`：model `24-337`、skill `24-337`、project `200-395`、agent `114-402`、session type `178-395`、slash `275-536`；`1200x440` 全部 `overflowTop=false/overflowBottom=false`；`1200x360` 模型和技能面板自动压缩到 `24-320`，slash 为 `24-238`。
- 本地 dev UI 冒烟：`http://127.0.0.1:5174/chat/draft`，在 `1200x360` 视口打开 sidebar 新建会话类型菜单，DOM 边界为 `88-307`，`overflowTop=false/overflowBottom=false`，菜单根节点 max-height 为 `min(18rem, calc(var(--radix-popover-content-available-height) - 0.75rem))` 且 `overflow-y:auto`。
- 本地 dev UI 冒烟：`http://127.0.0.1:5174/chat/draft`，在 `1200x360` 视口复验 helper 抽取后的 model、skill、slash、sidebar-create 面板，均为 `overflowTop=false/overflowBottom=false`，并确认 DOM inline maxHeight 仍由同一 Radix available-height 公式生成。
- 本地 dev UI 冒烟：`http://127.0.0.1:5174/chat/draft`，在 shared / agent-chat-ui `PopoverContent` 默认高度兜底后，用 `1200x360` 视口复验 model `24-320`、skill `24-320`、slash `24-238`、sidebar-create `88-307`，全部满足距离上下边界至少 12px。
- `pnpm --filter @nextclaw/ui test -- src/features/settings/pages/__tests__/model-config-page.test.tsx`
- `pnpm --filter @nextclaw/ui test -- src/features/agents/components/__tests__/agents-page.test.tsx`
- `pnpm --filter @nextclaw/ui test -- src/features/settings/pages/__tests__/model-config-page.test.tsx`
- `pnpm --filter @nextclaw/ui tsc`
- `rg -n "No models available|createText \\?|emptyText \\?\\?" packages/nextclaw-ui/src/shared/components/common/searchable-model-input.tsx packages/nextclaw-ui/src/shared/components/common/provider-scoped-model-input.tsx -S`
- `pnpm --filter @nextclaw/agent-chat-ui test -- src/components/chat/ui/chat-input-bar/chat-input-bar-toolbar.test.tsx`
- `pnpm --filter @nextclaw/agent-chat-ui tsc`
- `pnpm --filter @nextclaw/ui test -- src/features/chat/features/session/components/session-header/__tests__/chat-session-project-badge.test.tsx src/features/chat/features/session-type/components/__tests__/chat-sidebar-create-menu.test.tsx`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/ui test -- src/features/chat/features/session/components/session-header/__tests__/chat-session-project-badge.test.tsx`
- `pnpm --filter @nextclaw/agent-chat-ui test -- src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx`
- `pnpm --filter @nextclaw/agent-chat-ui tsc`
- `pnpm --filter @nextclaw/agent-chat-ui lint`
- 本地 dev UI 冒烟：`http://127.0.0.1:5174/model`，在 `900x360` 视口打开 shared 模型候选 Popover，DOM 边界为 `155-237`，max-height 为 `min(15rem, calc(var(--radix-popover-content-available-height) - 0.75rem))`，未贴边/越界。
- `pnpm lint:maintainability:guard`
- `pnpm --filter @nextclaw/agent-chat-ui test -- src/components/chat/ui/chat-input-bar/chat-input-bar-toolbar.test.tsx src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx src/components/chat/ui/chat-input-bar/chat-slash-menu.test.tsx src/components/chat/ui/chat-message-list/chat-message-list.test.tsx`
- `pnpm --filter @nextclaw/ui test -- src/shared/components/common/__tests__/searchable-model-input.test.tsx src/features/chat/features/session/components/session-header/__tests__/chat-session-project-badge.test.tsx src/features/chat/features/session-type/components/__tests__/chat-sidebar-create-menu.test.tsx src/features/settings/pages/__tests__/model-config-page.test.tsx src/features/chat/features/welcome/components/__tests__/chat-welcome.test.tsx`
- `pnpm --filter @nextclaw/agent-chat-ui tsc`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/agent-chat-ui lint`
- `pnpm --filter @nextclaw/ui lint`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `pnpm check:generated-clean`
- `git diff --check`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- `pnpm --filter @nextclaw/agent-chat-ui test -- src/components/chat/ui/chat-input-bar/__tests__/chat-composer-keyboard.utils.test.ts src/components/chat/ui/chat-input-bar/__tests__/chat-composer.utils.test.ts src/components/chat/ui/chat-input-bar/__tests__/chat-input-bar-selection.test.tsx src/components/chat/ui/chat-input-bar/__tests__/chat-input-bar-toolbar.test.tsx src/components/chat/ui/chat-input-bar/__tests__/chat-input-bar.test.tsx src/components/chat/ui/chat-input-bar/__tests__/chat-slash-menu.test.tsx`
- `pnpm --filter @nextclaw/agent-chat-ui test -- src/components/chat/ui/chat-input-bar/chat-input-bar-toolbar.test.tsx src/components/chat/ui/chat-input-bar/chat-slash-menu.test.tsx src/components/chat/ui/chat-input-bar/chat-input-bar.test.tsx`
- `pnpm --filter @nextclaw/ui test -- src/shared/components/common/__tests__/searchable-model-input.test.tsx src/features/settings/pages/__tests__/model-config-page.test.tsx src/features/chat/features/session-type/components/__tests__/chat-sidebar-create-menu.test.tsx src/features/chat/features/session/components/session-header/__tests__/chat-session-project-badge.test.tsx src/features/chat/features/welcome/components/__tests__/chat-welcome.test.tsx`
- 本地 dev UI 冒烟：`http://127.0.0.1:5174/chat/draft`，直接打开模型、技能、项目、Agent、会话类型面板读取 DOM；模型面板 inline max-height 为 `min(22rem, max(0px, calc(var(--radix-popover-content-available-height, 100vh) - 1rem)))`，实际边界约为 `62-396`；技能 `45-396`，项目 `273-458`，会话类型 `251-457`，Agent `189-463`，均未贴边/越界。
- `pnpm --filter @nextclaw/agent-chat-ui test -- src/components/chat/ui/chat-input-bar/__tests__/chat-input-bar-toolbar.test.tsx src/components/chat/ui/chat-input-bar/__tests__/chat-input-bar.test.tsx src/components/chat/ui/chat-input-bar/__tests__/chat-slash-menu.test.tsx`
- `pnpm --filter @nextclaw/ui test -- src/shared/components/common/__tests__/searchable-model-input.test.tsx src/features/chat/features/session-type/components/__tests__/chat-sidebar-create-menu.test.tsx src/features/chat/features/session/components/session-header/__tests__/chat-session-project-badge.test.tsx`
- `pnpm --filter @nextclaw/agent-chat-ui test`
- `pnpm --filter @nextclaw/ui test -- src/features/chat/features/welcome/components/__tests__/chat-welcome.test.tsx src/features/settings/pages/__tests__/model-config-page.test.tsx src/features/chat/components/layout/__tests__/chat-sidebar.test.tsx`
- `pnpm --filter @nextclaw/ui test -- src/features/chat/features/message/utils/__tests__/chat-message.utils.test.ts src/features/chat/features/message/utils/__tests__/chat-message-file-operation.utils.test.ts src/features/marketplace/utils/__tests__/marketplace-installed-cache.utils.test.ts`
- `pnpm --filter @nextclaw/agent-chat-ui tsc`
- `pnpm --filter @nextclaw/agent-chat-ui lint`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/ui lint`：0 error，3 warnings；剩余为 settings `ProviderForm` / `SecretsConfigForm` 既有结构 warning。
- 本地 dev UI 冒烟：`http://127.0.0.1:5174/chat/draft`，Playwright `1200x420` 打开模型面板，content `63.6-337.8`，computed max-height `288px`，内部列表 scrollHeight `854` / clientHeight `230`。
- 本地 dev UI 冒烟：`http://127.0.0.1:5174/chat/draft`，Playwright `1200x360` 打开模型面板，content `58.9-321.1`，computed max-height `276px`，内部列表 scrollHeight `854` / clientHeight `218`，未贴边且内部滚动。
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `pnpm check:generated-clean`
- `git diff --check`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`：0 error，2 warnings；剩余为 `diff.utils.ts` 接近预算和 `shared/components/ui` 既有目录预算 README 例外。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`：0 error，1 warning；剩余 warning 仅为 `shared/components/ui` 既有目录预算 README 例外。
- `pnpm --filter @nextclaw/agent-chat-ui test -- src/components/chat/utils/copy-text.utils.test.ts`
- `pnpm --filter @nextclaw/agent-chat-ui test`
- `pnpm --filter @nextclaw/agent-chat-ui tsc`
- `pnpm --filter @nextclaw/agent-chat-ui lint`：0 error，0 warning。
- `pnpm lint:new-code:governance`
- `pnpm --filter @nextclaw/ui test -- src/features/settings/pages/__tests__/secrets-config-page.test.tsx src/features/settings/utils/__tests__/secrets-config-form.utils.test.ts src/features/settings/utils/__tests__/provider-form-support.utils.test.ts src/features/settings/pages/__tests__/providers-config-page.test.tsx`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/ui lint`：0 error，0 warning。
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `pnpm check:generated-clean`
- `git diff --check`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`：0 error，4 warnings；剩余为 `diff.utils.ts` 接近预算、`ProviderForm` 仍高于预算但本轮减少 103 行、`provider-form-support.utils.ts` 接近预算、`shared/components/ui` 既有目录预算 README 例外。

## 发布/部署方式

暂未发布。本轮是源码与 UI 体验改造，已添加 changeset，进入后续统一 NPM beta 发布时需要包含受影响包。

## 用户/产品视角的验收步骤

1. 打开新会话或空白 draft，会看到居中的欢迎页和输入框，而不是只在底部出现输入栏。
2. 欢迎页输入框下方可看到项目目录选择入口，默认指向 NextClaw workspace。
3. 选择项目后发送第一条消息，创建的新会话应绑定该 project root。
4. 点击 welcome 引导卡片，示例 prompt 应填入输入框，光标应位于文本末尾。
5. 打开模型选择器，可搜索模型；收藏模型后应置顶到收藏分组。
6. 在小高度视口打开模型、技能、slash、项目、Agent 和会话类型面板，面板不应贴到视口边界，也不应超出可见区域。
7. 已有会话、有消息、正在发送或 draft 发送失败后，不应错误重新打开欢迎页。

## 可维护性总结汇总

当前方向遵循“子 feature owner 收敛”和“复用输入主链路”：

- welcome 展示、业务容器、显示规则和测试已从父级 conversation/components 中迁出。
- conversation panel 只负责装配，不持有 welcome 业务规则。
- input bar 只新增 presentation surface，不承载 project 选择业务。
- `ChatInputManager` 继续是发送 projectRoot 的 owner，避免 UI 组件直传运行时细节。
- 模型收藏的持久化事实归 kernel `PreferenceManager`，UI 只通过 API/query 使用偏好，不用 localStorage 特例承载长期偏好。
- welcome 卡片只触发 prompt suggestion，发送/建会话仍走原输入主链路。
- 浮层高度修复收敛在基础输入/欢迎子 feature 面板上，使用 Radix 可用空间和设计上限，不写屏幕尺寸特判。
- shared UI / agent-chat-ui primitive 现在持有默认碰撞边界，业务层只保留自身宽度与高度上限，避免同一浮层合同多处重复维护。
- `shared/components/ui` 已补充目录预算 README，明确根目录只保留业务无关 primitive，复杂组件进入语义子目录。
- agent-chat-ui 的 `chat-input-bar/` 与 `chat-message-list/` 已补充目录预算 README，记录当前历史扁平边界和后续拆分缝。
- `ChatMessageListProps` 已从 view-model 合同迁回 React 组件边界，view-model 类型不再泄漏 `ReactNode`。
- sidebar 新建会话类型菜单的高度合同收回 `ChatSidebarCreateMenu` 组件自身，三处调用点共享同一可滚动边界。
- session header project badge 的动态路径 popover 已增加 max-height 与纵向滚动，避免长路径或小高度设备继续撑出视口。
- create menu 高度测试迁到组件级测试，避免继续膨胀 `chat-sidebar.test.tsx` 这个接近预算的大集成测试。
- Radix available-height 公式已收敛到 `Popover` / `Select` primitive helper；业务组件只表达自身设计上限，不再手写完整 CSS 变量公式。
- shared UI 与 agent-chat-ui default skin 的 `PopoverContent` 现在默认持有 max-height、collision padding 与纵向滚动兜底；模型/技能/项目等复杂面板仍可用更小设计上限覆盖，不需要每个普通菜单都手写高度保护。
- shared UI 与 agent-chat-ui default skin 的 Popover/Select 高度 helper 已补充 `100vh` fallback，避免 Radix available-height CSS 变量缺失时整条 `max-height` 失效。
- `SearchableModelInput` 已从自制 absolute dropdown 收敛到 shared Popover，settings / agents 的模型候选浮层不再维护第二套关闭、定位和高度逻辑。
- `SearchableModelInput` 的候选列表已改成 `flex-1 overflow-y-auto` 内部滚动区，内容多时滚动发生在面板内部，不再依赖父层裁切。
- 模型候选 icon-only toggle 文案改由 i18n 上层传入，shared 输入组件只承载通用交互，不硬编码英文文案。
- 模型候选 empty / create 文案改为必传合同，shared 输入组件不再保留英文兜底或缺省文案分支。
- toolbar 模型选择测试已收敛重复 fixture，避免搜索、收藏、浮层高度三条测试重复维护完整 option 列表。
- session project badge 菜单只声明自身高度上限，滚动能力回到 shared Popover primitive；对应测试也收敛了重复渲染 fixture。
- `chat-input-bar.test.tsx` 的默认 props builder 已支持嵌套合并，并补充本地 composer/model fixture，测试只声明场景差异；该文件从 866 行降到 709 行，不再触发接近 900 行预算的 warning。
- agent-chat-ui 使用自己的 default-skin / `ChatUiPrimitives` 暴露浮层高度 helper，没有把 reusable package 反向耦合到 nextclaw-ui。
- `chat-ui-primitives.tsx` 的 default-skin 导入已从跨目录相对路径收敛到 `@agent-chat-ui/` alias，module-structure governance 通过。
- 测试侧不再复制完整 Radix available-height 公式；小测试复用 primitive helper，大型 `chat-input-bar.test.tsx` 只验证设计上限和 Radix 可用高度变量，避免继续膨胀大测试文件。
- `chat-conversation-panel.test.tsx` 继续瘦身，welcome create draft 等内部行为已迁到 welcome 容器测试覆盖。
- path-scoped maintainability guard 通过，已改 tracked 文件统计为 total `+114/-239/net -125`，非测试 `+59/-158/net -99`。
- guard 剩余 3 个 warning 都是既有预算风险或持续治理项：agent-chat-ui input-bar 目录文件数、conversation panel 测试接近预算、chat-input-bar container 接近预算。
- 后续批次 maintainability guard 通过，剩余 warning 为既有目录预算例外或 `shared/lib/api/types.ts` 接近预算；preference endpoint helper 已放入 `shared/lib/api/preferences/` 子目录，未继续增加 API 根目录文件数。
- 最新 maintainability guard：0 error，3 warning，均为已有目录预算例外；三个超预算目录都有 README 说明和下一步拆分方向。
- 最新 maintainability guard 补充信号：`chat-input-bar.test.tsx` 从 866 行降到 709 行，已移除接近测试文件预算的 warning。
- `ChatUnknownPart` 与 `ChatMessageMeta` 两个单用小组件已内联并删除，`chat-message-list/` 直接文件数回到 12，移除该目录预算 warning。
- shared UI 与 agent-chat-ui default skin 的 Popover/Select 高度 helper 已升级为 `min(limit, max(0px, calc(available-height - 2rem)))`：相比只减 `0.75rem` / `1rem` 的旧公式，浮层会留出更明确的视口呼吸空间，并在极小可用空间下避免产生无效负高度。
- Select primitive 的 content / viewport 现在统一是 flex column + 内部 scroll region；普通 select、Agent 选择和模型相关面板都不用再靠外层裁切列表。
- toolbar 模型搜索面板设计上限从 `22rem` 收紧为 `18rem`，在小高度设备上优先保留输入区和边界呼吸空间。
- agent-chat-ui `chat-input-bar/` 测试文件已迁入 `__tests__/`，运行时组件根目录只保留 input bar 相关组件、utils、README 与 `lexical/` 子目录。
- `copy-text` 已按真实角色迁移为 `copy-text.utils.ts`，fallback 复制链路拆成上下文快照、临时 textarea、执行命令、恢复上下文四段，删除原先超长函数 warning。
- `copy-text.utils.test.ts` 覆盖 navigator clipboard 主路径、execCommand fallback、临时 textarea 清理、active input 焦点与 selection 恢复。
- agent-chat-ui package lint 已从 1 个既有 warning 收敛到 0 warning。
- 最新标准 maintainability guard：0 error，4 warnings；剩余 warning 为 `diff.utils.ts` 接近预算、`ProviderForm` 仍超过文件预算但已从 667 行降到 564 行、`provider-form-support.utils.ts` 接近预算，以及 `shared/components/ui` 既有目录预算 README 例外。当前批次包含用户可见 welcome/model 功能改动，因此严格 `--non-feature` 净增长门槛不作为最终判定。
- `SecretsConfigForm` 已把提交映射和校验迁到 feature utils，React 组件不再承担 provider/ref payload 归一化细节，原 settings cognitive-complexity warning 被清掉。
- `ProviderForm` 已把 provider/schema/template 上下文派生、保存 payload、测试连接 payload、模型 thinking 配置变更和 device-code 授权轮询分别收敛到 utils / hook；主组件从巨型 UI+副作用混合体收缩为 query/mutation 连接与意图动作 owner。
- `provider-form-support.utils.ts` 超预算后继续拆出 `provider-form-context.utils.ts` 与 `provider-form-model.utils.ts`；support 文件当前 405 行，重新回到 500 行文件预算内。
- settings utils 新增 round-trip、保存 payload、模型前缀校验、thinking 默认值约束、重复 alias 和未知 provider ref 测试；`@nextclaw/ui lint` 当前为 0 error / 0 warning。

## NPM 包发布记录

已添加 `.changeset/chat-welcome-context-entry.md` 与 `.changeset/chat-model-favorites-preferences.md`。当前触达 `@nextclaw/ui`、`@nextclaw/agent-chat-ui`、`@nextclaw/kernel`、`@nextclaw/server`，若进入发布批次，需要随统一 NPM beta 发布。
