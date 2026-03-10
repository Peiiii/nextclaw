# 迭代完成说明
- 新增独立库 `@nextclaw/agent-chat`，将对齐 agent-chat 的核心逻辑（controller/handler/adapter/types/utils）独立封装，UI 只需直接接入。
- 增强事件模型，新增 reasoning 相关事件（start/delta/end），并在事件处理器与流式适配器中支持。
- `nextclaw-ui` 改为依赖 `@nextclaw/agent-chat`，移除原 `components/chat/core` 目录，消除重复代码与冗余实现。
- 统一 ESM/NodeNext 规范，修正 `.js` 扩展导出路径与类型标注。

# 测试/验证/验收方式
- 运行 `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat tsc`
- 运行 `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc`

# 发布/部署方式
- 不适用（仅前端本地逻辑调整，未执行发布）。

# 用户/产品视角的验收步骤
1. 进入任意会话，发送一条消息，确认消息立即进入列表并可流式更新。
2. 刷新页面后进入同一会话，确认历史消息仍按顺序展示。
3. 触发包含工具调用的对话，确认工具卡片与结果仍可显示。
