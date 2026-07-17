# v0.23.13 聊天引用导航、消息标签与文件面板稳定性

## 迭代完成说明

本轮完成 Linear NC-125 的文件、目录引用与消息标签交互修复：

- 根因一：原输入状态只区分统一引用根层和文件模式，没有当前目录这一事实；文件模式空查询仍消费搜索结果，而搜索合同只把空查询解释为项目根层直接子项，因此目录条目只能被选中，无法继续进入。
- 根因二：消息列表的 inline token 点击 owner 只处理 Skill，文件、目录和面板应用会被直接忽略；共享标签组件又给非 Skill 标签固定了 `h-7`、边框和胶囊内边距，导致标签与正文基线、字号和行高割裂。
- 端到端检查确认现有 server 已分别提供受项目根约束的目录浏览 API 和项目全范围递归搜索 API，文件预览 owner 也已经能够识别目录并打开目录浏览器；因此修复复用这些主链路，没有新增后端搜索、平行文件选择器或第二套预览机制。
- 文件模式现在以项目根相对目录作为导航状态：空查询调用目录浏览，目录条目进入下一级，并提供“当前文件夹”条目用于真正插入目录引用；有查询时仍以项目根为范围调用全局搜索，返回文件或目录引用。
- 消息中的文件和目录标签解析为项目根内绝对路径后复用既有文件预览；面板应用复用既有 `showContent`；Skill 继续复用原渲染预览。
- 文件、目录、Skill 和面板应用统一由共享标签 owner 渲染为正文大小的紧凑链接，移除固定高度胶囊，并统一提供完整 key/path tooltip。
- 设计依据同步更新在 `docs/designs/2026-07-16-chat-file-directory-references.design.md`。
- 后续同批次完成 Linear NC-130：共享 input surface 原先只有 `240px` 最小高度和 `24rem` 最大高度，实际内容会在两者之间撑高面板，因此根层、目录加载和不同结果数量之间产生明显抖动。修复把既有最大可用高度同时设为固定高度，保持视口碰撞约束不变；没有新增测量状态、effect 或文件选择器专属样式分支。
- NC-130 同时把目录引用项的主次信息交换为“引用当前文件夹 / 实际目录名”，让首要操作语义直接可见，而不是把“当前文件夹”作为弱化状态说明。

## 测试/验证/验收方式

- `@nextclaw/agent-chat-ui` TypeScript 检查通过；消息 markdown 与列表定向测试共 `50` 项通过。
- `@nextclaw/ui` TypeScript 检查通过；引用 plugin、输入状态、路径解析、消息容器和流式输入定向测试共 `38` 项通过。
- 两个 package 的完整 ESLint 均无 error；`@nextclaw/ui` 仅报告一个本轮未触达的 `cron-config.tsx` 既有复杂度 warning。最终治理检查没有新增命名、目录、owner、参数修改、React effect 或跨包导入违规。
- `@nextclaw/ui` 全量回归共 `742` 项，其中 `737` 项通过；剩余 `5` 项失败已在 `origin/master` 的干净 detached worktree 用相同命令复现，分别是 welcome 测试缺少 `QueryClientProvider` 和 workspace panel 过期 query key 断言。本轮一度暴露的 `4` 项流式输入 fixture 失败已补齐 browse/search hook mock，并纳入上述 `38` 项定向回归。
- `@nextclaw/agent-chat-ui` 全量回归剩余 `3` 项失败，也已在 `origin/master` 的干净 detached worktree 逐项复现，分别是既有 ReactNode 合同、`whitespace-pre` 断言和 jsdom selection 行为；本轮触达的 `50` 项均通过。
- `pnpm local:source-runtime -- start --home-mode clone-config --port 18925 --instance nc-125` 从当前工作树构建 `35` 个 workspace package 并启动隔离源码实例，完整构建通过。
- 在 `http://127.0.0.1:18925` 的真实页面将新任务绑定到 NC-125 隔离工作树：输入 `@` 进入文件模式后，从根目录打开 `docs`，页面显示其子目录、文件和“docs / 当前文件夹”可选项；选择当前文件夹后成功插入不可编辑目录 token。
- 同一真实页面在文件模式输入 `chat-inline-token-badge`，返回位于 `packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list` 的深层文件，证明搜索范围是整个项目而不是当前目录。
- 页面控制台无 error/warning；草稿未发送给外部模型，浏览器页已关闭，隔离源码实例已停止，用户正在运行的 NextClaw 实例未被重启或替换。
- `pnpm lint:maintainability:guard`、`pnpm lint:new-code:governance`、governance backlog ratchet 与 `git diff --check` 通过；源码构建生成物已用 `pnpm clean:generated` 清理。
- NC-130 定向测试通过：`@nextclaw/agent-chat-ui` input surface menu `3` 项、`@nextclaw/ui` context reference plugin `4` 项；两个 package 的 `tsc`、构建与 lint 均通过，`@nextclaw/ui` lint 仅保留未触达的 `cron-config.tsx` 既有复杂度 warning。
- NC-130 使用最新源码在隔离实例 `http://127.0.0.1:18930/chat` 完成真实页面验收：真实键盘打开 `@` 菜单，从根层进入“文件与文件夹”再进入 `.agents`；根层、目录加载中和子目录结果完成后三个阶段的面板高度均为 `304.9375px`，子目录首行明确显示“引用当前文件夹 / .agents”。实例随后已停止，没有重启或接管用户正在运行的实例。
- NC-130 全量测试审计仍复现本轮未触达的既有基线：`@nextclaw/agent-chat-ui` 为 ReactNode 合同、jsdom selection 和旧样式断言共 `3` 项，`@nextclaw/ui` 为 welcome 测试缺少 QueryClientProvider 和 workspace panel 过期 query key 共 `5` 项；本次触达路径的定向回归全部通过。

## 发布/部署方式

NC-125 只在隔离分支提交并创建 Ready PR；同批次 NC-130 按 issue 内明确授权 fast-forward 到干净的本地 `master`。两者都不执行 NPM 发布、runtime update、桌面发布、部署或数据库 migration；NC-130 不 push、不建 PR。

## 用户/产品视角的验收步骤

1. 打开一个已经绑定项目目录的聊天，在输入框键入 `@` 并选择“文件与文件夹”。
2. 选择任意目录，确认菜单在同一位置显示上一级、当前文件夹以及该目录的直接子项。
3. 选择“当前文件夹”，确认输入框插入目录 token；也可以继续进入更深目录后选择文件。
4. 重新进入“文件与文件夹”并输入深层文件名，确认无论当前浏览目录在哪里，都能从整个项目范围返回匹配结果。
5. 发送包含文件、目录、Skill 或面板应用引用的消息后，确认标签与普通 markdown 链接同字号、同一行显示；悬停可见完整提示，点击可打开对应预览或应用。
6. 在文件引用面板的根层、目录加载中和不同目录结果之间切换，确认面板高度不随内容数量抖动；进入子目录后，确认首行以“引用当前文件夹”为主要操作文案，并把实际目录名作为补充信息。

## 可维护性总结汇总

- 本轮是用户可见能力补全，不适用非功能改动的生产代码净增 `<= 0` 门槛。
- 目录导航复用现有 `useServerPathBrowse`，全局搜索复用 `useServerPathSearch`；两者由输入状态 owner 按“空查询浏览 / 非空查询搜索”单路径切换，没有扩展后端合同。
- 文件和目录点击复用现有 `chatThreadManager.openFilePreview`，面板应用复用 `chatUiManager.showContent`，没有新增 preview manager 或组件内文件读取。
- 共享消息标签删除原有多套 tone、胶囊和用户/助手分支样式，统一成一套链接语义；该文件由 `122` 行降至 `72` 行，是本轮主要正向减债。
- `post-edit-maintainability-guard` 检查 `15` 个代码文件：`0 error`、`5 warning`；warning 为既有超预算目录或接近预算的触达文件，没有新增文件或目录膨胀。`context-reference-plugin.utils.ts` 当前 `358/400` 行，后续继续增长前应把纯 item builder 收敛到独立角色 owner。
- 代码增减报告：`+460 / -158`，净增 `302` 行；非测试代码 `+256 / -140`，净增 `116` 行。增长用于目录导航状态、全局搜索切换、消息点击能力与 i18n，测试覆盖同步增长；实现没有新增 effect、store、服务或平行链路。
- `post-edit-maintainability-review` 结论：通过，no maintainability findings。React 组件类型、key 与 DOM 父级保持稳定；目录路径属于当前 trigger 会话的瞬时 UI 状态，不进入持久 store。
- NC-130 的代码改动为 `+54 / -26`，其中非测试语义代码 `+4 / -7`、净减 `3` 行，满足非功能改动净增 `<= 0` 的硬门。正向减债是删除重复的最小高度常量和内层高度 owner，把尺寸合同收敛到现有 PopoverContent；目录项仅交换既有标题和副标题，不新增组件、helper、状态或平行样式路径。
- NC-130 的 maintainability guard、new-code governance、backlog ratchet 与 generated-clean 全部通过。两个触达生产文件分别为 `402/500` 和 `358/400` 行，均只报告接近预算 warning 且本次没有增长；后续继续扩展时，应分别拆出 input surface 布局角色和纯 reference item builder。`post-edit-maintainability-review` 结论仍为 no maintainability findings。

## NPM 包发布记录

本轮及同批次 NC-130 包含用户可见行为和共享 UI 变更，已更新 `.changeset/chat-reference-navigation.md`；以下包均需 patch 且当前未发布，状态为待统一发布：

- `@nextclaw/agent-chat-ui@0.6.5`
- `@nextclaw/ui@0.15.5`
