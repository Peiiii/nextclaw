# v0.21.16 Chat Queued Inputs

## 迭代完成说明

- 完成 chat 运行中输入的本地排队：当前 run 活跃时，默认发送会把草稿加入队列，等待 run 完全空闲后自动作为下一轮对话发送。
- 完成队列行的编辑与删除能力：编辑会取消该排队项并恢复原 composer snapshot 到输入框，删除会直接取消该排队项。
- 暂停队列行的“引导”入口：active-run inbox 追加涉及协议事件、journal replay 与模型输入视图，需要先完成协议设计，当前产品入口只保留自动排队发送。
- 修复排队消息顺序错位：根因是排队 draft 曾在入队时提前构造完整 NCP envelope，导致 message timestamp/id 早于真正发送时间；现在队列只保存 composer snapshot 与 run metadata，等出队自动发送时才构造标准 envelope。
- UI 展示落在输入面板同一个卡片 shell 的顶部扩展区，原 composer 区域高度保持不变，由输入面板整体向上增高；多条排队输入在同一背景内多行展示并 truncate，不额外绘制外框、内部圆角或行分割线；右侧不提供关闭排队和更多菜单。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui test src/features/chat/features/conversation/hooks/__tests__/use-session-conversation-controller.test.tsx src/features/chat/features/conversation/components/__tests__/session-conversation-input.streaming.test.tsx src/features/chat/features/conversation/components/__tests__/session-conversation-area.test.tsx`
- `pnpm -C packages/nextclaw-agent-chat-ui test src/components/chat/ui/chat-input-bar/__tests__/chat-input-bar.test.tsx src/components/chat/ui/chat-input-bar/__tests__/chat-composer-keyboard.utils.test.ts`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-agent-chat-ui tsc`
- `pnpm -C packages/nextclaw-ui lint`
- `pnpm -C packages/nextclaw-agent-chat-ui lint`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `pnpm clean:generated`

## 发布/部署方式

- 未部署。
- 未提交、未推送、未发布。
- 本次属于本地源码实现与验证闭环，后续如进入发布批次，需要走统一 changeset / release 流程。

## 用户/产品视角的验收步骤

- 当 AI 正在运行时，在输入框输入新内容并点击发送，应清空输入框，并在输入面板同一个卡片 shell 的顶部出现排队行。
- 连续发送多条时，应在输入面板顶部扩展区出现多行排队内容；每行正文在空间不足时 truncate，原 composer 区域高度不被压缩。
- 当前 run 完全结束后，队首输入应自动作为下一轮对话发送。
- 自动发送后的排队消息进入消息列表时，应和用户手动新发消息一样使用真实发送时间；刷新后也不应按入队时间插到上一轮 AI 回复之前。
- 点击某一排队行的编辑图标后，该行应从队列消失，原输入内容、附件和技能等 composer snapshot 应退回输入框供继续编辑。
- 点击某一排队行的删除图标后，该行应从队列消失，且不恢复到输入框、不触发发送。
- 多条排队时应显示为输入面板同一张卡片里的顶部内容，不应呈现为多个卡片、多个独立横幅、独立边框模块或行分割线；右侧只保留编辑、删除两个直接操作。

## 可维护性总结汇总

- 已将 `ChatInputBar` 扩展为通用 `topSlot` shell 插槽，队列行作为输入面板卡片内部顶部扩展渲染，不再由业务组件自己绘制第二个外框。
- 已将队列行操作收敛到 controller 的队列 action owner；编辑/删除不在 UI 组件中复制 composer 状态逻辑。
- 已删除未定协议的“引导”产品入口，避免 UI 暴露 active-run inbox 追加语义导致 transcript 顺序和持久化语义不一致。
- 已将队列数据从完整 send envelope 收敛为 composer snapshot 与 metadata，真正的 message id/timestamp 只在出队发送边界生成，和普通手动发送路径保持一致。
- 已将排队草稿构造与自动发送状态迁移拆出主流程，避免 `useSessionConversationController` 继续膨胀成单段混合职责。
- maintainability guard、new-code governance 与 backlog ratchet 均通过；当前 guard 剩余 3 个 warning，集中在 near-budget 或本次功能增长文件。
- 本次新增用户能力带来生产代码净增长，属于功能性增量；已通过拆分组件与 helper 控制主函数预算，没有引入新的治理 error。

## NPM 包发布记录

- 本次未执行 NPM 发布。
- 涉及待后续统一评估的包：`@nextclaw/ui`、`@nextclaw/agent-chat-ui`。
- 当前状态：待统一发布；是否需要 changeset 由后续提交/发布批次按 release notes 流程统一确认。

## 红区触达与减债记录

### packages/nextclaw-ui/src/features/chat/features/conversation/hooks/use-session-conversation-controller.ts

- 本次是否减债：部分减债。
- 说明：新增排队能力使文件增长，但已拆出草稿构造 helper 与自动发送 owner，`useSessionConversationController` 不再触发函数预算 error。
- 下一步拆分缝：若继续增加 chat send 状态机能力，应抽出独立 queue manager/store。

### packages/nextclaw-ui/src/features/chat/features/conversation/components/session-conversation-input.tsx

- 本次是否减债：部分减债。
- 说明：输入组件仅组合顶部队列行和 ChatInputBar，队列行实现保持在独立展示组件中。
- 下一步拆分缝：继续把 toolbar 数据构造和 input surface wiring 分离，降低文件 near-budget 风险。
