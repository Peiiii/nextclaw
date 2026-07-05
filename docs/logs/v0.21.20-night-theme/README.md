# v0.21.20 暗夜主题

## 迭代完成说明

本次新增 `night` 暗夜主题，并把主题模型从单纯主题名扩展为带 `appearance` 的主题定义，为后续像 VSCode 一样继续增加多个亮色/暗色主题留出稳定结构。

本次异常根因：

- 刷新后暗夜主题消失：`index.html` 里的首屏主题 bootstrap 只认识旧的亮色主题，`night` 不在 `themeColors` 白名单里，因此刷新时会把已持久化的 `night` 归一回 `natural`。
- Markdown 看不清：assistant Markdown、文件代码语法和部分状态 utility 使用固定亮色主题变量；night 主题切暗了容器，但这些文字/代码变量没有切到暗色可读值。
- Provider/Channel/Agent 等页面低对比：选中项使用 `bg-primary-50/*`，在 night 下 `brand-50` 是浅色，导致暗色界面出现中亮底和次级小字低对比。
- Cron 错误提示刺眼：错误提示使用 `bg-red-50`、`border-red-*` 和 `text-red-*` 亮色 utility，night 下仍呈现亮粉底。
- Switch 关闭态不可见：shared `Switch` 的关闭态轨道使用 `bg-muted`，圆点使用 `bg-card`，night 下两者亮度过近。

修复方式：

- `shared/lib/theme` 增加 `night`、`UiThemeAppearance`、`getThemeAppearance` 和主题定义列表。
- `design-system.css` 增加 night token，设置 dark `color-scheme`。
- `index.html` 首屏 bootstrap 同步识别 night，刷新前就设置 `data-theme-appearance`、背景色和 color scheme。
- `index.css` 增加 dark appearance 兼容层，覆盖 Markdown、代码语法、primary-50、muted 透明小字和状态色 utility。
- `Switch` 增加稳定 `data-state` 与 switch 语义类，night 下单独校准关闭态轨道、圆点和打开态圆点。
- PWA shell theme manager 同步 night 的 theme-color 和 dark color scheme。

## 测试/验证/验收方式

工程验证：

- `pnpm -C packages/nextclaw-ui lint`：通过。
- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-ui test -- src/features/pwa/managers/__tests__/pwa-shell-theme.manager.test.ts`：1 个测试文件、10 个测试通过。
- `pnpm -C packages/nextclaw-ui build`：通过；保留既有 Browserslist、动态 import 和大 chunk warning。
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

## 可维护性总结汇总

本次使用前端样式封装、交互质量、干净实现和可维护性复核口径收尾。主题事实收敛在 `shared/lib/theme`，PWA shell 只消费 appearance，视觉 token 收敛在 `design-system.css` 和全局 dark appearance 兼容层，没有在业务页面里逐个打补丁。

代码与样式变更统计（不含本迭代文档）：总计 `+629 / -39`，测试文件 `+11 / -0`，非测试变更 `+618 / -39`。本次是新增用户可见主题能力并修复其刷新与可读性问题，非功能净增门槛不适用。正向减债动作是把主题扩展从离散字符串提升为带 appearance 的定义表，并清除了 night 对既有亮色 utility、错误/警告 utility 和 Switch 关闭态默认色的隐式依赖。

目录和命名治理通过；没有新增业务 owner、wrapper、parallel implementation 或跨包 deep import。

## NPM 包发布记录

- 涉及包：`@nextclaw/ui`。
- 发布状态：本轮未发布。
- changeset：已新增 `.changeset/night-theme.md`，进入统一发布批次时发布为 `@nextclaw/ui` patch。
