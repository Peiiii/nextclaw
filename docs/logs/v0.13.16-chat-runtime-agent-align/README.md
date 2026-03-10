# v0.13.16-chat-runtime-agent-align

## 迭代完成说明

本次迭代聚焦 chat 前端核心 runtime，对齐 `agent-kit` 的 agent abstraction + runtime core 思路，并先沉淀设计背景与实施方案。

设计文档：

- [Chat Runtime / Agent Alignment](../../designs/2026-03-10-chat-runtime-agent-align.md)

本次实施范围限定为：

- `@nextclaw/agent-chat` 的通用扩展点
- `nextclaw-ui` 的流式、消息、history、run lifecycle 核心逻辑

明确不优先处理：

- session list
- `chatUiManager`
- 纯 UI 外壳与交互细节

## 测试/验证/验收方式

- 文档阶段验证：
  - 检查设计文档是否完整覆盖背景、目标、边界、结构建议、验收标准。
  - 检查迭代 README 是否通过 Markdown 链接引用设计文档。
- 代码阶段验证：
  - 对受影响包执行最小充分验证，至少覆盖 `lint`、`tsc`，必要时补 `build`。
  - 若聊天主链路发生行为变更，补 send/stream/stop/resume 的最小冒烟验证。

## 发布/部署方式

- 本次为前端/前端基础库内部重构，不单独部署文档。
- 待代码改造完成后，按受影响范围执行常规前端构建与发布流程。
- 若仅为内部重构且无独立对外发布动作，则发布步骤标记为“不适用”并说明原因。

## 用户/产品视角的验收步骤

1. 打开 chat 页面并进入任意会话。
2. 发送一条消息，确认用户消息立即出现，随后 assistant 流式输出正常。
3. 在运行中执行 stop，确认前端状态与后端 run 状态保持一致。
4. 刷新或重新进入运行中的会话，确认可以恢复 run 流。
5. 打开已有历史会话，确认 history hydrate 后消息、reasoning、tool 调用展示正常。
