## 目录预算豁免

- 原因：该目录是 agent chat message list 的当前组件边界，历史上同时承载 message shell、markdown、reasoning、tool card 入口和基础 meta/action 子组件。已有更细的 `tool-card/`、`chat-message-file/`、`code-block/` 子目录用于承接复杂实现。
- 后续拆分缝：新增工具卡片、文件展示或代码块能力必须优先进入现有语义子目录；新增跨消息类型的编排逻辑应先判断是否属于 view-model 或上层 presenter，而不是继续塞进本目录根部。
