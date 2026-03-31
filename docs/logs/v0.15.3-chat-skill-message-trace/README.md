# v0.15.3-chat-skill-message-trace

## 迭代完成说明

- 让聊天输入区里选中的 skill 不再只停留在临时 UI 状态，而是随消息正文一起留痕：
  - 发送时会把 skill token 按输入顺序串进用户消息文本 part，例如 `$weather`
  - 文件 token 仍保持原有附件 part，不引入新的重消息结构
- 让用户消息气泡对这些 inline token 做所见即所得的轻量渲染：
  - skill token 会在消息卡片里渲染成内联 badge，而不是裸文本堆在正文里
  - 普通文本与 token 仍按输入顺序混排，视觉上接近 composer 内的阅读体验
  - 这层渲染基于轻量 metadata + 前端 adapter 切片完成，不改变底层消息协议
- 保留现有 `requested_skills` metadata 作为运行时机器语义，同时补上用户可见文本留痕，避免 skill 选择“发出去就消失”
- 额外补充 `ui_inline_tokens` metadata，用于消息回放阶段恢复更好的前端展示；AI 语义继续依赖正文 token 与 `requested_skills`，不把展示层逻辑硬塞进运行时
- 修正发送按钮判定：
  - 当输入里只有 skill token、没有普通文本时，也会被视为可发送内容
  - 避免出现“消息实际可发送，但 UI 仍然禁用发送”的状态错位
- 在共享 prompt 语义里补充 chat composer token 解释：
  - 告诉模型像 `$weather`、`$web-search` 这样的 token 表示用户显式选择的 skill
  - 避免模型把它误读成普通字符串、shell 变量或金额文本
- 适配层做了解耦拆分：
  - 消息级 adapter 只负责 role / timestamp / message-level orchestration
  - inline text/token 切片独立到专门的 adapter helper，便于后续扩展 mention、command、引用等其它 token
- 补齐相关测试，覆盖：
  - skill token 序列化进入消息 part
  - 历史消息从 metadata 恢复 inline token 并渲染成 badge
  - 消息列表容器和 view model 对 inline-content 的适配
  - 系统 prompt / bootstrap-aware user prompt 对 skill token 语义的说明

## 测试/验证/验收方式

- UI 侧单测：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui exec vitest run src/components/chat/chat-composer-state.test.ts src/components/chat/chat-inline-token.utils.test.ts src/components/chat/adapters/chat-message.adapter.test.ts src/components/chat/containers/chat-message-list.container.test.tsx
```

- 结果：`Test Files 4 passed`，`Tests 18 passed`

- 聊天 UI 渲染侧单测：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui exec vitest run src/components/chat/ui/chat-message-list/chat-message-list.test.tsx
```

- 结果：`Test Files 1 passed`，`Tests 15 passed`

- Core 侧单测：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core exec vitest run src/agent/context.test.ts src/agent/runtime-user-prompt.test.ts
```

- 结果：`Test Files 2 passed`，`Tests 6 passed`

- 类型检查：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui tsc
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui tsc
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core tsc
```

- 结果：三侧 `tsc` 均通过

- 影响包 lint：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui lint
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core lint
```

- 结果：均无 error；仅存在仓库历史 warning

- 仓库现状补充：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui lint
```

- 结果：当前工作区存在一个与本次改动无关的现存 error，位于 `packages/nextclaw-ui/src/components/chat/chat-input/chat-input-bar.controller.ts` 的 React Compiler memoization 校验；本次 feature 相关文件未新增 lint 阻塞项

- 最小构建验证：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-agent-chat-ui build
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-ui build
PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core build
```

- 结果：三侧 build 均通过

- 可维护性守卫：

```bash
PATH=/opt/homebrew/bin:$PATH pnpm lint:maintainability:guard
```

- 结果：
  - 阻塞项为 `0`
  - 警告 `5` 条，其中本次收尾后已消除新增 file-budget 阻塞，只剩目录预算与既有大文件预警
  - `flat-directories-subtree` 额外提示 `packages/nextclaw-ui/src/components/chat/ncp` 仍是混合扁平目录，但不构成阻塞

## 发布/部署方式

- 本次为聊天前端与 prompt 语义对齐优化，不涉及数据库、migration 或独立后端部署。
- 若需要上线，沿用现有前端/应用发布流程重新发布包含 `@nextclaw/agent-chat-ui`、`@nextclaw/ui` 与 `@nextclaw/core` 的版本即可。
- 远程 migration：不适用（未触达后端/数据库）

## 用户/产品视角的验收步骤

1. 进入聊天页，在输入框里通过 `/` 或底部 skill picker 选择一个 skill，例如 `weather`。
2. 在 skill token 前后各输入一段普通文本并发送，确认用户消息卡片里不是只显示裸 `$weather` 文本，而是会把 skill 渲染成一个清晰可读的内联 badge，并且顺序和输入时一致。
3. 仅选择 skill token、不输入普通文本直接发送，确认发送按钮可用，消息仍可成功发出。
4. 刷新页面或继续下一轮对话，回看上一条用户消息，确认仍能从消息卡片直接看出当时选了哪个 skill，而不是只在发送瞬间短暂可见。
5. 观察模型行为，确认它不会把 `$weather` 这类 token 当成无意义字符，仍会按显式 skill 选择来理解当前请求。
