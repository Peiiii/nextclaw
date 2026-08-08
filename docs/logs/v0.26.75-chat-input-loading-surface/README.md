# 聊天输入框加载表面清理

## 迭代完成说明

- 根因：模型配置尚未解析时，业务适配层同时把同一个 loading 状态投影到模型选择器与输入框 inline hint；共享输入框又把 hint 渲染成带边框的双条脉冲骨架，因此加载期间出现无语义的胶囊占位并撑高输入区。
- 确认方式：从用户截图中的双条骨架形状反查 `InputBarHint`，再沿 `isProviderStateResolved -> isModelOptionsLoading -> buildModelStateHint -> ChatInputBar` 完整链路确认；模型选择器本身已经拥有独立 loading 反馈。
- 根因修复：删除模型加载到 inline hint 的重复投影；模型选择器继续负责加载反馈，NextClaw 业务层只在模型加载完成后仍为空时创建可操作警告。共享 UI 的通用 loading 合同保持兼容，不因单一宿主体验修复收窄公共 API。

## 测试/验证/验收方式

- 定向测试：`pnpm --filter @nextclaw/ui test -- src/features/chat/features/input/utils/__tests__/chat-input-bar.utils.test.ts`，17 项通过，覆盖普通加载期间不创建 inline hint，以及模型为空时仍返回配置警告。
- TypeScript：`pnpm --filter @nextclaw/agent-chat-ui tsc` 与 `pnpm --filter @nextclaw/ui tsc` 均通过，确认业务适配调整没有破坏共享 UI 合同。
- ESLint：`@nextclaw/agent-chat-ui` 与 `@nextclaw/ui` package lint 均为 0 error；分别保留 1 条和 3 条既有 warning，其中本次触达测试文件所在历史 `describe` 超过函数行数提醒，未由本次新增用例扩大该函数。
- 真实页面：当前源码 Vite 实例 `http://127.0.0.1:5174/chat/draft` 热更新后，输入框 shell 中目标双条 skeleton 数量为 0、全部 pulse 元素数量为 0；输入框保持单一稳定表面，模型选择器与发送按钮正常显示。
- 可维护性：non-feature guard 检查 3 个触达文件，0 error、1 warning；生产代码 `+1/-10，净减 9 行`。`session-conversation-input.tsx` 当前 486 行，接近 500 行预算，但本次净减 1 行。
- 治理：`pnpm check:governance-backlog-ratchet` 通过；全局 `pnpm lint:new-code:governance` 被工作区另一项未提交的 `agent-context-window.manager.test.ts` 父级相对导入阻塞，本次触达路径的 planned-path preflight、文件角色和模块结构检查均通过。

## 发布/部署方式

- 本次只提交源码、测试、changeset 与迭代记录；不推送、不部署、不发布，也不重启 NextClaw 宿主或服务。
- 当前源码 Vite 实例通过热更新完成验收；后续随统一 NPM patch 发布进入产品构建。

## 用户/产品视角的验收步骤

1. 打开新任务页并刷新，使模型目录重新加载。
2. 确认输入框内部不再出现带边框、双灰条闪烁的胶囊占位，输入区高度不因模型加载而变化。
3. 确认模型选择器仍能表达自身加载状态，并在加载完成后显示当前模型。
4. 在没有可用模型的环境中确认仍会出现明确的配置提示与入口。

## 可维护性总结汇总

- 已执行 `post-edit-maintainability-guard --non-feature` 与 `post-edit-maintainability-review`；可维护性复核通过，无需保留新增债务。
- 正向减债动作是删除：移除 NextClaw 业务层的一条重复状态投影，总生产代码净减 9 行。
- 没有新增 helper、wrapper、service、effect、fallback、目录或文件角色；NextClaw 中的模型 loading 重新收敛到唯一视觉 owner，同时保持 shared package 公共合同兼容。
- 这不是机械压缩行数：删除的代码对应同一事实的第二展示路径，用户交互与代码合同同时变得更少、更直接。
- 当前包内部结构保持既有 feature root 与 shared UI package 边界，没有新增白名单外目录、barrel 或跨包 deep import。

## NPM 包发布记录

- `@nextclaw/ui`：当前 `0.15.22`，需要后续统一 patch 发布，状态为 `待统一发布`。
- 本次未执行 NPM 发布。
