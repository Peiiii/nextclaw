# @nextclaw/bibo-client

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
