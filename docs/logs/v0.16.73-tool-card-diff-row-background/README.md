# v0.16.73-tool-card-diff-row-background

## 迭代完成说明

- 修复 `packages/nextclaw-agent-chat-ui` 中工具卡片文件预览/差异视图的长行背景覆盖异常：当 diff 或 preview 行内容很长时，文本会继续横向溢出，但绿色/红色/普通底色没有一起扩展，导致一部分文本跑到“无底色区域”上。
- 根因已确认：问题出在 [tool-card-file-operation-lines.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/tool-card/tool-card-file-operation-lines.tsx)。原实现把紧凑视图的每一行做成 `grid + 1fr`，同时代码单元格使用 `min-w-full`。这样一来，行容器与文本内容不是同一个宽度 owner：长文本可以继续溢出，但带背景色的代码单元格只覆盖到原来的 track 宽度，所以出现“文本超出底色”的错位。这个根因通过代码路径比对，以及长行定向测试的 DOM 结构断言共同确认。
- 最终修复方式不是继续补额外宽度兜底，而是把宽度 owner 从“每一行自己算”收敛成“整块代码区共享同一个最长行宽度”：先为整个 block 计算最长代码列宽，再把这个宽度统一挂到 `data-file-code-stack`；每一行自身只保留 `w-full`，代码单元格只负责铺满这块共享宽度。这样短行也会继续被同一块底色覆盖到最右侧，不会再出现“只有最长那一行有完整底色，其它行右半边露白”的现象。
- 同时确认了一个交付链路根因：如果界面是从 `nextclaw` 包自带的 `ui-dist` 提供，而不是直接跑源码，那么仅修改 `@nextclaw/agent-chat-ui` 源码并不会立刻改变用户看到的页面；必须继续重建 `@nextclaw/ui` 并刷新 `packages/nextclaw/ui-dist`。本次已完成这一步，新的 bundle 中已经不再包含旧的 `grid + 1fr` 实现。
- 同步补了 [tool-card-file-operation-lines.test.tsx](/Users/peiwang/Projects/nextbot/packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/__tests__/tool-card-file-operation-lines.test.tsx) 的定向测试，锁定 compact/workspace 两种布局下的行容器和代码单元格宽度合同，防止后续回归。

## 测试/验证/验收方式

- 通过：`pnpm --filter @nextclaw/agent-chat-ui exec vitest run src/components/chat/ui/chat-message-list/__tests__/tool-card-file-operation-lines.test.tsx src/components/chat/ui/chat-message-list/__tests__/chat-message-list.file-operation.test.tsx`
- 通过：`pnpm --filter @nextclaw/agent-chat-ui tsc`
- 通过：`pnpm -C packages/nextclaw-ui build`
- 通过：`pnpm -C packages/nextclaw build`
- 通过：`pnpm --filter @nextclaw/agent-chat-ui build`
- 通过：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/tool-card/tool-card-file-operation-lines.tsx packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/__tests__/tool-card-file-operation-lines.test.tsx`
- 通过：`pnpm lint:new-code:governance -- --paths packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/tool-card/tool-card-file-operation-lines.tsx packages/nextclaw-agent-chat-ui/src/components/chat/ui/chat-message-list/__tests__/tool-card-file-operation-lines.test.tsx`
- 通过：`pnpm check:governance-backlog-ratchet`
- 通过：检查新生成的 `packages/nextclaw/ui-dist/assets/chat-page-*.js` 与 `packages/nextclaw-ui/dist/assets/chat-page-*.js`，确认 bundle 已切换到新的“共享最长行宽度”实现，不再包含旧的 `grid + 1fr` 代码路径。
- 未作为本次通过条件：`pnpm --filter @nextclaw/agent-chat-ui lint` 仍被包内既有历史问题阻塞，报错集中在 `chat-input-bar*` 与 `lexical/*` 等未触达文件，不属于本次修复引入的问题。

## 发布/部署方式

- 本次不涉及独立部署。
- 若需要把修复带到消费方，按现有流程重新构建并发布/集成 `@nextclaw/agent-chat-ui` 即可。

## 用户/产品视角的验收步骤

1. 在聊天界面触发一个会产生文件预览或 diff 的工具卡片，例如 `write_file`、`edit_file`、`read_file`。
2. 让返回结果里至少包含一行明显超长的代码文本，并展开该工具卡片。
3. 横向查看或滚动长行，确认绿色新增行、红色删除行、普通预览行的底色会覆盖整条可见行宽，而不是只覆盖前半段。
4. 同时确认短行仍然铺满卡片宽度，行号 gutter 没有塌陷，workspace 布局与 compact 布局表现一致。

## 可维护性总结汇总

- 长期目标对齐 / 可维护性推进：这次改动顺着“代码更少、布局 owner 更清晰、行为更可预测”的方向推进了一小步，没有为视觉问题再叠一层特判或 fallback，而是直接把“整块代码区的共享宽度”收敛成唯一主路径。
- 本次是否已尽最大努力优化可维护性：是。问题定位后优先选择删掉旧的 `grid + 1fr + helper` 组合，而不是继续在现有结构外补宽度样式。
- 是否优先遵循删减优先、简化优先、代码更少更好：是。非测试代码改动为 `新增 48 行 / 删除 53 行 / 净减 5 行`，属于纯 bugfix 下的净减实现。
- 是否让总代码量、分支数、函数数、文件数或目录平铺度下降，或至少没有继续恶化：是。未新增生产文件；非测试代码净减；删除了旧的宽度辅助逻辑，没有增加新的双路径。
- 抽象、模块边界、class / helper / service / store 等职责划分是否更合适、更清晰：是。布局 owner 仍然留在原始文件预览行组件内，没有把样式问题散到新的 helper 或额外包装层；代码行容器和代码单元格各自职责更明确。
- 目录结构与文件组织是否满足当前项目治理要求：满足。本次未新增目录，且对本次触达文件执行的 diff-only governance 检查已通过。
- 独立可维护性复核结论：通过。基于 `post-edit-maintainability-guard` 结果与独立复核，本次 `代码增减报告` 为 `新增 82 行 / 删除 65 行 / 净增 17 行`，`非测试代码增减报告` 为 `新增 48 行 / 删除 53 行 / 净减 5 行`；`no maintainability findings`。

## NPM 包发布记录

- 不涉及 NPM 包发布。
