# v0.12.69-platform-openrouter-profit-gateway-design

## 1) 迭代完成说明（改了什么）

本迭代不改代码，先把产品方向统一为：**OpenRouter 型平台中转**，并明确为 **平台托管上游、用户只接入 NextClaw** 的商业模式。

### 1.1 核心原则（最终口径）

- 用户侧：只注册/登录/充值并调用 `NextClaw /v1/*`，**不需要也不允许**用户自行接入上游厂商凭证。
- 平台侧：由后台统一接入上游（先支持平台 OAuth 授权接入，后续补 API Key 方式），统一做路由、限流、熔断、结算。
- 商业侧：按“售卖单价 - 上游成本 - 通道成本”核算毛利，通过模型分层和策略路由持续优化利润率与稳定性。
- 模型命名：对外模型标识与 OpenRouter 对齐，使用 `provider/model`（如 `openai/gpt-4o`），明确体现上游供应商语义。

### 1.2 目标与非目标

目标（本方案覆盖）：

- 明确控制面（后台配置）与数据面（在线转发）职责边界。
- 形成可落地的数据模型（上游连接、路由策略、价格表、账单流水、毛利汇总）。
- 形成可执行的流量治理规则（限流、熔断、回退、降级）。
- 形成分阶段交付路径，避免一次性过度改造。

非目标（本轮不做）：

- 不做多租户企业合同账期系统。
- 不做跨境税务/发票系统。
- 不做复杂 BI 平台，只保留运营必需指标面板。

### 1.2.1 范围边界（独立文档）

- “做什么 / 不做什么 / 暂时不做什么”已独立为范围文档：[SCOPE.md](./SCOPE.md)。
- 本文只保留方案设计主线，范围边界以 `SCOPE.md` 为唯一准入来源。

### 1.3 架构蓝图（控制面 + 数据面）

```text
[Admin Console]
  -> 配置上游连接(平台OAuth)
  -> 配置模型目录/定价/路由/熔断策略
  -> 查看健康度、成本、毛利

[Control Plane API]
  -> provider_accounts / provider_models / route_policies / price_books
  -> circuit_policies / rate_limit_policies

[Gateway Data Plane /v1/*]
  -> 鉴权(用户token)
  -> 配额与风控预检
  -> 路由决策(主路由+候选)
  -> 熔断判断(开/关/半开)
  -> 上游调用 + 失败切换
  -> 成本归集 + 用户计费 + 毛利入账
```

### 1.4 关键数据模型（建议新增）

- `provider_accounts`
  - 用途：平台维护上游账号连接（非用户连接）。
  - 关键字段：`provider`、`auth_type`(`oauth`/`api_key`)、`credentials_ciphertext`、`status`、`priority`、`health_state`。
- `provider_models`
  - 用途：统一管理“平台模型名 -> 上游模型名”映射。
  - 关键字段：`public_model_id`、`provider`、`upstream_model`、`capabilities`、`enabled`。
- `route_policies`
  - 用途：每个 `public_model_id` 的路由顺序与权重策略。
  - 关键字段：`strategy`(`priority`/`weighted`/`latency_first`/`margin_first`)、`candidates_json`。
- `circuit_policies`
  - 用途：定义熔断参数。
  - 关键字段：`failure_rate_threshold`、`min_requests`、`open_seconds`、`half_open_probe_count`。
- `price_books`
  - 用途：平台售卖价格（按模型/层级）。
  - 关键字段：`sell_input_usd_per_1m`、`sell_output_usd_per_1m`、`flat_fee_usd`、`effective_from`。
- `upstream_cost_ledger`
  - 用途：记录每次请求真实上游成本。
  - 关键字段：`request_id`、`provider`、`upstream_model`、`cost_usd`、`latency_ms`、`status_code`。
- `revenue_ledger`
  - 用途：记录用户侧收费与毛利。
  - 关键字段：`request_id`、`charge_usd`、`cost_usd`、`gross_margin_usd`、`gross_margin_rate`。

说明：现有 `usage_ledger` 可保留作为用户账务主账，`upstream_cost_ledger`/`revenue_ledger` 用于经营核算与运营分析。

### 1.5 在线请求流程（标准路径）

1. 用户调用 `/v1/chat/completions`（仅使用平台 token）。
2. 网关做鉴权、额度与限流预检。
3. 根据 `public_model_id` 读取 `route_policies`，选主上游。
4. 若主上游熔断打开，则直接选下一候选。
5. 调用上游，记录耗时、状态码、token usage。
6. 成功：写入用户计费、上游成本、毛利流水。
7. 失败：按策略重试或切换候选；若全部失败返回统一错误。

### 1.6 熔断与限流策略（最小可行）

- 熔断（每个 `provider+model` 维度）：
  - 统计窗口内失败率超过阈值且达到最小请求量 -> `OPEN`。
  - `OPEN` 期间拒绝该候选并转下游。
  - 到期进入 `HALF_OPEN`，只放行少量探测请求。
  - 探测成功恢复 `CLOSED`，失败回到 `OPEN`。
- 限流（分层）：
  - 用户级：QPS、并发、日预算。
  - 模型级：总并发与成本预算上限。
  - 平台级：全局故障保护阈值（防雪崩）。

### 1.7 定价与利润模型（平台赚差价）

每次请求核算：

- `upstream_cost_usd = input_tokens/1M * upstream_input_price + output_tokens/1M * upstream_output_price + upstream_flat_fee`
- `user_charge_usd = input_tokens/1M * sell_input_price + output_tokens/1M * sell_output_price + sell_flat_fee`
- `gross_margin_usd = user_charge_usd - upstream_cost_usd - infra_cost_allocated`

运营指标（后台必须可见）：

- 毛利额/毛利率（按天、模型、上游、用户层级）。
- 上游成功率/TP95 延迟/错误码分布。
- 路由命中占比与回退次数。

### 1.8 平台 OAuth 优先策略（平台侧，不是用户侧）

- 优先支持“平台管理员授权上游账号”的 OAuth 接入，减少明文密钥管理风险。
- OAuth token 存储必须加密，支持自动刷新与失效告警。
- API Key 接入作为后续补充能力，不阻塞首阶段上线。

### 1.9 后台（Admin）信息架构建议

- `上游管理`：连接状态、可用额度、健康状态、优先级。
- `模型目录`：平台模型名、上游映射、可见性、默认路由。
- `定价中心`：售卖价格、渠道价、灰度生效时间。
- `风控中心`：限流规则、熔断规则、黑白名单。
- `经营看板`：收入、成本、毛利、请求成功率、Top 风险上游。

### 1.10 分阶段实施路径

- Phase A（控制面打底）
  - 引入 `provider_accounts/provider_models/price_books/route_policies`。
  - 管理后台可配置并持久化。
- Phase B（数据面切换）
  - 网关按路由策略转发并写入成本/毛利流水。
  - 引入统一错误语义与回退机制。
- Phase C（稳定性与经营化）
  - 熔断状态机 + 指标面板 + 告警。
  - 支持利润优化策略（margin-first 与 SLA guardrail）。

### 1.11 访问文档拆分

- 访问与调用方案已拆分至独立文件：[ACCESS-DESIGN.md](./ACCESS-DESIGN.md)。
- `ITERATION.md` 保留策略与设计主线，`ACCESS-DESIGN.md` 聚焦接入方实际调用方案（域名、鉴权、接口、错误码、示例）。
- 范围边界见独立文档：[SCOPE.md](./SCOPE.md)。

## 2) 测试/验证/验收方式

本次为设计文档迭代，验证聚焦“方案一致性与可执行性”。

- 结构验证：
  - 已按迭代制度创建单层目录 `docs/logs/v0.12.69-platform-openrouter-profit-gateway-design`。
  - 文档包含四部分：完成说明、验证方式、发布方式、用户验收步骤。
- 一致性验证：
  - 明确写出“用户不接上游，仅平台接上游”。
  - 明确写出“平台 OAuth 优先（平台侧）+ API Key 后置”。
  - 明确写出“赚差价”利润公式与毛利指标。
  - 访问文档已独立为 `ACCESS-DESIGN.md`，便于对接方单独查阅。
  - 范围边界已独立为 `SCOPE.md`，作为唯一边界口径。
- 工程命令验证：
  - 本次未改动运行时代码，`build/lint/tsc` 对本次产物不构成有效信号，故省略（仅文档变更）。

## 3) 发布/部署方式

本次仅发布方案文档，无代码与基础设施变更，无需执行部署。

后续进入实现阶段时，按以下闭环执行：

1. 先上 D1 migration（新增控制面与经营账本表）。
2. 发布后端 Worker（含路由/熔断/计费逻辑）。
3. 发布 Admin Console（上游管理、定价、风控、经营看板）。
4. 执行线上冒烟：模型调用成功率、路由回退、成本与毛利入账一致性。

## 4) 用户/产品视角的验收步骤

1. 管理员在后台接入一个上游账号（平台 OAuth）。
2. 管理员创建一个平台模型（如 `openai/gpt-4o`），并配置售价与路由候选。
3. 普通用户注册登录后，直接调用平台 `/v1/chat/completions`，无需配置任何上游厂商账号。
4. 请求成功后，后台可看到：
   - 用户侧扣费流水；
   - 上游侧成本流水；
   - 该请求毛利与毛利率。
5. 人为下线主上游后，再次调用应自动回退到候选上游，用户侧保持连续可用。
