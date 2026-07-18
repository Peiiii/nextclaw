# v0.25.16 设置侧栏与跳转链接交互规范

## 迭代完成说明

本次先统一设置页左侧栏上方导航与左下角工具入口的垂直密度，再把主题与语言配置从设置侧栏归位到“外观”页面，并把普通 URL 跳转统一为真实链接语义。设置侧栏现在只承担设置导航、帮助入口与账号入口，底部顺序固定为“帮助文档 → 账号”，账号成为最后一项；主界面 Chat Sidebar 的主题和语言快捷切换继续保留，“外观”页面则成为设置域内的持久偏好配置 owner。

间距问题的根因是侧栏条目虽然已经由 `SidebarItemDensity` 统一行高、字号和横向间距，但相邻条目的纵向间距没有归入同一个 stack owner。上方导航使用容器级 `space-y-0.5`，footer 却在账号入口和主题、语言 wrapper 上分别维护独立 margin。修复删除逐项 margin 和无语义 wrapper，让导航列表与 footer 从同一个 density 映射取得 stack spacing。

配置重复的根因是 `Sidebar` 同时承担导航与主题、语言配置，而且保留了没有真实 consumer 的 `mode="main"` 分支；移动端还为语言维护了独立页面和导航入口。端到端检索确认桌面壳只会渲染设置模式 Sidebar，主界面实际由 Chat Sidebar 提供快捷菜单。修复因此不是条件隐藏，而是删除 Sidebar 的失效 main 模式与两个配置下拉，在现有 `AppearanceSettingsPage` 中复用 `useTheme`、`useLanguagePreference`、`SettingRow` 和 shared Select；同时删除移动端独立语言页面与 `/language` 路由，让移动设置也通过“外观”进入。主题 Provider 与语言偏好 hook 仍是唯一状态 owner，没有新增平行状态、effect、adapter 或兼容分支。

跳转入口的根因是 shared actions 中没有以 `href` 为合同的链接 primitive：旧 `ActionLink` 实际渲染为可点击 `span`，`ExternalActionLink` 实际渲染为 `button`，搜索设置里的“查看文档”甚至形成 `<a><button>…</button></a>` 的交互元素嵌套。修复删除这组名实不符且几乎没有消费面的旧实现，新增 `NavigationLink`，统一真实 anchor、文本链接视觉、外链图标、键盘焦点、`target` / `rel` 与桌面宿主打开行为。搜索文档、模型文档、渠道教程、飞书开发者后台、二维码地址、SkillHub 来源、发布说明与文档浏览器外链已迁移；正文 Markdown 链接、文件下载/打开 CTA 和卡片 icon-only 链接本来已有正确 anchor 语义，保留各自专用呈现。设置侧栏“帮助文档”打开产品内文档面板，没有稳定 URL，继续使用按钮是有意的交互例外。

用户明确提出这是长期交互规范，因此规则已写入 `frontend-interaction-quality` skill：URL / 路由导航使用 link，状态修改与命令执行使用 button，禁止 anchor 包 button 与可点击 span，普通跳转优先 shared navigation primitive；没有为这类依赖语境判断的规则新增窄扫描脚本，避免把下载 CTA、正文内容链接和专用卡片操作误判为违规。

## 测试/验证/验收方式

- 修前定向基线：`pnpm --filter @nextclaw/ui test -- src/app/components/layout/__tests__/sidebar.layout.test.tsx src/features/settings/pages/__tests__/appearance-settings-page.test.tsx src/app/components/layout/__tests__/settings-entry-page.test.tsx` 按新增合同出现 3 个失败，分别证明设置侧栏仍有主题下拉、外观页没有主题配置、移动设置仍单列语言入口。
- 修后定向测试：同一命令通过，3 个测试文件 / 10 个测试。
- 主界面快捷入口回归：`pnpm --filter @nextclaw/ui test -- src/features/chat/components/layout/__tests__/chat-sidebar.test.tsx` 通过，1 个测试文件 / 24 个测试。
- 链接语义与 footer 顺序修前基线：新增合同后运行 `pnpm --filter @nextclaw/ui exec vitest run src/shared/components/actions/__tests__/navigation-link.test.tsx src/features/settings/pages/__tests__/search-config-page.test.tsx src/app/components/layout/__tests__/sidebar.layout.test.tsx`，按预期分别因组件不存在、文档链接内嵌按钮、账号不在最后而失败。
- 受影响面回归：运行 NavigationLink、搜索设置、侧栏、Marketplace、Brand Header、渠道表单、渠道鉴权、模型设置与桌面更新共 9 个测试文件，39 个测试全部通过。
- 全量 UI 套件当前未全绿：`pnpm --filter @nextclaw/ui test` 暴露 5 个与本批次无关且位于未触达文件的失败；定向复跑确认 `chat-conversation-welcome.test.tsx` 的 4 项缺少 `QueryClientProvider`，`chat-session-workspace-panel.test.tsx` 的 1 项仍断言旧 query key 形状。本批次相关定向测试、类型、构建与真实页面验收均通过，未越权修改这两条并发链路。
- `pnpm --filter @nextclaw/ui tsc`：通过。
- `pnpm --filter @nextclaw/ui lint`：0 error；保留与本次无关的 `cron-config.tsx` 既有 cognitive-complexity warning。
- `pnpm --filter @nextclaw/ui build`：通过；保留既有 Browserslist 数据与大 chunk 提示。
- 源码消费确认：本地 Vite `http://127.0.0.1:5174` 返回的 transformed `appearance-settings-page.tsx` 已包含主题与语言 owner 和两个 Select，证明运行实例消费当前工作树源码。
- 真实桌面路径：访问 `http://127.0.0.1:5174/appearance`，设置侧栏 DOM 中 combobox 数量为 `0`，主内容区为 `2`；实际把主题从“默认”切到“暗夜”，`data-theme=night`、`data-theme-appearance=dark`，再恢复“默认”；实际把语言切到 English 并完成页面 reload，再恢复中文。访问 `/chat` 展开“设置菜单”，主题与语言快捷下拉仍存在。
- 真实窄屏路径：以 `390 × 844` 访问 `/appearance`，主题与语言控件边界均为 `left=188 / right=332 / width=144`，页面 `scrollWidth=390`，无横向溢出；访问 `/settings`，列表保留“外观”且不再单列“语言”。控制台 0 error，验收后恢复原主题、语言与视口。
- 真实搜索设置路径：访问 `http://127.0.0.1:5174/search`，可访问树把“查看文档”识别为 link；DOM 证据为 `tag=A`、真实 `href`、`target=_blank`、`rel=noopener noreferrer`、嵌套 button 数量 0、边框宽度 0。设置侧栏 DOM 顺序为“帮助文档、账号”，页面控制台 0 error，验收后恢复原折叠状态。
- `pnpm clean:generated`、`pnpm check:generated-clean`、`pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`：全部通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths <本批次 UI 源码与测试路径>`：通过，0 error / 2 warning；总代码 `+393/-469`、净减 76 行，排除测试后 `+274/-417`、净减 143 行。两个 warning 是本次触达但没有膨胀的既有渠道大文件预算提醒。

## 发布/部署方式

本次未执行 commit、push、前端发布、NPM publish、Desktop 打包或 GitHub release。数据库 migration、后端部署、NextClaw 宿主重启和运行时更新不适用；改动等待后续统一前端 / Desktop 发布携带。

## 用户/产品视角的验收步骤

1. 打开任一设置页，确认左侧栏底部只保留帮助文档与账号，两项行高和相邻间距与上方紧凑菜单一致，并且账号是最底部一项。
2. 进入“外观”，确认页面顶部可以分别配置主题和语言，主题即时生效，语言切换后按既有合同刷新界面。
3. 返回主界面，展开侧栏“设置菜单”，确认主题与语言快捷切换仍可用。
4. 在手机尺寸进入“设置”，确认不再单列“语言”，进入“外观”即可完成主题与语言配置，且页面没有横向溢出。
5. 进入“搜索渠道”，确认“查看文档”呈现为普通文本外链而非描边按钮；键盘聚焦可见，浏览器可识别并复制真实链接地址。

## 可维护性总结汇总

本次使用 `post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 收口，定向代码统计为 `+393/-469`、净减 76 行；排除测试后为 `+274/-417`、净减 143 行。正向减债动作包括：删除逐项 margin 与无语义 wrapper、删除没有 consumer 的 Sidebar main 模式、删除设置侧栏重复配置表面、删除移动端独立语言展示页与导航分支、删除名实不符的 action-link 实现，并复用现有外观页表单组件、状态 owner 与新的单一 NavigationLink 合同。改动减少了分支、文件、路由与配置表面，而不是靠压缩命名、折叠表达式或转移复杂度满足行数门槛。

检查范围没有文件级、目录级、函数级、命名职责或红区阻塞项。`sidebar.tsx` 从 456 行降到 254 行，不再处于 500 行预算的 80% 预警区；设置侧栏的职责已经从“伪通用侧栏 + 偏好配置”收敛为单一设置导航布局。`channel-form.tsx` 当前 427 行、与基线相同，`weixin-channel-auth-section.tsx` 当前 460 行、较基线净减 1 行，两者仍接近 500 行预算并产生 warning，但本次没有继续膨胀；后续触达其结构性职责时应按 guard 建议拆分。没有保留双 owner 或临时兼容路径。

## 红区触达与减债记录

### `packages/nextclaw-ui/src/features/channels/components/config/channel-form.tsx`

- 本次是否减债：是，文件行数与基线持平，没有继续膨胀。
- 说明：把原有教程 anchor 收敛到 shared `NavigationLink`，删除页面内重复链接样式和图标 JSX。
- 下一步拆分缝：后续结构性触达时，将表单 header、字段区和提交动作拆成职责明确的展示组件或 view hook。

### `packages/nextclaw-ui/src/features/channels/components/config/weixin-channel-auth-section.tsx`

- 本次是否减债：是，较基线净减 1 行。
- 说明：二维码地址与开发者后台入口复用 shared `NavigationLink`，删除两套重复外链样式和图标 JSX。
- 下一步拆分缝：后续结构性触达时，按二维码鉴权与既有应用接入两个领域拆分独立组件文件。

## NPM 包发布记录

- `@nextclaw/ui`：已更新 patch changeset `.changeset/settings-sidebar-footer-spacing.md`，尚未发布，待后续统一发布。
- 其它 NPM 包：不涉及。
