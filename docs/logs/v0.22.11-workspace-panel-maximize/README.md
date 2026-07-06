# v0.22.11 Workspace Panel Maximize

## 迭代完成说明

本次为会话工作区右侧栏增加了容器内最大化/还原入口。桌面端工作区侧栏保持原有前进、后退、关闭操作，并新增最大化按钮；点击后侧栏不会覆盖全局左栏或 Doc Browser，而是在当前会话区域内铺开，覆盖消息区与工作区侧栏自身，再次点击还原为原来的可拖拽右侧栏。

实现上由 `ChatConversationPanel` 声明会话区域覆盖边界，`ChatSessionWorkspacePanel` 持有本地临时最大化状态，`ResizableRightPanel` 增加 `overlayScope="container"` 以复用现有 overlay 行为但改为父容器内绝对定位。移动端本来就是全屏 overlay，不显示重复最大化按钮。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui test -- src/shared/components/resizable-right-panel/__tests__/resizable-right-panel.test.tsx src/features/chat/features/workspace/components/__tests__/chat-session-workspace-panel.test.tsx`
- `pnpm --filter @nextclaw/ui tsc`
- `pnpm --filter @nextclaw/ui lint`
- `pnpm --filter @nextclaw/ui build`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs`
- `pnpm lint:new-code:governance`
- `pnpm check:governance-backlog-ratchet`
- `git diff --check`，范围限定在本次触达文件

## 发布/部署方式

无需单独部署。本次改动进入 `@nextclaw/ui` 后随下一次常规 NPM/桌面发布带出。

## 用户/产品视角的验收步骤

1. 打开一个包含工作区右侧栏的会话，例如子会话、文件预览或定时任务面板。
2. 在右侧栏顶部工具区点击最大化图标。
3. 确认右侧栏铺满当前会话区域，覆盖消息区和原右侧栏，但不覆盖全局左侧栏与 Doc Browser。
4. 点击还原图标，确认右侧栏回到原来的 docked 宽度，并恢复拖拽调整宽度能力。
5. 在移动端或 overlay 模式确认不会出现重复最大化按钮。

## 可维护性总结汇总

本次是新增用户可见能力，非测试生产代码有必要增长。实现没有把最大化状态写入会话 store，也没有复制工作区面板内容；状态归属在工作区面板本地，覆盖边界归布局容器，定位能力归共享右栏组件。新增共享合同只有 `overlayScope` 一个可枚举选项，继续复用原有 resize/overlay 主链路。

`post-edit-maintainability-guard` 通过；报告中的 landing 与截图脚本 warning 来自当前脏工作区已有无关改动，不属于本次触达范围。按 touched path scoped guard 复核无 warning。`post-edit-maintainability-review` 结论：通过；本次 scoped 源码/测试/i18n 改动新增 200 行、删除 8 行、净增 192 行，其中非测试新增 76 行、删除 8 行、净增 68 行。增长集中在一个用户可见交互、一个共享定位合同和对应测试，没有新增平行状态链路。

## NPM 包发布记录

- 涉及包：`@nextclaw/ui`
- 发布状态：待下一次统一 NPM/桌面发布带出
- Changeset：`.changeset/workspace-panel-container-maximize.md`
