# v0.20.91 Side Chat Slash Command

## 迭代完成说明

本轮完成 slash command 第一期：`/` 面板先展示 `Commands`，再展示 `Skills`，新增 `Side chat` 命令。选择命令只执行动作并清掉当前 slash 查询，不插入 skill token 或普通文本。

`Side chat` 会在父会话右侧打开一个未 materialize 的 draft conversation。该 draft 不持久化、不伪造成 child tab、不调用 `sessions_spawn`。用户发送第一条消息时，前端通过 `agent-run.send` metadata 声明 child materialization，后端在现有 `AgentRunRequestManager -> SessionManager.createSession` 主链路中创建真实 child session，并继承父会话上下文、runtime、agent、model、thinking 与 project metadata。发送成功后右侧 draft 升级为真实 child-session tab，主路由保持父会话。

根因/设计依据：原 `/` 面板只承载 skill reference，无法在同一入口下扩展命令；而 side chat 如果直接创建后端 session，会违背“像普通新会话一样首条消息才创建”的产品预期。最终方案把 command 建模为 input surface item action，把 side chat 建模为 workspace draft，把 session 创建仍收敛到后端 session owner。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui test -- src/features/chat/features/input/input-surface-plugins/__tests__/slash-command-plugin.test.ts src/features/chat/features/workspace/utils/__tests__/chat-workspace-panel-view-model.utils.test.ts src/features/chat/managers/__tests__/chat-thread.manager.test.ts src/features/chat/stores/__tests__/chat-thread.store.test.ts src/features/chat/pages/__tests__/ncp-chat-page.test.ts`
- `pnpm -C packages/nextclaw-ui test -- src/features/chat/features/input/input-surface-plugins/__tests__/slash-command-plugin.test.ts src/features/chat/features/input/hooks/__tests__/use-chat-input-surface-state.test.tsx`
- `pnpm -C packages/nextclaw-agent-chat-ui test -- src/components/chat/ui/chat-input-bar/__tests__/chat-input-bar.test.tsx`
- `pnpm -C packages/nextclaw-agent-chat-ui test -- src/components/chat/ui/input-surface/__tests__/chat-input-surface-host.test.tsx`
- `pnpm -C packages/nextclaw-kernel test -- src/managers/__tests__/agent-run-request.manager.test.ts src/managers/__tests__/session.manager.test.ts`
- `pnpm -C packages/nextclaw-shared tsc`
- `pnpm -C packages/nextclaw-kernel tsc`
- `pnpm -C packages/nextclaw-agent-chat-ui tsc`
- `pnpm -C packages/nextclaw-ui tsc`
- `pnpm -C packages/nextclaw-shared lint`
- `pnpm -C packages/nextclaw-kernel lint`
- `pnpm -C packages/nextclaw-agent-chat-ui lint`
- `pnpm -C packages/nextclaw-ui lint`
- `pnpm -C packages/nextclaw-shared build`
- `pnpm -C packages/nextclaw-kernel build`
- `pnpm -C packages/nextclaw-agent-chat-ui build`
- `pnpm -C packages/nextclaw-ui build`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `pnpm check:generated-clean`
- Browser cold-start smoke at `http://127.0.0.1:5184/chat`: new-task draft `/` shows only skill items with neutral `斜杠菜单` listbox label; existing-session `/` shows `Side chat 命令` as the first item before skill items; no React console errors after cold navigation.

结果：全部通过。已确认 slash item 顺序为 `Commands` 在 `Skills` 前；slash 面板整体标签保持中性，具体业务分类由 item section 呈现。`packages/nextclaw-kernel lint` 仍有既有测试大块 `max-lines-per-function` warning；构建阶段有 Node 版本和前端 chunk 体积 warning，均未阻塞本轮变更。

## 发布/部署方式

本轮未执行发布/部署。已新增 `.changeset/side-chat-slash-command.md`，待后续统一 NPM 发布批次带出。

## 用户/产品视角的验收步骤

1. 在已有会话输入 `/`，确认 `Commands` 分组在 `Skills` 前，且可看到 `Side chat`。
2. 选择 `Side chat`，确认输入框中的 slash 查询被清掉，右侧打开继承父会话上下文的空会话界面。
3. 在未发送前刷新或切换，确认不会产生真实后端 session。
4. 在 side chat draft 发送第一条消息，确认右侧升级为真实 child session，并继承父会话上下文。
5. 回归 `/` skill 选择、`@` panel app 选择、面板复开第一项 focus。

## 可维护性总结汇总

本轮保持单一路径：slash command 与 skill 共用 input surface host，command action 不新增第二套输入面板；side chat 创建仍走 `agent-run.send` 和 `SessionManager`，没有新增平行后端 API。状态 owner 维持在 `ChatThreadManager/ChatThreadStore`，draft 状态明确非持久化，materialize 后转换为真实 child tab。

已执行 maintainability guard、new-code governance、backlog ratchet 和主观维护性复核。三处初始越线文件已拆回预算内：`SessionManager` 降到 514 行，`ChatThreadManager` 降到 588 行，`ChatThreadStore` 降到 396 行。当前 maintainability guard 无 error，剩余 7 个 near-budget warning，后续适合在独立测试拆分/manager 继续瘦身批次中处理。

## NPM 包发布记录

- 需要发布：是，用户可见 UI/agent 行为变化。
- 待发布 packages：`@nextclaw/agent-chat-ui`、`@nextclaw/shared`、`@nextclaw/kernel`、`@nextclaw/ui`。
- 发布状态：已新增 changeset，待统一发布。
