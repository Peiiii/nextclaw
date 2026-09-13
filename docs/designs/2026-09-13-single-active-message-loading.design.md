# 单一活动消息加载态设计

## 问题与证据

当会话历史中保留一条 `streaming` 或 `pending` assistant 消息，而当前运行又产生后一条流式 assistant 消息时，聊天界面会在两条消息下方同时显示跳动的三点。用户因此无法判断这是两条回复同时生成，还是同一轮工作的不同阶段。

现有链路中，页面容器已经从当前消息集合选出最后一条流式 assistant，并且只对该行传入 `isSending=true`。共享 `ChatMessageList` 却没有用这个当前活动信号控制消息内动画，而是只读取每条消息自身可能过期的 `status`。于是较早的流式消息仍显示三点、流式 Markdown 和推理进行态。

被破坏的不变量是：一个聊天列表在一次运行中最多只能有一个视觉上的活动 assistant；历史消息状态即使尚未被后端收敛，也不能形成第二个加载焦点。

## 范围与 owner

修复归共享 `ChatMessageList` 展示 owner。消息协议和会话状态仍保留原值，页面容器继续负责把当前活动行投影为 `isSending`。不修改 runtime、事件协议、持久化或工具分组规则。

这是恢复既有加载反馈的 bugfix。无需更新用户文档；用户可见行为变化需要 changeset。

## 方案

共享消息列表先在当前可见消息中找出最后一条状态为 `streaming` 或 `pending` 的 assistant。只有同时满足以下条件的消息才进入视觉活动态：

1. 当前 `ChatMessageList` 的 `isSending` 为真；
2. 消息是当前列表中最后一条生成中的 assistant。

这一条视觉活动态统一控制消息底部三点，以及传入消息正文的流式 Markdown、推理进行态。空草稿仍沿用现有 typing placeholder；已有内容的活动消息仍显示底部三点。历史消息的内容、工具结果和原始状态不变。

采用现有 `isSending` 作为当前 UI 活动态，是因为调用方已经按活动行提供该信号。直接把较早消息改成 `final` 会伪造协议事实；仅隐藏三点则会让旧消息中的 Markdown 或推理继续表现为流式，不能完整关闭同类问题。

## 验收与交付

- 两条 assistant 都携带 `streaming` 状态、后一条为当前活动项时，页面只出现一组三点。
- 较早消息不再使用流式正文或推理样式，后一条仍保持流式反馈。
- 单条空 assistant 草稿继续显示 typing placeholder；单条已有内容的活动 assistant 继续显示三点。
- 运行共享消息组件全套测试、共享组件与页面 package 的 TypeScript 编译，以及 diff-only maintainability review。
- 通过组件 DOM 证据确认加载指示数量，不要求用户人工复现偶发竞态。

`design-document: required`；`plan: not-required`，单批完成。
