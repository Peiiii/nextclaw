# 聊天输入框 IME 取消、候选词提交与光标稳定性设计

## 背景

聊天输入框先后出现两类中文输入法问题：

1. 输入拼音后立即按 Backspace，字母没有被删除，光标跳到正文前方。
2. 输入拼音后按 `1/2/3/4` 选择候选词，偶发候选词成功上屏，但光标跳到正文最前方。

第二类反馈证明第一次修复只删除了一个 composition 结束 fallback，没有闭合整条输入链路。本轮目标不是继续补某个数字键或浏览器特判，而是让正文、选区和 IME 生命周期只有一个实时 owner，并删除普通输入期间的整棵编辑树重建。

## 端到端现状依据

真实链路为：

`浏览器 IME -> Lexical beforeinput/input/composition -> ChatComposerLexicalOwner -> SessionConversationInput nodes -> React 回传 Lexical`

Lexical `0.43.0` 已内建处理：

- `insertText`；
- `insertReplacementText`；
- `insertFromComposition`；
- Chrome/WebKit、Firefox、Safari 不同的 `input` / `compositionend` 顺序；
- composition 期间的 keydown 隔离与 DOM/selection 同步。

现有业务实现却在这条链上又建立了平行写路径：

1. React `onBeforeInput` 拦截 `insertText` 和 `insertReplacementText`，`preventDefault` 后从外部快照人工替换文字。
2. 普通 Backspace、Delete、Shift+Enter 也先把 Lexical state 转成线性 nodes，再调用 `root.clear()` 重建整棵文档和 selection。
3. editor update 发布到 React 后，父组件每次 render 都创建新的 nodes 数组，`useLayoutEffect` 因引用变化反复执行外部同步判断。
4. 程序化同步使用一整帧布尔锁忽略 update；若真实用户输入与外部写入落在同一帧，合法 update 也可能被吞掉。

按数字选词不是普通数字输入。输入法会以 composition 结束、replacement input 或 composition input 的形式提交候选词。此时 Lexical 和 React 业务层同时解释并写入同一个提交，人工路径随后 `root.clear()`，浏览器持有的原生 selection 对应 DOM 节点被替换，光标便可能退回根节点起点。

## 分层根因

### 直接触发

候选词提交产生 `insertReplacementText` / composition input；React handler 与 Lexical 同时处理同一输入。

### 生成机制

业务层用外部 nodes 快照人工算下一份文档，再通过 `root.clear()` 覆盖 Lexical 已经更新的正文和选区。父组件回传快照又提供了第二次覆盖机会。

### 系统性根因

同一份实时编辑文档存在两个可写 owner：Lexical editor state 与 React composer nodes。外部 nodes 原本只应承担发送、恢复和 token 语义投影，却被当成受控输入在普通键入期间持续回灌。

### 防线缺口

既有测试只模拟 `insertText` 或直接修改 paragraph 文本，没有覆盖候选词的浏览器事件顺序，也没有在 `@nextclaw/ui` 消费链路中断言 DOM 节点身份与选区。第一次修复只运行了组件包定向测试，漏掉了当时已经失败的跨包 streaming/IME 测试。

## 核心原则

- Lexical 是实时正文、selection 和 IME composition 的唯一事实 owner。
- React composer nodes 是发送/持久化投影，以及明确程序化命令的输入，不是普通键入的平行编辑器。
- 原生文字输入、候选词替换、普通删除和换行交给 Lexical 已验证的平台事件管线。
- 只有恢复草稿、重置、插入 token、应用 prompt 等明确命令可以把外部文档写入 Lexical。
- 程序化写入使用精确 update tag；不得用定时器或跨一整帧布尔锁屏蔽其它 update。
- 需要自定义的相邻 token 删除直接修改对应 Lexical token node，不重建整个 root。

这些取舍落实 `single-fact-owner`、`information-expert`、`deletion-first`、`stable-identity` 和 `predictable-behavior-first`。核心不是“多做光标恢复”，而是让错误的第二写路径消失。

## 实现方案

1. 删除 `ContentEditable.onBeforeInput` 与 `handleLexicalComposerBeforeInput`，不再拦截 `insertText`、`insertReplacementText`。
2. 键盘 controller 只保留产品级 Send/Stop 命令；composition 期间所有按键均交还 IME/Lexical，Shift+Enter、普通 Backspace/Delete 也交给 Lexical。
3. 相邻 skill/file token 删除作为唯一例外，直接删除目标 `ChatComposerTokenNode`，不经过线性快照和 `root.clear()`。
4. owner 绑定 editor 时从真实 editor state 初始化签名，避免挂载后重复重建同一初始文档。
5. 删除 `requestAnimationFrame` 外部写入锁；所有明确外部写入带 `CHAT_COMPOSER_EXTERNAL_UPDATE_TAG`。update listener 只忽略与预期外部签名一致的 tagged update；若同一批次合入真实用户输入，最终签名不同，仍正常发布。
6. composition 结束以 Lexical `COMPOSITION_END_TAG` 为稳定发布边界，不把 `CompositionEvent.data` 在业务层人工写回。
7. `SessionConversationInput` 对同一份 input snapshot 复用稳定的 composer nodes 数组，流式消息等无关 render 不再反复触发外部同步 effect。

## 修复后的数据流

普通输入链路：

`浏览器 IME -> Lexical editor state + selection -> owner update listener -> React draft projection`

明确外部命令链路：

`恢复/重置/token/prompt 命令 -> tagged Lexical update -> React draft projection确认`

两条链路共享 Lexical 这个文档 owner，但普通输入不会再绕到 React 快照后反向重建 editor。

## 目录组织

- 设计文档继续更新本文件，不创建平行设计。
- 输入生命周期与 editor 协调保留在 `lexical/owners/chat-composer-lexical-owner.ts`。
- DOM 绑定删减保留在 `lexical/chat-input-bar-tokenized-composer.tsx`。
- keyboard controller 收敛为产品级键盘命令。
- update tag 与 root 同步合同保留在 `chat-composer-lexical-editor-state.ts`。
- 候选词跨父组件重渲染验收放在既有 `session-conversation-input.streaming.test.tsx`。

## 验收标准

### 用户路径

1. 中文拼音 composition 中按 Backspace 取消，正文为空且光标不跳。
2. 输入拼音后按 `1/2/3/4` 选词，候选词只提交一次，光标位于候选词末尾。
3. 流式输出引发父组件重渲染时，composition DOM 节点身份保持不变。
4. 英文输入、连续删除、Shift+Enter、Enter 发送、Escape 停止、slash 与 token 行为不回归。

### 自动化边界验收

- 组装真实顺序：普通文本建立 Lexical selection -> composition start -> 拼音 DOM 预编辑 -> streaming rerender -> 数字候选键 -> composition input -> composition end。
- 断言候选词内容、paragraph DOM 身份与最终 caret offset。
- 同时运行 `@nextclaw/agent-chat-ui` 和 `@nextclaw/ui` 定向测试、两个包的 `tsc` 与 lint。

### 人工验收边界

jsdom 不能打开系统候选词窗口，因此最终仍需在消费当前源码的页面用 macOS 中文输入法按真实 `1/2/3/4` 选词。自动化测试验证事件链和 owner 合同，不冒充系统输入法 UI 验收。

## 非目标

- 不拦截数字键猜测用户是否在选词。
- 不增加浏览器、操作系统或输入法品牌特判。
- 不用延时 focus、selection restore 或隐藏 fallback 掩盖 owner 冲突。
- 不改变 composer nodes、token 或发送协议的公共数据形状。
