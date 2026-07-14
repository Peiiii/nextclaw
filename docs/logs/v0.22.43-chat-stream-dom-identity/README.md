# v0.22.43-chat-stream-dom-identity

## 迭代完成说明

本批修复流式输出期间交互状态被意外重置的三个基础生命周期问题。文字选区存在两条独立的违约路径：第一，外部状态同步进入 Lexical 时同时提交了内部 selection，Lexical 默认会把它同步为浏览器 DOM selection；第二，消息 Markdown 在组件内部根据动态回调创建 `p`、`a`、`span`、`code` 等 renderer，流式查询快照更新使 `handleInlineTokenClick` 获得新函数身份后，renderer 组件类型也随之变化，React 因而卸载并重建历史消息的文本节点。Panel App 重新加载则是消息展示生命周期问题：Panel App 后续出现 reasoning 或 tool 时，单张工具卡会被替换成工具活动分组，导致 iframe 被卸载。

修复后，Lexical 后台文档与 caret 同步在 composer 未持有焦点时使用官方 `SKIP_DOM_SELECTION_TAG`，只更新编辑器模型，不再接管当前页面焦点和选区；composer 正在接收用户输入时，受控状态回写仍必须把内部 caret 同步回 DOM。后一个边界来自真实回归：若聚焦态也跳过 DOM selection，第一次 Backspace 后文本虽然从末尾正确删除，浏览器光标却会落到 offset 0。显式的 `focusComposer` / `focusComposerAtEnd` 用户动作仍允许主动更新 DOM selection。Markdown 使用模块级稳定 renderer，动态回调和文案通过 Context 更新，因此行为保持最新而历史 DOM 身份不再绑定查询对象身份。旧的 `ChatPopoverContent` 输入框焦点特判随之删除，所有弹层恢复标准 focus-out 语义。Panel App 被定义为不可跨越的交互边界，不再参与动态工具分组，宿主 renderer 也保持稳定引用。实现没有增加全局选区保存、焦点恢复或逐组件适配逻辑。

为避免同类问题再次出现，本批新增 `react-rendering-lifecycle-safety` 通用 React 编码 skill，并在 `AGENTS.md` 建立常驻硬约束和触发路由：组件类型保持模块级稳定，动态数据通过 props / Context 传递，streaming 更新不得通过 type、key 或父级结构变化重挂载状态型 DOM。验证层要求直接断言 Text node、iframe、editor 或 canvas 的节点身份，而不能只断言内容仍存在。

## 测试/验证/验收方式

- 修复前的 owner 合同缺口：后台文档同步与后台 caret 同步调用 `editor.update` 时都没有携带 DOM selection 隔离标记；Lexical 的默认语义会把内部 selection 提交到 DOM。新增测试分别锁定两条调用都必须携带 `SKIP_DOM_SELECTION_TAG`。
- 聚焦态回归证据：在 `http://127.0.0.1:5174/chat/sid_bmNwLW1xa21zNGp5LWIzZjM5OGFl` 输入 `/agent`，修复前第一次 Backspace 后文本为 `/agen`、DOM caret 却为 0；修复后连续五次删除依次为 `/agen`@5、`/age`@4、`/ag`@3、`/a`@2、`/`@1。新增组件回归测试锁定聚焦 composer 的连续 Backspace，并新增 owner 单测锁定聚焦态不能使用 `SKIP_DOM_SELECTION_TAG`。
- 修复前的 Markdown 定向失败证据：保持消息文本不变、只替换宿主 `onInlineTokenClick` 回调后，历史 Text 节点身份发生变化，已有浏览器选区变空；修复后节点身份和选区都保持，并且链接等交互调用最新宿主回调。
- 修复前的 Panel App 定向失败证据：追加 reasoning 与第二个 tool 后，既有 Panel App iframe 消失；修复后 Panel App 保持独立渲染边界。
- `@nextclaw/agent-chat-ui` 5 个定向测试文件共 45 项通过，覆盖后台文档同步、输入选区、Markdown DOM 身份、流式历史消息选区和 Panel App 身份。
- `@nextclaw/ui` 2 个宿主层测试文件共 19 项通过；`@nextclaw/agent-chat-ui` 与 `@nextclaw/ui` TypeScript 检查通过。
- 新增 React 生命周期 skill 的 frontmatter 已使用仓库 `yaml` 解析器按 `quick_validate` 同等规则验证通过；`AGENTS.md` 的触发路由、规范索引和常驻硬约束均可反向定位到该 skill。
- `pnpm lint:new-code:governance`、`pnpm check:governance-backlog-ratchet` 与 `git diff --check` 通过。
- 本地源码页面中，用户消息选区在 assistant 持续运行的 7.5 秒观察窗口内保持，但旧实现于运行完成切换时丢失；这一观察进一步定位到 Markdown Text 节点被替换。修复后的精确节点身份与选区由上述 DOM 回归测试证明。既有会话的 11 个 Panel App iframe 在追加测试消息后的 8 秒观测窗口内始终保持 11 个。

## 发布/部署方式

本次未执行发布或部署。

已新增 `.changeset/chat-stream-dom-identity.md`，后续随 `@nextclaw/agent-chat-ui` 与 `@nextclaw/ui` patch 版本统一发布。无后端、数据库或 migration 变更。

## 用户/产品视角的验收步骤

1. 在 assistant 思考、持续输出和完成状态切换时，选中一段已有用户消息，确认选区不会消失，输入框也不会抢回焦点。
2. 聚焦聊天输入框，输入 `/agent` 后连续按 Backspace，确认字符从末尾逐个删除，光标始终停在剩余查询末尾而不是跳到 `/` 前。
3. 打开包含内联 Panel App 的历史消息，在后续 reasoning 和工具结果继续到达时，确认应用不闪白、不重新加载，应用内部状态保持不变。
4. 确认普通工具结果仍按原规则合并为活动分组，Panel App 前后的普通内容和工具结果顺序不变。
5. 确认用户主动切换会话、关闭内容或刷新页面时仍按原有生命周期工作；本批只阻止无用户意图的流式重挂载。

## 可维护性总结汇总

- 设计原则是“后台数据同步不得隐式接管用户交互状态；动态运行时数据不得决定 React 组件类型；交互型内容不得被动态展示分组接管生命周期”。composer owner 只拥有编辑器模型，浏览器当前 selection 属于用户；Markdown renderer 类型必须稳定；Panel App iframe 是工具展示中的硬边界。
- 选区修复复用 Lexical 官方 update tag，并把 Markdown renderer 从动态闭包收敛为稳定组件，没有增加选区镜像状态、事件监听器或恢复 effect；Panel App 修复收敛在既有工具分组 owner。
- 精确暂存统计总计 `+729/-379`、净增 350 行，其中回归测试与通用规范承担主要新增；非测试源码 `+281/-283`、净减 2 行。staged snapshot 的 scoped maintainability guard 为 0 error、4 个既有预算 warning，满足非功能改动闸门。
- 消息列表目录继续使用已有超预算例外；`chat-composer-lexical-owner.ts` 当前 470 行、`chat-message-markdown.tsx` 当前 440 行、`chat-message-list.container.tsx` 当前 425 行，均接近 500 行预算但未越线，container 较 HEAD 减少 13 行。本批没有新增 effect、manager、状态镜像或兼容分支，也没有建立第二条消息渲染链路。
- 主观复核结论：输入侧修复落在唯一 Lexical owner，消息侧修复落在唯一 Markdown renderer owner；旧的全局 Popover 输入框焦点特判已删除，无需让菜单、搜索框、预览区和消息区分别保存或恢复选区。Panel App 修复落在既有工具分组 owner。
- 聚焦态补充修复只把现有 DOM selection 隔离条件收窄到真正的后台同步，没有新增 selection 状态或第二条删除路径；`chat-composer-lexical-owner.ts` 当前 466 行，较 500 行预算仍有余量。
- 本批没有新增只识别 ReactMarkdown 的窄治理脚本，也没有为单条规则引入新的 ESLint plugin 依赖；通用防线由自动触发的 React 生命周期 skill、常驻硬约束和强制 DOM 身份回归测试组成。后续若仓库统一引入 React lint plugin，再评估启用通用的 unstable nested component 规则。

## NPM 包发布记录

本次未发布 NPM 包。

- `@nextclaw/agent-chat-ui`：patch，待统一发布。
- `@nextclaw/ui`：patch，待统一发布。
