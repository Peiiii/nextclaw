# v0.21.6 Markdown 文件链接打开右侧栏修复

## 迭代完成说明

本次修复聚焦既有 Markdown 文件链接能力，不属于 `show_content` 工具链。

- 根因判断：当前源码中的 server-path 读取对绝对路径会直接解析，不会拼接 `workDir`；`ChatMessageMarkdown` 也已有本地文件链接拦截逻辑。
- 已确认异常：`react-markdown` 的内部 `node` prop 被透传到了真实 DOM，导致链接渲染为 `node="[object Object]"`，不符合预期。
- 修复方式：在 Markdown 自定义组件边界消费掉内部 `node` prop，不再透传给 `a/table/input/img/code` DOM 节点。
- 回归覆盖：补充 `/Users/peiwang/Downloads/particle-cosmos.html` 绝对路径链接用例，确认点击触发既有 `viewMode: "preview"` 文件打开 action，不带 rendered viewer；补充容器层用例，确认 action 接到 `ChatThreadManager.openFilePreview`。
- 根因未完全定位：用户实际运行态点击未打开右侧栏的现场还未通过完整 app 点击复现；当前源码链路显示不是 workDir 拼接问题，剩余排查方向是运行 bundle 是否刷新、实际 surface 是否传入 `onFileOpen`。

## 测试/验证/验收方式

- `packages/nextclaw-agent-chat-ui`: `./node_modules/.bin/vitest run src/components/chat/ui/chat-message-list/__tests__/chat-message-markdown.test.tsx`
- `packages/nextclaw-ui`: `./node_modules/.bin/vitest run src/features/chat/features/message/components/__tests__/chat-message-list.container.test.tsx`
- `packages/nextclaw-agent-chat-ui`: `./node_modules/.bin/tsc -p tsconfig.json --noEmit`
- `packages/nextclaw-ui`: `./node_modules/.bin/tsc -p tsconfig.json --noEmit`
- 根目录：`./node_modules/.bin/eslint --max-warnings=0 <touched files>`
- 根目录：`node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --non-feature --paths <touched files>`
- 根目录：`node scripts/governance/checks/lint-new-code-governance.mjs -- <touched files>`
- 根目录：`node scripts/governance/backlog/check-governance-backlog-ratchet.mjs`
- 根目录：`git diff --check`

## 发布/部署方式

未执行发布或部署。本次为前端源码与测试修复，等待后续统一发布。

## 用户/产品视角的验收步骤

1. 在聊天消息中渲染 `[particle-cosmos.html](/Users/peiwang/Downloads/particle-cosmos.html)`。
2. 检查 DOM 中链接不再包含 `node="[object Object]"`。
3. 普通左键点击该链接，应进入既有 workspace file preview 右侧栏链路，文件 path 保持 `/Users/peiwang/Downloads/particle-cosmos.html`。

## 可维护性总结汇总

- 本次触达生产代码 0 净增，只在自定义 Markdown 组件边界消费内部 prop。
- 没有新增 owner、manager、adapter 或并行打开链路。
- 回归测试覆盖组件层和容器层，避免把 Markdown 文件链接问题误归到 `show_content`。
- `post-edit-maintainability-review` 判断：非测试代码净增为 0，正向动作是简化 DOM 输出边界并补齐缺失回归；无可维护性发现。

## NPM 包发布记录

本轮未发布 NPM 包。已添加独立 changeset，后续统一 NPM 发版需要纳入：

- `@nextclaw/agent-chat-ui`
- `@nextclaw/ui`

当前状态：待统一发布。
