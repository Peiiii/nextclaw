# v0.15.81-child-session-unread-dot

## 迭代完成说明（改了什么）

本次迭代把最初“只给 child session / 绘画子会话补未读点”的局部方案，收敛成了一套更通用的共享 session unread 机制。目标不是做通知系统，而是在 NextClaw 的会话工作台里，用一条极轻量、可复用的规则告诉用户：“这个会话已经完成了一轮新的结果产出，而且你当前不在看它。”

- 在 [chat-session-list.store.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/stores/chat-session-list.store.ts) 中新增共享 read watermark 能力，并把 unread 显示策略收敛成纯函数：
  - `readUpdatedAtBySessionKey`
  - `markSessionRead`
  - `hydrateReadWatermarks`
  - `hasUnreadSessionUpdate`
- 核心判定规则统一为：
  - 基础变化信号仍然是 `updatedAt > read watermark`
  - 但未读点只会在“当前不是 active session”且“session status 已回到 idle”时显示
- 继续直接复用已有 session summary 上的 `updatedAt` 与 `status`，不新增后端字段、不新增协议、不加额外请求。
- 在 [chat-session-list.manager.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/managers/chat-session-list.manager.ts) 中补上 unread owner 边界：
  - `markSessionRead`
  - `hydrateReadWatermarks`
  - 视图层不再直接推进 unread 状态，而是交由 session list manager 驱动 store。
- 在 [ChatSidebar.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/ChatSidebar.tsx) 中接入共享 unread 规则：
  - 首屏把当前加载到的主会话列表作为已读基线，避免历史会话一加载就全部显示未读；
  - 当前激活主会话会自动记为已读；
  - 非激活主会话只有在本轮运行结束、状态回到 idle 后，才会在 `updatedAt` 晚于其 read watermark 时显示未读小圆点。
- 在 [chat-child-session-panel.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/chat-child-session-panel.tsx) 中删除局部特判式思路，改为复用同一套共享规则与 owner 边界：
  - 当前激活 child tab 自动记为已读；
  - 非激活 child tab 同样只会在 status 回到 idle 后显示未读小圆点；
  - 用户点开后立即消失。
- 在 [use-ncp-child-session-tabs-view.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/ncp/session-conversation/use-ncp-child-session-tabs-view.ts) 中仅补充透出 `updatedAt` 与 `runStatus`，让 child tab 能接入同一判定，不再为“绘画”或其它子会话类型单独分支。
- 在 [chat-sidebar-session-item.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/chat-sidebar-session-item.tsx) 中把展示态与编辑态拆成两个局部视图，并加上主会话未读点展示，避免继续往单个渲染块里堆条件。
- 在 [i18n.chat.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/lib/i18n.chat.ts) 中补充统一无障碍文案 `chatSessionUnread`。
- 在测试中补齐主会话列表与 child tab 两条回归链路：
  - [ChatSidebar.test.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/ChatSidebar.test.tsx)
  - [ChatConversationPanel.test.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/ChatConversationPanel.test.tsx)
  - [chat-session-list.manager.test.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/managers/chat-session-list.manager.test.ts)

## 测试 / 验证 / 验收方式

- 定向 eslint：
  - `pnpm -C packages/nextclaw-ui exec eslint src/components/chat/ChatSidebar.tsx src/components/chat/chat-sidebar-session-item.tsx src/components/chat/chat-child-session-panel.tsx src/components/chat/stores/chat-session-list.store.ts src/components/chat/ncp/session-conversation/use-ncp-child-session-tabs-view.ts src/components/chat/ChatSidebar.test.tsx src/components/chat/ChatConversationPanel.test.tsx src/lib/i18n.chat.ts`
- 定向测试：
  - `pnpm -C packages/nextclaw-ui exec vitest run src/components/chat/managers/chat-session-list.manager.test.ts src/components/chat/ChatSidebar.test.tsx src/components/chat/ChatConversationPanel.test.tsx`
- UI 类型检查：
  - `pnpm -C packages/nextclaw-ui tsc`
- UI 构建验证：
  - `pnpm -C packages/nextclaw-ui build`
- 维护性守卫尝试：
  - `pnpm lint:maintainability:guard`
- 结果摘要：
  - 上述定向 eslint、定向测试、`tsc` 与 `build` 已通过。
  - 定向测试输出里有既有 `--localstorage-file` warning，但不影响本次 unread 行为验证。
  - `pnpm lint:maintainability:guard` 已执行；本次 unread 改动自己的 owner 边界与治理问题已收口，不再是阻断项。
  - 当前 guard 仍未全绿，但阻断来自工作区其它并行改动触发的多处维护性超限与热点治理问题，集中在 `packages/nextclaw-core`、`packages/nextclaw-openclaw-compat`、`packages/nextclaw` 等链路，不是这次共享 session unread 改动引入。

## 发布 / 部署方式

- 本次属于前端 UI 行为变更，涉及联动发布的公开包：
  - `@nextclaw/ui`
  - `nextclaw`
- 发布前执行本记录中的定向 eslint、定向测试、类型检查与 UI build。
- 若与同批次前端改动一起发布，通过 changeset 完成版本提升与发布，并同步提交本迭代记录。

## 用户 / 产品视角的验收步骤

1. 打开聊天页，确认主会话列表可以看到多个会话；若存在父会话下的多个 child session，也打开右侧 child session 面板。
2. 保持当前停留在会话 A，不切到会话 B；或者停留在 child tab A，不切到 child tab B。
3. 让后台会话 B 开始流式输出，但仍处于 running 状态，确认主会话列表或 child tab B 此时不会立刻出现未读小圆点。
4. 等后台会话 B 完成这轮回复、状态回到 idle 后，确认这时才出现未读小圆点。
5. 确认当前正在查看的那个会话不会因为自己持续更新或刚完成而被标成未读。
6. 点击带未读点的会话或 child tab，确认内容切换成功，且未读点立即消失。
7. 再次切回其它会话后，让该会话继续产生新内容，确认只有在“离开后又发生更新，且该轮更新已经完成”时才会重新出现未读点。
8. 首次进入聊天页时，确认当前已加载的历史会话不会全部被误标成未读。

## 可维护性总结汇总

- 长期目标对齐 / 可维护性推进：
  - 这次顺着 NextClaw “统一入口、统一工作台”的方向推进了一小步。未读状态不再是某个绘画子会话的特例，而是任何 session summary 都能复用的一条轻量规则，用户能更自然地在多会话工作流里判断哪里有增量变化。
- 是否已尽最大努力优化可维护性：
  - 是。本次优先复用既有 `updatedAt`、既有 `status` 与既有 session list store / manager，没有新增后端协议、通知中心，也没有做“主会话一套、child session 一套”的双实现。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：
  - 是。最终收敛成“共享 watermark + 统一比较函数 + 视图层只负责标记当前 active 为已读并渲染小圆点”的方案，而不是为绘画、子会话、主会话分别堆分支。新增逻辑前，已经先删除了“局部特判 unread”这条更窄、更难复用的方向。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：
  - 部分做到。本次是明确的用户可见能力补全，总代码有净增长；但没有新增文件，增长主要集中在共享 store、两个消费视图与两组回归测试。与此同时，原本会继续分叉成多处 unread 判定的风险被收敛成了一处共享规则，避免了后续按会话类型继续恶化。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：
  - 是。`chat-session-list.store` 只负责共享 unread 状态与纯判定；[chat-session-list.manager.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/managers/chat-session-list.manager.ts) 负责推进 read watermark；[ChatSidebar.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/ChatSidebar.tsx) 和 [chat-child-session-panel.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/chat-child-session-panel.tsx) 只消费该规则并把当前上下文交给 manager；[use-ncp-child-session-tabs-view.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/ncp/session-conversation/use-ncp-child-session-tabs-view.ts) 只补充现成数据，不承担 unread 逻辑。没有新增补丁式 service / helper 层来转移复杂度。
- 目录结构与文件组织是否满足当前项目治理要求：
  - 部分满足。本次没有新增文件，避免了继续拉平目录；但 [packages/nextclaw-ui/src/components/chat](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat) 目录本身仍较平铺。后续若 session item 继续增加更多 meta 或交互，优先把 item header 再下沉为局部子视图，而不是继续在侧栏项组件里追加条件。
- 独立于实现阶段的可维护性复核：
  - 可维护性复核结论：通过
  - 本次顺手减债：是
  - 代码增减报告：
    - 新增：549 行
    - 删除：154 行
    - 净增：+395 行
  - 非测试代码增减报告：
    - 新增：379 行
    - 删除：153 行
    - 净增：+226 行
  - no maintainability findings
  - 可维护性总结：
    - 这次非测试代码的净增长主要来自把 unread 规则真正做成主会话列表与 child tab 共用的稳定实现、把 zustand action 形态收口到更符合治理规则的顶部小工厂函数，以及顺手把 [chat-sidebar-session-item.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/chat-sidebar-session-item.tsx) 的展示态/编辑态拆开，避免 unread 点接入后继续恶化可读性。
    - 这份增长已经接近当前约束下的最佳收敛点：如果不把 unread 判定沉到共享 store，后续只会演化成多处重复逻辑；如果不补两条回归测试，这类“后台更新但当前未激活”的行为很容易回归；如果不顺手收掉 effect / closure 边界问题，这次实现会继续以补丁形态留债。
    - 当前后续最值得继续观察的 seam 是首屏 read watermark hydration 只做一次基线这一点；若未来会话列表引入分页或更复杂筛选，应优先扩展这套共享基线策略，而不是回退成局部特判。
