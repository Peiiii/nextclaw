# Provider Instance Runtime Route Fix

## 背景

`docs/designs/2026-06-02-provider-template-instance-refactor-design.md` 已明确 provider template / provider instance 合同：

- `providerId` 是具体 provider instance 的身份。
- `providerType` 只表示模板/展示类型，不是运行时路由身份。
- chat/model picker 的模型 route 形态必须是 `<providerId>/<providerModel>`。
- 运行时收到模型 route 后，必须先按 `providerId` 命中 `config.providers[providerId]`，再剥掉 `providerId` 前缀，把 provider 需要的模型名发给上游 API。

0.20.5 引入 provider instance 后，普通 LLM 主链没有在最终 provider 调用前覆盖原始请求模型，导致 UI 传下来的 `<providerId>/<providerModel>` 继续穿透到上游。例如 `deepseek-2/deepseek-v4-flash` 被发给 DeepSeek API 后，上游会稳定返回 model not found。

## 根因

`LlmProviderManager.resolveRoute()` 已能把 provider instance route 解析成 provider type route，例如：

```text
deepseek-2/deepseek-v4-flash -> route.model = deepseek/deepseek-v4-flash
```

但 `chat()` / `chatStream()` 调用 provider 时仍使用展开后的原始 `params.model`。下游 `LiteLLMProvider` 看到 `providerName = deepseek` 是内置 provider，不会剥离 `deepseek-2/` 这个 instance 前缀，因此上游 API 收到错误模型名。

这是运行时 route 合同违约，不是某个 provider、runtime 或模型的特殊问题。

## 修复策略

第一阶段修复必须落在通用 LLM 主链：

1. `LlmProviderManager` 解析出 `route` 后，传给 provider 的 `model` 必须使用 `route.model`。
2. 原始 `params.model` 只作为用户选择输入，不再直接穿透到上游调用。
3. `providerType` 继续只用于定位 template/spec 能力，不作为 provider instance 身份。

后续可进一步把普通 LLM 与 NARP provider route 的解析收敛到同一个命名 owner，但本次 bugfix 先修复第一个错误 hop，避免扩大改动面。

## 验收标准

- `deepseek-2/deepseek-v4-flash` 命中 `providers["deepseek-2"]`。
- 上游 API 收到的模型名不包含 `deepseek-2/`。
- 旧配置 `providers.deepseek` + `deepseek/deepseek-v4-flash` 继续可用。
- 同一 `providerType` 的多个 instance 不互相抢路由。
- 修复不依赖具体 provider、OpenCode 或 NARP 特判。
