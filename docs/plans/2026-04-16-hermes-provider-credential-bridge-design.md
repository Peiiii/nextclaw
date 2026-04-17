# Hermes Provider Credential Bridge Design

## Goal

让 `Hermes` 在 NextClaw 中拥有与 `codex / claude / native` 一致的统一体验：

- 用户继续只在 NextClaw 里选择模型
- 用户继续只在 NextClaw 里配置 provider 凭据
- `http-runtime / Hermes` 不再要求用户再理解一套 Hermes 上游凭据体系
- Hermes 成为 NextClaw 统一入口下的一个运行时，而不是一个“外部黑盒 + 额外手配系统”

## Current Gap

当前实现已经打通了这些能力：

- NextClaw 可以创建 `http-runtime / Hermes` 会话
- 模型名会从 NextClaw 前端传到 Hermes adapter
- Hermes adapter 可以把 reasoning / tool-call / tool-invocation 正确投影回 NextClaw

但当前还没有打通最关键的一层：

- NextClaw 的 provider 凭据不会自动桥接到 Hermes
- 用户在前端看到的是 NextClaw 的统一模型目录，但真正认证却依赖 Hermes 自己的上游凭据

这会制造认知错位：

- 用户会自然认为“既然我选的是 NextClaw 里的模型，那就应该自动用 NextClaw 里配置的 provider 凭据”
- 但当前 `http-runtime / Hermes` 只复用了“模型选择体验”，没有复用“provider routing / credential ownership”

## Product Requirement

产品上应统一成下面这套心智模型：

1. 用户在 NextClaw 中配置 provider
2. 用户在 NextClaw 中选择模型
3. 用户选择会话类型为 `Hermes`
4. NextClaw 负责把“模型路由 + provider 凭据 + 运行参数”桥接给 Hermes
5. Hermes 只负责 agent runtime 执行，不要求用户再配置第二套上游凭据

一句话：

**Hermes 应该消费 NextClaw 的 provider routing 结果，而不是让用户自己再维护 Hermes 独立的 provider 配置。**

## Recommended Architecture

推荐做成“NextClaw 统一 provider route -> Hermes adapter consumption”模式，而不是让 Hermes adapter 自己再做 provider 发现。

### Boundary

NextClaw 负责：

- 解析用户当前选择的模型
- 从已有 provider 配置中解析出可执行的上游 route
- 产出 Hermes 所需的上游连接参数
- 把这些参数放进 `http-runtime` 请求元信息或 headers 中

Hermes adapter 负责：

- 读取 NextClaw 传来的 provider route
- 把 route 翻译成 Hermes 可理解的上游调用参数
- 保持现有的 reasoning / tool-call / stream 翻译职责

Hermes 本体负责：

- 用收到的 route 实际发起上游调用
- 返回流式结果

### Why This Boundary

这样分层的好处是：

- provider credential 的 owner 仍然是 NextClaw，而不是 Hermes
- 用户只需要维护一套 provider 配置
- `codex / claude / native / hermes` 都共享统一模型与凭据入口
- Hermes adapter 不需要复制 NextClaw 的 provider 管理逻辑

## Data Contract

新增一个“provider route bridge”负载，从 NextClaw 传给 Hermes adapter。

最小必要字段建议包括：

- `providerName`
- `model`
- `apiBase`
- `apiKey`
- `headers`
- `routeKind`
- `reasoningConfig`
- `extraProviderMetadata`

其中：

- `model` 是最终上游模型名，不一定等于用户前端看到的全名
- `apiKey` 与 `apiBase` 来源于 NextClaw 已配置 provider
- `headers` 用于兼容需要自定义头的 provider

不建议把 Hermes adapter 直接接入整个 `ProviderManager`，因为那会让 adapter 重新耦合 NextClaw 内部实现；更好的做法是由 NextClaw 先把 route resolve 成稳定负载。

## UX Target

完成后用户体验应变成：

1. 用户只配置一次 provider
2. 会话类型里选择 `Hermes`
3. 模型下拉继续显示统一模型目录
4. 如果当前模型可被 Hermes 路由，直接可用
5. 如果当前模型不可被 Hermes 路由，前端给出明确原因

错误文案要统一成产品语言，例如：

- `Hermes 当前无法使用模型 "xxx"：对应 provider 尚未配置凭据`
- `Hermes 当前无法路由到 "xxx"：该 provider 缺少 API Base`
- `Hermes 当前不支持模型 "xxx" 的此类调用能力`

而不是继续暴露 Hermes 私有错误或让用户猜测是哪里没配。

## Implementation Phases

### Phase 1: Bridge Contract

- 在 NextClaw 侧新增 `resolveProviderRouteForHttpRuntime(...)`
- 为 `http-runtime` 请求增加 `providerRoute` 元信息
- Hermes adapter 支持读取该元信息

### Phase 2: Hermes Consumption

- Hermes adapter 优先使用 NextClaw 提供的 provider route
- 保留当前 `hermesApiKey` 仅作为开发态 fallback
- 明确区分“统一桥接模式”与“旧本地 Hermes 自管模式”

### Phase 3: UX Alignment

- `http-runtime / Hermes` 的 session type 文案改为统一体验导向
- readiness 检查加入“provider route 可解析性”
- 用户看到的是 NextClaw 视角的错误，而不是 Hermes 内部认证语义

### Phase 4: Remove Cognitive Mismatch

- 对 `Hermes` 会话限制或改造模型列表来源
- 避免显示“理论可选但实际不可桥接”的模型
- 把“当前模型是否支持 Hermes 路由”做成正式 capability

## Non-Goals

这次不应做：

- 把 Hermes 内嵌进 NextClaw 主 runtime
- 让 Hermes adapter 自己重建一套完整 ProviderManager
- 为每个 provider 做独立的 Hermes 特判 UI
- 保留长期双轨的“用户既可配 NextClaw provider，又可配 Hermes provider”主路径

开发期可保留 fallback，但产品主路径必须收敛为统一体验。

## Success Criteria

满足以下条件才算真正完成 Hermes 产品化接入：

1. 新用户不需要再理解 Hermes 独立上游凭据
2. 用户在 NextClaw 中配置 provider 后，Hermes 会话可直接消费
3. 用户在 NextClaw 中选择模型时，Hermes 会话行为与其它 runtime 保持统一心智
4. 工具调用、reasoning、streaming、失败语义继续保持现有一致性
5. Hermes 不再只是“技术接通”，而是成为统一体验的一部分

## Immediate Next Step

第一步先实现：

- NextClaw 侧的 `provider route -> http-runtime bridge payload`

这是整个方案的最小主干。一旦这层打通，后续 Hermes adapter 消费和 UI readiness 对齐都能顺着收敛。
