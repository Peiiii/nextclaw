# v0.22.32 Chat Input Error Status

## 迭代完成说明

本次修复会话输入栏错误状态的位置问题。根因是 `sendError` 被建模在 `toolbar.actions` 里，并由 `ChatInputBarActions` 渲染，所以错误提示会跟发送/停止按钮、模型选择等操作控件挤在同一侧，看起来像某个按钮区域的局部错误。

修复后，`sendError` 归属 `ChatInputBar` 顶层输入面板状态，由输入面板渲染成工具栏上方的整行状态提示；`ChatInputBarActions` 只保留发送、停止和上下文窗口操作。业务侧通过 chat i18n 传入详情按钮文案，中文界面展示“查看详情”，底层 UI 包仍保留英文 fallback。

## 测试/验证/验收方式

- `/Users/peiwang/.nvm/versions/node/v22.16.0/bin/pnpm -C packages/nextclaw-agent-chat-ui test src/components/chat/ui/chat-input-bar/__tests__/chat-input-bar.test.tsx`
- `/Users/peiwang/.nvm/versions/node/v22.16.0/bin/pnpm -C packages/nextclaw-agent-chat-ui tsc`
- `/Users/peiwang/.nvm/versions/node/v22.16.0/bin/pnpm -C packages/nextclaw-agent-chat-ui lint`
- `/Users/peiwang/.nvm/versions/node/v22.16.0/bin/pnpm -C packages/nextclaw-ui tsc`
- `/Users/peiwang/.nvm/versions/node/v22.16.0/bin/pnpm -C packages/nextclaw-ui lint`
- `node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths ...`
- `/Users/peiwang/.nvm/versions/node/v22.16.0/bin/pnpm lint:new-code:governance -- ...`
- `/Users/peiwang/.nvm/versions/node/v22.16.0/bin/pnpm check:governance-backlog-ratchet`
- `/Users/peiwang/.nvm/versions/node/v22.16.0/bin/pnpm check:generated-clean`

说明：第一次全量 `lint:new-code:governance` 被当前工作区其他未提交 WIP 中的 `workspace-file-content-preview.tsx` 旧 effect 规则命中阻塞；随后对本次触达文件执行了同一治理入口的定向验证，并通过。

## 发布/部署方式

本次未执行发布或部署。已添加 changeset，后续随统一 NPM 发布流程进入 `@nextclaw/agent-chat-ui` 与 `@nextclaw/ui` patch 发布。

## 用户/产品视角的验收步骤

1. 让当前会话进入发送错误或服务恢复等待状态。
2. 确认错误提示显示在输入工具栏上方的整行状态区域，而不是右侧发送/停止按钮旁。
3. 点击“查看详情”或 `Details`，确认完整错误内容仍可展开查看。
4. 确认模型选择、附件按钮、上下文窗口指示和发送/停止按钮布局不被错误提示挤压。

## 可维护性总结汇总

可维护性复核结论：通过。

- 本次顺手减债：是。
- 代码增减报告：新增 114 行，删除 119 行，净增 -5 行。
- 非测试代码增减报告：新增 102 行，删除 104 行，净增 -2 行。
- 正向减债动作：职责收敛、删除。
- 质量与可维护性提升证明：删除了 action 组件中的错误渲染职责，错误状态回到输入面板 owner；最终 staged 范围没有引入非测试生产代码净增。
- 遗留提醒：`chat-input-bar.test.tsx` 和 `session-conversation-input.tsx` 接近文件预算，后续继续修改时应优先拆分测试 fixture 和输入栏业务组合逻辑。

## NPM 包发布记录

- 是否涉及 NPM 包发布：涉及，待统一发布。
- `@nextclaw/agent-chat-ui`：patch，修复输入错误状态展示位置。
- `@nextclaw/ui`：patch，接入新的输入错误状态合同并补充本地化详情文案。
