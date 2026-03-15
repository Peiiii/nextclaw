# v0.13.111 ncp-demo-model-default-gpt-5.3-codex

## 迭代完成说明（改了什么）

- 将 ncp-demo 的真实模型配置统一切换为 `gpt-5.3-codex`
- 更新后端代码默认模型：`apps/ncp-demo/backend/server/backend.ts`
- 更新本地配置：`apps/ncp-demo/backend/.env`
- 更新示例配置：`apps/ncp-demo/backend/.env.example`

## 测试/验证/验收方式

- 执行 `pnpm -C apps/ncp-demo/backend tsc`
- 执行 `pnpm smoke:ncp-demo` 验证 demo 基本链路

## 发布/部署方式

- 本次为本地 demo 配置调整，不涉及线上部署
- 启动开发：`pnpm dev:ncp-demo`

## 用户/产品视角的验收步骤

1. 在 `apps/ncp-demo/backend/.env` 确认 `OPENAI_MODEL=gpt-5.3-codex`
2. 执行 `pnpm dev:ncp-demo`
3. 发送一条消息，确认后端以真实模型模式运行（health/日志可见 `llm=openai`）
