# Iteration v0.0.2-nextclaw-builtin-provider-gateway-mvp

## 1) 迭代完成说明（改了什么）
- 完成 NextClaw 内置 provider 的 MVP 集成（不需要登录系统）。
- 新增内置 provider `nextclaw`（`packages/nextclaw-core/src/providers/registry.ts`）：
  - 定义默认网关地址：`https://api.nextclaw.io/v1`
  - 首批默认模型：`dashscope/qwen3.5-*`
  - provider 定位为 gateway（套壳）能力。
- 完成开箱即用关键路径：
  - 默认模型改为 `dashscope/qwen3.5-flash`（`packages/nextclaw-core/src/config/schema.ts`）
  - `providers.nextclaw` 加入默认配置结构（`packages/nextclaw-core/src/config/schema.ts`）
  - `loadConfig` 自动为 `providers.nextclaw.apiKey` 生成本机体验 key（`nc_free_*`）并持久化（`packages/nextclaw-core/src/config/loader.ts`）。
- 调整 provider 路由逻辑（`packages/nextclaw-core/src/config/schema.ts`）：
  - 当模型前缀命中的 provider 未配置 key 时，允许继续匹配已配置 key 的 gateway provider（用于 `dashscope/*` 自动路由到 `nextclaw`）。
- UI/后端元数据联动：
  - provider 测试默认模型增加 `nextclaw` fallback（`packages/nextclaw-server/src/ui/config.ts`）
  - provider 展示排序中加入 `nextclaw`（`packages/nextclaw-server/src/ui/config.ts`）。
- 新增 Cloudflare Worker 网关：`workers/nextclaw-provider-gateway-api`
  - `GET /health`
  - `GET /v1/models`
  - `GET /v1/usage`
  - `POST /v1/chat/completions`（OpenAI 兼容路径）
  - 按 API key（设备体验 key）做 USD 总额度控制（Durable Object 记账）
  - 首期上游路由 DashScope（Qwen3.5 系列）
  - 支持 stream 请求的异步用量记账。
- 根脚本接入新增 worker 的 `build/lint/tsc`（`package.json`）。

## 2) 测试/验证/验收方式
- 单元验证：
  - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core test -- --run src/config/schema.provider-routing.test.ts src/config/loader.nextclaw-provider.test.ts`
  - 结果：通过（5/5）。
- 工程验证（全量）：
  - `PATH=/opt/homebrew/bin:$PATH pnpm lint`
  - `PATH=/opt/homebrew/bin:$PATH pnpm tsc`
  - 结果：`lint` 与 `tsc` 通过（lint 仅有仓库既存 warning，无 error）。
- 工程验证（build）：
  - `PATH=/opt/homebrew/bin:$PATH pnpm build`
  - 结果：未完全通过；阻塞于既存 UI 文件 `packages/nextclaw-ui/src/components/chat/useChatStreamController.ts` 的重复定义编译错误（与本次改动无直接关联）。
  - 补充验证（受影响包）：
    - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-core build` 通过
    - `PATH=/opt/homebrew/bin:$PATH pnpm -C packages/nextclaw-server build` 通过
    - `PATH=/opt/homebrew/bin:$PATH pnpm -C workers/nextclaw-provider-gateway-api build` 通过
- 冒烟验证 1（NextClaw 内置 provider 开箱即用，非仓库目录写入）：
  - 命令：`NEXTCLAW_HOME=/tmp/... pnpm -C packages/nextclaw-core exec tsx -e \"loadConfig + getProviderName\"`
  - 观察点：
    - 默认模型为 `dashscope/qwen3.5-flash`
    - 路由 provider 为 `nextclaw`
    - 自动生成 key 前缀为 `nc_free_`
- 冒烟验证 2（Worker 本地接口可用）：
  - 命令：在 `/tmp` 目录运行 `wrangler dev`（指定本项目 `wrangler.toml`），然后 `curl`：
    - `GET /health` -> 200 + `status: ok`
    - `GET /v1/models` -> 200 + 返回 `dashscope/qwen3.5-*` 列表
    - `GET /v1/usage`（带 Bearer）-> 200 + `freeTrialUsdLimit`/`freeTrialUsdRemaining`
    - `POST /v1/chat/completions`（缺少 Bearer）-> 401
    - `POST /v1/chat/completions`（不支持模型）-> 400 `model_not_found`

## 3) 发布/部署方式
- Worker 发布：
  - 配置生产密钥：`DASHSCOPE_API_KEY`
  - 可选配置：`FREE_TRIAL_USD_LIMIT`、`FREE_TRIAL_FLAT_USD_PER_REQUEST`
  - 执行：`pnpm -C workers/nextclaw-provider-gateway-api deploy`
- NextClaw 侧发布：
  - 按既有 changeset/version/publish 流程发布受影响包。
  - 确认 `nextclaw-core` 与 `nextclaw`（以及依赖联动包）版本同步发布。
- 上线检查：
  - 生产网关 `/health`、`/v1/models` 可访问
  - 新安装 NextClaw 可直接使用内置 provider 发起首个请求
  - 超出体验额度后返回 429 且提示升级/自配 provider key。

## 4) 用户/产品视角的验收步骤
1. 全新环境安装并启动 NextClaw，不手动填写任何第三方 API key。
2. 打开 Provider 配置页，确认存在内置 `nextclaw` provider。
3. 默认模型保持 `dashscope/qwen3.5-flash`，直接发起对话请求。
4. 请求成功返回后，查看网关 `usage` 数据有累计。
5. 持续请求直到额度达到上限，确认返回明确“免费额度已耗尽”反馈（429）。
