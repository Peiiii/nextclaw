# 迭代完成说明

- 为 `packages/nextclaw-ui` 建立了第一阶段的移动端设备壳层：新增 `viewport layout` 判定层，按 `mobile < 768 / desktop >= 768` 在 `AppLayout` 中分发到桌面壳与移动壳。
- 按“先响应式、再薄平台层”的原则新增了 `platforms/mobile`，把真正属于设备形态差异的内容收敛到移动端壳层中，包括：
  - 顶部栏 `MobileTopbar`
  - 底部导航 `MobileBottomNav`
  - 移动端应用壳 `MobileAppShell`
  - 移动端设置壳 `MobileSettingsShell`
  - 聊天移动端壳 `ChatMobileShell`
- 聊天页完成了第一阶段的手机可用化：
  - 手机端不再同时展示桌面双栏
  - `/chat` 走会话列表态，`/chat/:sessionId` 走会话详情态
  - `ChatConversationPanel` 与 workspace/doc/browser 面板改为适合手机的覆盖层/全屏呈现
  - 原先散落在业务里的 `matchMedia('(max-width: 767px)')` 被收回统一视口层
- 设置与配置页完成了“列表进详情”收敛：
  - `ConfigSplitPage` 新增移动端 `list/detail` 模式
  - `providers / channels / search / sessions` 等页面切到移动端单列列表进详情的行为
- 入口结构做了收口：
  - 删除了 `src/app.tsx`
  - 把应用入口移入 [packages/nextclaw-ui/src/app/index.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/app/index.tsx)
  - 受保护路由改为一份配置驱动的声明数组，避免桌面/移动适配继续在入口里散成长串分支
  - 导航配置从 `app/components/layout` 收敛到 [packages/nextclaw-ui/src/app/configs/app-navigation.config.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/app/configs/app-navigation.config.ts)，既降低 layout 目录平铺压力，也让移动/桌面导航共用同一份配置 owner
- 同批次顺手修复了两处运行链路收口问题：
  - 修正了 `vitest.config.ts` 中仍指向旧 `providers / pwa` 路径的 alias
  - 把 `marketplace-page-detail.test.tsx` 中不兼容当前 `ES2020` 目标的 `.at()` 改为等价索引写法，保证包级 `tsc` 通过
- 同批次继续修复了移动端打开文档浏览器后的布局问题：
  - 根因已确认：`MobileAppShell` 只是渲染了共享 `DocBrowser`，但 `DocBrowser` 本身只有桌面 `docked / floating` 呈现，仍保留固定桌面宽度、拖拽、resize 与模式切换控件，手机端没有全屏覆盖契约。
  - 修复方式：为 [packages/nextclaw-ui/src/shared/components/doc-browser/doc-browser.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/shared/components/doc-browser/doc-browser.tsx) 增加 `displayMode="fullscreen"` 展示契约；[packages/nextclaw-ui/src/platforms/mobile/components/mobile-app-shell.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/platforms/mobile/components/mobile-app-shell.tsx) 在手机壳层中显式传入该模式，让文档浏览器以全视口覆盖层显示，并隐藏桌面 resize / drag / dock-toggle 控件。
- 同批次继续优化了移动端顶部栏、底部栏和聊天详情页空间：
  - 顶部栏降低为更接近微信一类高频移动应用的紧凑高度，减少纵向空间占用。
  - 底部主导航降低高度，并把选中态反馈从“整块 tab 背景”收缩到包裹图标和文字的紧凑圆角区域，降低视觉压迫感。
  - 新增统一 `isChatSessionDetailRoute()` 路由判断；`/chat` 会话列表仍展示底部主导航，`/chat/:sessionId` 会话详情隐藏底部主导航，只保留顶部返回入口，形成更接近微信聊天详情的沉浸式体验。
- 同批次继续校准了底部导航反馈区域：
  - 将 hover/selected 的视觉反馈从整格 tab 收敛为包裹“图标 + 文字”的紧凑圆角矩形。
  - 外层 `Link` 仍保留完整触控面积，避免为了视觉收缩牺牲手机端可点性。
- 同批次继续优化了手机端会话列表顶部区域：
  - 将会话列表顶部的新建/搜索区拆成桌面与移动两套 toolbar 展示组件，`ChatSidebar` 继续共享同一套 presenter/store/hook 数据流。
  - 手机端改为更轻量的“圆角搜索胶囊 + 紧凑加号入口”，避免直接照搬桌面端大号新建按钮和独立搜索块。
  - 多会话类型时，手机端加号打开类型选择菜单；只有默认类型时，加号直接创建默认会话。
- 同批次继续优化了手机端聊天详情顶部空间：
  - 根因已确认：`MobileAppShell` 在 `/chat/:sessionId` 上渲染通用 `MobileTopbar`，而 `ChatConversationPanel` 内部又渲染会话标题 header，手机端形成两层顶部栏，纵向空间被重复占用。
  - 修复方式：聊天详情路由隐藏共享 `MobileTopbar`；`ChatMobileShell` 将返回 `/chat` 的动作注入 `ChatConversationPanel`，由聊天面板 mobile header 同时承接“返回 + 会话标题 + 操作”。
  - 这样手机端聊天详情只保留一条顶部 header，更接近微信聊天页的空间模型，同时路由返回逻辑仍归移动平台壳层组合，不塞进聊天业务组件。
- 同批次继续收紧了一级功能页 topbar 的左侧空白：
  - 根因已确认：`MobileTopbar` 在没有返回按钮的一级路由上仍渲染 `32px` 左侧占位，导致 `聊天 / 技能 / Agent / 设置` 等一级标题左侧空白过大。
  - 修复方式：一级路由不再渲染返回占位；只有存在返回目标的二级页才保留返回按钮和右侧平衡占位。
- 同批次继续将一级功能页 topbar 标题居中：
  - 在一级页没有返回按钮和右侧操作的前提下，标题统一居中，避免标题左侧出现“空但不稳”的视觉感受。
- 同批次继续补出手机端语言切换入口：
  - 根因已确认：桌面端已有语言切换能力，但移动端设置首页没有暴露对应入口，导致手机端无法通过壳层完成同一项偏好设置。
  - 修复方式：把语言偏好状态与切换动作抽为 [packages/nextclaw-ui/src/features/settings/hooks/use-language-preference.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/features/settings/hooks/use-language-preference.ts)，桌面 Sidebar 与移动端语言设置页共用该 hook；手机端仅新增 [packages/nextclaw-ui/src/features/settings/pages/language-settings-page.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/features/settings/pages/language-settings-page.tsx) 作为展示层入口。
  - 移动端设置列表新增 `Language`，并复用同一份 `getMobileSettingsNavItems()` 导航配置，避免新增一套语言业务逻辑或移动端专属状态。
  - 同批次根据可发现性反馈，将 `Language` 调整为手机端设置列表第一项；这只是移动端展示顺序变化，桌面 Sidebar 与语言切换逻辑不变。

# 测试/验证/验收方式

- 运行：`pnpm -C packages/nextclaw-ui tsc --noEmit`
- 结果：通过。

- 运行：`pnpm -C packages/nextclaw-ui exec vitest run src/app.test.tsx src/app/components/layout/app-layout.test.tsx src/app/components/layout/settings-entry-page.test.tsx src/platforms/mobile/components/mobile-bottom-nav.test.tsx src/shared/components/__tests__/config-split-page.test.tsx src/features/chat/components/layout/chat-page-shell.test.tsx src/features/marketplace/components/marketplace-page-detail.test.tsx`
- 结果：通过，`7` 个测试文件、`14` 个测试用例全部通过。

- 运行：`pnpm -C packages/nextclaw-ui build`
- 结果：通过。

- 运行：`pnpm -C packages/nextclaw-ui exec vitest run src/shared/components/doc-browser/doc-browser.test.tsx src/app/components/layout/app-layout.test.tsx`
- 结果：通过，`2` 个测试文件、`4` 个测试用例全部通过。

- 运行：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/shared/components/doc-browser/doc-browser.tsx packages/nextclaw-ui/src/shared/components/doc-browser/doc-browser.test.tsx packages/nextclaw-ui/src/platforms/mobile/components/mobile-app-shell.tsx`
- 结果：通过，无错误，保留 `2` 条 warning，均为 `DocBrowser` 历史体量接近预算/函数体量偏大；本次通过抽出布局 class/style helper，未继续恶化 `DocBrowser` 函数体量。

- 运行：`pnpm -C packages/nextclaw-ui exec vitest run src/platforms/mobile/components/mobile-bottom-nav.test.tsx src/platforms/mobile/components/mobile-app-shell.test.tsx src/features/chat/components/layout/chat-page-shell.test.tsx`
- 结果：通过，`3` 个测试文件、`5` 个测试用例全部通过。

- 运行：`pnpm -C packages/nextclaw-ui exec vitest run src/platforms/mobile/components/mobile-bottom-nav.test.tsx`
- 结果：通过，`1` 个测试文件、`2` 个测试用例全部通过。

- 运行：`pnpm -C packages/nextclaw-ui exec vitest run src/app/components/layout/settings-entry-page.test.tsx src/features/settings/pages/language-settings-page.test.tsx src/app/components/layout/sidebar.layout.test.tsx src/platforms/mobile/components/mobile-bottom-nav.test.tsx`
- 结果：通过，`4` 个测试文件、`9` 个测试用例全部通过。

- 运行：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/platforms/mobile/components/mobile-bottom-nav.tsx packages/nextclaw-ui/src/platforms/mobile/components/mobile-bottom-nav.test.tsx`
- 结果：通过，无错误、无 warning；非测试代码新增 `5` 行、删除 `5` 行，净增 `0` 行。

- 运行：`pnpm -C packages/nextclaw-ui exec vitest run src/features/chat/components/layout/chat-sidebar.test.tsx`
- 结果：通过，`1` 个测试文件、`17` 个测试用例全部通过。

- 运行：`pnpm -C packages/nextclaw-ui exec vitest run src/platforms/mobile/components/mobile-app-shell.test.tsx src/features/chat/components/conversation/chat-conversation-panel.test.tsx`
- 结果：通过，`2` 个测试文件、`16` 个测试用例全部通过。

- 运行：`pnpm -C packages/nextclaw-ui exec vitest run src/platforms/mobile/components/mobile-app-shell.test.tsx`
- 结果：通过，`1` 个测试文件、`3` 个测试用例全部通过。

- 运行：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/platforms/mobile/components/mobile-topbar.tsx packages/nextclaw-ui/src/platforms/mobile/components/mobile-app-shell.test.tsx`
- 结果：通过，无错误、无 warning；非测试代码新增 `2` 行、删除 `2` 行，净增 `0` 行。

- 运行：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/platforms/mobile/components/mobile-app-shell.tsx packages/nextclaw-ui/src/platforms/mobile/components/mobile-app-shell.test.tsx packages/nextclaw-ui/src/platforms/mobile/components/chat-mobile-shell.tsx packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-panel.tsx packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-header.tsx packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-panel.test.tsx`
- 结果：通过，无错误、无 warning；抽出 header 后 [packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-panel.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-panel.tsx) 从 `509` 行降到 `370` 行。

- 运行：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/features/chat/components/layout/chat-sidebar.tsx packages/nextclaw-ui/src/features/chat/components/layout/chat-sidebar-toolbar.tsx packages/nextclaw-ui/src/features/chat/components/layout/chat-sidebar.test.tsx`
- 结果：通过，无错误，保留 `2` 条 warning，均为 `ChatSidebar` 历史体量接近预算/函数体量偏大；本次将顶部 toolbar 拆出后，`ChatSidebar` 从 `459` 行降到 `416` 行，主函数从 `283` 行降到 `243` 行。

- 运行：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/app/configs/app-navigation.config.ts packages/nextclaw-ui/src/platforms/mobile/components/mobile-topbar.tsx packages/nextclaw-ui/src/platforms/mobile/components/mobile-bottom-nav.tsx packages/nextclaw-ui/src/platforms/mobile/components/mobile-bottom-nav.test.tsx packages/nextclaw-ui/src/platforms/mobile/components/mobile-app-shell.tsx packages/nextclaw-ui/src/platforms/mobile/components/mobile-app-shell.test.tsx packages/nextclaw-ui/src/platforms/mobile/components/chat-mobile-shell.tsx`
- 结果：通过，无错误、无 warning。

- 运行：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/features/settings/index.ts packages/nextclaw-ui/src/features/settings/hooks/use-language-preference.ts packages/nextclaw-ui/src/features/settings/pages/language-settings-page.tsx packages/nextclaw-ui/src/features/settings/pages/language-settings-page.test.tsx packages/nextclaw-ui/src/app/components/layout/sidebar.tsx packages/nextclaw-ui/src/app/components/layout/sidebar.layout.test.tsx packages/nextclaw-ui/src/app/components/layout/settings-entry-page.test.tsx packages/nextclaw-ui/src/app/configs/app-navigation.config.ts packages/nextclaw-ui/src/platforms/mobile/components/mobile-settings-shell.tsx packages/nextclaw-ui/src/app/index.tsx`
- 结果：通过，无错误，保留 `1` 条 warning；该 warning 为 `Sidebar` 历史函数体量偏大，本次触达后函数体量从 `158` 降到 `155`，未继续恶化；非测试代码新增 `125` 行、删除 `19` 行、净增 `+106` 行，增长集中在新增移动端语言入口这一用户可见能力。

- 运行：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-ui/src/app/configs/app-navigation.config.ts packages/nextclaw-ui/src/app/components/layout/settings-entry-page.test.tsx`
- 结果：通过，无错误、无 warning；非测试代码新增 `1` 行、删除 `1` 行，净增 `0` 行。

- 运行：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <本次移动端适配相关文件>`
- 结果：通过，无错误，保留 `4` 条 warning；统计结果为：
  - 代码增减报告：新增 `1860` 行，删除 `262` 行，净增 `+1598` 行
  - 非测试代码增减报告：新增 `1347` 行，删除 `262` 行，净增 `+1085` 行
- 具体 warning：
  - [packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-panel.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/features/chat/components/conversation/chat-conversation-panel.tsx) 接近文件预算
  - [packages/nextclaw-ui/src/features/chat/components/layout/chat-sidebar.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/features/chat/components/layout/chat-sidebar.tsx) 接近文件预算
  - `ChatSidebar` 仍有历史函数体量偏大 warning，但本次未进一步恶化
  - [packages/nextclaw-ui/src/shared/components/search-config.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/shared/components/search-config.tsx) 接近文件预算

- 运行：`pnpm lint:new-code:governance`
- 结果：基础命名与文件角色检查通过；仓库级命令仍被当前工作区内与本批次无关的 `packages/nextclaw/src/cli/shared/services/gateway/*`、`packages/nextclaw/src/cli/shared/services/runtime/*` 目录层级治理问题阻塞，因此未将仓库级治理全绿作为本次迭代通过前提。

- 运行：`pnpm check:governance-backlog-ratchet`
- 结果：通过，`ratchet status: OK`。

# 发布/部署方式

- 本次改动属于前端 UI 与布局层调整，无需数据迁移、远程配置变更或额外部署脚本。
- 随正常 NextClaw UI 前端构建与发布流程进入下一个前端版本即可。
- 发布前建议至少在一个手机尺寸与一个桌面尺寸再做一次真实页面冒烟。

# 用户/产品视角的验收步骤

1. 以手机尺寸打开 NextClaw UI，例如 `375x812`。
2. 确认应用进入移动端壳层，而不是继续使用桌面双栏框架。
3. 检查底部导航是否存在并能在 `聊天 / 技能 / Agent / 设置` 间切换。
4. 进入 `/chat`，确认先看到会话列表；点击会话后进入详情；从详情可返回列表。
5. 在聊天详情中打开 workspace/doc/browser 相关面板，确认呈现为手机可用的覆盖层或全屏层，而不是桌面侧边停靠。
6. 进入 `/settings`，确认先看到设置入口列表；点击某个设置项后进入详情页；返回时回到设置列表。
7. 进入 `providers / channels / search / sessions` 等典型 split 页面，确认手机端不再出现被横向压缩的双栏。
8. 切回桌面尺寸，确认原有桌面壳层、桌面侧栏与主内容区仍可正常工作。
9. 在手机尺寸下点击文档入口，确认文档浏览器以全屏覆盖层打开，不出现桌面侧边栏宽度、拖拽 resize 控件或 dock/floating 切换按钮。
10. 在手机尺寸下进入任意非聊天详情页，确认顶部栏和底部栏高度更紧凑，底部选中态只在图标和文字组成的紧凑圆角区域内反馈。
11. 在手机尺寸下进入 `/chat/:sessionId` 聊天详情，确认底部主导航隐藏；点击顶部返回后回到 `/chat` 会话列表，底部主导航重新显示。
12. 在手机尺寸下 hover 或按下底部导航项，确认反馈区域只包裹图标与文字，不铺满整个四等分 tab 区域。
13. 在手机尺寸下进入 `/chat` 会话列表，确认顶部区域为圆角搜索胶囊和紧凑加号入口，不再出现桌面式大号新建按钮。
14. 在手机尺寸下进入 `/chat/:sessionId` 聊天详情，确认顶部只有一条聊天 header；该 header 内包含返回按钮与会话标题，不再叠加外层 `MobileTopbar`。
15. 在手机尺寸下切换 `聊天 / 技能 / Agent / 设置` 等一级功能页，确认标题居中，且左侧不再预留无返回按钮的空白占位。
16. 在手机尺寸下进入 `/settings`，确认列表中存在 `Language` 入口；进入后能看到当前语言并切换到另一个语言选项，桌面 Sidebar 的语言下拉仍使用同一套切换逻辑。
17. 在手机尺寸下进入 `/settings`，确认 `Language` 是设置列表第一项，而不是埋在列表底部。

# 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。虽然移动端适配本身属于新增用户能力，总代码净增长不可避免，但本次优先删除了根目录入口 [packages/nextclaw-ui/src/app.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/app.tsx)，并把入口收回到 `app/` 子树，避免继续在模块根上平铺增长；同时没有复制整套业务逻辑，而是尽量通过响应式和薄壳层组合复用现有 feature owner。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：本次作为新增手机端能力，总代码与文件数净增长；但增长集中在 `platforms/mobile` 与统一视口层，且同步偿还了根入口治理债务，并将设备差异从业务层散点判断收敛回统一壳层与配置驱动导航。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。业务逻辑仍留在 `features/*`，通用能力仍留在 `shared/*`，`platforms/mobile` 只承接设备差异壳层；没有把聊天 manager、session store、配置数据 owner 搬进移动端目录。入口路由也改成配置驱动声明，减少继续在壳层里堆硬编码分支的风险。
- 目录结构与文件组织是否满足当前项目治理要求：本次触达范围满足。`src` 根目录不再继续增长新的业务入口文件；移动端差异集中在 `platforms/mobile`，没有引入新的 `runtime/host` 轴。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：本次已基于守卫结果做独立复核，结论为 `通过`，`no maintainability findings`。当前仍保留的风险不是结构性错误，而是若后续继续触达 `ChatConversationPanel`、`ChatSidebar` 与 `search-config`，应优先拆出更细的局部模块，避免它们越过文件预算。
- 移动端文档浏览器修复的可维护性复核：结论为 `通过`。本次没有复制一份 mobile-only doc browser，也没有把设备判断散落到业务调用点，而是给共享 `DocBrowser` 增加一个明确展示契约，由 mobile shell 组合使用。当前 `DocBrowser` 文件仍接近预算，后续若继续增强文档浏览器，应优先拆分 header / tab strip / iframe surface / resize handles。
- 移动端顶部/底部栏与聊天详情沉浸式调整的可维护性复核：结论为 `通过`，`no maintainability findings`。本次把聊天详情路由判断收敛到 [packages/nextclaw-ui/src/app/configs/app-navigation.config.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/app/configs/app-navigation.config.ts)，由 mobile shell 与 chat mobile shell 复用同一判断，避免了路径规则散落；底部选中态也通过现有配置驱动导航渲染，没有新增平行导航实现。
- 手机端会话列表顶部区域的可维护性复核：结论为 `通过`，`no maintainability findings`。本次没有把手机端样式继续塞进 `ChatSidebar` 的大段条件 class，而是抽出桌面/移动 toolbar 纯展示组件，保留同一套数据 owner 和 action 入口；新增文件用于降低主组件体量，并让后续移动端会话列表继续按组合方式演进。
- 手机端聊天详情单 header 优化的可维护性复核：结论为 `通过`，`no maintainability findings`。本次删除了聊天详情上的共享顶部栏渲染路径，没有新增第二套聊天详情壳；返回路由动作仍由 `ChatMobileShell` 注入，`ChatConversationPanel` 只负责展示 mobile header 控件，边界保持清晰。
- 一级功能页 topbar 左侧空白收紧与标题居中的可维护性复核：结论为 `通过`，`no maintainability findings`。本次删除无返回场景的占位 DOM，并用现有标题元素完成居中，未新增状态、分支 owner 或平台特化组件。
- 手机端语言入口的可维护性复核：结论为 `通过`，`no maintainability findings`。本次没有复制桌面语言切换逻辑，也没有在 mobile shell 里新增业务状态；语言偏好被收敛为 `features/settings` 的共享 hook，桌面 Sidebar 和移动端设置页仅组合不同展示。
- 手机端语言入口置顶的可维护性复核：结论为 `通过`，`no maintainability findings`。本次只调整移动端设置导航配置顺序，非测试代码净增 `0`，没有新增分支或第二套展示逻辑。

# NPM 包发布记录

- 不涉及 NPM 包发布。
