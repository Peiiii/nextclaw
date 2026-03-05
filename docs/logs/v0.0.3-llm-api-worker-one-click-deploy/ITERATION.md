# Iteration v0.0.3-llm-api-worker-one-click-deploy

## 1) 迭代完成说明（改了什么）
- 新增一键部署命令：`pnpm deploy:llm-api-worker`。
- 新增脚本：`scripts/deploy-llm-api-worker.mjs`，流程为：
  - 从 `DASHSCOPE_API_KEY` 环境变量或 `--api-key` 参数读取密钥；
  - 调用 `wrangler secret put DASHSCOPE_API_KEY` 更新 Cloudflare secret；
  - 调用 `wrangler deploy` 部署 `workers/nextclaw-provider-gateway-api`。
- 根 `package.json` 新增脚本入口：
  - `"deploy:llm-api-worker": "node scripts/deploy-llm-api-worker.mjs"`

## 2) 测试/验证/验收方式
- 命令可用性冒烟：
  - `DASHSCOPE_API_KEY=*** pnpm deploy:llm-api-worker`
  - 预期先输出“Updating secret”，再输出“Deploying worker”，最后“Deploy completed.”
- 实际执行结果：
  - 已在本地执行一键部署命令，完成 secret 写入与 worker 发布。
  - Wrangler 返回部署地址：`https://nextclaw-provider-gateway-api.15353764479037.workers.dev`
- 参数校验：
  - 未提供 key 时，脚本应失败并提示两种传参方式。
- 安全性检查：
  - 脚本不将 API key 写入仓库文件，仅通过 stdin 传入 wrangler secret 命令。

## 3) 发布/部署方式
- 直接使用根命令部署：
  - `DASHSCOPE_API_KEY=*** pnpm deploy:llm-api-worker`
- 若使用参数传入：
  - `pnpm deploy:llm-api-worker -- --api-key ***`
- 部署后验证：
  - `GET /health`
  - `GET /v1/models`
  - `GET /v1/usage`（带 Bearer）

## 4) 用户/产品视角的验收步骤
1. 在终端执行：`DASHSCOPE_API_KEY=*** pnpm deploy:llm-api-worker`。
2. 预期：命令一次完成 secret 更新与 worker 发布，无需手动执行多条 wrangler 命令。
3. 发布后访问网关健康接口，确认返回 `status: ok`。
4. 在 NextClaw 里选择内置 provider 发起请求，确认可以调用已部署网关。
