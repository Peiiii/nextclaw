# v0.16.14-chat-first-send-session-route-fix

## 迭代完成说明（改了什么）

- 修复了聊天首条发送的真实根因：发送入口此前优先读取 `selectedSessionKey`，但当前页面真正显示的线程 key 来自 `ChatThreadSnapshot.sessionKey`。当两者在首屏、新会话草稿态或路由切换后短暂错位时，前端会把草稿清空，却没有把消息发进当前线程。
- 本次把“新会话”和“草稿转真实会话”两条语义重新收敛到 `manager / store` owner 边界：
  - 点击新会话时，明确回到 `/chat` 根路由，不再提前带 `sessionKey`。
  - 同时由 `ChatSessionListManager` 直接切换到新的草稿线程 key，并同步清空 thread owner 的旧会话状态，避免继续依赖页面 `useEffect` 才把当前线程改过来。
  - 首发时仍直接使用当前草稿线程发送；发送成功后，如果当前仍停留在 `/chat` 根路由且该草稿就是当前线程，则由 `ChatSessionListManager` 把路由 `replace` 成真实 session 路由，保证刷新后能回到原会话。
- 对应实现：
  - [`packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-input.manager.ts`](../../../../packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-input.manager.ts)
    发送入口优先使用当前线程 key，而不是滞后的 `selectedSessionKey`；发送成功后再委托 session-list owner 判定是否补路由。
  - [`packages/nextclaw-ui/src/components/chat/managers/chat-session-list.manager.ts`](../../../../packages/nextclaw-ui/src/components/chat/managers/chat-session-list.manager.ts)
    新会话创建统一回到 `/chat`，同步草稿线程状态，并负责“根草稿成功发送后补真实路由”的 owner 判定。
  - [`packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-page.tsx`](../../../../packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-page.tsx)
    删除此前页面层的“草稿物化后自动补路由”业务判定，不再把这条核心逻辑放在组件 `useEffect`。
- 新增回归测试 [`packages/nextclaw-ui/src/components/chat/ncp/tests/ncp-chat-input.manager.test.ts`](../../../../packages/nextclaw-ui/src/components/chat/ncp/tests/ncp-chat-input.manager.test.ts) 与 [`packages/nextclaw-ui/src/components/chat/chat-page-runtime.test.ts`](../../../../packages/nextclaw-ui/src/components/chat/chat-page-runtime.test.ts)，覆盖三条关键场景：
  - 当前路由线程 key 正确、但 `selectedSessionKey` 已滞后时，发送仍应落到当前线程。
  - `/chat` 根路由空白草稿态下，首发仍应继续使用当前草稿线程发送，而不是提前补 ID。
  - 新会话创建后应停留在 `/chat`，并由 session-list owner 在发送成功后补具体 session 路由。
- 为满足本仓库 touched-legacy 命名治理，本次同步将页面壳文件重命名为 kebab-case：
  - [`packages/nextclaw-ui/src/app.tsx`](../../../../packages/nextclaw-ui/src/app.tsx)
  - [`packages/nextclaw-ui/src/app.test.tsx`](../../../../packages/nextclaw-ui/src/app.test.tsx)
  - [`packages/nextclaw-ui/src/components/chat/chat-page.tsx`](../../../../packages/nextclaw-ui/src/components/chat/chat-page.tsx)
  - [`packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-page.tsx`](../../../../packages/nextclaw-ui/src/components/chat/ncp/ncp-chat-page.tsx)

## 测试/验证/验收方式

- 已通过：`pnpm -C packages/nextclaw-ui test -- run src/app.test.tsx src/components/chat/ncp/tests/ncp-chat-input.manager.test.ts src/components/chat/chat-page-runtime.test.ts src/components/chat/managers/chat-session-list.manager.test.ts src/components/chat/ncp/ncp-chat-page-data.test.ts`
  - 结果：通过，8 个测试文件、44 个测试全部通过。
- 已通过：`pnpm -C packages/nextclaw-ui tsc`
  - 结果：通过。
- 已执行：`pnpm lint:maintainability:guard`
  - 结果：未通过，但阻断项不在本次聊天修复链路内。
  - 当前阻断为工作区内其它并行改动触发的超预算文件：`packages/nextclaw/src/cli/commands/ncp/context/nextclaw-ncp-context-builder.test.ts`。
  - 本次触达的聊天 UI 文件未再出现新的治理阻断；`app/app.test` 与 `chat-page/ncp-chat-page` 的 kebab-case 重命名也已被治理识别通过。
- 未执行：真实浏览器聊天 UI 冒烟
  - 原因：仓库当前没有现成覆盖“新会话停留 `/chat` 根路由 + 首发成功后再补 session id”与“stale selected key 下仍准确发送到当前线程”这两条组合链路的前端 smoke。本次先用精确回归测试锁住这两条根因路径。

## 发布/部署方式

- 本次未执行发布。
- 变更仅触达前端聊天发送目标解析、草稿路由补全与页面壳文件重命名，不涉及后端协议、数据库或部署配置，不需要额外迁移。
- 如需随前端版本发布，按现有 UI 发布流程构建并发布 `packages/nextclaw-ui` 所在前端批次即可。

## 用户/产品视角的验收步骤

1. 打开 `/chat` 根路由，确认此时 URL 里还没有 session id。
2. 从一个已有会话点击“新会话”，确认 URL 先回到 `/chat`，而不是提前带上具体 session id。
3. 直接输入第一条消息并发送。
4. 确认会话开始正常运行后，URL 会从 `/chat` 自动补成带具体 session id 的路由。
5. 在 AI 已有回复后刷新页面，确认仍能回到刚才那条会话，而不是丢回空白 `/chat`。
6. 再从一个已有 session 直接进入聊天页，确认发送消息会落到当前可见线程，不会被 stale 选中态带偏到别的 session。

## 可维护性总结汇总

- 本次是否已尽最大努力优化可维护性：是。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：是。本次删除了页面层 `useEffect` 里的草稿补路由业务判断，没有再增加新的 store、flag 或双轨逻辑，而是把规则收敛回已有 manager owner。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：基本做到最小必要增长。净增主要来自把“新会话 stay on `/chat`”和“发送成功后补路由”收敛到 manager owner 所需的最小逻辑，以及对应回归测试；同时顺手偿还了 `app/app.test` 的 touched-legacy kebab-case 命名债。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：是。发送目标判断仍由 `NcpChatInputManager` 负责，草稿线程创建与路由补全则统一落在 `ChatSessionListManager`，不再让组件 `useEffect` 承担业务编排。
- 目录结构与文件组织是否满足当前项目治理要求：满足。本次新增测试文件放入 `packages/nextclaw-ui/src/components/chat/ncp/tests/`，避免让 `chat/ncp` 目录越过平铺预算。
- 若本次涉及代码可维护性评估，默认应基于一次独立于实现阶段的 `post-edit-maintainability-review` 填写，而不是只复述守卫结果：是，以下结论基于独立复核填写。

可维护性复核结论：通过

本次顺手减债：是

代码增减报告：
- 新增：123 行
- 删除：29 行
- 净增：+94 行

非测试代码增减报告：
- 新增：60 行
- 删除：8 行
- 净增：+52 行

长期目标对齐 / 可维护性推进：
- 这次修复顺着“统一入口必须可靠、路由必须可恢复、行为必须可预测”的长期目标推进了一小步。新会话从 `/chat` 草稿态开始、首发后再自然物化成真实会话，是统一入口体验里很核心的一条连续语义。
- 本次已经做到问题范围内的最佳删减点：没有新增新的 session store、没有复制第二套路由补丁逻辑，也没有继续把复杂度推回组件 effect；相反，明确删掉了页面层的补丁式路由 effect。
- 下一步最值得继续补的 seam 是浏览器级聊天 smoke：把“新会话先停 `/chat`，首发成功后再补 session id”做成真正的端到端回归护栏。

可维护性总结：
- no maintainability findings
- 本次真正把复杂度从页面 `useEffect` 收回到了 manager/store owner 边界里，行为语义比上一版更单一、更可预测。剩余维护性风险主要不在这条聊天链路，而在工作区其它并行改动触发的超预算守卫，需要在独立批次里单独处理。
