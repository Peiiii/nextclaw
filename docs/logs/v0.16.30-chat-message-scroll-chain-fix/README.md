# v0.16.30 Chat Message Scroll Chain Fix

## 迭代完成说明

- 修复聊天消息列表中嵌套滚动区偶发“外层会话明明没到底却继续滚不下去”的问题。
- 具体做法是在推理块 [`chat-reasoning-block.tsx`](../../../packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-reasoning-block.tsx) 和文件操作预览滚动区 [`tool-card-file-operation.tsx`](../../../packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/tool-card/tool-card-file-operation.tsx) 中移除 `overscroll-contain`，恢复浏览器默认的祖先滚动链，让内层滚到边界后继续把滚轮交给外层会话列表。
- 补充两个回归断言，明确这两个滚动区不应再重新引入 `overscroll-contain`：
  - [`chat-message-list.test.tsx`](../../../packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/chat-message-list.test.tsx)
  - [`chat-message-list.file-operation.test.tsx`](../../../packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/__tests__/chat-message-list.file-operation.test.tsx)

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/agent-chat-ui exec vitest run src/components/chat/ui/chat-message-list/chat-message-list.test.tsx src/components/chat/ui/chat-message-list/__tests__/chat-message-list.file-operation.test.tsx`
- `pnpm --filter @nextclaw/agent-chat-ui tsc`
- `pnpm --filter @nextclaw/agent-chat-ui lint`
- `pnpm lint:maintainability:guard`

结果说明：

- `vitest` 通过，2 个测试文件共 26 个用例通过。
- `tsc` 通过。
- `pnpm --filter @nextclaw/agent-chat-ui lint` 未通过，但失败项来自工作区既有的 `chat-input-bar*`、`chat-message-file/index.tsx` 等文件，与本次滚动链修复无直接关系；本次修改的 4 个文件未引入新的 lint error。
- `pnpm lint:maintainability:guard` 未通过，阻塞点来自工作区中未由本次改动触达的 [`ChatSidebar.tsx`](../../../packages/nextclaw-ui/src/components/chat/ChatSidebar.tsx) 既有体量超预算问题，不是本次消息列表修复新增的问题。

## 发布/部署方式

- 本次是前端本地修复，无额外发布脚本或部署步骤。
- 跟随正常前端构建链路进入下一次 UI 发布即可。

## 用户/产品视角的验收步骤

1. 打开任意包含“思考/推理块”或文件操作预览的会话。
2. 把鼠标放在消息内部的那个小滚动区上，先把内层内容滚到最底部。
3. 在不移开鼠标的前提下继续向下滚动。
4. 确认外层会话消息列表会继续向下滚动，而不是卡在当前位置。
5. 对文件操作预览区重复一次，确认行为一致。

## 可维护性总结汇总

- 可维护性复核结论：通过
- 本次顺手减债：是

### 长期目标对齐 / 可维护性推进

- 这次修复顺着“统一体验、减少 surprise failure”的方向推进了一小步。聊天区作为用户与 NextClaw 交互的主入口，不应因为消息内部有二级滚动区就制造“看起来没到底但滚不动”的体验断层。
- 我优先选择删减而不是补一个新的滚轮转发逻辑：直接移除会切断祖先滚动链的 `overscroll-contain`，比新增事件桥接代码更小、更直接、更符合浏览器默认行为。

### 代码增减报告

- 新增：4 行
- 删除：2 行
- 净增：+2 行

### 非测试代码增减报告

- 新增：2 行
- 删除：2 行
- 净增：0 行

### 可维护性总结

- 本次是否已尽最大努力优化可维护性：是。问题根因是多余的滚动边界约束，因此直接删除约束，而不是新增一层 JS 兜底。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。非测试代码实现为净零增长，只保留了最小必要的测试断言。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：是。非测试代码未增长，没有新增文件、抽象或分支。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。修复停留在问题源头的消息子组件滚动样式层，没有把简单样式问题升级成新的 hook 或 manager。
- 目录结构与文件组织是否满足当前项目治理要求：基本满足。本次没有新增目录平铺或角色混乱；相关目录仍存在既有文件数压力，但本次未继续恶化。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：已执行独立复核。
- no maintainability findings
