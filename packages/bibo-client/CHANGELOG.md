# @nextclaw/bibo-client

## 0.0.4

### Patch Changes

- 260165f: Keep asynchronous questions in the assistant message at their original position, and expose ordered Bibo message content for the hosted chat.
- becaeb6: 修复刷新、手机切后台或连接断开时终止回复的问题。任务由服务端管理，页面返回后恢复同一次运行及停止入口，显示工作和连接状态，避免重复发送与错误的取消提示。
- 50f0440: Bibo 笔记默认直接编辑，新建后立即打开并自动避免重名。收紧文档菜单、侧栏与列表排版，修正块手柄定位，文档切换统一使用路径末项的下拉入口。

  支持拖拽、键盘调整和记忆聊天分栏；AI 的实际文本块提前分卡展示，长间隔显示友好时间。移除所有页面的刷新确认，保留草稿恢复，并提供连接现有真实模型的本地开发入口。

## 0.0.4-beta.1

### Patch Changes

- becaeb6: 修复刷新、手机切后台或连接断开时终止回复的问题。任务由服务端管理，页面返回后恢复同一次运行及停止入口，显示工作和连接状态，避免重复发送与错误的取消提示。
- 50f0440: Bibo 笔记默认直接编辑，新建后立即打开并自动避免重名。收紧文档菜单、侧栏与列表排版，修正块手柄定位，文档切换统一使用路径末项的下拉入口。

  支持拖拽、键盘调整和记忆聊天分栏；AI 的实际文本块提前分卡展示，长间隔显示友好时间。移除所有页面的刷新确认，保留草稿恢复，并提供连接现有真实模型的本地开发入口。

## 0.0.4-beta.0

### Patch Changes

- 260165f: Keep asynchronous questions in the assistant message at their original position, and expose ordered Bibo message content for the hosted chat.

## 0.0.3

### Patch Changes

- e901514: Bibo 的原生 Agent 可以在继续处理任务时提出可选答复的问题；网页支持推荐项、选项解释、引用式回答和刷新恢复。
- c0cc602: AI 保存产物并请求展示后，自动在对话工作区打开文件，支持预览和源码编辑。停止生成或保存失败不会自动打开未保存的产物。Client SDK 提供文件展示事件和精确读取接口。

## 0.0.2

### Patch Changes

- 219a6fa: Report exhausted Bibo model quota before starting a chat request, preserving the draft and avoiding an empty new conversation.
