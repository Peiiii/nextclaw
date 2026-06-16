# Goal Progress

## 当前目标

把新会话欢迎页升级为居中意图入口，支持默认 workspace/project 选择；同时持续推进至少 30 项代码可维护性、清晰度、解耦可插拔和克制 UI 优化。

## 明确非目标

- 不重写 chat composer / send 主链路。
- 不把 project 选择塞进输入组件内部。
- 不为了凑数量做无意义 UI 花活或表层格式化。
- 不提交或发布，除非用户明确要求。

## 冻结边界 / 不变量

- welcome 是 `features/chat/features/welcome` 子 feature。
- conversation panel 只能装配 welcome，不能持有 welcome 业务规则。
- `ChatInputManager` 仍是发送 projectRoot 的业务 owner。
- 每项优化必须能对应到代码证据、测试证据或规则沉淀。

## 已完成进展

- 1-41：welcome 子 feature 迁移、嵌入 input surface、默认 workspace/projectRoot 链路、显示规则 util、会话类型选择、历史项目下拉、agent 名称展示、真实页面冒烟、panel/welcome 测试瘦身、相关测试与规范补充。

## 当前下一步

提交当前欢迎页批次后，继续做模型选择器搜索、收藏置顶，以及 kernel 偏好 KV manager。

## 锚点计数器

5/20
