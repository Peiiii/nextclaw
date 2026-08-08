---
"@nextclaw/core": patch
"@nextclaw/runtime": patch
"@nextclaw/kernel": patch
"@nextclaw/server": patch
"@nextclaw/client-sdk": patch
"@nextclaw/ui": patch
"@nextclaw/agent-chat-ui": patch
---

增加提供商模型目录获取与后台自动刷新：Kimi 现在也能在提供商设置中获取当前模型列表，并参与每 12 小时的目录刷新；未填写 API Key 或上游拒绝鉴权时会直接给出可操作的本地化提示，不再展示原始英文 401，后台目录失败也不再被其他 Provider 的刷新状态拖成持续加载。其他尚未确认支持模型目录的提供商继续支持手工配置。候选只保留文本输出的聊天 LLM，图像、视频、语音、Embedding、Rerank 与 Moderation 模型不会进入聊天配置。聊天模型选择器只在展开后提示上次已见基线之后真正新增的模型，并支持“本批不再提醒”；首次大目录不会制造数百条提醒。具体提供商页会自动提示对应差集，超过 50 个候选时隐藏“全部添加”、支持搜索并只渲染前 50 个匹配项；已配置模型也可进入批量删除模式后全选或删除所选。显式获取、自动刷新和批量操作都只修改当前草稿或目录快照，不会绕过用户保存。
