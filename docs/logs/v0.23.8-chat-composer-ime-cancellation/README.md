# v0.23.8-chat-composer-ime-cancellation

## 迭代完成说明

本批修复聊天输入框在中文输入法组合期间按 Backspace 后，拼音字母未被删除、光标反而跳到输入框开头的问题。

根因是同一次 IME 输入存在两个事实 owner：Lexical 已根据浏览器 composition 生命周期维护编辑器内容与选区，React `onCompositionEnd` 又在业务层读取 `CompositionEvent.data`，并在 editor 回到 composition 开始前状态时把字符手工插回。用户按 Backspace 取消组合恰好会回到该状态，因此被错误识别为“浏览器尚未提交”，随后整棵 Lexical root 被重建，字符与光标都被覆盖。

修复删除 React、owner 与 controller 中的人工 composition 提交路径。Lexical 现在独占 composition 生命周期、编辑器文档和活跃选区；外部 owner 只在 `LexicalEditor.isComposing()` 为 false 时同步或发布稳定快照。本批没有加入浏览器识别、定时器、选区恢复或新的兼容层。

设计依据见 [`docs/designs/2026-07-15-chat-composer-ime-cancellation.design.md`](../../designs/2026-07-15-chat-composer-ime-cancellation.design.md)。

## 测试/验证/验收方式

- 修前红灯：新增 owner 边界用例，把 `LexicalEditor.isComposing()` 固定为 true；旧实现仍调用 `editor.update` 重写 root，测试失败。修复后同一用例通过。
- 定向回归：chat composer 的 owner、keyboard 与 input bar 测试共 `42/42` 通过，覆盖组合期间外部重渲染不改写 DOM/光标、composition 事件数据不被人工写回、Backspace 取消后 draft 保持为空。
- `@nextclaw/agent-chat-ui` TypeScript 检查通过。
- `@nextclaw/agent-chat-ui` ESLint 通过。
- 包级全量测试存在 `2` 个既有失败：公共类型文件含 `ReactNode`，以及文件预览长行 class 断言；失败文件不在本批触达范围，IME 定向用例全部通过。
- 本地 `5174` 源码页面已加载当前实现并完成普通输入、焦点与页面重渲染冒烟。
- 原生中文 IME 自动验收未完成：当前 macOS 输入源为 `US`，自动化键盘无法切换到已安装的微信输入法。该缺口保留为下方人工验收步骤，不把普通键盘冒烟冒充 IME 通过。

## 发布/部署方式

本次未执行发布或部署。已新增 `.changeset/chat-composer-ime-cancellation.md`，后续随 `@nextclaw/agent-chat-ui` 与 `@nextclaw/ui` 统一发布 patch。

本批不涉及后端、数据库、migration、运行时配置或远程部署。

## 用户/产品视角的验收步骤

1. 打开聊天输入框，将输入法切换为中文拼音。
2. 按下任意拼音字母，让输入法进入组合态，但不要选词上屏。
3. 立即按 Backspace。
4. 确认拼音字母被删除，输入框保持为空，光标仍在空输入框的合法起点，没有跳到其它内容前方。
5. 再正常输入并选择一个中文候选词，确认文字只上屏一次。
6. 在 AI 流式输出期间重复以上步骤，确认父组件重渲染不会清空组合文本或移动光标。

## 可维护性总结汇总

- 本批生产代码新增 `6` 行、删除 `89` 行、净减 `83` 行；测试代码新增 `64` 行、删除 `152` 行、净减 `88` 行；合计新增 `70` 行、删除 `241` 行、净减 `171` 行。
- 正向减债动作是删除平行的 composition flag、开始快照、人工提交函数、React composition handlers 和为该 fallback 服务的测试合同，让 IME 只剩 Lexical 一条主链路。
- 没有新增文件级抽象、helper、状态、浏览器特判或 DOM 恢复分支；owner 由 `467` 行降至 `444` 行，controller 删除 `51` 行。
- 可维护性 guard 以 `--non-feature` 检查 6 个触达文件：`0` error、`2` warning；生产代码净减 `83` 行，满足非功能改动门槛。两条 warning 均为接近预算且本批下降：`chat-input-bar.test.tsx` 为 `898/900`、owner 为 `444/500`，分别净减 `22` 行与 `23` 行。
- `lint:new-code:governance` 与 `check:governance-backlog-ratchet` 均通过。
- `chat-input-bar.test.tsx` 后续新增覆盖应优先拆分 fixtures/builders 与行为场景；owner 若继续增长，应优先拆出独立的命令或 selection 职责，不把生命周期逻辑放回 React 组件。

## NPM 包发布记录

- `@nextclaw/agent-chat-ui`：需要 patch；changeset 已添加，当前待统一发布。
- `@nextclaw/ui`：需要 patch；消费修复后的聊天输入组件，changeset 已添加，当前待统一发布。
