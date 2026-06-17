# Goal Progress

## 当前目标

把新会话欢迎页升级为居中意图入口后，继续优化 chat 入口体验：模型选择器支持搜索与收藏置顶，收藏持久化收敛到 kernel 通用偏好 KV manager，并让欢迎页/输入栏相关浮层在小高度设备上不超出可见区域。

## 明确非目标

- 不重写 chat composer / send 主链路。
- 不把 project 选择塞进输入组件内部。
- 不为了凑数量做无意义 UI 花活或表层格式化。
- 不碰、不提交当前工作区中未提交的 Codex desktop visibility 改动。
- 不把模型收藏写成前端 localStorage 特例。
- 不为一个模型选择器发明只能服务单点的窄抽象。
- 不用窗口监听或屏幕尺寸特判修复浮层位置，优先使用浮层自身的可用空间合同。

## 冻结边界 / 不变量

- welcome 是 `features/chat/features/welcome` 子 feature。
- conversation panel 只能装配 welcome，不能持有 welcome 业务规则。
- `ChatInputManager` 仍是发送 projectRoot 的业务 owner。
- 偏好持久化归 kernel manager，UI 只能通过 API/query 消费。
- 模型收藏只是通用偏好 KV 的一个 key，不进入专用 runtime / model 硬编码。
- 技能、模型、slash、welcome project/session type 等 chat 入口浮层必须尊重触发点上下文的可用高度，内部列表滚动。
- 每项优化必须能对应到代码证据、测试证据或规则沉淀。

## 已完成进展

- 1-41：welcome 子 feature 迁移、嵌入 input surface、默认 workspace/projectRoot 链路、显示规则 util、会话类型选择、历史项目下拉、agent 名称展示、真实页面冒烟、panel/welcome 测试瘦身、相关测试与规范补充。
- 42：欢迎页批次已提交为 `dd91bfbf5 feat(chat): add welcome context entry`。
- 43-63：接入 kernel 通用偏好 KV、server preferences route、UI preference API、模型收藏分组/搜索/action 合同；能力卡片填充 prompt 并复用原输入主链路；输入区组件和 token node 做边界解构、alias import、lint warning 清理，`copy-text` 改名为 `copy-text.utils.ts`。
- 64-79：把浮层高度责任归到 Popover/Select primitive；`ChatMessageListProps` 回到组件边界；agent-chat-ui 目录预算 README、shared UI README、sidebar create menu、project badge、primitive helper、真实 DOM 560/440/360 高度验证和治理闭环完成。
- 80-93：`SearchableModelInput` 删除自制 absolute dropdown，改用 shared Popover；empty/create/toggle 文案回到 i18n 调用方；模型、技能、slash、project、Agent、session type 面板补充 `100vh` fallback、内部滚动断言和真实 DOM 验证。
- 94-99：`chat-input-bar/` 测试迁入 `__tests__/`，`chat-input-bar.test.tsx` 从 866 行降到 709 行；`ChatUnknownPart` / `ChatMessageMeta` 单用组件内联删除；copy fallback 拆分并补测试，agent-chat-ui 全量 95 个测试通过。
- 100：UI 小组件 props 边界解构 warning 清理，`pnpm --filter @nextclaw/ui lint` warning 从 28 降到 20。
- 101：shared hook 与 marketplace utils 的 params 解构 warning 清理，UI lint warning 从 20 降到 16。
- 102：chat message / file-operation utils 参数解构与入参突变整理，UI lint warning 从 16 降到 4。
- 103：`chat-message.utils.test.ts` 抽出 shared test helper，并把 file-operation preview 用例拆到独立测试文件；主测试文件降到 541 行，UI lint warning 降到 3。
- 104：模型面板高度问题确认属于 floating primitive 合同；shared UI 与 agent-chat-ui Popover/Select available-height gap 升级为 `2rem`，Select content/viewport 改为 flex 内部滚动，toolbar 模型面板上限从 `22rem` 收紧到 `18rem`。
- 105：真实 dev 页面 `http://127.0.0.1:5174/chat/draft` 用 Playwright 在 `1200x420` 和 `1200x360` 打开模型面板；`360` 高度下 content `58.9-321.1`，scrollHeight `854` / clientHeight `218`，未贴边且内部滚动。
- 106：本轮收尾通过 agent-chat-ui 全量 96 个测试、UI 相关 33 个页面测试、message 18 个测试、ui/agent-chat-ui tsc/lint、governance、generated-clean、diff check；UI lint 剩余 3 个 settings 既有 warning。
- 107：`SecretsConfigForm` 的 provider/ref 映射、提交归一化和校验迁出 React component，落到 `features/settings/utils/secrets-config-form.utils.ts`；组件只保留 UI、本地编辑态和 toast 展示，新增 utils 单测覆盖 round-trip、重复 provider alias、未知 provider ref。
- 108：`ProviderForm` 的 device-code 授权轮询迁出到 `useProviderAuthFlow`，provider/template/schema 派生收敛到 `resolveProviderFormContext`，模型增删、thinking 配置、保存 payload、测试连接 payload 收敛到 `provider-form-support.utils.ts`；详情 JSX 拆成内部 detail pane，主组件只连接 query/mutation、编辑态和意图动作。
- 109：settings 定向验证通过：`secrets-config-page`、`secrets-config-form.utils`、`provider-form-support.utils`、`providers-config-page` 共 11 个测试通过；`@nextclaw/ui` tsc 通过；`@nextclaw/ui` lint 从 3 个 warning 收敛到 0 error / 0 warning。
- 110：最终治理验证通过：`pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、`pnpm check:generated-clean`、`git diff --check` 均通过；maintainability guard 为 0 error / 4 warning，剩余为既有预算提醒或本轮继续下降中的 `ProviderForm` / `provider-form-support.utils` 接近预算提醒。

## 当前下一步

继续跑治理类收尾验证，并优先寻找同责任链上能自然减债的优化点；避免为了凑数继续机械拆分或扩大到无关产品面。

## 锚点计数器

182/20
