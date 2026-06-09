# v0.20.56 UI Directory Structure Governance

## 迭代完成说明

- 纠正 `packages/nextclaw-ui/src/features/chat` 的子业务域落位：稳定子域统一进入 `features/chat/features/*`，例如 `input`、`message`、`session`、`session-type`、`ncp`、`runtime`、`workspace`。
- 每个 chat 子 feature 保留自己的角色目录，例如 `utils/`、`hooks/` 与 `__tests__/`，避免把纯 utils 回收到父 feature，也避免把业务域名直接平铺在 chat root。
- 收窄并修正 `features/chat/index.ts` 作为跨 feature 公共边界；外部 feature 继续通过 `@/features/chat` 导入稳定入口，chat 内部使用子 feature alias 路径。
- 将 shared 基础 UI 中的语义组件从 `shared/components/ui` 移出，并进一步从 `shared/components/common` 拆到 `actions`、`feedback`、`settings`、`status`、`tags`，避免 `common` 变成新的膨胀目录。
- 删除未使用的 shared UI 旧组件，并把 `tabs-custom` 使用点收敛到基础 `Tabs` 组合。
- 补齐 UI 对 `@nextclaw/ncp-toolkit` 的 workspace 依赖、tsconfig path 与 Vite/Vitest alias，保证类型检查和测试运行时解析一致。
- 继续收敛 chat 组件封装：`ChatConversationPanel` 回到薄组合壳，header、alerts、welcome/message content、parent banner、workspace section 与 skeleton 拆为独立展示/连接组件；未新增 `.container.tsx` 文件。
- 抽出 sidebar session 分组 utils、session list 展示组件与 create menu 组件，复用 desktop/mobile/project group 的创建菜单结构。
- 将 `CompactTabStrip` 从基础 `tabs.tsx` 拆到独立 shared UI tab strip，并把 `IconActionButton` 的禁用 tooltip 合同从 `tooltip=""` 改为 `tooltip={false}`。
- 将 workspace panel active content 拆到 workspace 组件层，让外层 panel 只负责 resizable shell、tab view model、navigation history 与 visible selection sync。
- 修复 chat sidebar utility menu 的内联双语 aria-label，统一走 i18n 文案 owner。
- 同批次续改进一步下沉稳定子 feature 组件：input 的输入栏、message 的消息列表、session-type 的类型选项/create menu、session 的会话列表/header/badge/icon、workspace 的面板与文件预览组件，均移动到各自 `features/*/components` 下；父级 `features/chat/components` 只保留跨子域编排、layout、provider 与 welcome/shell 组件。
- 本轮没有把所有组件机械拆入子 feature；conversation 面板、layout shell/sidebar、provider 等仍留在 chat 父 feature，因为它们承担跨 input/message/session/workspace 的组合职责。

## 测试/验证/验收方式

- `pnpm -C packages/nextclaw-ui tsc`：通过。
- `pnpm -C packages/nextclaw-ui test -- src/features/chat/managers/__tests__/ncp-chat-input.manager.test.ts src/features/chat/features src/features/agents/components/__tests__/agents-page.test.tsx src/features/chat/components/conversation/session-header/__tests__/chat-session-header-actions.test.tsx src/features/chat/components/conversation/session-header/__tests__/chat-session-project-badge.test.tsx`：通过，31 个测试文件、127 个测试通过。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `node .agents/skills/file-organization-governance/scripts/enhanced-check-organization.js packages/nextclaw-ui/src`：通过，未检测到组织问题。
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`：通过；总计新增 1879 行、删除 1983 行、净减 104 行；非测试代码新增 1648 行、删除 1678 行、净减 30 行。
- `pnpm -C packages/nextclaw-ui test -- src/features/chat/components/conversation/__tests__/chat-conversation-panel.test.tsx src/features/chat/components/layout/__tests__/chat-sidebar.test.tsx src/features/chat/components/layout/__tests__/chat-sidebar-read-state.test.tsx src/features/chat/components/conversation/session-header/__tests__/chat-session-header-actions.test.tsx src/features/chat/features/workspace/utils/__tests__/chat-workspace-panel-view-model.utils.test.ts`：通过，5 个测试文件、51 个测试通过。
- `pnpm -C packages/nextclaw-ui lint`：通过；仍有 33 个既有 warning，无 error。
- `pnpm lint:maintainability:guard`：通过；总计新增 1879 行、删除 1983 行、净减 104 行；非测试代码新增 1648 行、删除 1678 行、净减 30 行。
- Playwright smoke `http://127.0.0.1:5174/`：首屏标题 `NextClaw - Chat`，sidebar 与 chat scroll container 存在，未卡 skeleton；仅检测到 dev 前端直连缺少后端 `/api/runtime/update` 的 404，未出现组件 chunk/module 失败。
- 同批次组件归属续改验证：
  - `pnpm -C packages/nextclaw-ui tsc`：通过。
  - `pnpm -C packages/nextclaw-ui test -- src/features/chat/features/input/components src/features/chat/features/message/components src/features/chat/features/session-type/components src/features/chat/features/session/components src/features/chat/features/workspace/components src/features/chat/components/conversation/__tests__/chat-conversation-panel.test.tsx src/features/chat/components/conversation/__tests__/chat-conversation-header.test.tsx src/features/chat/components/layout/__tests__/chat-sidebar.test.tsx src/features/chat/components/layout/__tests__/chat-sidebar-read-state.test.tsx`：通过，10 个测试文件、70 个测试通过。
  - `node .agents/skills/file-organization-governance/scripts/enhanced-check-organization.js packages/nextclaw-ui/src/features/chat`：通过，未检测到组织问题。
  - `pnpm lint:new-code:governance`：通过。
  - `pnpm check:governance-backlog-ratchet`：通过。
  - `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature`：通过；最终提交口径总计新增 231 行、删除 175 行、净增 56 行；非测试代码新增 124 行、删除 133 行、净减 9 行；仅保留三个接近预算 warning。
  - `git diff --check`：通过。

## 发布/部署方式

- 未发布。
- 未部署。
- 本次是 UI 源码结构治理与测试/配置同步，等待后续统一前端发布批次。

## 用户/产品视角的验收步骤

- 打开 chat 页面，确认会话列表、输入区、消息区、workspace panel、session header 仍正常显示。
- 切换会话列表的时间视图与项目视图，确认 session group、project group 与 child session 入口仍可用。
- 打开 workspace panel 的 child-session、file preview 与 cron tab，确认 tab strip、关闭/前进/后退按钮与内容区仍正常。
- 在 Agents 页面创建或编辑 agent，确认 runtime/session type 下拉仍能读取 chat session type 选项。
- 打开 marketplace、channels、remote、settings、system status 等使用 shared status/notice/tag/action 组件的页面，确认组件样式和交互不回退。

## 可维护性总结汇总

- 已使用 `file-organization-governance`、`collapsible-feature-root-architecture`、`role-first-file-organization`、`file-naming-convention`、`post-edit-maintainability-guard` 与 `post-edit-maintainability-review` 规则进行收尾判断。
- 代码增减报告：新增 1879 行，删除 1983 行，净减 104 行。
- 非测试代码增减报告：新增 1648 行，删除 1678 行，净减 30 行。
- 正向减债动作：删除、复用、职责收敛。删除未使用 UI 组件和旧 tabs wrapper；chat 子业务域按真正嵌套 feature root 收敛；shared 语义组件从 `ui` 和膨胀的 `common` 拆到更具体职责目录。
- 组件复用复核：`ChatConversationPanel`、`ChatSidebar`、`ChatSessionWorkspacePanel` 与 shared `tabs.tsx` 的主流程更短，重复的 create menu 和紧凑 tab strip 结构已收敛到稳定组件；新增抽象均对应真实复用或稳定变化点，不是单纯按行数拆分。
- 目录结构与文件组织已通过 governance 和专项结构扫描；保留的 watchpoint 是若 `shared/components/ui` 后续继续触达，应继续拆出更多基础控件职责或记录明确预算豁免。
- 同批次组件归属续改继续满足非功能改动的非测试代码净减原则：最终提交口径总净增 56 行，增长主要来自 `CompactTabStrip` 定向测试；非测试代码净减 9 行。父级 chat components 的平铺压力下降，子 feature owner 更明确；保留 warning 为 `chat-conversation-panel.test.tsx`、`chat-thread.store.ts` 与 `doc-browser.tsx` 接近文件预算，后续触达时应优先继续拆测试 fixture/builder、store domain owner 和 doc browser 子职责。

## NPM 包发布记录

不涉及 NPM 包发布。
