# 迭代完成说明（改了什么）

- 新增 `ChatStreamActionsManager` 统一绑定/暴露 chat stream actions，其他 manager 仅依赖该入口完成 send/stop/reset/history 接入。
- `useChatStreamController` 继续作为最薄运行入口（事件/格式转换 + 流式运行），输出 action 统一绑定到 `ChatStreamActionsManager`。
- 历史数据改为直接使用 `messages`，移除 `historyEvents` 相关链路与回退事件拼接。
- 移除前端队列展示与相关状态字段（`queuedCount`/`queuedMessages`）及组件。
- 修复 agent-chat 内部 `createRef` 只读引用问题，并补齐 `@types/json-schema`。

# 测试/验证/验收方式

- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`
- `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui lint`
  - 结果：0 errors，存在既有 warning（含本次涉及文件的 `prefer-destructuring` 与 `max-lines-per-function` 警告）。

# 发布/部署方式

- 不适用（未执行发布）。

# 用户/产品视角的验收步骤

1. 打开任一会话页面，历史消息可正常渲染且不依赖 events。
2. 发送消息，流式输出可正常落入消息列表。
3. 切换会话或删除会话时，消息状态可重置且不会残留旧内容。
4. 输入区不再展示队列相关 UI，发送/停止按钮行为正常。
