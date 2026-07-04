# v0.21.14 Slash 面板应用打开入口

## 迭代完成说明

本次在聊天输入框 Slash 面板中新增“面板应用”动作项。用户输入 `/` 后可以搜索 Panel App，选中后不会插入输入内容或引用 token，而是直接在右侧面板打开对应 Panel App。Slash 面板分组顺序为命令、技能、面板应用，优先保留更高频的 Skill 选择。

Slash 面板顶部新增分类筛选标签：全部、命令、技能、面板应用。标签显示当前搜索结果中的分类数量，默认保持全部视图；用户需要找面板应用时可以直接切换到“面板应用”，避免信息量过大时下方分组不可见。

实现保持 `/` 与 `@` 的语义边界：`/` 是立即动作入口，`@` 仍是上下文引用入口。Panel App 搜索排序复用现有引用面板的匹配、收藏和最近打开排序逻辑，避免维护两套筛选规则。

## 测试/验证/验收方式

- `pnpm --filter @nextclaw/ui test -- src/features/chat/features/input/input-surface-plugins/__tests__/slash-command-plugin.test.ts src/features/chat/features/input/hooks/__tests__/use-chat-input-surface-state.test.tsx`：通过，2 个测试文件、5 个测试。
- `pnpm --filter @nextclaw/agent-chat-ui test -- src/components/chat/ui/chat-input-bar/__tests__/chat-input-bar.test.tsx`：通过，33 个测试，覆盖无 token Slash item 清空触发文本而不插入内容。
- `pnpm --filter @nextclaw/agent-chat-ui test -- src/components/chat/ui/chat-input-bar/__tests__/chat-slash-menu.test.tsx src/components/chat/ui/input-surface/__tests__/chat-input-surface-host.test.tsx`：通过，2 个测试文件、11 个测试，覆盖分类标签筛选、数量展示和 input surface session 行为。
- `pnpm --filter @nextclaw/ui exec eslint <本次触达文件>`：通过，无错误。
- `pnpm --filter @nextclaw/ui lint`：通过，仍有未触达 `doc-browser.test.tsx` 的既有函数长度 warning。
- `pnpm lint:new-code:governance`：通过。
- `pnpm check:governance-backlog-ratchet`：通过。
- `pnpm --filter @nextclaw/agent-chat-ui tsc`：通过。
- `pnpm --filter @nextclaw/ui tsc`：通过。
- `pnpm clean:generated`：通过，generated artifacts 保持 clean。

## 发布/部署方式

本次仅修改前端源码、测试和 i18n 文案，未执行发布或部署。

## 用户/产品视角的验收步骤

1. 在聊天输入框输入 `/`。
2. 预期：Slash 面板顶部出现“全部、命令、技能、面板应用”分类标签，并显示当前搜索结果数量。
3. 默认“全部”处于选中状态，列表中命令在前，技能分组排在面板应用分组之前。
4. 点击“面板应用”标签，预期列表只显示面板应用动作项。
5. 在 Slash 面板中搜索某个 Panel App。
6. 选择该 Panel App。
7. 预期：输入框中的 slash 触发文本被清理，右侧面板打开对应 Panel App；不会把 Panel App 写入当前消息。

## 可维护性总结汇总

已运行 `post-edit-maintainability-guard`，本次触达范围无错误，存在一个观察项：`session-conversation-input.tsx` 当前 458 行，接近 500 行预算。本次在该文件只保留 Slash 面板应用选择到 `chatUiManager.showContent` 的事件桥接，打开逻辑仍交给 `chatUiManager` owner，没有新增平行协议或组件层业务分支。

代码增减：总计新增 474 行、删除 55 行、净增 419 行；非测试新增 283 行、删除 43 行、净增 240 行。增长来自新增用户能力：Panel App Slash action、通用 input surface 分类筛选合同、分类标签 DOM 交互测试、Slash 插件测试、hook 加载条件测试和 i18n 文案。分类筛选沉到通用 input surface 菜单，避免在 Slash 或 Panel App 专属路径里复制过滤 UI。

## NPM 包发布记录

不涉及 NPM 包发布。
