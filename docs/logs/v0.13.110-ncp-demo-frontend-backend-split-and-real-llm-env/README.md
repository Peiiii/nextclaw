# v0.13.110 ncp-demo-frontend-backend-split-and-real-llm-env

## 迭代完成说明（改了什么）

- 将 `apps/ncp-demo` 重构为两个子项目：
- `apps/ncp-demo/backend`：Hono + NCP HTTP Agent Server
- `apps/ncp-demo/frontend`：React + NCP HTTP Agent Client
- `apps/ncp-demo` 顶层保留编排职责（dev/build/lint/tsc/smoke），不再混合前后端实现
- 新增 `.env` 自动加载机制：`apps/ncp-demo/scripts/env.mjs`
- 开发/冒烟脚本会自动读取 `backend/.env.local`、`backend/.env`、`.env.local`、`.env`
- 后端新增真实 LLM 接入：`OpenAICompatibleNcpLLMApi`
- `NCP_DEMO_LLM_MODE=auto` 时，检测到 `OPENAI_API_KEY + base_url/OPENAI_BASE_URL` 自动走真实 OpenAI-compatible 接口
- 未配置密钥时自动回退 mock，保证本地 demo 可用

## 测试/验证/验收方式

- 安装依赖：`pnpm install`
- Backend 类型/校验：`pnpm -C apps/ncp-demo/backend tsc && pnpm -C apps/ncp-demo/backend lint`
- Frontend 类型/校验：`pnpm -C apps/ncp-demo/frontend tsc && pnpm -C apps/ncp-demo/frontend lint`
- Demo 编排校验：`pnpm -C apps/ncp-demo tsc && pnpm -C apps/ncp-demo lint`
- Demo 冒烟：`pnpm -C apps/ncp-demo smoke`
- 根目录冒烟：`pnpm smoke:ncp-demo`

## 发布/部署方式

- 本次改动用于本地开发/演示，不涉及线上部署
- 根目录一键开发：`pnpm dev:ncp-demo`
- 若需要真实 LLM：在 `apps/ncp-demo/backend/.env` 配置 `base_url` 与 `OPENAI_API_KEY`

## 用户/产品视角的验收步骤

1. 执行 `pnpm dev:ncp-demo`
2. 打开前端地址（默认 `http://127.0.0.1:5181`）
3. 发送消息，确认出现完整流式事件（run.started、tool、text、run.finished）
4. 点击 `replay last run`，确认可重放同一 run
5. 配置 `apps/ncp-demo/backend/.env` 后重启开发命令，确认走真实模型回复
