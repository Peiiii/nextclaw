# 聊天欢迎页单入口简化

## 迭代完成说明

- 欢迎页从“标题 + 副标题 + 输入框 + 独立上下文栏 + 三张能力卡”收敛为单标题、单输入入口、成组上下文和轻量提示建议。
- 欢迎态输入文案改为直接询问用户目标；普通会话仍保留完整的 `/`、`@` 与快捷键提示，不削弱后续可发现性。
- 项目、Agent 与会话类型继续复用原有选择组件和状态链路，仅在欢迎页中组合为一个上下文表面；发送与会话创建路径未新增旁路。
- 三张能力卡删除并替换为三个无边框提示按钮；原 `chat-welcome-capability-grid.tsx` 重命名为职责更准确的 `chat-welcome-prompt-suggestions.tsx`。
- 模型选择触发器只显示模型名，完整 provider/model 仍保留在菜单、标题和可访问名称中。
- 附件与技能收进同一个“＋”入口；第一层只保留轻量操作，技能在同一浮层进入可搜索的第二级列表，不再把完整技能管理器直接堆进首层。
- 技能列表删除重复图标、来源胶囊和空心选择圆，整行可选且只为已选项显示勾；编辑器同步时保留浮层焦点，可连续多选。
- 删除“＋”入口的技能数量徽标，避免越界遮挡和无必要的视觉强调。
- 将 hover 从强调/选中态 `accent` 中拆为全局浅交互色；模型按钮、菜单、共享按钮和列表使用一致的 `#f5f5f5` 反馈。
- 模型面板与技能面板统一为轻量搜索、平铺分组和底部管理入口；未收藏星标仅在 hover/focus 时出现，并增加“管理模型与提供商”跳转。
- 模型搜索支持分词与跨 `/`、空格、连字符的子序列模糊匹配，例如 `deep v4`、`dsv4` 均可命中对应 DeepSeek 模型。
- 所有文本输入框聚焦时保持原边框、背景与阴影，不再额外显示 focus 边框或 ring。
- 粘贴或添加图片后，附件 token 显示真实图片缩略图，加载失败才退回通用图标；文件、技能、项目、工作区引用和面板应用等编辑器内嵌 token 共用 24px 高、16px 图标、7px 圆角和垂直居中的紧凑尺寸骨架。
- 编辑器范围选区把 token 当作原子对象：选区跨过 token 时整块显示统一浅蓝选中态，并抑制缩略图、图标和内部文字各自出现碎片化原生高亮。
- 补齐 `ChatConversationWelcome` 测试对 `useProjects` 的既有 mock 缺口，使相关测试组可独立重复运行。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui tsc`：本轮早期通过；最终复查被并行工作区中两个非本任务测试文件的 `statusKind` 合同漂移阻塞，具体见下方复验说明。
- `pnpm --filter @nextclaw/agent-chat-ui tsc`：通过。
- `pnpm --filter @nextclaw/ui lint`：通过，0 error。
- `pnpm --filter @nextclaw/agent-chat-ui lint`：通过，0 error。
- `pnpm --filter @nextclaw/ui exec vitest run src/features/chat/features/welcome/components/__tests__/chat-welcome.test.tsx src/features/chat/features/welcome/components/__tests__/chat-conversation-welcome.test.tsx`：2 个文件、9 条测试通过。
- `pnpm --filter @nextclaw/agent-chat-ui exec vitest run src/components/chat/ui/chat-input-bar/__tests__/chat-input-bar.test.tsx`：1 个文件、33 条测试通过。
- `pnpm --filter @nextclaw/ui build`：生产构建通过；仅保留既有大 chunk 提示。
- 输入工具栏定向测试：3 个文件、35 条测试通过，覆盖两级菜单、连续多选、模型模糊搜索与管理入口。
- 内嵌附件 token 定向测试：2 条测试通过，覆盖统一紧凑尺寸、真实图片缩略图和原子选区状态。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet`、`pnpm check:generated-clean`：通过。
- Playwright 真实页面验收：`http://127.0.0.1:5174/`，在 `1440x900` 与 `915x603` 视口分别检查中英文欢迎页，横向溢出均为 `0`；工作目录弹层可打开，点击“梳理当前项目”后同一编辑器写入完整提示词。
- Playwright 真实交互验收：技能面板连续选择两项后仍保持打开，2 个选中勾同时存在；模型与“＋”按钮 hover 均为 `rgb(245, 245, 245)`；模型搜索输入聚焦前后 border/background/box-shadow 完全一致；`dsv4` 可命中 `deepseek-v4-flash`；管理入口指向 `/providers`；页面错误为 0。
- Playwright 真实图片与选区验收：附件 token 实测高度 24px、缩略图 16px、圆角 7px、`vertical-align: middle`；全选后 token 的 `data-composer-selected=true`，整块背景为 `rgb(214, 234, 255)`、边框为 `rgb(184, 213, 245)`，与相邻正文选区连续显示。

## 发布/部署方式

- 本轮完成本地源码改造、验证与提交，未部署、未发布。
- 不涉及数据库 migration、后端服务变更或 NextClaw 宿主重启。

## 用户/产品视角的验收步骤

1. 打开新任务空态，确认首屏只突出“今天想完成什么？”和输入框，不再出现副标题与三张能力卡。
2. 确认输入框占位文案简短，技能、附件、模型和发送操作仍可用。
3. 确认项目、Agent、会话类型位于同一个上下文表面，并可分别打开和选择。
4. 点击“梳理当前项目”“推荐实用技能”或“创建定时任务”，确认提示内容进入原输入框而不是跳转到第二套流程。
5. 切换中英文与常规桌面、紧凑桌面宽度，确认信息层级、换行和操作可达性保持稳定。
6. 打开“＋ → 技能”，连续选择多个技能，确认浮层不关闭；关闭后“＋”旁不出现数量徽标。
7. 打开模型选择，输入模型名称片段或缩写，确认可模糊匹配；底部“管理模型与提供商”可进入提供商页。
8. 聚焦模型搜索、技能搜索及其他文本输入框，确认边框、背景和阴影均不跳变。
9. 粘贴图片并输入正文、技能或上下文引用，确认所有内嵌 token 等高；全选内容时确认 token 整块进入选中态，不再只有文件名或技能名局部染蓝。

## 可维护性总结汇总

- `post-edit-maintainability-guard --non-feature --paths ...`：0 error；总代码 `+698/-681/net +17`，非测试代码 `+528/-584/net -56`。
- 正向减债动作是删除副标题、能力卡图标/说明/容器样式、默认项目徽标和旧能力卡命名，同时复用原输入与上下文选择链路；没有新增 manager、helper、adapter 或兼容分支。
- 欢迎页仍是页面编排 owner，共享输入组件仍拥有编辑器与工具栏，React 组件类型、key、父级身份和编辑器生命周期未改变。
- 文件继续留在现有 `features/chat/features/welcome/components` 子 feature，未增加目录层级、barrel 或共享层抽象。
- 守卫保留 7 条既有/临界预算预警；`chat-input-bar.test.tsx` 已从超限修回 893 行，新增模型搜索回归测试进入独立文件，未继续挤压该热点文件。
- 可维护性复核结论：通过；无新增维护债务，非测试语义代码净减 56 行。
- 图片缩略图与富文本选区属于新增用户能力，相关 12 个文件守卫为 0 error、2 条临界文件预算预警；选区到 token DOM 的纯映射收敛在 editor-state 模块，owner 只负责调度，数据继续沿既有附件 token 与 Lexical selection 链路传递，没有新增平行附件状态或第二套编辑器选区模型。

## NPM 包发布记录

- 本轮不涉及 NPM 包发布。
- 源码触达 `@nextclaw/ui` 与 `@nextclaw/agent-chat-ui`；已添加 patch changeset，待后续统一发布批次处理。
