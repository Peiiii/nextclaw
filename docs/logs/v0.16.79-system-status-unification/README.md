# v0.16.79-system-status-unification

## 迭代完成说明

本次迭代完成了前端“系统状态”收口整改，把原先分散在 `runtime-lifecycle`、`runtime-control`、聊天 store 与页面局部拼装逻辑中的系统级状态统一收口到新的 `system-status` 模块中。

相关设计文档：

- [前端系统状态统一收口设计](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-19-frontend-system-status-unification-design.md)

本次确认的根因有三层：

1. 系统状态没有唯一 owner。
   - `runtime-lifecycle` 只覆盖 bootstrap / 连接恢复语义。
   - `runtime-control` 又维护一套平行的服务管理状态解释。
2. 聊天域把系统状态镜像进了 feature store。
   - `chat-input.store.ts` 与 `chat-thread.store.ts` 持有 `chatRuntimeBlocked` / `chatRuntimeMessage`。
   - `useNcpChatSnapshotSync(...)` 把系统状态再次同步写入聊天 store，导致同一事实有多份副本。
3. 组件自己再做一层产品态拼接。
   - `RuntimeStatusEntry`、`RuntimeControlCard`、`NcpChatPage`、`ChatSidebar` 各自消费不同来源并拼自己的系统语义。

这就是之前“状态展示位置不该出现却出现”“系统文案和交互阻塞语义容易串掉”的根本原因：不是某个 if 写错了，而是系统状态边界从一开始就没有收紧。

本次实现命中根因的方式：

- 新增唯一 owner：
  - `packages/nextclaw-ui/src/system-status/system-status.manager.ts`
  - `packages/nextclaw-ui/src/system-status/system-status.store.ts`
  - `packages/nextclaw-ui/src/system-status/system-status.utils.ts`
  - `packages/nextclaw-ui/src/system-status/hooks/use-system-status.ts`
- 把 bootstrap、transport、连接中断恢复、runtime control、服务动作期状态统一收口到 `system-status`。
- 删除旧的 `runtime-lifecycle` 整个模块。
- 删除旧的 `use-runtime-control.ts` 与 `runtime-control.manager.ts`。
- 删除聊天 store 中不属于聊天领域的系统状态字段：
  - `chatRuntimeBlocked`
  - `chatRuntimeMessage`
- 删除 `useNcpChatSnapshotSync(...)` 中对系统状态的镜像同步。
- 让聊天页、侧栏、runtime status entry、runtime control card、runtime presence card 全部改为直接消费统一 selector。

本次额外做掉的删减：

- 去掉 `ncp-chat-input-availability.utils.ts` 里的调试 `console.log`
- 把局部 `localLifecycle / localServiceState / localMessage / busyAction` 从 `RuntimeControlCard` 收回统一 owner
- 把 `RuntimeStatusEntry` 的状态摘要改为直接来自系统状态 selector，不再自己维护另一套 runtime truth

## 测试 / 验证 / 验收方式

已执行：

```bash
pnpm -C packages/nextclaw-ui exec vitest run \
  src/system-status/system-status.manager.test.ts \
  src/system-status/system-status.selectors.test.ts \
  src/system-status/system-status.bootstrap-polling.test.ts \
  src/components/layout/runtime-status-entry.test.tsx \
  src/components/config/runtime-control-card.test.tsx \
  src/components/config/runtime-presence-card.test.tsx \
  src/components/chat/containers/chat-sidebar.test.tsx \
  src/components/chat/ncp/session-conversation/use-ncp-session-conversation.test.tsx \
  src/components/chat/chat-input/ncp-chat-input-availability.utils.test.ts \
  src/components/chat/ncp/tests/ncp-chat-input.manager.test.ts \
  src/components/chat/chat-conversation-panel.test.tsx
```

结果：

- `11` 个测试文件通过
- `67` 个测试用例通过

已执行：

```bash
pnpm -C packages/nextclaw-ui exec tsc --noEmit
```

结果：

- 通过

已执行：

```bash
pnpm -C packages/nextclaw-ui exec eslint \
  src/app.tsx \
  src/system-status \
  src/api/raw-client.utils.ts \
  src/components/chat/chat-conversation-panel.test.tsx \
  src/components/chat/chat-input/ncp-chat-input-availability.utils.ts \
  src/components/chat/chat-input/ncp-chat-input-availability.utils.test.ts \
  src/components/chat/containers/chat-input-bar.container.tsx \
  src/components/chat/containers/chat-sidebar.tsx \
  src/components/chat/containers/chat-sidebar.test.tsx \
  src/components/chat/ncp/ncp-app-client-fetch.ts \
  src/components/chat/ncp/ncp-chat-input.manager.ts \
  src/components/chat/ncp/ncp-chat-page.tsx \
  src/components/chat/ncp/page/ncp-chat-derived-state.ts \
  src/components/chat/ncp/session-conversation/use-ncp-session-conversation.ts \
  src/components/chat/ncp/session-conversation/use-ncp-session-conversation.test.tsx \
  src/components/chat/ncp/tests/ncp-chat-input.manager.test.ts \
  src/components/chat/stores/chat-input.store.ts \
  src/components/chat/stores/chat-thread.store.ts \
  src/components/config/runtime-control-card.tsx \
  src/components/config/runtime-control-card.test.tsx \
  src/components/config/runtime-presence-card.tsx \
  src/components/config/runtime-presence-card.test.tsx \
  src/components/layout/runtime-status-entry.tsx \
  src/components/layout/runtime-status-entry.test.tsx \
  src/hooks/use-realtime-query-bridge.ts \
  src/transport/local-transport.service.ts
```

结果：

- 通过

已执行：

```bash
node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs \
  --non-feature \
  --paths $(git diff --name-only -- packages/nextclaw-ui/src)
```

结果：

- 通过
- 非测试代码变更：`新增 78 行 / 删除 754 行 / 净减 676 行`

已执行：

```bash
pnpm check:governance-backlog-ratchet
```

结果：

- 通过

已执行：

```bash
pnpm lint:new-code:governance
```

结果：

- 未通过，但阻塞项均来自当前工作区中与本次任务无关的其它改动，集中在 `packages/nextclaw/src/cli/shared/services/**`
- 本次新增的 `system-status.selectors.ts` 命名问题已在本迭代内修正为 `system-status.utils.ts`

## 发布 / 部署方式

本次改动仅涉及前端 UI 状态组织与消费链路，不涉及额外发布脚本调整。

常规前端交付方式：

1. 合并代码
2. 按既有前端发布流程构建 `nextclaw-ui`
3. 在集成环境验证聊天页、runtime 管理页、头部状态入口与 presence 卡片

若需要单独发布前端，可继续使用既有 `/release-frontend` 流程；本次不要求新增发布机制。

## 用户 / 产品视角的验收步骤

1. 启动 UI 并进入聊天页。
   - 预期：系统状态不再通过聊天 store 镜像。
   - 预期：聊天区不会再出现之前那种散落式 runtime 状态副本。
2. 在服务冷启动期间进入聊天页。
   - 预期：发送动作被统一系统状态阻塞。
   - 预期：不会再依赖 chat store 自己保存一份 `chatRuntimeBlocked`。
3. 在服务已 ready 后模拟 websocket / fetch 短暂断开。
   - 预期：系统状态统一进入恢复语义。
   - 预期：侧栏连接状态、runtime 管理卡片与头部状态入口保持一致。
4. 打开 runtime control card。
   - 预期：动作执行中的状态、恢复中的状态、错误状态来自统一系统 owner，而不是组件本地拼装。
5. 打开顶部 runtime status entry。
   - 预期：展示内容与 runtime control card 的语义一致，不再是另一套局部摘要。
6. 查看 presence card。
   - 预期：环境判断来自统一系统状态，不再直接依赖旧的 `useRuntimeControl()`。

## 可维护性总结汇总

可维护性复核结论：通过

本次顺手减债：是

代码增减报告：

- 新增：277 行
- 删除：1438 行
- 净增：-1161 行

非测试代码增减报告：

- 新增：78 行
- 删除：754 行
- 净增：-676 行

no maintainability findings

本次是否已尽最大努力优化可维护性：是。当前实现已经把“系统状态 owner 分散、聊天域镜像系统状态、组件本地再拼系统语义”这三层核心债务一起收掉，没有继续保留双轨。

是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。最终不是在旧模块外再包一层新壳，而是直接删除了 `runtime-lifecycle`、`use-runtime-control`、`runtime-control.manager` 与聊天 store 的系统状态字段。

是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：是。非测试代码净减 `676` 行，且旧模块被整段删除，没有保留长期双轨。

抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰：是。现在“系统状态”有唯一 `manager + store`，聊天 store 回到聊天域，runtime control 回到系统状态输入源，组件主要消费 selector。

目录结构与文件组织是否满足当前项目治理要求：本次涉及的 `nextclaw-ui` 新增命名已满足治理要求；全仓 `pnpm lint:new-code:governance` 仍被其它未收敛改动阻塞，不属于本迭代新增问题。

独立于实现阶段的主观复核结论：

1. 还能删什么：
   - 这次已把旧 `runtime-lifecycle` 与 `use-runtime-control` 整段删除，当前剩余主要是既有配置/聊天目录体量偏大，不是本迭代新引入。
2. 还能怎么简化：
   - 后续若继续整理，可把 `system-status.manager.ts` 内的 runtime-control action 执行分成更细的 helper，但当前未超过预算，且没有再制造第二层 owner。
3. 是否只是把复杂度换个位置：
   - 否。这次不是“把旧逻辑搬家”，而是用一个统一 owner 替代了原来三处平行解释，并真实删除了旧链路。
4. React effect 是否仍只承担外部同步：
   - 本次保留在根部的 query -> system-status 同步，仅用于统一系统状态 source 接入；业务阻塞语义与服务动作状态已经回收到 manager/store，没有继续散落到业务组件 effect 中。

后续观察点：

- `ChatSidebar` 文件已经接近预算上限，后续如再扩展会话列表能力，应优先拆出更细的域模块，而不是继续在单文件里叠功能。

## NPM 包发布记录

不涉及 NPM 包发布。
