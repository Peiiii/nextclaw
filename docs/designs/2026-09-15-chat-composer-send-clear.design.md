# 消息发送后输入框清空设计

## 问题与根因

用户在聊天输入框中发送消息后，输入框应立即清空；发送失败时才恢复原草稿。当前草稿由 `chat-composer-draft.store` 按会话持久化，发送入口会在调用 runtime 前清空该会话草稿。

共享 Lexical 编辑器为了不打断中文等输入法的组词过程，会在 `editor.isComposing()` 时跳过外部状态同步。但是这次外部状态不会在组词结束后重试。composition end 随后把编辑器中的旧内容通过 `onNodesChange` 回写到会话草稿，导致已经成功发送的消息再次被持久化；切换会话、重新进入或刷新只是重新展示了这份错误草稿。

链路证据：

1. 发送 controller 在发送前调用 `resetComposer`，失败时才调用 `restoreComposer`。
2. `resetComposer` 清空按 session key 存储的正文、节点、技能和附件。
3. Lexical owner 的 `syncExternalState` 在输入法组词中直接返回。
4. 同一 owner 在带 `COMPOSITION_END_TAG` 的编辑器更新中允许发布节点，因此旧消息可以覆盖已经清空的持久化状态。

## 用户链路与预期

用户从新会话或已有会话输入中文消息，即使点击发送时输入法仍处于收尾阶段，消息被 runtime 接受后输入框也应保持为空。用户切换到其它会话、再返回当前会话，或刷新页面，都不应再次看到已成功发送的正文、引用、技能或附件。只有发送请求失败时，发送前的完整草稿才恢复供修改和重试。

这项修复让输入框清空与会话草稿恢复保持可信，避免用户误以为消息未发送或重复发送，符合长期搭档对操作结果和连续状态的准确感知要求。

## 方案选择

采用共享 `ChatComposerLexicalOwner` 边界内的延迟外部同步，并由私有的 `ChatComposerExternalStateOwner` 单独持有延迟状态与取消生命周期：

- 输入法组词期间继续禁止直接改写 Lexical 文档，保护候选词和光标。
- 若此时收到与当前编辑器不同的外部 nodes，保存最新一份待应用状态。
- composition end 时，待应用的外部状态优先于本次已过期的编辑器快照；owner 将其写入 Lexical，并且不向宿主发布旧 nodes。
- 正常组词期间没有外部变化时，仍按现有路径发布最终文字。
- owner 解绑编辑器时丢弃该实例尚未应用的外部状态，避免跨实例污染。

未选择的方案：

- 不在发送按钮中强制结束输入法或直接操作 DOM。该做法只覆盖点击发送，无法覆盖同会话多窗口共享草稿等其它外部同步来源，并把编辑器生命周期泄露给产品层。
- 不为持久化 store 新增 revision/tombstone 协议。它可以拒绝旧写入，但会扩大所有草稿写入方的合同与迁移面；当前证据锁定在编辑器丢弃外部状态，修正最近 owner 的净复杂度更低。
- 不以 reset key 强制重建整个 composer。重建会额外影响焦点、输入面板和语音状态，而 owner 已有外部状态同步职责。

## Owner、不变量与失败恢复

`ChatComposerLexicalOwner` 继续是 Lexical 文档与 React 外部 nodes 之间的唯一边界 owner；私有 `ChatComposerExternalStateOwner` 只管理待同步 nodes、revision 和实例解绑取消，不成为新的调用入口。新增不变量：外部 nodes 在 active composition 中可以延迟，但不得永久丢失；一旦存在较新的外部状态，composition end 不得把更旧的编辑器快照发布给宿主。

发送 controller 和会话草稿 store 的职责不变：成功发送保留空草稿，发送异常恢复发送前快照。无需 storage schema、数据迁移、兼容分支或新公共入口。

## 验收与验证矩阵

黄金验收链路：用户在真实聊天输入框中输入中文并在输入法收尾时点击发送 → 消息出现在当前会话且开始处理 → 输入框清空 → 切换会话再返回或刷新 → 输入框仍为空。失败判定是已发送内容、引用、技能或附件任一重新出现。

AI 验证：

1. owner 单测复现组词期间收到清空状态，证明修前清空被跳过且修后在 composition end 应用，旧 nodes 不回写。
2. owner 单测证明没有外部更新的正常 composition end 仍发布最终文字。
3. 会话输入状态测试证明发送清空后切换会话再返回保持为空，同时其它会话未发送草稿仍恢复。
4. controller 回归证明成功发送清空、发送失败恢复的合同不变。
5. 运行受影响 package 的定向测试、TypeScript 类型检查与 diff-only maintainability review。

用户主观验收仅需在其常用中文输入法中确认真实手感；正确性由上述自动化证据承担。

## 文档、交付与非目标

中英文聊天指南补充“成功发送清空当前草稿，失败恢复；切换或刷新不会恢复已发送内容”的用户合同，并添加 UI package 的用户可见 bugfix changeset。

非目标：不改变发送快捷键、输入法候选交互、草稿按会话隔离策略、消息队列、发送失败恢复、模型或会话选择，也不清理历史 localStorage 中已经残留的文本；用户下一次成功发送该草稿后会按新合同清空。

`design-document: required`，因为修复跨共享编辑器 package 与持久化会话草稿边界。`plan: not-required`，实现和验证可在单批内闭环。
