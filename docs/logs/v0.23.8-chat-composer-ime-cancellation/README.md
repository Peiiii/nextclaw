# v0.23.8-chat-composer-ime-cancellation

## 迭代完成说明

本批最初修复中文输入法 composition 中按 Backspace 后字符恢复、光标跳到输入框开头的问题；后续按用户补充的“输入拼音后按 `1/2/3/4` 选候选词，偶发光标跳到最前方”继续完成同一责任链的结构性收敛。

完整根因不是单个 `compositionend` fallback，而是同一实时编辑文档存在两个可写 owner：

- Lexical 已根据浏览器 `beforeinput`、`input`、composition 维护正文与 selection；
- React `onBeforeInput` 又拦截 `insertText` / `insertReplacementText`，从外部 nodes 快照人工改字并 `root.clear()` 重建文档；
- Backspace、Delete、Shift+Enter 也走相同的整树重建；
- 父组件每次 render 新建 nodes 数组，外部同步 effect 被无关 streaming render 反复触发；
- owner 用一整帧布尔锁忽略程序化 update，存在连带吞掉真实用户 update 的窗口。

数字候选键会触发 IME replacement/composition 提交，恰好让 Lexical 原生提交与 React 人工提交竞争。整树重建替换了浏览器 selection 所属 DOM 节点，因此同一架构缺陷会以“取消 composition”“数字选词”“普通删除”等不同事件顺序反复表现。

本轮删除 React `beforeinput` 平行写路径和普通删除/换行的全文重建。Lexical 现在独占实时文字、selection 与 IME 生命周期；keyboard controller 只保留 Send/Stop 产品命令，相邻 token 删除直接移除目标 Lexical token node。明确的 reset/restore/token/prompt 写入使用精确 update tag，不再用 `requestAnimationFrame` 布尔锁。父组件对同一 input snapshot 复用稳定 nodes 引用，无关 streaming render 不再触发外部文档同步。

设计依据已扩充到候选词提交与完整 owner 链路：[`docs/designs/2026-07-15-chat-composer-ime-cancellation.design.md`](../../designs/2026-07-15-chat-composer-ime-cancellation.design.md)。

## 测试/验证/验收方式

- 修前证据：`@nextclaw/agent-chat-ui` 的 owner/keyboard/input-bar 定向测试 `41/41` 全绿，但同一 consumer 链路的 `@nextclaw/ui` streaming/IME 用例为 `1/4` 失败，证明第一次修复的测试边界不完整。
- 候选词 assembled boundary test 改为真实顺序：普通文字建立 Lexical selection -> composition start -> 拼音 DOM 预编辑 -> streaming rerender -> 数字 `1` 选词 -> composition input -> composition end；断言候选词、paragraph DOM 身份与最终 caret offset。
- 修后 `@nextclaw/agent-chat-ui` 三个定向文件 `42/42` 通过。
- 修后 `@nextclaw/ui` `session-conversation-input.streaming.test.tsx` `4/4` 通过。
- `pnpm --filter @nextclaw/agent-chat-ui tsc` 通过。
- `pnpm --filter @nextclaw/ui tsc` 通过。
- `pnpm --filter @nextclaw/agent-chat-ui lint` 通过，`0` error、`0` warning。
- `pnpm --filter @nextclaw/ui lint` 通过，`0` error；保留 `cron-config.tsx` 的 `1` 条既有复杂度 warning，与本批无关。
- `http://127.0.0.1:5174/chat` 源码 consumer 冒烟：唯一聊天 editor 输入“输入法光标验收”后保持 active，正文与 caret offset 均为 `7`；按 Backspace 后正文退一字、caret offset 为 `6`；随后已清空测试草稿且未发送消息。
- 原生中文候选窗仍需人工验收：浏览器自动化不能可靠控制 macOS 系统输入法候选 UI，本批不把合成事件测试冒充原生 IME 通过。
- 可维护性 guard `--non-feature --paths ...`：`0` error、`3` warning；总计新增 `183` 行、删除 `174` 行、净增 `9` 行，其中非测试生产代码新增 `109` 行、删除 `154` 行、净减 `45` 行。
- 定向 `lint:new-code:governance --paths ...` 全部通过；全工作区入口被用户现有 `packages/nextclaw-core/src/shared/lib/core-utils/utils/helpers.utils.ts` 父级相对导入阻塞，与本批文件无关。
- `check:governance-backlog-ratchet` 通过。

## 发布/部署方式

本次未执行发布、部署或服务重启。`.changeset/chat-composer-ime-cancellation.md` 已在前一轮加入，继续随 `@nextclaw/agent-chat-ui` 与 `@nextclaw/ui` 统一发布 patch。

排查确认当前 `55667` 安装运行实例来自 `0.23.0` runtime bundle，资源时间早于第一次修复提交，因此它尚不包含此前修复；本轮没有在未获授权的情况下重启或替换该实例。`5174` 源码 dev 页面已通过热更新消费本轮实现。

本批不涉及后端、数据库、migration、运行时配置或远程部署。

## 用户/产品视角的验收步骤

1. 打开当前源码聊天输入框，将输入法切换为中文拼音。
2. 输入任意拼音，按 `1/2/3/4` 选择对应候选词，重复多次。
3. 确认候选词只上屏一次，光标始终位于候选词末尾，不跳到正文最前方。
4. composition 尚未选词时按 Backspace，确认拼音被取消，光标不跳。
5. 在 AI 流式输出期间重复步骤 2-4，确认后台重渲染不清空预编辑文本、不替换正文节点、不移动光标。
6. 补验英文输入、连续 Backspace、Shift+Enter、Enter 发送、Escape 停止以及 skill/file token 删除。

## 可维护性总结汇总

- 可维护性复核结论：通过；本次属于非功能 bugfix，非测试生产代码净减 `45` 行。
- 正向减债动作：删除 `onBeforeInput` 人工文字提交、普通删除/换行快照重建、整帧 update 锁；将 token 删除收敛到 keyboard controller 对单个 Lexical node 的直接操作。
- owner 从 `444` 行降至 `436` 行；keyboard controller 由承载通用文字编辑快照逻辑收敛为 `123` 行的产品键盘命令与 token 边界逻辑。
- 未增加浏览器/输入法品牌特判、数字键拦截、定时 focus 或 selection restore；外部同步 tag 表达明确程序化来源，普通输入主流程更短。
- guard 的三条 warning 均为历史文件接近预算：`chat-input-bar.test.tsx` `883/900` 且本批未增长，owner `436/500` 且净减 `8` 行，`session-conversation-input.tsx` `485/500` 且只新增稳定引用 `1` 行。没有文件级、目录级、函数级、命名职责或红区阻塞项。
- 下一步拆分缝：`chat-input-bar.test.tsx` 优先拆 fixtures/builders；`session-conversation-input.tsx` 后续按输入/工具栏连接职责拆分。本批不为过行数门槛扩大无关重构。

重复失败的机制改进已进入 `.agents/skills/react-rendering-lifecycle-safety/SKILL.md` 与 `.agents/skills/nextclaw-validation-workflow/SKILL.md`：editor 场景必须检查原生事件与外部 draft 是否形成双写，并在最终 consumer 覆盖真实 IME 事件顺序、DOM 身份和 caret。该规则属于按需前端生命周期/验证场景，不进入每轮常驻 `AGENTS.md`；语义依赖运行时 owner 与事件链，暂不增加高误报的窄治理脚本。

## NPM 包发布记录

- `@nextclaw/agent-chat-ui`：需要 patch；changeset 已添加，当前待统一发布。
- `@nextclaw/ui`：需要 patch；消费修复后的聊天输入组件，changeset 已添加，当前待统一发布。
