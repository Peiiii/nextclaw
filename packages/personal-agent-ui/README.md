# Personal Agent UI

`@nextclaw/personal-agent-ui` 提供可复用的 React 视觉与交互组件。包名、公共 API、CSS class 和 token 不包含产品品牌；账号、会话、任务等业务状态留在消费应用。Bibo 是当前第一个消费者。

## 边界

- 公共组件：`Button`、`Input` / `Select` / `Textarea` / `Field`、`SegmentedControl`、`ListRow`、`EmptyState`、`Notice`、`Message` / `Markdown`、`Composer`、`Dialog` / `Sheet`、`ActionMenu` / `ActionMenuItem` / `ActionMenuLink`、`IconButton`。
- 文件页使用 `Tab` / `TabList`；外观选择使用 `ActionMenuRadioGroup`；操作提示使用 `Tooltip`。文件激活、关闭、草稿和保存仍由应用持有。
- 工作空间与会话入口复用 `NavigationItem`，保留调用方的真实链接；共享行高、内边距、选中与 hover 配方。
- 公共样式：`src/styles/theme.css` 中的 `--ui-*` token 和 `.ui-*` class，统一默认、hover、focus、selected、disabled 与错误状态。
- 品牌配置：Bibo 的名称、标记、文案、配色覆盖留在应用层，通过 props 和主题变量注入。未来改名无需重命名组件包或公共 API。
- 业务流程：网络请求、导航、确认、保存判定与 store 不进入组件包。组件不得依赖 Bibo、Zustand、Cloudflare 或服务端代码。

页面可决定布局，但重复控件不能再写局部平行状态样式。组件从包根入口导入。新增组件要有跨页面使用场景或独立行为合同。

## Bibo 工作界面规范

几何参考用户提供的 Codex 2026-09-27 截图；品牌配色由应用覆盖。尺寸和状态的事实源是 `src/styles/theme.css` 与 `src/styles/overlays.css`，业务页只安排布局，不覆盖同级控件的配方。

| 角色 | 鼠标／桌面规范 | 触控尺寸／窄屏布局 |
| --- | --- | --- |
| 导航与阅读 | 图标栏 52px、会话栏 240px、顶栏 44px；阅读上限 880px、侧留白 16px | 导航抽屉与固定底部入口，阅读列占满可用空间 |
| Button | 最小高 32px、13px 字、8px 圆角；primary 为主要动作、secondary 为次要强调、quiet/text 为辅助、danger 为危险操作 | 最小高 44px |
| IconButton | 32px 点击区、17–18px Lucide 图标，必须有具体动作名称 | 44px 点击区 |
| SegmentedControl | 外框约 32px、13px 字；同一内容的范围／视图切换，aria-pressed 表达选中 | 选项最小高 44px |
| Tab / TabList | 34px 高、8px 圆角、13px 字；选中浅色表面；关闭槽位独立，长名省略 | 44px 高，标签栏内部横向滚动 |
| Composer | 22px 圆角、轻边框／阴影，与正文列对齐；聚焦不改变容器外观 | 固定在可用阅读区底部，多行在自身内部滚动 |

两种主题只改变语义颜色和轻阴影，不改变几何或 DOM 身份。默认「Bibo 经典」保留暖白与绿色，「简约」使用中性色。业务样式消费 canvas/sidebar/surface/ink/muted/line/primary/selection/hover/focus 等语义 token，不能为同级控件写固定颜色。

TabList 用左／右、Home／End 移动焦点，Enter／Space 激活，避免键盘经过时触发文件读取；关闭按钮不嵌套在 Tab 按钮内。分段控件使用按钮组语义，不能因外观类似就替代文件 Tab。

分段控件的外层底板使用 hover token，悬停选项使用对比更强的 selection-hover token 与 ink 文字；选中项使用 surface。验收必须比较真实底板上的悬停色，不能只证明背景色数值发生变化。

### Tooltip

- Tooltip 是提示的唯一 owner；IconButton 默认提示具体动作，Button 仅在显式提供补充说明时使用；SegmentedControl 不添加提示。Tab 和会话名仅在截断或需要补全路径时使用，导航图标与目录入口复用同一 Tooltip，不增加布局节点。
- 鼠标停留 350ms 后显示，键盘可见焦点也有提示；离开、点击或 Escape 关闭。触屏与鼠标操作后的自动焦点恢复不弹出。菜单展开时触发器的 tooltip 收起，Escape 优先关闭当前菜单。
- 左侧导航、会话、目录优先向右；顶部、编辑工具栏和 Tab 默认向下；输入器附近向上。间隔 8px、边缘避让 10px，空间不足自动换边。
- 文案说明动作或显示省略的完整名称，不暴露实现细节；同一目标不同时使用原生 title。纯内容链接、表单输入、弹出菜单选项保留自身可读名称与语义，避免重复 tooltip。
- 可点击不等于需要 tooltip。收件箱条目、任务、日程内容、概览卡片等内容入口以 hover 和打开详情表达可交互；「今天」「标记已读」等已完整可读的筛选和文字按钮不重复提示。仅在说明无文字图标、补全截断文字或提供额外路径信息时出现。

### 间距与内容行

间距复用 4／8／12／16／24／32px token：图标与文字 8px、同组操作 8px、内容行横向内边距 12px、卡片内边距 16px、区块间距 16–24px。同组区域共用对齐线，状态文字预留独立空间，hover 不改变尺寸、位置或内边距。

概览卡片内的内容入口使用 `ListRow variant="card"`：44px 最小高度、8px 圆角、8×12px 内边距，整行 hover 保留圆角；卡片圆角 12px。文字不贴 hover 背景边缘，不以去掉内边距的裸 button 拼内容行。默认列表的反馈区域也保留左右 8px 留白与 8px 圆角。手机分段切换保留 44px 实际点击高度，但可见底板保持 32px，选中表面 26px，避免厚重的筛选条。

点击范围与可见反馈范围分开：手机底部导航保持整格可点击，hover／选中底板内缩、最大宽 56px、高 44px、圆角 10px，不铺满整格。列表、导航和卡片的 hover／selected 遵守同一原则，反馈不能变成贴边的大块直角色面。

图标按钮的宽、高、最小宽和最小高共同消费 `--ui-icon-button-size`，鼠标 32px、触控 44px；只用 pointer: coarse 扩大控件，桌面窄窗口不放大。普通图标按钮的可见 hover 底板始终是 32px 圆角正方形，触控额外区域保持透明；发送等填充按钮使用 filled 配方。禁止只改最小高度或单独改宽度造成长条。触控导航行实际点击高 44px、可见反馈高 32px，鼠标行高 32px；导航行间留白 4px，模块与会话分组留白 8px，不逐页加纵向 padding。表单输入鼠标 14px／36px 高，触控 16px／44px 高；布局断点只改变壳与分区。品牌标识作为身份锚点，不增加按钮式 hover 底板。

新增界面直接复用控件；改变配方先改组件 owner，再同步消费者与本规范。最低验证覆盖 tsc、桌面／320px 窄屏、长名称、键盘／触屏、控件状态、主题切换后草稿与消息节点稳定；现有应用 product smoke 保护代表性跨页行为，不另建逐页规则脚本。

验证：`pnpm --filter @nextclaw/personal-agent-ui tsc` 与 `pnpm --filter @nextclaw/bibo-hosted smoke:client`；在真实页面抽查桌面、手机、默认、hover、焦点、选中、禁用与错误状态。

弹层、菜单及 tooltip 使用同一组 Radix 依赖版本，共享 DismissableLayer、FocusScope 和 Portal 生命周期。调整版本须一起核验，避免多实例造成背景点击锁残留或 Esc 同时关闭父层。纯行为组件不包含业务 API；命名表单、危险确认等由应用提供内容、忙碌状态及失败结果。图标统一使用 Lucide；hover 验收同时比较控件和真实承载面的颜色，不能把不可辨认的色差算作反馈。
