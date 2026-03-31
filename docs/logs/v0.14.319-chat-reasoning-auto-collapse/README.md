# v0.14.319-chat-reasoning-auto-collapse

## 迭代完成说明

- 优化 `@nextclaw/agent-chat-ui` 中 reasoning 展示区的默认展开策略。
- 已完成的 reasoning 默认收起，避免历史思考内容长期占用消息高度。
- 仅当 assistant 当前正在输出的最后一个 reasoning queue 仍处于进行中时，默认展开该 reasoning block。
- 当当前 reasoning queue 结束后，若用户未手动重新展开，则自动收起。
- 若用户在进行中手动重新展开 reasoning block，则后续不再强制自动收起，尊重用户显式操作。
- 补充消息列表测试，覆盖默认收起、运行中展开、完成后自动收起、多 reasoning queue 只展开当前 queue、手动展开后保持展开等场景。

## 测试/验证/验收方式

- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm --filter @nextclaw/agent-chat-ui test -- chat-message-list.test.tsx`
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm --filter @nextclaw/agent-chat-ui tsc`
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm --filter @nextclaw/agent-chat-ui lint`
- `PATH=/Users/peiwang/.nvm/versions/node/v22.16.0/bin:$PATH pnpm lint:maintainability:guard`
  - 结果：仍失败，但失败项来自工作区中已存在的其它改动，集中在 `packages/nextclaw-core/src/session/manager.ts` 的复杂度治理，不是本次 reasoning UI 改动新引入的问题。

## 发布/部署方式

- 本次为前端组件行为调整，无需单独远程 migration。
- 若需要随版本发布，按项目既有前端发布流程执行相关 package 的版本提升、构建、发布与 UI 集成验证。

## 用户/产品视角的验收步骤

1. 打开聊天界面，触发一个会先输出 reasoning 的 assistant 回复。
2. 确认当前正在增长的 reasoning queue 默认展开。
3. 当 reasoning 结束并进入普通回复，或整条回复完成后，确认该 reasoning 自动收起。
4. 构造同一条 assistant message 内含多个 reasoning queue 的场景，确认只有当前最后一个、仍在输出的 reasoning queue 展开，之前已结束的 queue 保持收起。
5. 在 reasoning 进行中先手动折叠再手动展开，等待其结束，确认该 reasoning 不会被再次自动收起。
