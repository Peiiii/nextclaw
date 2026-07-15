# 聊天输入框 IME 取消与光标稳定性设计

## 背景

聊天输入框在中文输入法中存在稳定复现：按下一个拼音字母形成合成文本后立即按 Backspace，字母没有被删除，光标同时跳到输入内容前方。

本轮目标不是增加光标恢复补丁，而是修正 IME composition 的事实 owner，让浏览器与 Lexical 已经完成的删除/取消语义不再被业务层反向覆盖。

## 现状依据

当前输入链路为：

`浏览器 IME -> Lexical contenteditable -> React composition 事件 -> ChatComposerLexicalOwner -> 外部 composer nodes`

现有实现同时维护了两条 composition 提交路径：

1. Lexical 根据浏览器事件维护 composition 文本、selection 和最终 editor state。
2. React `onCompositionEnd` 再调用 `handleLexicalComposerCompositionEnd`；当最终 editor 内容与 composition 开始快照相同时，代码把 `CompositionEvent.data` 手工插回文档。

第二条路径原本用于弥补 jsdom 不执行浏览器默认编辑行为，但它无法区分两种完全不同的情况：

- 浏览器尚未把 composition 文本提交到 editor；
- 用户通过 Backspace 删除或取消 composition，editor 正确回到开始前状态。

当前逻辑把第二种情况误判为第一种情况。随后 `publishSnapshot` 通过 `root.clear()` 重建 Lexical 文档和 selection，造成已删除字母被重新写入，并破坏浏览器正在维护的光标状态。

已有测试只覆盖“composition 结束后应该手工插字”的模拟路径，没有覆盖“composition 取消后 editor 回到基线”的真实语义，因此测试通过但用户路径失败。

## 核心判断

- IME composition 的唯一事实 owner 必须是 Lexical editor，而不是 React DOM handler 或外部 `nodes`。
- `CompositionEvent.data` 是事件信息，不是可以无条件写回文档的最终事实。
- jsdom 缺少浏览器默认编辑行为，不能成为生产代码保留第二条 composition 提交链路的理由。
- 光标属于当前活跃 editor 的交互状态；composition 期间不得通过外部快照重建 DOM 或 selection。

该判断落实 `single-fact-owner`、`information-expert`、`deletion-first` 和 `predictable-behavior-first`：删除没有外部兼容合同的隐藏 fallback，让相同输入序列只经过 Lexical 一条主链路。

## 推荐方案

1. 删除 `ContentEditable` 上由 React 接管的 `onCompositionStart` / `onCompositionEnd`。
2. 删除 `ChatComposerLexicalOwner` 自己维护的 composition flag、开始快照和手工提交方法。
3. owner 在外部状态同步、editor update 和 selection change 时直接读取 `LexicalEditor.isComposing()`；composition 期间保持静默，composition 真正结束后由 Lexical update listener 发布最终快照。
4. 删除 `handleLexicalComposerCompositionEnd` 及“editor 未更新时手工插入 `event.data`”的测试合同。
5. 新增用户复现序列的回归测试：composition 开始后 Backspace 取消，最终 draft 为空且光标不被重建到错误位置。

不新增浏览器识别、定时器、selection 恢复、`event.data` 特判或另一层兼容 owner。

## Owner 与数据流

修复后的主链路：

`浏览器 IME -> Lexical composition state -> Lexical editor state -> ChatComposerLexicalOwner update listener -> 外部 composer nodes`

- 浏览器：产生真实 composition/key/input 事件。
- Lexical：唯一拥有 composition 生命周期、editor document 和活跃 selection。
- `ChatComposerLexicalOwner`：观察 Lexical 的稳定快照，负责把最终 nodes 发布给外部 owner；不再解释或补写 IME 事件数据。
- 外部 composer nodes：保存可发送 draft 和 token 语义，只用于明确的外部同步/重置，不在 composition 期间回刷 editor。

这是一条观察链路，不会因为 React 自动重渲染触发新的输入副作用。

## 目录组织

- 设计文档：`docs/designs/2026-07-15-chat-composer-ime-cancellation.design.md`。
- owner 修复：保留在现有 `lexical/owners/chat-composer-lexical-owner.ts`。
- DOM 绑定删减：保留在现有 `lexical/chat-input-bar-tokenized-composer.tsx`。
- controller 删除旧 fallback：保留在现有 `lexical/chat-composer-lexical-controller.ts`。
- 回归测试：合并进现有 chat composer 测试，不新增测试文件，避免继续扩大目录平铺度。

## 兼容与迁移

手工 composition fallback 不拥有持久化数据、公开 API 或已发布外部协议，只是生产代码为测试环境保留的内部兼容路径，因此直接删除，不保留迁移桥。

现有英文输入、发送/停止、Shift+Enter、slash 面板、skill/file token 和普通 Backspace 合同保持不变。本轮不改变 composer nodes 的公共形状。

## 验收标准

### 修前红灯

- 空 draft，启动 composition，模拟拼音字母后按 Backspace 取消，再结束 composition。
- 旧实现错误地把字母重新写入 draft。

### 修后功能合同

- 同一序列结束后 draft 为空。
- selection 保持在空 draft 的合法起点，不发生错误 DOM 重建。
- 正常中文 composition 上屏一次且只上屏一次。
- streaming 父组件重渲染期间 composition 不丢失、不倒序、不跳光标。
- 英文输入、连续 Backspace、Shift+Enter、发送、slash/token 不回归。

### 工程验证

- `@nextclaw/agent-chat-ui` 定向 Vitest。
- `@nextclaw/agent-chat-ui` `tsc`。
- package lint；如被既有问题阻塞，则覆盖全部触达文件的定向 ESLint。
- 当前源码 dev 页面上的真实中文输入法复现。
- `post-edit-maintainability-guard --non-feature`、new-code governance 与 backlog ratchet。

## 非目标

- 不在本轮重写整个 tokenized composer。
- 不改变 token、slash menu 或外部 draft 数据结构。
- 不用浏览器/操作系统特判覆盖所有 IME 实现差异。
- 不通过定时 focus 或 selection restore 掩盖 owner 错误。

## 后续实现顺序

1. 先加入精确取消序列的失败测试并记录红灯。
2. 删除 React/owner/controller 的手工 composition 提交路径。
3. 让 owner 统一读取 Lexical composition state。
4. 运行定向测试与静态验证。
5. 在当前源码 dev 页面按用户原步骤完成真实中文输入法验收。
