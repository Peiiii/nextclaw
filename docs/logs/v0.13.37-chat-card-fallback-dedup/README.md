# v0.13.37-chat-card-fallback-dedup

## 迭代完成说明（改了什么）
- 修改 `packages/nextclaw/src/cli/commands/ui-chat-run-coordinator.ts`：
  - 在“中途终止”分支中，若本轮已出现工具相关 `session_event`，不再把 `partialReply` 追加写入会话历史末尾，避免终止后历史出现额外重复文本。

## 测试/验证/验收方式
- 代码与类型验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw tsc`（通过）
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw build`（通过）
- 运行链路测试：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw test -- --run src/cli/commands/agent-runtime-pool.command.test.ts`（通过，5/5）
- Lint 验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw lint`（通过；仅既有 warning，无 error）
- 本次改动影响面：后端 UI Chat 中途终止落库策略。

## 发布/部署方式
- 本次为后端 `nextclaw` 运行时行为修复，按项目后端发布闭环执行：
  1. 确认 `nextclaw` 包构建/类型检查通过。
  2. 按既有发布流程完成版本变更与发布（如需发布）。
  3. 发布后在目标环境进行“工具调用中途终止 + 刷新历史”冒烟确认。
- 若本次仅本地开发验证、不发布：标记为“不适用（未触发发布动作）”。

## 用户/产品视角的验收步骤
1. 打开 Chat 页面，发起一个会触发工具调用的对话（能看到工具调用/结果卡片）。
2. 在工具调用过程中点击“终止”，等待本轮结束。
3. 刷新页面并回到该会话，确认历史消息末尾未被额外追加一段重复文本。
