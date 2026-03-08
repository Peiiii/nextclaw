# 平台接入方案（OpenRouter 型中转）

本文档面向接入方，约定“只接 NextClaw，不直连上游厂商”。

## 1. 接入原则

- 接入方只使用 NextClaw 提供的统一 OpenAI 兼容接口。
- 不需要提供任何上游厂商凭证（API Key / OAuth）。
- 模型选择使用平台公开模型名（`public_model_id`），由平台内部路由到上游。
- 模型命名与 OpenRouter 对齐，采用 `provider/model` 形式（例如 `openai/gpt-4o`），会体现上游供应商前缀。

## 1.1 范围边界（引用）

- 统一边界定义见独立文档：[SCOPE.md](./SCOPE.md)。
- 本文仅描述接入调用细节，不重复维护“做/不做/暂不做”清单。

## 2. 基础信息

- Base URL（示例）：`https://ai-gateway-api.nextclaw.io`
- 兼容路径：
  - `GET /v1/models`
  - `POST /v1/chat/completions`
  - `GET /v1/usage`
- Header：
  - `Authorization: Bearer <platform_token>`
  - `Content-Type: application/json`
  - 可选：`X-Idempotency-Key: <request_key>`

## 3. 鉴权与账号

- 先通过平台账号体系登录，获取平台 token。
- 后续所有 `/v1/*` 请求都必须携带该 token。
- token 失效时返回 401，需要重新登录获取新 token。

## 4. 模型发现与调用

### 4.1 获取可用模型

`GET /v1/models`

响应重点：

- `data[].id`：平台模型名（对外可见）
- `data[].display_name`：展示名

### 4.2 聊天补全

`POST /v1/chat/completions`

请求示例：

```json
{
  "model": "openai/gpt-4o",
  "messages": [
    { "role": "user", "content": "你好，请给我一段总结。" }
  ],
  "stream": false
}
```

说明：

- `model` 必须是平台公开模型名，命名形态与 OpenRouter 对齐（`provider/model`）。
- 平台会在内部完成上游选择、回退与结算。

## 5. 错误语义（最小集合）

- `401 UNAUTHORIZED`：token 缺失或无效。
- `403 FORBIDDEN`：账号无权限访问当前资源。
- `429 insufficient_quota`：用户余额/额度不足或达到限流阈值。
- `503 service_unavailable`：平台当前无可用上游或维护中。
- `5xx`：平台内部异常（可重试，建议指数退避）。

## 6. 计费与对账

- 用户侧费用以平台售卖价格结算，不直接暴露上游进价。
- 账单查询通过平台业务接口（非上游账单接口）。
- 对账以平台侧 `request_id` 为唯一追踪键。

## 7. 实施建议（客户端）

- 为每次请求生成幂等键（`X-Idempotency-Key`），避免网络抖动重复计费。
- 对 `429/503/5xx` 实施有限重试和退避。
- 对关键请求记录 `request_id`，便于平台支持排障。
