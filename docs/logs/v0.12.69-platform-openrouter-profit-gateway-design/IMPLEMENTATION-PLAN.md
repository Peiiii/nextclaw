# Implementation Plan（Business-Loop MVP）

## 1. 目标

交付一个可跑通业务闭环的中转站版本（OpenRouter 对齐）：

- 管理员配置上游账号（平台托管）。
- 管理员配置公开模型映射与销售价/成本价。
- 用户仅调用 NextClaw `/v1/*`。
- 每次请求可完成“用户扣费 + 上游成本 + 毛利”入账。
- 后台有可读的利润总览。

## 2. 执行计划（含状态）

1. 数据层：新增上游账号、模型目录、利润账本表。  
状态：`已完成`
2. 控制面 API：提供 providers/models/profit 管理接口。  
状态：`已完成`
3. 数据面：`/v1/models` 动态目录、`/v1/chat/completions` 动态转发与利润记账。  
状态：`已完成`
4. Admin UI：补齐上游管理、模型管理、利润看板。  
状态：`已完成`
5. 全量验证：`build + lint + tsc + 冒烟`。  
状态：`已完成`
6. 发布与发布后验证：后端 + 管理端部署并做线上最小验收。  
状态：`已完成`

## 3. 本轮必须验收项（MVP Gate）

1. 可创建 provider account（含 OAuth token、API Base、priority、enabled）。
2. 可配置 `public_model_id`（如 `openai/gpt-4o`）并绑定上游模型。
3. 用户调用该公开模型可返回正常响应。
4. `usage_ledger` 与 `request_profit_ledger` 同步有记录。
5. `GET /platform/admin/profit/overview` 可看到聚合结果。

## 4. 本轮不做

- 不做复杂熔断状态机与多上游智能调度。
- 不做用户自带上游凭证。
- 不做企业级结算税务系统。

## 5. 回滚策略

1. 将问题模型 `enabled=false` 快速止损。
2. 必要时回滚 Worker 到上一个稳定 Version ID。
3. 如需回滚数据层，仅做“停用新能力”而非删除账本历史。
