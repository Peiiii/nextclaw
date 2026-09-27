# Personal Agent UI

`@nextclaw/personal-agent-ui` 提供可复用的 React 视觉与交互组件。包名、公共 API、CSS class 和 token 不包含产品品牌；账号、会话、任务等业务状态留在消费应用。Bibo 是当前第一个消费者。

## 边界

- 公共组件：`Button`、`Input` / `Select` / `Textarea` / `Field`、`SegmentedControl`、`ListRow`、`EmptyState`、`Notice`、`Message` / `Markdown`、`Composer`、`Dialog` / `Sheet`、`ActionMenu` / `ActionMenuItem` / `ActionMenuLink`、`IconButton`。
- 公共样式：`src/styles/theme.css` 中的 `--ui-*` token 和 `.ui-*` class，统一默认、hover、focus、selected、disabled 与错误状态。
- 品牌配置：Bibo 的名称、标记、文案、配色覆盖留在应用层，通过 props 和主题变量注入。未来改名无需重命名组件包或公共 API。
- 业务流程：网络请求、导航、确认、保存判定与 store 不进入组件包。组件不得依赖 Bibo、Zustand、Cloudflare 或服务端代码。

页面可决定布局，但重复控件不能再写局部平行状态样式。组件从包根入口导入。新增组件要有跨页面使用场景或独立行为合同。

验证：`pnpm --filter @nextclaw/personal-agent-ui tsc` 与 `pnpm --filter @nextclaw/bibo-hosted smoke:client`；在真实页面抽查桌面、手机、默认、hover、焦点、选中、禁用与错误状态。

弹层、菜单及 tooltip 使用同一组 Radix 依赖版本，共享 DismissableLayer、FocusScope 和 Portal 生命周期。调整版本须一起核验，避免多实例造成背景点击锁残留或 Esc 同时关闭父层。纯行为组件不包含业务 API；命名表单、危险确认等由应用提供内容、忙碌状态及失败结果。图标统一使用 Lucide；hover 验收同时比较控件和真实承载面的颜色，不能把不可辨认的色差算作反馈。
