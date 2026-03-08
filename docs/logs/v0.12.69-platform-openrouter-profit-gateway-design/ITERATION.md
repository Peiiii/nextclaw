# v0.12.69-platform-openrouter-profit-gateway-design

## 1) 迭代完成说明（改了什么）

本轮已从“方案阶段”进入“可运行闭环 MVP”并落地代码，目标对齐 OpenRouter 型中转业务：

- 平台托管上游，不让用户自带上游凭证。
- 管理员可配置上游账号、公开模型映射、销售价与上游成本。
- 用户调用统一 `/v1/chat/completions`。
- 请求完成后写入用户扣费与利润账本。
- 后台可查看利润汇总。

### 1.1 文档与范围

- 范围文档：[SCOPE.md](./SCOPE.md)
- 接入文档：[ACCESS-DESIGN.md](./ACCESS-DESIGN.md)
- 实施计划：[IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md)

### 1.2 后端实现（workers/nextclaw-provider-gateway-api）

- 新增 migration：`0005_openrouter_business_loop.sql`
  - `provider_accounts`
  - `model_catalog`
  - `request_profit_ledger`
- 新增/扩展管理端 API：
  - `GET/POST/PATCH /platform/admin/providers`
  - `GET /platform/admin/models`
  - `PUT /platform/admin/models/:publicModelId`
  - `GET /platform/admin/profit/overview`
- 数据面改造：
  - `/v1/models` 支持动态目录（无动态配置时回退静态模型）
  - `/v1/chat/completions` 按动态模型映射转发到对应上游
  - 非流式与流式结算后均写入 `request_profit_ledger`
  - 补齐流式结算 `onSettled` 回调，确保流式也能记利润

### 1.3 管理前端实现（apps/platform-admin）

- 新增类型与 API client：
  - ProviderAccountView / ModelCatalogView / AdminProfitOverview
  - providers/models/profit 的管理端请求函数
- Admin 页新增“业务闭环三块卡片”：
  - 利润总览（1/7/30 天）
  - 上游供应商账号管理（新增 + 启停）
  - 模型目录与定价管理（对外模型 -> 上游模型映射 + 价差配置）
- 为满足 lint 规则，新增模块化页面文件：
  - `src/pages/admin-gateway-business-loop.tsx`

## 2) 测试/验证/验收方式

### 2.1 构建与静态检查

已执行并通过：

1. `pnpm -C workers/nextclaw-provider-gateway-api build`
2. `pnpm -C workers/nextclaw-provider-gateway-api lint`
3. `pnpm -C workers/nextclaw-provider-gateway-api tsc`
4. `pnpm -C apps/platform-admin build`
5. `pnpm -C apps/platform-admin lint`
6. `pnpm -C apps/platform-admin tsc`
7. `pnpm build`
8. `pnpm lint`
9. `pnpm tsc`

说明：仓库其他包存在既有 lint warning（非本迭代新增），本次未扩散到本改动范围。

### 2.2 本地冒烟（已跑通）

执行路径：

1. 本地 D1 migration。
2. 启动本地 mock upstream（`127.0.0.1:9099`）。
3. 启动 worker（`127.0.0.1:8788`）。
4. 注册并提升 admin，创建 provider。
5. 配置模型 `openai/gpt-4o` -> `qwen-plus`。
6. 普通用户调用 `/v1/chat/completions`。
7. 校验利润总览与账本。

关键结果：

- `chat_model=openai/gpt-4o`
- `chat_text=pong`
- `profit_requests=1`
- `profit_margin_usd=0.00033`
- `usage_ledger_count=1`
- `profit_ledger_count=1`

## 3) 发布/部署方式

本轮已执行发布闭环：

1. 后端：
   - `pnpm deploy:platform:backend`
   - 远程 migration 成功（`0005_openrouter_business_loop.sql`）
   - Worker 发布成功，Version ID：
     - `6fe2c2cf-9aa9-4244-aa72-928ef9167e1b`
2. 管理端：
   - `pnpm deploy:platform:admin`
   - Pages 发布成功：
     - `https://64935817.nextclaw-platform-admin.pages.dev`

## 4) 用户/产品视角的验收步骤

### 4.1 线上发布后最小验收（已执行）

1. `GET https://ai-gateway-api.nextclaw.io/health` 返回 200。
2. `GET /platform/admin/providers` 未带 token 返回 401（路由已上线且鉴权生效）。
3. `GET /platform/admin/profit/overview` 未带 token 返回 401（路由已上线且鉴权生效）。
4. 管理端发布地址访问 200：
   - `https://64935817.nextclaw-platform-admin.pages.dev`

### 4.2 业务验收步骤（运营/产品）

1. 管理员登录 Admin，新增一个上游账号（OAuth token）。
2. 配置公开模型（如 `openai/gpt-4o`）并填写销售价/成本价。
3. 普通用户调用 `/v1/chat/completions`（仅平台 token）。
4. 在“利润总览”看到请求数、营收、成本、毛利率变化。

## 5) 已知风险与后续

- 当前 `wrangler.toml` 里 `AUTH_TOKEN_SECRET` 仍是开发默认值，生产应改为安全随机密钥并通过 secrets 管理。
- 上游多账号智能路由、熔断状态机精细化（半开探测/动态阈值）仍属下一阶段。
