# v0.21.20 暗夜主题

## 迭代完成说明

本次新增 `night` 暗夜主题，并把主题模型从单纯主题名扩展为带 `appearance` 的主题定义，为后续像 VSCode 一样继续增加多个亮色/暗色主题留出稳定结构。

本次异常根因：

- 刷新后暗夜主题消失：`index.html` 里的首屏主题 bootstrap 只认识旧的亮色主题，`night` 不在 `themeColors` 白名单里，因此刷新时会把已持久化的 `night` 归一回 `natural`。
- Markdown 看不清：assistant Markdown、文件代码语法和部分状态 utility 使用固定亮色主题变量；night 主题切暗了容器，但这些文字/代码变量没有切到暗色可读值。
- Provider/Channel/Agent 等页面低对比：选中项使用 `bg-primary-50/*`，在 night 下 `brand-50` 是浅色，导致暗色界面出现中亮底和次级小字低对比。
- Cron 错误提示刺眼：错误提示使用 `bg-red-50`、`border-red-*` 和 `text-red-*` 亮色 utility，night 下仍呈现亮粉底。
- Switch 关闭态不可见：shared `Switch` 的关闭态轨道使用 `bg-muted`，圆点使用 `bg-card`，night 下两者亮度过近。
- 输入框附件 chip 偏亮：`@nextclaw/agent-chat-ui` 的 file token 使用 `bg-slate-50`、`text-slate-700` 和内部 `bg-white`，上传图片后在 night 下仍按亮色 token 渲染。
- 右侧 Skill/MCP 详情文档仍是亮色：Marketplace 详情误用 `data:text/html` 生成独立 HTML 并放进 DocBrowser iframe，内部 CSS 固定浅色，导致它脱离主 React 树、主题变量和应用级 `data-theme-appearance`。
- 暗夜主题不够好找：主题列表仍按历史亮色主题顺序展示，唯一暗色主题排在靠后位置。

修复方式：

- `shared/lib/theme` 增加 `night`、`UiThemeAppearance`、`getThemeAppearance` 和主题定义列表。
- `design-system.css` 增加 night token，设置 dark `color-scheme`。
- `index.html` 首屏 bootstrap 同步识别 night，刷新前就设置 `data-theme-appearance`、背景色和 color scheme。
- `index.css` 增加 dark appearance 兼容层，覆盖 Markdown、代码语法、primary-50、muted 透明小字和状态色 utility。
- `Switch` 增加稳定 `data-state` 与 switch 语义类，night 下单独校准关闭态轨道、圆点和打开态圆点。
- PWA shell theme manager 同步 night 的 theme-color 和 dark color scheme。
- `@nextclaw/agent-chat-ui` 的 `ChatComposerTokenNode` 将 file token 从固定 slate/white 颜色改为 `border-border`、`bg-muted`、`text-foreground`、`bg-card` 和 `text-muted-foreground` 等语义色。
- Skill 与 MCP Marketplace 详情从 `data:text/html` 改为内部 `marketplace-detail` DocBrowser tab，由 React renderer 直接渲染 Metadata、Content、Markdown、代码块、标签和链接，天然继承当前主题变量。
- 主题列表将 `night` 前移到第一位，但 `DEFAULT_THEME` 仍保持 `natural`，提高暗色主题可发现性而不改变默认体验。

## 测试/验证/验收方式

工程验证：

- `pnpm -C packages/nextclaw-ui lint`：通过。
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-ui test -- src/features/pwa/managers/__tests__/pwa-shell-theme.manager.test.ts`：1 个测试文件、10 个测试通过。
- `pnpm -C packages/nextclaw-ui build`：通过；保留既有 Browserslist、动态 import 和大 chunk warning。
- `pnpm -C packages/nextclaw-agent-chat-ui exec vitest run src/components/chat/ui/chat-input-bar/__tests__/chat-input-bar.test.tsx src/components/chat/ui/chat-input-bar/__tests__/chat-composer-token-node.test.tsx`：2 个测试文件、34 个测试通过。
- `pnpm -C packages/nextclaw-ui exec vitest run src/features/marketplace/components/detail-doc/__tests__/marketplace-detail-doc.test.tsx src/features/marketplace/components/__tests__/marketplace-page-detail.test.tsx src/features/marketplace/components/mcp/__tests__/mcp-marketplace-page.test.tsx`：3 个测试文件、8 个测试通过。
- `pnpm clean:generated`：通过，generated artifacts clean。
- `pnpm lint:new-code:governance -- <本次触达文件>`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `git diff --check -- <本次触达文件>`：通过。

真实界面验收：

- Chrome 打开本地 `http://127.0.0.1:5174`，确认当前实例为 `theme=night`、`appearance=dark`。
- 刷新截图对应的 Markdown 会话后，DOM 仍为 `theme=night`、`appearance=dark`、`color-scheme=dark`，正文颜色为 `rgb(238, 233, 221)`。
- Markdown 对比度抽样：正文/列表约 `14.67`，inline code 约 `14.36`，链接约 `7.91`。
- 主页面巡检：`/chat`、`/appearance`、`/model`、`/providers`、`/channels`、`/runtime`、`/cron`、`/skills`、`/agents` 全部为 `theme=night`、`appearance=dark`，可见文本低对比扫描 `lowCount=0`。
- 追加验收 `/appearance`：关闭态 `Switch` 在 night 下圆点与轨道可见，截图 `/tmp/nextclaw-night-appearance-switch.png`。
- 追加验收 `/cron`：展开包含 `Invalid API Key` 的错误任务，错误条背景为 `rgba(218, 47, 47, 0.14)`、边框为 `rgba(218, 47, 47, 0.36)`，截图 `/tmp/nextclaw-night-cron-error-bar.png`。
- 追加验收聊天输入框文件上传：在 `http://127.0.0.1:5174/chat/sid_bmNwLW1yN2RkZzdhLWQzMjFhNWQy` 的 night 主题下粘贴 `image.png`，生成真实 file token；外壳背景为 `rgb(24, 27, 33)`、文字为 `rgb(238, 233, 221)`、边框为 `rgb(44, 49, 58)`，截图 `/tmp/nextclaw-night-file-token.png`。
- 追加验收 `/skills`：点击 `Browser Control` 打开右侧详情，`iframeCount=0`，面板内容为 React 渲染的 `元数据/内容` 详情而不是 `data:text/html` iframe；根节点仍为 `theme=night`、`appearance=dark`、`color-scheme=dark`，截图 `/tmp/nextclaw-night-marketplace-detail-react.png`。
- 追加验收 `/marketplace/mcp`：点击 `Chrome DevTools MCP` 打开右侧详情，`iframeCount=0`，面板出现 `元数据/内容` 和来源链接，未显示 `详情暂不可用`，截图 `/tmp/nextclaw-night-mcp-detail-react.png`。
- 追加桌面验收：使用 `1600x1000` 视口打开右侧 `420px` dock，`/skills` 与 `/marketplace/mcp` 的详情面板均为 `iframeCount=0`；Metadata 与 Content 按实际容器宽度堆叠为单列，未被桌面断点挤成窄双列，截图 `/tmp/nextclaw-desktop-night-skill-detail-2.png`、`/tmp/nextclaw-desktop-night-mcp-detail-3.png`。
- 追加 MCP 详情可读性验收：`Chrome DevTools MCP` 详情的 Metadata 不再展示 `summaryI18n` / `contentI18n` 这类嵌套调试对象；DOM 验证 `hasSummaryI18n=false`、`hasContentI18n=false`。
- 主题顺序验收：桌面视口打开侧栏主题菜单，选项顺序为 `Night, Natural, Minimal, Paper, Mist, Dawn, Graphite, Probe`，截图 `/tmp/nextclaw-desktop-night-theme-menu.png`；源码确认 `DEFAULT_THEME` 仍为 `natural`。

## 发布/部署方式

本次未执行发布、部署或远程 migration。

本次变更属于 NextClaw UI 本地源码改动；后续如进入统一 NPM 发布批次，需要按发布流程评估 `@nextclaw/ui` 版本与 changeset。

## 用户/产品视角的验收步骤

1. 在侧边栏主题菜单选择 `暗夜`。
2. 刷新页面，确认侧边栏仍显示 `暗夜 / 中文`，页面保持暗色背景。
3. 打开包含 Markdown、列表、表格、inline code、链接和代码工具卡的会话，确认文字清晰可读。
4. 打开设置、提供商、渠道、运行时、定时任务、技能市场和 Agent 管理页面，确认没有亮色主题残留导致的暗底暗字或亮底灰字问题。
5. 在外观页确认“显示快捷栏”开关的关闭态和打开态都能看清。
6. 在定时任务页展开失败任务，确认错误详情是暗色错误提示而不是亮色粉底。
7. 在聊天输入框上传或粘贴图片，确认 `image.png` 文件 token 是暗色胶囊，而不是白底浅字。
8. 在技能市场或 MCP 市场打开详情文档，确认右侧面板地址不再是 `data:text/html`，内容区、Metadata、Content、代码块和标签均为内置暗色可读样式。
9. 打开主题菜单，确认 `暗夜` 排在主题列表前面，但首次默认主题仍不是暗夜。

## 可维护性总结汇总

本次使用前端样式封装、交互质量、干净实现和可维护性复核口径收尾。主题事实收敛在 `shared/lib/theme`，PWA shell 只消费 appearance，视觉 token 收敛在 `design-system.css` 和全局 dark appearance 兼容层，没有在业务页面里逐个打补丁。

代码与样式变更统计（不含本迭代文档）：总计 `+629 / -39`，测试文件 `+11 / -0`，非测试变更 `+618 / -39`。本次是新增用户可见主题能力并修复其刷新与可读性问题，非功能净增门槛不适用。正向减债动作是把主题扩展从离散字符串提升为带 appearance 的定义表，并清除了 night 对既有亮色 utility、错误/警告 utility 和 Switch 关闭态默认色的隐式依赖。

附件 chip 追加修正统计：本轮 follow-up 总计 `+64 / -8`，其中生产代码 `+5 / -5`、测试 `+48 / -0`、changeset 与迭代记录 `+11 / -3`。生产代码是等量语义色替换，没有引入新的业务路径；新增测试单独落在 focused test 文件，避免继续膨胀既有大型输入框测试文件。

右侧详情 React 化与主题排序追加修正统计：本轮 follow-up 总计 `+775 / -536`，净增 `+239`；其中生产/源码约 `+607 / -466`，测试 `+153 / -69`。正向减债动作是删除两套 `data:text/html` HTML 字符串生成器和旧 HTML renderer，统一收敛为一个内部 `marketplace-detail` React DocBrowser renderer 与小型详情 store，并让 Metadata 视图跳过嵌套调试对象。`post-edit-maintainability-guard --paths` 通过，提示新 `marketplace-detail-doc.tsx` 为 `442` 行、接近 `500` 行组件预算；后续若继续扩展 Markdown 能力，应优先拆出 Markdown parser，而不是继续堆大组件。

目录和命名治理通过；没有新增业务 owner、wrapper、parallel implementation 或跨包 deep import。

## NPM 包发布记录

- 涉及包：`@nextclaw/ui`、`@nextclaw/agent-chat-ui`。
- 发布状态：本轮未发布。
- changeset：已新增 `.changeset/night-theme.md`，进入统一发布批次时发布为 `@nextclaw/ui` 和 `@nextclaw/agent-chat-ui` patch。
