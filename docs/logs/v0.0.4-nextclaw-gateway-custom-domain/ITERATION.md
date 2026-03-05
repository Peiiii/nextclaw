# Iteration v0.0.4-nextclaw-gateway-custom-domain

## 1) 迭代完成说明（改了什么）
- 将 NextClaw 内置 provider 的默认网关域名切换为自定义域名：
  - 从 `https://api.nextclaw.io/v1`
  - 切换到 `https://ai-gateway-api.nextclaw.io/v1`
- 更新 gateway 自动识别关键词为 `nextclaw.io`，兼容自定义子域扩展。
- 增加配置迁移：
  - 若历史配置中 `providers.nextclaw.apiBase` 为旧值 `https://api.nextclaw.io/v1`，加载配置时自动迁移为新域名。
- 更新测试用例，覆盖默认路由域名与旧域名迁移行为。

## 2) 测试/验证/验收方式
- 受影响测试：
  - `pnpm -C packages/nextclaw-core test -- --run src/config/schema.provider-routing.test.ts src/config/loader.nextclaw-provider.test.ts src/config/loader.nextclaw-api-base-migration.test.ts`
- 受影响包验证：
  - `pnpm -C packages/nextclaw-core build`
  - `pnpm -C packages/nextclaw-core lint`
  - `pnpm -C packages/nextclaw-core tsc`
- 验收观察点：
  - 默认 API Base 为 `https://ai-gateway-api.nextclaw.io/v1`
  - 历史配置旧域名可自动升级到新域名
  - 不影响自动生成 `nc_free_*` 内置体验 key。

## 3) 发布/部署方式
- 代码发布后，CLI/UI 读取到的 NextClaw 内置 provider 默认地址将自动使用新域名。
- Worker 部署命令维持不变：
  - `DASHSCOPE_API_KEY=*** pnpm deploy:llm-api-worker`
- 若线上已绑定 `ai-gateway-api.nextclaw.io`，无需额外改动客户端配置即可生效（未手工覆盖 `providers.nextclaw.apiBase` 的前提下）。

## 4) 用户/产品视角的验收步骤
1. 启动 NextClaw，打开 Provider 配置页查看 `nextclaw` provider。
2. 确认默认 API Base 显示为 `https://ai-gateway-api.nextclaw.io/v1`。
3. 对已存在旧配置用户，重启后确认旧 `api.nextclaw.io` 自动变更为新域名。
4. 发起一次内置 provider 请求，确认能正常返回模型响应。
