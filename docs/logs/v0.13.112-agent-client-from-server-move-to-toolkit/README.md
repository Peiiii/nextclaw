# v0.13.112 agent-client-from-server-move-to-toolkit

## 迭代完成说明（改了什么）

- 将 `createAgentClientFromServer` 从 `@nextclaw/ncp` 迁移到 `@nextclaw/ncp-toolkit`。
- `@nextclaw/ncp` 的 endpoint 入口移除该函数导出，回归协议契约层定位。
- 新增 `@nextclaw/ncp-toolkit` 实现文件并在 `agent/index.ts` 导出。
- 更新消费方引用：`apps/ncp-demo/backend/server/index.ts` 改为从 `@nextclaw/ncp-toolkit` 导入。
- 更新文档说明：`@nextclaw/ncp-http-agent-server` README 中 in-process 包装器来源改为 `@nextclaw/ncp-toolkit`。

## 测试/验证/验收方式

- `pnpm -C packages/ncp-packages/nextclaw-ncp tsc && pnpm -C packages/ncp-packages/nextclaw-ncp lint`
- `pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit tsc && pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit lint && pnpm -C packages/ncp-packages/nextclaw-ncp-toolkit test`
- `pnpm -C apps/ncp-demo/backend tsc`
- `pnpm smoke:ncp-demo`

## 发布/部署方式

- 本次变更属于包内结构与导出边界调整，不涉及线上部署。
- 本地开发验证可直接执行：`pnpm dev:ncp-demo`。

## 用户/产品视角的验收步骤

1. 在业务代码中将 `createAgentClientFromServer` 的导入改为 `@nextclaw/ncp-toolkit`。
2. 启动 demo：`pnpm dev:ncp-demo`。
3. 发送消息并确认前后端流式对话正常。
4. 执行 `pnpm smoke:ncp-demo`，确认自动冒烟通过。
