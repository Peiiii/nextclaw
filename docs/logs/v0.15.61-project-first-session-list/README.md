# v0.15.61-project-first-session-list

## 迭代完成说明（改了什么）

本次迭代围绕聊天左侧会话区做了一轮 `project-first` 体验优化，目标是在保留现有时间视图的前提下，让用户也能按项目组织会话，并且在项目上下文里更自然地新建草稿会话。

- 为 [ChatSidebar.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/ChatSidebar.tsx) 增加了轻量的列表模式切换：
  - 保留现有按时间分组的会话视图；
  - 新增 `project-first` 视图；
  - 切换控件移动到“会话记录”标题右上角，并收敛成低权重文字切换，不再使用高对比强调块。
- 为 sidebar 增加了项目分组投影：
  - 一级为 project；
  - 二级为该 project 下的 sessions；
  - 未绑定 project 的会话在 `project-first` 视图下隐藏；
  - project 组头样式改为单行紧凑布局，会话数量不再单独换行。
- 为 project 组头的新建入口补齐了项目内会话创建语义：
  - 如果当前只有一种可用会话类型，点击加号直接创建；
  - 如果存在多种可用会话类型，点击加号先弹出 `popover` 菜单，让用户选择具体 runtime / 会话类型；
  - 选中后才真正进入新草稿，并且草稿从第一刻起就已经绑定对应 `projectRoot`。
- 在同批次续改中，重构了 project 视图下新建草稿会话的状态模型，修复“第一次从历史绘画会话里点项目加号，新会话不带项目；第二次才带上”的真实竞态：
  - 旧问题的根因不是单点 if 判断，而是 `draft`、当前选中会话和路由切换的真相源分散，导致第一次点击时 `selectedSessionKey` 先被前端抢切，新路由还没落地，随后又被旧路由同步逻辑拨回历史会话；
  - 这次把 draft session key 收回 [chat-session-list.store.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/stores/chat-session-list.store.ts)，让 store 永远持有一个可晋升的 root draft key；
  - [chat-session-list.manager.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/managers/chat-session-list.manager.ts) 现在只负责“消费当前 draft key + 旋转下一个 spare draft key + 导航”，不再提前篡改当前选中会话；
  - [NcpChatPage.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/ncp/NcpChatPage.tsx) 现在优先以 URL 上的 `routeSessionKey` 作为当前页面会话真相源，draft project override 也只再匹配明确的 session key；
  - persisted session 的项目目录更新已从 draft override 语义里解耦，回到 [use-chat-session-update.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/hooks/use-chat-session-update.ts) 统一负责缓存更新与 skills 查询失效，避免一个状态同时承担两套职责。
- 收敛了会话 header 里的 project tag 视觉：
  - [chat-session-project-badge.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/session-header/chat-session-project-badge.tsx) 从绿色强调样式调整为灰阶中性信息标签；
  - popover 标题也同步回到当前设计系统的灰阶层级。
- 为以上改动补充回归测试，覆盖：
  - 列表模式切换；
  - project 视图隐藏无 project 会话；
  - project 内多 runtime 先选后建；
  - 单 runtime 直接创建；
  - 从同项目旧会话里点击项目加号时，不会再提前把“当前选中会话”切到新 draft，避免被旧路由回拨；
  - route 切换后，新 draft 会立即以项目 session key 呈现并带上对应 `projectRoot`；
  - persisted session 的 project 更新不再复用 draft override 本地状态；
  - project badge 使用中性色样式。

关联方案文档：

- [2026-04-09-project-first-session-list-plan](/Users/peiwang/Projects/nextbot/docs/plans/2026-04-09-project-first-session-list-plan.md)

## 测试 / 验证 / 验收方式

- UI 定向测试：
  - `pnpm --filter @nextclaw/ui test -- --run src/components/chat/ChatSidebar.test.tsx src/components/chat/managers/chat-session-list.manager.test.ts src/components/chat/session-header/chat-session-project-badge.test.tsx`
- 本次续改定向测试：
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/ui test -- --run src/components/chat/chat-page-runtime.test.ts src/components/chat/managers/chat-session-list.manager.test.ts src/components/chat/ChatSidebar.test.tsx src/components/chat/ncp/ncp-chat-page-data.test.ts src/components/chat/hooks/use-chat-session-project.test.tsx src/components/chat/hooks/use-chat-session-update.test.tsx src/components/chat/chat-session-preference-sync.test.ts src/components/chat/useChatSessionTypeState.test.tsx`
- UI 类型检查：
  - `pnpm --filter @nextclaw/ui tsc`
- 本次续改 UI 类型检查：
  - `PATH=/opt/homebrew/bin:$PATH pnpm --filter @nextclaw/ui tsc`
- UI 构建：
  - `pnpm --filter @nextclaw/ui build`
- 前端维护性守卫：
  - `pnpm lint:maintainability:guard`
- 本次续改前端维护性守卫：
  - `PATH=/opt/homebrew/bin:$PATH pnpm lint:maintainability:guard`
- 结果摘要：
  - 上述定向测试与 `tsc` 已通过；
  - `lint:maintainability:guard` 已通过，本次无新增 error，仅保留仓库既有目录/文件体量 warning；
  - 定向测试输出中存在既有 `--localstorage-file` warning，但不影响本次测试通过与行为验证。

## 发布 / 部署方式

- 本次发布涉及前端公开包联动：
  - `@nextclaw/agent-chat-ui`
  - `@nextclaw/ui`
  - `nextclaw`
- 发布前先执行相关包测试、类型检查和构建。
- 随后通过 changeset 完成版本号提升与发布，再提交版本文件、日志和代码改动。

## 用户 / 产品视角的验收步骤

1. 打开聊天页左侧 sidebar，确认“会话记录”右上角存在轻量的 `时间 / 项目` 视图切换。
2. 切到“项目”视图，确认只显示已经绑定 project 的会话。
3. 确认每个 project 组头是单行紧凑展示，project 名称与会话数量同行显示，不额外换行。
4. 当系统可用会话类型不止一种时，点击某个 project 组头加号，确认先弹出会话类型选择菜单。
5. 选择例如 `Codex` 后，确认进入新的草稿会话页。
6. 在新草稿 header 中确认 project tag 已经存在，说明草稿从创建开始就带着对应 project，而不是后补。
7. 观察会话 header 内的 project tag，确认它是灰阶中性标签，不再是绿色强调标签。
8. 当系统仅剩一种可用会话类型时，再次点击 project 组头加号，确认此时直接创建，不再多弹一步。
9. 进入某个已绑定 `projectRoot` 的旧会话后，保持停留在该会话页面，再从左侧同一个项目组头点击“新建任务”。
10. 确认此时进入的是一个新的草稿会话，而不是回到旧会话。
11. 在新草稿 header 中确认 project tag 仍然存在，且路径与项目组头对应的 `projectRoot` 一致，不会再出现“第一次没有、第二次才出现”的现象。

## 可维护性总结汇总

- 长期目标对齐 / 可维护性推进：
  - 这次改动顺着“统一入口但支持不同工作心智”推进了一小步。用户仍然在一个会话入口里工作，但可以在“时间优先”和“项目优先”两种组织方式之间切换，减少为了项目上下文而离开 NextClaw 或自行维护外部工具分组的成本。
- 是否已尽最大努力优化可维护性：
  - 是。本次没有引入独立 `Project` 实体、project store、project 路由或第二套 sidebar，而是坚持用同一份 session 数据派生出第二种视图。
- 是否优先遵循“删减优先、简化优先、代码更少更好、复杂度更低更好、清晰度更高更好”的原则：
  - 是。实现重点不是新造“项目系统”，而是把新增复杂度收束在 `listMode`、project 分组派生和 project 内新建语义上；同时把列表模式切换与 project 分组进一步拆成小组件，避免 [ChatSidebar.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/ChatSidebar.tsx) 继续无边界膨胀。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：
  - 部分做到。本次为了承载明确的新用户能力，总代码净增长；但增长已尽量集中在现有 chat sidebar 域内，并通过拆分 [chat-sidebar-list-mode-switch.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/chat-sidebar-list-mode-switch.tsx) 与 [chat-sidebar-project-groups.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/chat-sidebar-project-groups.tsx) 避免主组件超预算报错继续恶化。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰，是否避免了过度抽象或补丁式叠加：
  - 是。会话列表状态仍由既有 `chat-session-list.store` 和 `ChatSessionListManager` 管理；新增的只是 `listMode` 与“带 projectRoot 的 createSession”语义。project 分组渲染和切换 UI 被拆到局部组件，边界比把所有 JSX 和判断继续塞进 `ChatSidebar` 更清晰。
- 目录结构与文件组织是否满足当前项目治理要求：
  - 部分满足。[packages/nextclaw-ui/src/components/chat](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat) 目录仍有仓库既有平铺 warning；本次虽然新增了两个文件，但它们都直接对应 sidebar 内新增职责，且换来了主组件降压。后续若继续扩展 sidebar，建议进一步把会话列表投影逻辑收敛到更明确的子目录。
- 独立于实现阶段的可维护性复核：
  - 可维护性复核结论：通过
  - 本次顺手减债：是
  - 代码增减报告：
    - 新增：152 行
    - 删除：123 行
    - 净增：+29 行
  - 非测试代码增减报告：
    - 新增：73 行
    - 删除：91 行
    - 净增：-18 行
  - no maintainability findings
  - 可维护性总结：
    - 这次续改不是新增能力，而是把“draft key / 当前选中会话 / 路由”三套隐式真相源收回到一套更清晰的模型：store 持有可晋升的 draft key，manager 负责消费与旋转，页面优先以路由决定当前会话。
    - 非测试代码已经做到净减，主要删除点来自 [NcpChatPage.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/ncp/NcpChatPage.tsx)、[ncp-chat.presenter.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/ncp/ncp-chat.presenter.ts) 和 [use-chat-session-project.ts](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat/hooks/use-chat-session-project.ts) 中原本承担 draft 特判、双语义 override 和本地 draft id 管理的分支。
    - 新增代码主要落在 manager/store 和回归测试里，用来把“谁生成 draft key、谁决定当前会话、谁失效 skills 查询”这些职责收口到单点；整体不是再补一层，而是把旧补丁层拆掉后换成更单一的 owner。
    - 目录层面的既有 warning 仍在 [packages/nextclaw-ui/src/components/chat](/Users/peiwang/Projects/nextbot/packages/nextclaw-ui/src/components/chat)，但本次没有新增文件，平铺度未继续恶化；后续若继续触达 chat 入口，优先继续把页面编排与状态收敛到更明确的子域目录。
