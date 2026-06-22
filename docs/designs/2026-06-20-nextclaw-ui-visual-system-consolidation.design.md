# NextClaw UI 简约主题体系设计

## 背景

当前聊天首页不算花，但整体设计感不足。真实问题不是缺少某个漂亮颜色，而是侧栏、欢迎区、输入框、卡片、右侧 rail 与弹出层各自使用局部白灰色，缺少一个贯穿全局的视觉合同。

这会让界面看起来干净但松散：层级主要靠很浅的灰色差异支撑，主行动路径不够明确，主题切换也只能影响一部分界面。

后续观察进一步确认：旧 `warm` 名义上是暖色，但大面积仍是中性灰白，主动作又偏橄榄绿；`leaf` 则把绿色作为主轴，容易让界面变成“绿色皮肤”。因此主题体系不应围绕绿色扩展，而应围绕简约、舒适、低饱和、低干扰的工作台气质重建。

同时，会话页的 header 下边线和底部输入面板上边线会把对话流切成三段。它们属于装饰性结构线，不是必要交互边界，应从默认会话体验中移除。

## 现状依据

- 主题 owner 已在 `packages/nextclaw-ui/src/shared/lib/theme/index.ts` 与 `packages/nextclaw-ui/src/app/styles/design-system.css`。
- Tailwind 已把 `background`、`card`、`popover`、`primary`、`muted`、`accent`、`gray` 等映射到 CSS token。
- 聊天首页真实截图显示：主内容区太白，侧栏偏灰但边界弱，能力卡片与输入框主要靠浅边框分层，主色存在感不足。
- 代表性工作区截图显示：历史工具会话、Provider 设置页、DocBrowser、Side Dock 应用面板仍有大量壳层和列表使用硬编码白灰色，导致主题一进入真实工作流就断裂。
- 代码中大量关键 UI 仍使用 `bg-white`、`border-gray-*`、`text-gray-*`，例如 welcome capability card、基础 input/select、聊天侧栏工具区、popover content。这些写法会让不同主题无法形成整体语言。
- 真实视觉基线截图显示：旧绿色主题不够舒适，默认暖色不够“暖”，会话页 header / 输入区边线过多。

## 核心判断

NextClaw 的视觉系统应该先解决“统一入口的清晰工作台”问题，而不是继续增加孤立主题。

推荐方向是：

- **纸感工作台**：页面底色有轻微温度，不用纯白铺满。
- **清晰骨架**：侧栏、主工作区、输入区、卡片层级要明显，但不能靠重阴影。
- **低饱和主行动色**：主色只负责主入口、选中态、focus 与可执行动作，不承担大面积装饰。
- **少线条原则**：保留输入框、卡片、面板等真实交互/容器边界，移除只会切碎阅读流的装饰性分割线。
- **语义 token 统治组件**：组件不直接决定自己是白色还是灰色，而消费 `card/background/muted/border/primary`。
- **自然默认，不彩色 header**：默认主题采用早期截图中的暖灰侧栏、近白主画布和低饱和橄榄动作色；header 只使用普通工作区底色，不额外染色或做品牌色区域。
- **消息与工具卡片归主题管辖**：消息气泡、工具调用卡片、inline panel、附件卡片只消费主题 surface / border / text token；错误、成功、运行中、diff 增删等真实状态才使用独立语义色。

## 推荐方案

### 1. 主题 token 分层

每个主题固定以下角色：

- `--background`：页面和主工作台底色。
- `--background-secondary`：侧栏和二级区域底色。
- `--card`：卡片、输入框、浮层主体表面。
- `--border`：默认结构边界。
- `--border-hover`：hover 或可交互边界。
- `--foreground`：主文字。
- `--foreground-secondary`：标题下的说明、列表主信息。
- `--foreground-tertiary`：弱说明、placeholder 附近语义。
- `--primary`：主行动、选中、focus、未读点。
- `--accent`：浅选中底、辅助信息底，不承担主行动。

### 2. 推荐主题组合

本轮主题应保持少而精，优先给用户几个耐看的工作台选项，而不是展示调色板能力：

- `natural` / 自然：默认主题。接近最早产品截图的暖灰侧栏、近白工作台、柔和边界和低饱和橄榄主动作；用于建立 NextClaw 自己的基础工作台气质。
- `minimal` / 简白：备选极简主题。纯白工作台、白卡片、等比例灰阶边界、黑灰主动作，接近 OpenAI / ChatGPT 式基础简约风格。
- `warm` / 纸暖：暖纸底、taupe 主动作色，解决旧 warm “灰白 + 绿色按钮”的割裂感。
- `cool` / 雾蓝：低饱和蓝灰，适合偏冷静的工作台，不使用高亮蓝。
- `dawn` / 晨砂：低饱和 clay/rose 操作色，提供温柔但不粉、不花的替代。
- `graphite` / 石墨：近单色、低存在感，给最简约用户。
- `probe` / 探针：保留参考图带来的科学手绘气质，但主动作收敛到参考图标题与机器人描边的深墨色，不把绿色或紫色作为主题主轴。

旧 `leaf` 不再作为可选主题。若用户本地存储仍是 `leaf`，启动时迁移到 `warm`。

### 3. 色彩角色分配表

颜色不按“喜欢哪个色”分配，而按 UI 角色分配。每个主题都固定使用同一组角色：背景负责气质，卡片负责承载，边框负责结构，主色只负责动作和 focus，accent 只负责浅选中和 hover。

| 主题 | 页面底色 `background` | 侧栏/二级面 `secondary` | 卡片/输入 `card` | 默认边界 `border` | hover 边界 | 主动作 `primary` | 浅选中 `accent` | 主文字 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 自然 `natural` | `hsl(45 25% 97%)` / `#F9F8F5` | `hsl(45 14% 94%)` / `#F2F1EE` | `hsl(0 0% 100%)` / `#FFFFFF` | `hsl(45 14% 88%)` / `#E5E3DC` | `hsl(45 10% 80%)` / `#D1CFC7` | `hsl(94 13% 37%)` / `#5D6B52` | `hsl(94 20% 95%)` / `#F2F5F0` | `hsl(45 5% 20%)` / `#363430` |
| 简白 `minimal` | `hsl(0 0% 100%)` / `#FFFFFF` | `hsl(0 0% 98%)` / `#FAFAFA` | `hsl(0 0% 100%)` / `#FFFFFF` | `hsl(0 0% 90%)` / `#E6E6E6` | `hsl(0 0% 81%)` / `#CFCFCF` | `hsl(0 0% 9%)` / `#171717` | `hsl(0 0% 96%)` / `#F5F5F5` | `hsl(0 0% 9%)` / `#171717` |
| 纸暖 `warm` | `hsl(40 38% 97%)` / `#FAF8F4` | `hsl(39 30% 94%)` / `#F4F1EB` | `hsl(40 48% 98%)` / `#FCFBF7` | `hsl(34 22% 84%)` / `#DFD7CD` | `hsl(32 20% 73%)` / `#C8BBAC` | `hsl(28 15% 42%)` / `#7B6A5B` | `hsl(38 30% 91%)` / `#EFEAE1` | `hsl(24 18% 18%)` / `#362C26` |
| 雾蓝 `cool` | `hsl(210 32% 98%)` / `#F8FAFC` | `hsl(210 24% 96%)` / `#F2F5F7` | `hsl(210 36% 99%)` / `#FCFCFD` | `hsl(214 22% 87%)` / `#D7DDE5` | `hsl(215 17% 76%)` / `#B7C0CC` | `hsl(214 35% 48%)` / `#5075A5` | `hsl(210 48% 96%)` / `#F0F5FA` | `hsl(220 26% 18%)` / `#222A3A` |
| 晨砂 `dawn` | `hsl(24 38% 97%)` / `#FAF7F4` | `hsl(20 30% 94%)` / `#F4EEEB` | `hsl(24 48% 98%)` / `#FCF9F7` | `hsl(18 22% 84%)` / `#DFD3CD` | `hsl(16 20% 74%)` / `#CAB7AF` | `hsl(350 24% 46%)` / `#915963` | `hsl(352 34% 94%)` / `#F5EAEC` | `hsl(8 16% 18%)` / `#352927` |
| 石墨 `graphite` | `hsl(48 10% 97%)` / `#F8F8F7` | `hsl(45 8% 94%)` / `#F1F0EE` | `hsl(48 13% 99%)` / `#FDFDFC` | `hsl(42 7% 84%)` / `#D9D7D3` | `hsl(38 6% 74%)` / `#C1BEB9` | `hsl(220 9% 39%)` / `#5A606C` | `hsl(220 12% 92%)` / `#E8EAED` | `hsl(220 11% 18%)` / `#292C33` |
| 探针 `probe` | `hsl(42 83% 98%)` / `#FEFCF6` | `hsl(41 80% 96%)` / `#FDF8ED` | `hsl(41 80% 96%)` / `#FDF8ED` | `hsl(38 26% 82%)` / `#DDD4C5` | `hsl(210 14% 72%)` / `#AEB8C2` | `hsl(210 14% 22%)` / `#303840` | `hsl(210 16% 92%)` / `#E7EBEE` | `hsl(207 28% 19%)` / `#23323E` |

具体分配规则：

- `background`：主工作区、页面底、启动 shell/meta theme-color，必须保持同主题同色，避免启动后闪到另一种底色。
- `background-secondary`：左侧导航、设置导航、右侧 dock 壳层、列表承载面。
- `card/input/popover`：输入框、Provider 卡片、欢迎能力卡、DocBrowser 地址栏、Side Dock 卡片。
- `border`：真实容器边界；会话 header 下边线、输入区上方横线这类装饰线不使用。
- `primary`：新任务、发送、选中图标、focus ring、关键状态点，不做大面积背景。
- `accent`：轻 hover、图标浅底、tabs 轻选中；自然主题的会话列表选中态沿用旧版灰阶合同 `gray-200 / gray-900`，实际落色为 `#E5E3DC / #201F1D`。
- 状态色如成功、警告、错误继续保留语义色，不跟主题主色混用。

### 4. 当前界面收敛范围

本轮按代表性工作流优化可见骨架，不只看首页：

- 基础 `Input` / `Textarea` / `Select`：从硬编码白灰改为 `bg-card`、`border-border`、`text-foreground`、`placeholder:text-muted-foreground`。
- 欢迎页标题与说明：使用 `text-foreground` / `text-muted-foreground`。
- 欢迎能力卡片：使用 `bg-card`、`border-border`、`text-card-foreground`、`muted-foreground`，hover 时增强边界而不是加杂色。
- 聊天侧栏顶部、分割线、搜索框、创建按钮、popover：统一使用 `background-secondary/card/border/primary`。
- 历史会话列表：自然主题选中态保持旧版 `gray-200 / gray-900`；分组标签、编辑动作、项目徽标统一消费主题 token。
- 消息与工具调用：用户/助手/工具消息、工具卡片 header/content、附件卡片、inline token、inline panel card 统一消费 `card/muted/accent/border/foreground/primary-foreground`，避免固定 amber/slate/gray 让聊天阅读面跳出主题。
- Provider 设置页：split pane、Provider 列表卡片、模板 picker、详情表单标签与说明、model chip 统一消费 `card/border/muted/accent`。
- DocBrowser 与 Side Dock：面板壳层、tab strip、搜索栏、外链栏、Panel Apps / Service Apps 列表统一消费语义 token。
- 页面 token：强化默认 natural 主题的暖灰工作台、卡片层与边界，让默认界面更干净、更清楚；minimal 保持纯黑白灰备选。
- 会话页 header 和默认输入区外壳：移除装饰性横向边线，让对话流和输入区更连续。

### 5. Probe 主题颜色合同

如果保留探针主题，它只作为 token 主题存在，不新增组件专属色：

- 页面底色：`#FEFCF6`
- 卡片底色：`#FDF8ED`
- 主文字：`#22313D`
- 次文字：`#494D52`
- 主行动色：reference ink，接近 `hsl(210 14% 22%)` / `#303840`
- 浅选中/hover：`#E7EBEE`
- 信息 accent：`#DDE7EC`
- 信息前景：跟随 `primary-700`

金色和紫色来自参考图，但不进入通用 UI 主链路，只能作为插画或未来明确语义状态使用。

## Owner 与数据流

- 主题枚举、持久化、启动识别归 `shared/lib/theme`。
- 主题 token 归 `app/styles/design-system.css`。
- 基础控件的默认视觉归 `shared/components/ui/*`，业务页面只传尺寸和布局。
- 聊天欢迎页与侧栏的业务组合归 `features/chat`，但颜色必须消费语义 token。

数据流保持不变：用户选择主题 -> `ThemeProvider` 写入 `data-theme` -> CSS token 生效 -> 组件消费语义类名。

## 目录组织

本轮不新增组件目录，只修改既有 owner：

- `docs/designs/2026-06-20-nextclaw-ui-visual-system-consolidation.design.md`
- `packages/nextclaw-ui/src/app/styles/design-system.css`
- `packages/nextclaw-ui/src/shared/lib/theme/index.ts`
- `packages/nextclaw-ui/src/shared/components/ui/*`
- `packages/nextclaw-ui/src/shared/components/config-split-page.tsx`
- `packages/nextclaw-ui/src/shared/components/doc-browser/*`
- `packages/nextclaw-ui/src/features/chat/...`
- `packages/nextclaw-ui/src/features/settings/...`
- `packages/nextclaw-ui/src/features/panel-apps/...`
- `packages/nextclaw-ui/src/features/service-apps/...`
- PWA shell theme 同步与对应测试

## 兼容与迁移

- 旧的 `warm` / `cool` 主题值继续有效。
- 旧 `leaf` 存储值迁移到 `warm`，不再暴露为可选主题。
- 新主题值只通过 `THEME_OPTIONS` 暴露，不增加平行入口。
- 现有 `gray-*` token 继续可用，但关键表面优先改为语义类，避免主题被白灰硬编码打断。

## 验收标准

- 聊天首页截图中，侧栏、主工作区、输入框、能力卡片、右侧 rail 的层级清楚。
- 历史工具会话截图中，消息卡片、工具调用卡片和附件/inline panel 壳层进入主题；工具状态、错误和 diff 增删保留状态语义，侧栏选中态和输入区不跳出主题。
- Provider 设置页截图中，左侧设置导航、split pane、Provider 列表和详情表单使用同一套纸感底色与边界。
- DocBrowser 截图中，浏览器壳层与搜索栏进入主题；文档 iframe 正文保持文档自身视觉，不强行重染。
- Side Dock 应用面板截图中，Panel Apps / Service Apps 列表和卡片不再回到固定白灰。
- 主行动色在“新任务”“发送/选中/focus”等关键动作上形成连续路径。
- 默认 natural 主题接近早期产品截图的自然暖灰工作台，header 不使用特殊主题色，主动作色只用于按钮、选中和 focus。
- minimal 主题接近 OpenAI / ChatGPT 式基础简约风格，纯白为主、只使用等比例黑白灰、黑灰主动作，不显得灰蒙或花。
- natural、minimal、warm、cool、dawn、graphite、probe 都能加载并有可辨识但不冲突的层级。
- 旧 `leaf` 本地存储值不会继续进入绿色主题，而是进入纸暖主题。
- 会话页 header 下方和默认输入区上方不再出现装饰性横向分割线。
- `pnpm -C packages/nextclaw-ui tsc --noEmit` 通过。
- 定向 Vitest 覆盖主题枚举、PWA shell 颜色、主题菜单选项。
- 定向 ESLint 通过。
- `pnpm -C packages/nextclaw-ui build` 通过。
- 浏览器截图验收后再收尾。

## 非目标

- 不在本轮重设计所有设置页、marketplace 或右侧 workspace 的深层页面。
- 不强行重染 DocBrowser iframe 中的文档正文、网页正文或第三方/外部内容。
- 不改变工具调用卡片的执行状态色、错误/成功/警告等语义状态色。
- 不引入新的设计系统库或图标体系。
- 不把参考图的所有颜色都塞进基础 token。
- 不追求一次性消灭全仓库所有 `gray-*` 使用。

## 后续实现顺序

1. 先收敛基础控件和聊天首页关键表面到语义 token。
2. 再扩到历史工具会话、Provider 设置、DocBrowser、Side Dock 这些代表性工作区。
3. 再微调 natural / minimal / warm / cool / dawn / graphite / probe 的 token 对比度。
4. 用浏览器截图检查整体层次。
5. 最后跑类型、测试、lint、build、maintainability guard。
