# v0.22.18 Default Theme

## 迭代完成说明

本次新增 `work` 主题并以“默认”显示，作为一套接近参考图的浅色、高留白、柔灰侧栏、黑白灰控件主题。没有保存主题偏好时，应用默认使用该主题；主题菜单也将“默认”排在第一位。已有的 `natural`、`night` 等已保存主题偏好保持不变。

同步完成的主题 owner 覆盖：

- `THEME_DEFINITIONS` / `UiTheme` 新增 `work`。
- 首屏 `index.html` 主题背景、appearance 映射新增 `work`，避免刷新或首屏闪回旧主题。
- design system 新增 `:root[data-theme="work"]` token。
- `work` 主题保持黑白灰主调，主操作按钮使用统一的深色中性底，发送、新建会话和设置保存不再各自使用例外样式。
- 用户消息气泡的紧凑形态收敛到 `@nextclaw/agent-chat-ui` 消息组件本身，所有主题保持一致布局。
- `work` 主题只覆盖用户消息气泡颜色为浅灰底、深色文字，不改变 padding、圆角或阴影等布局/形态属性。
- `work` 主题下侧栏可点击导航文字和图标加深，避免看起来像 disabled 状态。
- 侧栏折叠状态的新任务入口改为普通 rail 图标样式，与定时任务、技能、Agent 管理保持同一视觉层级。
- `work` 主题下 assistant Markdown 链接使用蓝色，匹配参考图中的文档链接。
- PWA shell theme color 新增 `work`。
- 中英文主题文案显示为 `默认` / `Default`。
- MCP 市场 header 从硬编码深紫渐变改为主题 token 驱动，避免职场白主题下出现不跟随主题的固定色块。
- `@nextclaw/agent-chat-ui` 为用户消息增加稳定类名，使主题层可以精准覆盖用户消息配色。

## 测试/验证/验收方式

命令验证：

- `pnpm -C packages/nextclaw-agent-chat-ui exec vitest run src/components/chat/ui/chat-input-bar/__tests__/chat-input-bar.test.tsx`：通过，33 tests passed。
- `pnpm -C packages/nextclaw-agent-chat-ui exec vitest run src/components/chat/ui/chat-message-list/chat-message-list.test.tsx`：通过，20 tests passed。
- `pnpm -C packages/nextclaw-agent-chat-ui tsc`：通过。
- `pnpm -C packages/nextclaw-agent-chat-ui lint`：通过。
- `pnpm -C packages/nextclaw-agent-chat-ui build`：通过。
- `pnpm -C packages/nextclaw-ui exec vitest run src/shared/lib/theme/index.test.ts src/features/pwa/managers/__tests__/pwa-shell-theme.manager.test.ts`：通过，13 tests passed；覆盖无偏好时的默认主题、主题列表首项和 PWA 无主题兜底。
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-ui lint`：通过；仅保留既有 `chat-thread.manager.test.ts` 超 800 行 warning。
- `pnpm -C packages/nextclaw-ui build`：通过；仅保留既有 Browserslist、dynamic import、chunk size 提示。
- `pnpm clean:generated`：通过，generated artifacts are clean。
- `git diff --check -- <changed files>`：通过。
- `pnpm lint:new-code:governance -- <changed files>`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths <changed files>`：通过，0 errors / 1 warning；当前 `sidebar.tsx` 接近文件预算，但主题默认逻辑没有新增该侧栏的职责。

可视化验证：

- `/tmp/nextclaw-work-main-aligned.png`：聊天首页为白色主画布、柔灰侧栏、深灰导航控件，输入区模型标识和发送按钮为灰阶。
- `/tmp/nextclaw-work-file-token-aligned.png`：真实文件上传 token 在 composer 内保持灰阶；发送按钮保持灰黑主操作色。
- `/tmp/nextclaw-default-theme-first-load.png`：清除主题偏好后启动，`data-theme`、`data-theme-appearance` 与 localStorage 分别为 `work`、`light`、`work`，页面背景为纯白。
- `/tmp/nextclaw-default-theme-list.png`：主题菜单首项为 `Default`；中文语言包对应显示为 `默认`。
- `/tmp/nextclaw-default-theme-settings-save.png`：模型配置页的保存按钮与发送、新建会话保持同一深色中性操作层级。
- `/tmp/nextclaw-work-appearance-aligned.png`：外观设置页在职场白主题下开关、卡片、侧栏可读。
- `/tmp/nextclaw-work-marketplace-aligned.png`：MCP 市场页 header 与列表跟随职场白主题，无横向溢出。
- `/tmp/nextclaw-work-user-bubble-component-layout.png`：用户消息气泡为浅灰紧凑胶囊；紧凑尺寸来自消息组件，浅灰配色来自 `work` 主题。
- `/tmp/nextclaw-work-sidebar-contrast.png`：展开侧栏导航文字和图标加深到可点击状态。
- `/tmp/nextclaw-work-sidebar-collapsed-icons.png`：折叠侧栏新任务入口与其它 rail 图标统一为简约透明底。

## 发布/部署方式

本次未执行发布或部署。当前只完成本地源码实现、构建验证、浏览器可视化验收与 changeset 记录。

## 用户/产品视角的验收步骤

1. 打开 NextClaw UI。
2. 在左下角设置菜单中进入主题选择。
3. 确认主题列表首项为 `默认`；在无已保存主题偏好时，应用自动选中该主题。
4. 确认聊天首页、外观设置页、MCP 市场页呈现白色主画布、柔灰导航面、深灰导航状态；用户消息为浅灰紧凑气泡，发送、新建会话和保存等主操作保持统一的深色中性样式，assistant 文档链接为蓝色。
5. 折叠侧边栏，确认新任务入口和定时任务、技能、Agent 管理图标一样简约，不再显示单独强调背景。
6. 选择任意其他主题后刷新页面，确认选择仍保持；清除主题偏好后刷新，确认回到 `默认`。

## 可维护性总结汇总

本次新增主题能力使用既有主题 owner，不新增平行主题系统或业务组件分支。主题 token 与主题作用域在 `@nextclaw/ui`，用户消息紧凑形态在 `@nextclaw/agent-chat-ui` 组件层统一生效，避免主题 selector 改变布局。

正向减债动作：简化。MCP 市场 header 删除硬编码紫色渐变、装饰层和固定文字色，改为复用主题 token，减少与主题系统并行的视觉路径。

`post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 已用于收口判断。当前没有保留已知主题适配债务；守卫提示均为既有测试文件/目录预算边界。

## NPM 包发布记录

本次涉及 `@nextclaw/ui` 与 `@nextclaw/agent-chat-ui` 用户可见变化，已新增 `.changeset/work-white-theme.md`，类型均为 patch。

当前未执行 NPM 发布；状态为待后续统一发布。
