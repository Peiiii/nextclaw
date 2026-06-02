# Provider Template / Instance 重构设计

## 背景

当前 provider 配置把两类事实混在了一起：

- 系统内置 provider template：OpenAI、Anthropic、DashScope、MiMo 等内置 provider 的默认 API base、默认模型、vision/thinking 能力、OAuth 元信息、展示类型。
- 用户 provider 配置：用户是否启用、API key、API base override、模型列表、modelConfig override。

代码里对应的混合点主要是：

- `packages/nextclaw-server/src/features/config/stores/server-config.store.ts` 的 `buildConfigMeta()` 把内置 provider spec 和 custom provider 混成 `meta.providers`。
- `packages/nextclaw-ui/src/shared/components/config/providers-list.tsx` 把 `meta.providers` 当成页面左侧 provider 列表，再用 `config.providers[provider.name]` 补配置状态。
- `packages/nextclaw-ui/src/shared/components/config/provider-form.tsx` 在没有 `config.providers[providerName]` 时用 `EMPTY_PROVIDER_CONFIG`，导致“系统模板”和“用户实例”在表单里没有边界。
- `packages/nextclaw-ui/src/shared/lib/provider-models/index.ts` 当前通过 `resolveModelsWithDefaults(defaultModels, savedModels)` 修补空列表问题，但这会把用户显式清空 `models: []` 误判为“没有保存过，使用默认模型”。

这类修补不是根治。真正问题是：内置 provider template 不应该伪装成用户 provider instance。领域模型只保留两类东西：系统拥有 template，用户拥有 instance。`providerType`、`apiProtocol` 只是这两类对象上的字段，不是新的领域对象。

## 目标

本次设计要解决：

1. 新隔离环境中，系统内置 provider 类型仍然可见，用户可以从模板创建 provider。
2. 用户已有 `config.providers.*` 在新规范下仍然是合法 provider instance，升级后能在 UI 里找到。
3. 用户已配置的 provider 不因版本升级被静默改写。
4. `models: []` 明确表示该 instance 没有可用模型，不再 fallback 到 `defaultModels`。
5. 内置 provider 模板更新只影响模板目录和新建 instance，不静默污染旧 instance。
6. 用户可以删除任何 provider instance，包括由内置模板创建的 instance；删除不影响模板目录。
7. 实现要尽量小，但要删除或收敛当前明显错误的抽象和隐式 materialize 路径。
8. 借本次重构顺手降低 provider 表单复杂度，不能继续把 template/instance/auth/models/apiBase/wireApi 的状态机堆在一个 TSX 组件里。

不在本次范围：

- 自动从 provider `/models` 拉取线上模型目录。
- AI/skill 自动维护内置模型 catalog。
- 复杂的“同步模板新增模型”交互。本次只预留显式动作位置，不实现自动合并。
- 复杂的跨 instance 自动负载均衡或 fallback。多个 instance 可以同属一个 `providerType`，但 chat/model picker 的选择必须精确指向某一个 instance。

## 术语

### Provider Template

系统内置的 provider 类型定义。它随版本更新，不属于用户私有配置。

Template 只用于初始化 provider instance 和展示“可添加 provider 类型”。创建完成后，instance 不保存 `templateId`，也不需要依赖 template 才能解释自己的用户配置。

当前代码里的 `ProviderSpec` 就是 provider template 的实现命名。代码里如果出现 `ProviderCatalog` / registry，只表示“template 列表的存放和查找机制”，不是第三个领域概念。

Template 可以包含两组字段：

- 展示和初始化字段：默认 API base、默认模型、展示名称、OAuth 元信息、provider type 等。
- 运行协议字段：`apiProtocol`、`wireApi` 默认值、model prefix、gateway、headers、model override 等。

模板字段来源：

- `packages/nextclaw-runtime/src/providers/*.provider.ts`
- `packages/nextclaw-server/src/features/config/providers/server-builtin-provider.provider.ts`

模板包含：

- `id`
- `displayName`
- `providerType`
- `modelPrefix`
- `defaultApiBase`
- `defaultModels`
- `modelConfig`
- `apiProtocol`
- `defaultWireApi`
- `auth`
- `keywords`

模板不包含用户可编辑的 `logo` 字段。UI 图标应由 `providerType` 查表得到。

当前 `apiProtocol` 的实际支持：

- 默认走 OpenAI-compatible provider。
- 当现有 template 中 `apiProtocol === "anthropic-messages"` 时，走 Anthropic Messages provider。
- OpenAI-compatible 路径内部支持 `wireApi: "auto" | "chat" | "responses"`。

因此本次不新增泛化字段：

```ts
protocol: "openai-compatible" | "anthropic-compatible" | ...
```

这个字段目前既不是现有合同，也会把未来协议抽象提前固化。运行时如果需要协议判断，应继续使用 template 上的 `apiProtocol` / `wireApi` 等字段，而不是写入 provider instance。

### Provider Instance

用户在配置文件中拥有的真实 provider 实例。它存储在 `config.providers[providerId]`。

Instance 可以有可选 `providerType` 字段。它只用于展示身份、图标查找和从模板初始化后的来源标识，不是运行时协议开关，也不是 template 引用。

`providerId` 是用户实际 provider 的身份，也是 chat/model picker 中模型值斜杠前缀的来源。例如：

```ts
providers: {
  "openai-work": { providerType: "openai", models: ["openai-work/gpt-5.4"] },
  "openai-personal": { providerType: "openai", models: ["openai-personal/gpt-5.4"] }
}
```

这里 `openai-work` / `openai-personal` 是两个不同 instance；`openai` 只是它们共同的 provider type。运行时路由必须命中具体 instance，不能只按 provider type 路由。

旧配置天然符合新规范：

```json
{
  "providers": {
    "openai": {
      "enabled": true,
      "apiKey": "sk-...",
      "apiBase": null,
      "models": ["openai/gpt-5.4"]
    }
  }
}
```

在新规范下：

- `providerId = "openai"`
- 如果 instance 没有显式 `providerType`，且存在同名 provider type，则 view 层推断 `providerType = "openai"`。
- 如果没有显式 `providerType` 且 key 也匹配不到 provider type，则这是 custom instance。
- 如果多个 instance 显式声明同一个 `providerType`，它们都是合法 instance，差异由各自的 `providerId`、API key、API base、models 等用户配置决定。

## 核心合同

### 数据归属

- Template 是系统事实，属于版本内置模板列表。
- Instance 是用户事实，属于 `config.providers`。
- Provider 虽然持久化在 config 文件里，但产品和 API 上应作为独立资源暴露，不长期挂在 `/api/config/providers` 下面。
- Template 不直接写入用户配置。
- Instance 不自动跟随 template 改动。
- `providerId` 是 instance 的稳定身份，等于 `config.providers` 的 key。第一阶段不提供编辑 `providerId` 功能；需要改名时通过创建新 provider、迁移配置、删除旧 provider 完成。
- `providerType` 是 instance 的展示类型和模板来源，不是 instance 身份。

### 模型列表语义

Provider instance 的 `models` 是该 instance 的完整可用模型列表。

规则：

- `models: []` 表示用户 instance 没有可用模型。
- 缺少 instance 时，不存在 `models` 语义，UI 应展示 template，并允许从 template 创建 instance。
- 从 template 创建 instance 时，初始 `models` 拷贝 template 的 `defaultModels`。
- 后续 template 新增默认模型，不自动加入已有 instance。
- 用户想拿新版默认模型，应通过显式动作，例如“Reset from template”或“Add template defaults”，后续再实现。

因此必须删除当前错误逻辑：

```ts
savedModels.length === 0 ? defaultModels : savedModels
```

### 模型 route 合同

chat/model picker 使用的模型值必须精确指向 provider instance。

合同：

- 模型 route 形态为 `<providerId>/<providerModel>`。
- 斜杠前缀是 `providerId`，不是 `providerType`，也不是 template id。
- `config.providers[providerId].models` 存储 route 后的模型值，例如 `openai-work/gpt-5.4`。
- 从 template 创建 instance 时，需要把 template default model 重写成该 instance 的 `providerId` 前缀。
- 运行时收到模型 route 后，先解析出 `providerId`，命中具体 instance，再把 `providerId` 前缀剥掉，得到上游 provider 需要的模型名。
- template 的 `modelPrefix` / `litellmPrefix` / `stripModelPrefix` 只参与“route 模型名”和“上游 API 模型名”之间的转换，不参与选择哪个 provider instance。

例子：

```ts
template.defaultModels = ["openai/gpt-5.4"];

providers: {
  "openai-work": {
    providerType: "openai",
    models: ["openai-work/gpt-5.4"]
  }
}
```

用户选择 `openai-work/gpt-5.4` 时：

1. kernel 根据 `openai-work` 找到 `config.providers["openai-work"]`。
2. 通过该 instance 的 `providerType = "openai"` 找到 template。
3. 上游请求使用 template 规则转换后的模型名，例如 `gpt-5.4` 或 provider 要求的 prefixed form。

### API 语义

`/api/providers` 返回用户 instance：

```ts
type ProvidersView = {
  providers: Record<string, ProviderInstanceView>;
}
```

Provider templates 应由独立 provider 资源接口返回，不再依赖 `/api/config/meta.providers`。

```ts
type ProviderTemplatesView = {
  providerTemplates: ProviderTemplateView[];
}
```

旧 provider API 不是用户持久化数据，不做兼容桥。实现时迁移已知调用方到 provider resource endpoint，并删除旧 provider API surface。

## 配置结构

### Core schema

文件：

- `packages/nextclaw-core/src/features/config/configs/schema.ts`

新增可选字段：

```ts
export const ProviderConfigSchema = z.object({
  providerType: z.string().trim().min(1).optional(),
  enabled: z.boolean().default(true),
  displayName: z.string().trim().max(80).default(""),
  apiKey: z.string().default(""),
  apiBase: z.string().nullable().default(null),
  extraHeaders: z.record(z.string()).nullable().default(null),
  wireApi: z.enum(["auto", "chat", "responses"]).default("auto"),
  models: z.array(z.string().trim().min(1)).default([]),
  modelConfig: z.record(providerModelConfigSchema).default({})
});
```

旧配置不需要迁移，因为 `providerType` 是 optional。旧 instance 可以通过 `providerId` 推断展示身份。

不新增字段：

- `templateId`：template 只用于初始化，instance 不保存 template 引用。
- `logo`：UI 根据 `providerType` 查图标，不把图标写进用户配置。
- `protocol`：当前 runtime 已有 `apiProtocol` / `wireApi` 适配事实，不把泛化协议枚举写进 instance。

### Instance 展示类型推断规则

新增纯解析函数，建议放在 core 或 server shared 视实际依赖决定。它负责把旧配置和新配置统一解析成 instance 的展示身份，不负责运行时协议选择：

文件建议：

- `packages/nextclaw-core/src/features/config/configs/provider-instance-template-resolution.ts`
- 或 `packages/nextclaw-server/src/features/config/services/provider-instance-template-resolution.service.ts`

职责：

```ts
type ProviderTypeResolution = {
  providerId: string;
  providerType: string | null;
  template: ProviderTemplate | null;
  isCustom: boolean;
};

function resolveProviderTypeForInstance(params: {
  providerId: string;
  instance: ProviderConfig;
  templates: ProviderTemplate[];
}): ProviderTypeResolution;
```

规则：

1. 如果 `instance.providerType` 存在且能匹配 template，使用它。
2. 如果 `instance.providerType` 存在但匹配不到，保留该 `providerType` 用于展示扩展；template 为 null。
3. 如果没有 `providerType`，但 `providerId` 匹配 template id，推断 provider type。
4. 否则是 custom instance，`providerType = null`。

注意：这个解析结果只服务 UI 展示、默认值和创建流程。runtime 是否走 OpenAI-compatible 或 Anthropic Messages 不由 `providerType` 直接决定。

### 旧 config 兼容规则

历史配置里没有 `providerType` 字段。兼容逻辑必须在 provider instance 的边界做一次归一化，内部代码不要到处重复猜测。

规则：

1. 读取 `config.providers` 时，先拿到 map key 作为 `providerId`。
2. 如果 `provider.providerType` 有值，使用该值。
3. 如果 `provider.providerType` 缺失，并且 `providerId` 命中内置 template id，则推断 `providerType = providerId`。
4. 如果 `provider.providerType` 缺失，并且 `providerId` 不在内置 template id 范围内，则这是 custom provider instance，`providerType = null`。
5. 推断结果用于 view/runtime，不要求立刻写回 config。
6. 用户保存该 provider 时，可以把推断出的 `providerType` 写回，也可以继续保持旧 config 形态；实现前需要统一选择。我的推荐是第一阶段不做静默写回，避免升级后无交互改写用户配置。

## Server 设计

### 包职责分工

本次不是从零实现 provider 系统，而是把现有事实重新归位。

- `packages/nextclaw-core`
  - 拥有 `ProviderConfig` schema。
  - 提供 provider instance/template 解析纯函数。
  - 提供模型 route 解析和重写纯函数。
  - 不读取 UI meta，不负责文件 IO。
- `packages/nextclaw-runtime`
  - 继续提供内置 provider template 列表。当前代码名仍可以是 `ProviderSpec`。
  - template 上保留 `apiProtocol`、默认模型、默认 API base、默认 wireApi、modelConfig 等系统事实。
- `packages/nextclaw-server`
  - 拥有 provider resource API 的 view 合同。
  - 负责从 config instances 和 runtime templates 构建 server view。
  - 负责 create/update/delete provider instance，并保存配置。
- `packages/nextclaw-kernel`
  - 拥有运行时 provider client 的解析、缓存和调用。
  - 先按模型 route 的 `providerId` 找 instance，再通过 `providerType` 找 template。
  - 不管理 template 列表的 UI 展示，也不负责创建 provider instance。
- `packages/nextclaw-ui`
  - 拥有 Providers 页面、模板列表、instance 表单和 model picker 展示。
  - 不隐式创建 provider instance。
  - 不把 template 当成 instance 编辑。

### 当前问题

`server-config.store.ts` 同时负责：

- 加载配置。
- 构建 public config view。
- 构建 meta。
- 推断 custom provider。
- 创建/更新/删除 provider。
- provider connection test。

这导致 provider template/instance 边界很难清楚表达。

### 新 owner

新增一个小的 template/instance owner，避免继续把逻辑塞进 store。

建议文件：

```text
packages/nextclaw-server/src/features/config/services/provider-instance.service.ts
```

职责：

- 读取 template 列表。
- 从 config 构建 instance view。
- 从 template 构建 template view。
- 创建 provider instance。
- 判断 instance 是否有内置 provider type/custom。

建议 class：

```ts
export class ProviderInstanceService {
  listTemplates(config: Config): ProviderTemplateView[];
  listInstances(config: Config, uiHints: ConfigUiHints): Record<string, ProviderInstanceView>;
  getInstance(config: Config, providerId: string): ProviderConfig | null;
  createInstance(config: Config, request: ProviderCreateRequest): ProviderCreateResult;
  updateInstance(config: Config, providerId: string, patch: ProviderConfigUpdate): ProviderConfigView | null;
  deleteInstance(config: Config, providerId: string): boolean;
}
```

这个 class 不负责文件 IO，不直接 `loadConfig/saveConfig`。`server-config.store.ts` 仍负责 store 边界和保存。这样可以减少全局副作用，并方便测试。

### Server API 类型

文件：

- `packages/nextclaw-server/src/shared/types/server-api.types.ts`

建议新增/调整：

```ts
export type ProviderInstanceView = {
  id: string;
  providerType?: string | null;
  providerTypeDisplayName?: string;
  isBuiltInType: boolean;
  isCustom: boolean;
  enabled: boolean;
  displayName?: string;
  apiKeySet: boolean;
  apiKeyMasked?: string;
  apiBase?: string | null;
  extraHeaders?: Record<string, string> | null;
  wireApi?: "auto" | "chat" | "responses" | null;
  models?: string[];
  modelConfig?: Record<string, ModelConfigView>;
  modelPrefix?: string;
  supportsWireApi?: boolean;
};

export type ProviderTemplateView = {
  id: string;
  displayName?: string;
  providerType: string;
  apiProtocol?: "openai-compatible" | "anthropic-messages";
  modelPrefix?: string;
  keywords: string[];
  envKey: string;
  isGateway?: boolean;
  isLocal?: boolean;
  defaultApiBase?: string;
  apiBaseHelp?: LocalizedText;
  auth?: ProviderAuthView;
  defaultModels?: string[];
  modelConfig?: Record<string, ModelConfigView>;
  supportsWireApi?: boolean;
  wireApiOptions?: WireApiType[];
  defaultWireApi?: WireApiType;
};

export type ConfigMetaView = {
  providerTemplates: ProviderTemplateView[];
  search: SearchProviderSpecView[];
  channels: ChannelSpecView[];
};

export type ProviderCreateRequest = {
  providerType?: string | null;
  providerId?: string | null;
  displayName?: string | null;
  enabled?: boolean;
  apiKey?: string | null;
  apiBase?: string | null;
  extraHeaders?: Record<string, string> | null;
  wireApi?: WireApiType | null;
  models?: string[] | null;
  modelConfig?: Record<string, ModelConfigUpdate> | null;
};
```

`ProviderConfigView` 可以重命名为 `ProviderInstanceView`。如果改名影响面过大，第一阶段可以保留 type alias：

```ts
export type ProviderConfigView = ProviderInstanceView;
```

但代码内部应逐步使用 `ProviderInstanceView`。

注意：`ProviderTemplateView` 可以包含 `apiProtocol`，因为这是 template 的稳定运行协议字段；但 UI 第一阶段不展示、不编辑它。内部 template 的 headers、model override 等更底层运行字段仍可不透出，除非 UI 或 API 消费者有明确需求。

### Server endpoint 合同

Provider 是独立实体，推荐使用独立 resource endpoint。config 只是持久化位置，不应该决定 URL 归属。

```text
GET    /api/providers
GET    /api/provider-templates
POST   /api/providers
PUT    /api/providers/:providerId
DELETE /api/providers/:providerId
```

语义：

- `GET /api/providers` 返回用户 provider instances。
- `GET /api/provider-templates` 返回系统 provider templates。
- `POST /api/providers` 创建 instance。可从 `providerType` 初始化，也可创建 custom instance。
- `PUT /api/providers/:providerId` 只更新已存在 instance，不隐式 materialize template。
- `DELETE /api/providers/:providerId` 删除任意 instance，包括从内置 template 创建的 instance。

旧 API：

- 删除旧 `/api/config/meta.providers` provider template 暴露。
- 删除旧 `/api/config/providers*` provider mutation endpoint。
- 更新已知 UI/hooks/tests 调用方到新 `/api/providers` 和 `/api/provider-templates`。
- 不做旧 route -> 新 owner 的转发桥；API route 是代码，不是需要迁移的用户数据。

错误语义：

- `404`：更新、删除、auth 操作的 `providerId` 不存在。
- `409`：创建时指定的 `providerId` 已存在。
- `400`：`providerId`、`providerType`、models、headers 等请求字段非法。
- `providerId` 不在 update patch 中出现，避免把改名伪装成普通更新。
- 旧 provider route 被请求时应返回 404，或根本不注册该 route。

### 创建 instance

当前：

- `POST /api/config/providers` 只创建 custom provider。

目标：

- `POST /api/providers` 创建 provider instance。
- request 带 `providerType` 时，从对应内置模板初始化。
- request 不带 `providerType` 时，创建 custom instance。

创建规则：

1. `providerType` 为空：生成 `custom-<n>`。
2. `providerType` 非空：
   - 如果 `providerId` 提供，校验不重复。
   - 如果未提供，优先使用 `providerType`。
   - 如果 `providerType` 对应的默认 `providerId` 已存在，生成 `<providerType>-<n>` 或让用户输入 `providerId`。
   - 同一 `providerType` 可以创建多个 instance，不能因为 type 相同而拒绝创建。
3. 从 template 创建时：
   - `providerType` 写入 instance。
   - `displayName` 默认空，view 使用 template displayName。
   - `apiBase` 默认 `null`，view/runtime 使用 template defaultApiBase。
   - `wireApi` 默认 template defaultWireApi。
   - `models` 拷贝 template defaultModels。
   - `modelConfig` 拷贝 template modelConfig。
4. 从 custom 创建时：
   - `displayName` 使用用户输入或 `Custom <n>`。
   - `models` 使用请求 models 或空数组。
   - `providerType` 默认为空，除非用户明确选择某个展示类型。

### 更新 instance

当前：

- `PUT /api/config/providers/:provider` 会 `ensureProviderConfig()`，内置 provider 不存在时会隐式从 spec 创建。

目标：

- 更新只能更新已存在 instance。
- 不再通过更新 template id 隐式创建 instance。
- 如果 instance 不存在，返回 404，并提示先从 template 创建。

要删除/替换：

- `ensureProviderConfig()` 在 update path 中不再使用。
- `updateProvider()` 重命名或语义改为 `updateProviderInstance()`。

### 删除 instance

当前：

- `deleteCustomProvider()` 只允许删除 custom provider。

目标：

- `DELETE /api/providers/:providerId` 删除任何 instance。
- 删除 instance 不影响 template。
- 删除时清理 `secrets.refs` 下 `providers.<providerId>.*`。

这满足用户“可以把一个 provider 删掉，然后以后从模板重新建”的预期。

### Provider auth

当前：

- `provider-auth.utils.ts` 的 `setProviderApiKey()` 在 provider 不存在时也会创建默认 provider config。

目标：

- OAuth/auth 操作面向 instance，不面向 template。
- 如果 instance 不存在，auth start/import 返回 404。
- UI 从 template 发起 OAuth 前，必须先创建 instance，再对 instance 执行 auth。

要改：

- `setProviderApiKey()` 不能再隐式创建 instance。
- `startProviderAuth/importProviderAuthFromCli` 应基于 instance 的 `providerType` 解析到对应内置能力；没有内置能力时按 custom instance 处理。

### Runtime routing

当前：

- `matchProvider()` 通过 model prefix 匹配当前代码里的 template name，再找 `providers[templateName]`。
- 这隐含了 `providerId` 必须等于内置 template name。
- `LiteLLMProvider` 默认走 OpenAI-compatible；当 template 的 `apiProtocol === "anthropic-messages"` 时走 Anthropic Messages。

第一阶段目标：

- 对旧配置继续可用：`providers.openai` 仍能被 `openai/gpt-5.4` 匹配，因为这里 `openai` 同时是旧 `providerId`。
- 对新配置按 instance 精确路由：`openai-work/gpt-5.4` 必须路由到 `providers["openai-work"]`，即使它的 `providerType` 是 `openai`。
- 不新增 instance 级 `protocol` 字段。
- 不把 `providerType` 设计成 runtime 协议开关。

目标策略：

1. model selection 的斜杠前缀是 `providerId`，不是 `providerType`。
2. kernel 首先按 `providerId/model` 精确命中 instance。
3. 命中 instance 后，再通过该 instance 的 `providerType` 找到 template，读取 `apiProtocol`、`wireApi` 默认值、model prefix、headers、model override 等系统字段。
4. 旧配置没有 `providerType` 时，如果 `providerId` 等于内置 template id，view/runtime 可以推断 `providerType = providerId`，保持旧模型值兼容。
5. 同一 `providerType` 多 instance 是合法目标行为；每个 instance 的模型列表应使用自己的 `providerId` 作为 route prefix。

这意味着 template 的 `modelPrefix` 不能替代 `providerId`。它只用于默认模型生成、兼容旧内置模型值、以及把发给上游 API 的模型名转换成 provider 需要的形态。

### Kernel 改造点

文件：

- `packages/nextclaw-kernel/src/managers/llm-provider.manager.ts`

当前 `resolveProvider()` 主要按内置 template name 查 `providers[spec.name]`。新合同下应改为：

1. 解析 model route，得到 `providerId` 和 `providerModel`。
2. 用 `providerId` 读取 `config.providers[providerId]`。
3. 如果 provider 不存在或 disabled，返回 missing provider。
4. 解析该 provider 的 `providerType`；旧配置没有 `providerType` 时，用 `providerId` 匹配内置 template。
5. 用 template 的 `apiProtocol`、defaultApiBase、modelConfig、headers、model override 等构建 runtime provider。
6. 上游请求使用转换后的 `providerModel`，而不是完整 route。

建议新增或复用 core 纯函数：

```ts
type ProviderModelRoute = {
  providerId: string | null;
  providerModel: string;
};

function parseProviderModelRoute(model: string): ProviderModelRoute;

function rewriteTemplateModelForProvider(params: {
  providerId: string;
  template: ProviderTemplate;
  templateModel: string;
}): string;
```

保留兼容：

- 旧 `openai/gpt-5.4` 仍可路由，因为 `openai` 是旧 `providerId`。
- 只有一个 enabled provider 且模型没有斜杠时，可以保留当前“唯一 provider fallback”，但它应作为兼容兜底，不应成为新模型选择路径。
- keyword/providerType 匹配不应覆盖明确的 `providerId/model` route。

## UI 设计

### 前端交付展示目标

Providers 页面是一个工作型配置界面，不做 landing/介绍页。交付重点是让用户一眼分清：

- 已经存在的 provider instances。
- 当前选中的 provider instance 配置详情。
- 新增 provider 时可以从哪些 provider templates 创建。
- 模型选择最终会路由到哪个 `providerId`。

页面继续采用现有 `ConfigSplitPage` 的左右分栏骨架：

- 左侧：单一 provider instances 列表、搜索、Add Provider 入口。
- 右侧：选中 provider instance 的配置详情。
- 移动端：列表和详情两级视图，进入详情后显示返回。

Templates 不作为主页面列表或 tab 常驻展示，只作为“新增 provider”时的选择来源。视觉风格保持设置页的密度和克制，不做营销式卡片堆叠。卡片只用于列表项和新增弹窗，右侧详情保持表单/分区布局。

### 页面结构

文件：

- `packages/nextclaw-ui/src/shared/components/config/providers-list.tsx`

当前页面：

- `Configured`
- `All Providers`

目标页面：

- 左侧只有一个 providers 列表，展示用户 provider instances。
- 左侧顶部有搜索和 `Add Provider` 按钮。
- 点击 provider instance 后，右侧显示该 provider 的配置详情。
- 点击 `Add Provider` 后，弹出 template/custom 选择器；选择一项后创建新的 provider instance。

隔离环境行为：

- providers 列表为空，显示“尚未添加 provider”。
- `Add Provider` 可打开选择器，里面展示内置 templates 和 custom provider 入口。
- 选择 template 后创建 instance，并跳转到该 instance 的编辑页。

旧用户行为：

- 旧 `config.providers.openai` 显示在 providers 列表。
- 如果 provider disabled，也仍显示在列表中，状态为 Disabled。
- 这能保证用户升级后找得到已有 provider。

### 左侧列表展示

左侧列表展示所有 provider instances，不按 ready 状态过滤。

每个 instance 行展示：

- provider type 图标。
- displayName，缺省时使用 template displayName 或 `providerId`。
- `providerId`，使用小号 monospace 展示。
- 状态：Ready / Setup / Disabled。
- 模型数量。
- API base 简短预览。
- More 操作按钮。

More 菜单：

- `Delete`。
- 删除所有 provider instance 都可用，包括 built-in type instance 和 custom instance。
- 点击 Delete 后打开二次确认弹窗，不直接删除。
- 确认文案应包含 provider displayName / `providerId`，避免误删。
- 确认成功后调用 `DELETE /api/providers/:providerId`。
- 删除当前选中 provider 后，右侧回到空状态或选中列表中下一个 provider。

排序建议：

1. Ready。
2. Setup。
3. Disabled。
4. 同状态内按 displayName/providerId 排序。

搜索匹配 displayName、providerId、providerType、template keywords。

### 右侧详情状态

右侧 pane 明确分两种主状态：

- 未选中：显示空状态。
- 选中 instance：显示 `ProviderInstanceForm`。

空状态：

- providers 为空时，引导用户点击 `Add Provider`。
- 搜索无结果时，只显示 no match，不自动创建 provider。

### 组件拆分

当前 `ProvidersList` 和 `ProviderForm` 都偏大。建议按语义拆：

```text
packages/nextclaw-ui/src/shared/components/config/
  providers-page.tsx                 // 页面装配
  provider-list.tsx                   // 左侧 provider instances 列表
  provider-add-menu.tsx               // Add Provider 选择器，popover/dialog
  provider-instance-form.tsx          // 编辑 instance，替代/收敛 ProviderForm
  provider-models-section.tsx         // 继续复用
  provider-form-support.ts            // 逐步减少，只保留表单纯支持函数
```

如果为了控制第一阶段 diff，可以先不改文件名，但至少在逻辑上分出：

- `instances`
- `templatesForAdd`
- `selectedProviderId`

### ProviderForm 行为

当前：

- `providerName` 可以是 template name。
- 没有 config 时用 `EMPTY_PROVIDER_CONFIG`。
- 保存时会调用 update，从而隐式创建内置 provider config。

目标：

- `ProviderInstanceForm` 只接收 `providerId`。
- 如果 instance 不存在，不渲染编辑表单。
- 表单模型列表只来自 instance `models`，不 fallback。
- template 的 `modelConfig` 只作为能力展示/默认说明，不覆盖 instance 的显式配置；如果已有实例由旧配置推断 template，view 层可以合并 template modelConfig 供 runtime/展示使用，但保存时仍只保存 instance 事实。

需要删除：

- `EMPTY_PROVIDER_CONFIG` 在 template 编辑路径中的使用。
- `resolveEditableModels(defaultModels, currentModels)` 的 default fallback。
- `serializeModelsForSave(models, defaultModels)` 中“等于默认就保存 []”的逻辑。

目标模型保存：

```ts
payload.models = models;
```

如果用户删空，保存 `[]`，刷新仍为空。

### 创建 provider 交互

`Add Provider` 是 templates 的主要展示入口。主页面不常驻展示 templates。

推荐第一阶段使用一个轻量选择器：

- 桌面端：点击 `Add Provider` 打开 popover / dropdown command menu。
- 移动端：打开 modal sheet / dialog。
- 如果后续 template 数量明显增加，再升级为更宽的 searchable modal 卡片墙。

触发入口：

- 左侧顶部 `Add Provider` 按钮。

选择器内容：

- Template entries：OpenAI、Anthropic、Qwen、Kimi、MiMo 等。
- Custom Provider entry。
- 搜索框，可按 displayName、providerType、keywords 匹配。

每个 template entry 展示：

- provider type 图标。
- template displayName。
- 默认模型数量。
- 默认 API base 简短预览。
- 已有同 providerType instance 数量，例如 `2 configured`。

点击 template entry 后：

- 第一阶段可以直接创建 provider instance。
- `providerId` 默认使用 providerType；如果已存在，自动生成 `<providerType>-<n>`。
- 创建成功后关闭选择器，选中新 provider，右侧打开 `ProviderInstanceForm`。

Custom Provider entry：

- 点击后创建 `custom-<n>` provider instance。
- 创建成功后关闭选择器，选中新 provider，右侧打开 `ProviderInstanceForm`。

后续增强可以把“点击即创建”升级成二级 confirm dialog，用于让用户编辑 `providerId` / displayName / 默认模型预览。但第一阶段不要为了这个阻断主流程。

冲突和错误：

- 自动生成的 `providerId` 应避免重复，不静默覆盖。
- `providerId` 非法时显示 inline error。
- 创建失败时保持选择器打开，并显示错误。

### Provider instance 表单展示

`ProviderInstanceForm` 头部展示：

- provider type 图标。
- displayName。
- `providerId`。
- 状态 badge。
- 删除按钮。所有 provider instance 都允许删除，不只 custom。

右侧删除按钮和左侧 More 菜单删除使用同一个 confirm dialog / mutation owner，不能实现两套删除逻辑。

表单区块：

- Enabled。
- API key / OAuth。
- API base。
- Models。
- Advanced：extra headers、wireApi、modelConfig 等。

模型编辑展示：

- 在 instance 表单内，用户编辑的是 provider 本地模型名。
- UI 用锁定前缀展示 route 合同，例如 `openai-work / gpt-5.4`。
- 用户新增 `gpt-5.4` 时，保存 payload 写入 `openai-work/gpt-5.4`。
- 用户粘贴完整 `openai-work/gpt-5.4` 时，UI 可归一化为同一个 route。
- 用户粘贴其他 providerId 前缀的模型时，提示不属于当前 provider。
- 删除全部模型后保存 `models: []`，刷新仍为空。

model picker 展示：

- 聊天模型选择里展示完整 route，例如 `openai-work/gpt-5.4`。
- 可以辅助显示 provider displayName 和 provider type 图标。
- 提交给 kernel 的值仍是完整 route。

wireApi 展示：

- 只在 OpenAI-compatible 且 template/custom 支持时展示。
- `apiProtocol = "anthropic-messages"` 的 template 不展示 wireApi 控件。
- `/api/provider-templates` 可以返回 `apiProtocol`，但普通用户界面第一阶段不展示这个字段。

### 图标和 provider type 展示

UI 不新增 `logo` 配置字段。

建议新增或复用纯映射：

```text
packages/nextclaw-ui/src/shared/lib/provider-icons/
  index.ts
```

职责：

- 输入 `providerType`。
- 返回 UI icon/image asset。
- 不读取 provider instance 配置。
- 不参与 runtime routing。

如果 template 当前仍有 `logo` 字段，可以作为迁移期资源名来源；但新 UI 合同应以 `providerType -> icon` 为主，不把 `logo` 透出给用户配置。

### Provider 表单复杂度治理

当前 `packages/nextclaw-ui/src/shared/components/config/provider-form.tsx` 已经是高复杂度文件：

- 组件同时承担 query 数据读取、template/config 合并、表单状态初始化、auth 轮询、models 编辑、modelConfig 编辑、保存 payload 构造、connection test、删除 provider。
- 多个 `useMemo/useEffect/useCallback` 互相依赖，业务状态迁移藏在渲染组件里。
- `EMPTY_PROVIDER_CONFIG` 和 `resolveEditableModels()` 这类 fallback 让 template/instance 语义继续混在 UI 组件内部。

本次实现不能只在这个文件里继续补条件分支。推荐拆成“页面/业务容器/纯展示/纯解析”四层。

#### 推荐文件拆分

```text
packages/nextclaw-ui/src/shared/components/config/
  providers-list.tsx                         // 保留页面入口，负责布局和选中态
  provider-list.tsx                          // 左侧 provider instances 列表
  provider-row-actions-menu.tsx              // 左侧 row More 菜单
  provider-delete-confirm-dialog.tsx         // 删除二次确认，左右入口复用
  provider-add-menu.tsx                      // Add Provider 选择器，桌面 popover / 移动 dialog
  provider-instance-form.tsx                 // instance 表单容器，替代 ProviderForm 主体
  provider-models-section.tsx                // 纯展示/轻交互，继续复用
  provider-auth-section.tsx                  // 已存在，继续保持展示组件定位
  provider-instance-form-support.ts          // 表单纯函数：draft/buildPayload/equality/normalize
```

如果第一阶段不想一次性重命名 `provider-form.tsx`，也必须先把内部 owner 切出来，避免文件继续膨胀。最低要求：

- `provider-form.tsx` 不再新增 template/instance 业务判断。
- 新增 `provider-instance-form-support.ts` 承担 draft 与 payload 纯转换。
- 新增 `provider-add-menu.tsx`，template 选择和 custom 创建入口不塞进列表项。
- 新增 `provider-delete-confirm-dialog.tsx`，左侧 row action 和右侧详情删除复用同一个确认弹窗。

#### 数据请求 owner

新增或调整 hooks：

```text
packages/nextclaw-ui/src/shared/hooks/use-providers.ts
```

建议 hook：

```ts
useProviders()
useProviderTemplates()
useCreateProvider()
useUpdateProvider()
useDeleteProvider()
useTestProviderConnection()
```

query key：

- `['providers']`
- `['provider-templates']`

mutation 成功后：

- create/update/delete provider invalidates `['providers']`。
- template list 通常不因 instance mutation 失效；如果 template view 内含 configured count，则 create/delete 也需要 invalidate `['provider-templates']`。
- 不再用 `['config']` / `['config-meta']` 作为 Providers 页面主刷新入口。

#### 表单状态 owner

不建议为这个局部页面立即引入 app-level presenter 或 Zustand。这里的状态主要是单表单局部 draft，不需要跨页面持久化。

但要把状态机从 TSX 主体里拿出来：

```text
packages/nextclaw-ui/src/shared/components/config/hooks/
  use-provider-instance-form-draft.ts
  use-provider-auth-session.ts
```

职责：

- `use-provider-instance-form-draft.ts`
  - 输入：`instanceView`、`templateView`、`uiHints`。
  - 输出：draft、dirty state、intent-level actions、`buildPatch()`。
  - 不执行网络请求。
  - 不读取全局 query。
- `use-provider-auth-session.ts`
  - 只负责 auth start/poll/import 的 UI 会话状态和 timer cleanup。
  - 网络 mutation 仍由容器传入或 hook 内部读取，但不能混进普通表单 draft。

`useEffect` 约束：

- 允许用于 auth timer cleanup。
- 允许用于切换 `providerId` 时重置本地 draft。
- 不允许用 effect 做业务 fallback、自动创建 instance、自动同步 template defaults。

页面选中态：

- `selectedProviderId` 第一阶段可用局部 state。
- 如果后续要求刷新恢复 Providers 页面位置，再引入小型 Zustand persist store。
- 不为了这次局部设置页强行引入 app-level presenter。

#### 纯函数 owner

新增纯函数模块：

```text
packages/nextclaw-ui/src/shared/lib/provider-template-instance/
  index.ts
```

职责：

- 解析 template/instance 关系。
- 构建模型选择 catalog。
- 合并 `template.modelConfig + instance.modelConfig`。
- 组合 provider model route prefix。route prefix 必须来自 `providerId`，不是 `providerType`。
- 从 template default model 生成 provider instance model route。
- 从 model route 解析 providerId/providerModel。

这里不保存状态，不调用 React，不调用 API。

表单支持函数只处理 draft：

```ts
type ProviderInstanceDraft = {
  enabled: boolean;
  displayName: string;
  apiKey: string;
  apiBase: string;
  extraHeaders: Record<string, string> | null;
  wireApi: WireApiType;
  models: string[];
  modelConfig: ModelConfig;
};

function createProviderInstanceDraft(input: {
  instance: ProviderInstanceView;
  template: ProviderTemplateView | null;
}): ProviderInstanceDraft;

function buildProviderInstancePatch(input: {
  draft: ProviderInstanceDraft;
  baseline: ProviderInstanceDraft;
  template: ProviderTemplateView | null;
}): ProviderConfigUpdate;
```

注意：`buildProviderInstancePatch()` 不得把 `models: []` 转成“省略字段”或 default fallback。用户删空必须保存为空数组。

#### 组件职责边界

- `ProvidersList`
  - 页面布局、搜索、选中态。
  - 不构造 provider 保存 payload。
  - 不合并 template/instance 模型事实。
- `ProviderList`
  - 只展示 instances。
  - 应显示所有已有 instance，包括 disabled/setup 状态，确保旧用户升级后能找到 provider。
  - 每行提供 More 菜单，删除入口在这里。
- `ProviderRowActionsMenu`
  - 只表达 row-level 操作。
  - 删除操作只打开确认弹窗，不直接调用 API。
- `ProviderDeleteConfirmDialog`
  - 接收 `providerId` 和展示名称。
  - 调用 delete mutation。
  - 成功后由页面 owner 更新选中态。
- `ProviderAddMenu`
  - 只展示 templates/custom 创建入口。
  - 点击 entry 后创建 provider instance。
  - 不编辑 API key/models，因为 template 不是用户配置。
- `ProviderInstanceForm`
  - 只编辑 existing instance。
  - 不允许接收 template id 并隐式创建 instance。
  - 通过 hook 管理 draft，通过 support 函数构造 patch。
- `ProviderModelsSection`
  - 继续作为纯展示/局部交互组件。
  - 不知道 defaultModels fallback 规则。

#### 正向减债要求

这次是非功能架构修复，不应只增加新文件。实现时要至少完成以下减债之一：

- 删除 `EMPTY_PROVIDER_CONFIG` 参与 template 编辑的路径。
- 删除 `resolveModelsWithDefaults()` 或把它改成不再服务 fallback。
- 删除 `updateProvider()` 隐式 materialize 内置 provider 的路径。
- 从 `provider-form.tsx` 中移走 auth session 或 draft/payload 逻辑，使该文件行数和 statement 数下降。

如果第一阶段为了风险控制保留部分大组件，也必须在迭代记录里说明剩余拆分缝，而不是把复杂度继续合理化。

## Model catalog 设计

文件：

- `packages/nextclaw-ui/src/shared/lib/provider-models/index.ts`

当前：

- `buildProviderModelCatalog()` 遍历 `meta.providers`，把 template 和 config 合并。

目标：

- 遍历 `config.providers` instances。
- 对每个 instance 解析 `providerType`，需要展示/默认能力时再找到对应 template。
- catalog item 表示 provider instance，不表示 template。

建议类型：

```ts
export type ProviderModelCatalogItem = {
  providerId: string;
  providerType?: string | null;
  displayName: string;
  routePrefix: string;
  aliases: string[];
  models: string[];
  modelConfig: Record<string, ModelConfig>;
  modelThinking: Record<string, ModelThinkingCapability>;
  configured: boolean;
};
```

规则：

- `models` 只来自 instance models。
- model picker 展示和提交的模型 route 必须带 `providerId` 前缀，例如 `openai-work/gpt-5.4`。
- `routePrefix = providerId`。
- `modelConfig` 可以是 `template.modelConfig + instance.modelConfig`，instance 后置覆盖。
- `onlyConfigured` 过滤 enabled + apiKeySet + models 非空。
- 不存在 instance 的 template 不进入 chat/model picker。
- `providerType` 只用于展示身份和查找默认能力，不作为模型路由协议。

这符合“模板不是用户 provider”的核心合同。

## 实施计划

### Phase 0：撤掉错误 fallback

目标：先止住已知 bug，不再让 `models: []` 复活默认模型。

改动：

- `provider-form-support.ts`
  - `resolveEditableModels(defaultModels, savedModels)` 改为只返回 `savedModels`。
  - `serializeModelsForSave(models, defaultModels)` 改为直接保存 normalized models。
- `provider-models/index.ts`
  - `buildProviderModelCatalog()` 先恢复只读 instance models，避免 chat picker 对空列表 provider 显示默认模型。

风险：

- 隔离环境 provider list 仍为空，这是符合新语义。
- Add Provider 选择器还未完成前，用户从 UI 看模板模型仍可能不清楚。因此 Phase 0 应尽快接 Phase 1。

验证：

- 用户删空模型、保存、刷新，仍为空。
- 新隔离环境 `/api/provider-templates` 仍有 templates。
- 不声称隔离环境 provider instance 有模型。

### Phase 1：server/view 建立 template/instance 合同

改动：

- core schema 增加 `providerType?: string`。
- 新增 provider type resolution helper。
- server types 增加 `ProviderTemplateView`、`ProviderInstanceView`。
- 新增 provider resource API 输出 templates 和 instances。
- `buildConfigView()` 保留 config view，不再作为 provider UI 主入口。
- instance view 包含推断出的 `providerType/isBuiltInType/isCustom/modelPrefix`。
- `createProvider()` 支持 `{ providerType }`，从 template 初始化 instance。
- `updateProvider()` 不再隐式创建 instance。
- `deleteProvider()` 允许删除任意 instance。

验证：

- 旧 config.providers.openai 出现在 instances。
- 空 config 的 instances 为空，templates 非空。
- 从 template 创建 instance 后 config.providers 出现新 instance，models 拷贝 template defaults。
- 删除 built-in type instance 后 templates 仍存在。

### Phase 2：前端 Providers 页面改造

改动：

- `ProvidersList` 拆分或重构为单一 provider instances 列表。
- 左侧列表读取 `/api/providers`。
- `Add Provider` 选择器读取 `/api/provider-templates`。
- 点击 instance -> `ProviderInstanceForm`。
- 点击 `Add Provider` -> 打开 template/custom 选择器。
- 选择 template/custom entry -> 创建 provider instance。
- model 编辑 UI 使用锁定 `providerId` 前缀 + 可编辑 provider model 后缀。
- 从 template 创建后选中新 instance。

验证：

- 隔离环境 providers 列表为空，`Add Provider` 选择器里有 18 个 template。
- 点击 NextClaw Built-in template entry 后直接创建 instance。
- 创建后 provider list 出现 NextClaw Built-in instance，模型来自 template defaults。
- 创建第二个同 providerType instance 时，生成不同 `providerId`，模型 route 前缀也不同。
- provider list 每行 More 菜单包含 Delete，点击后出现二次确认。
- 确认删除当前选中 provider 后，列表移除该 provider，右侧不再显示已删除详情。
- 在 instance form 添加 `gpt-5.4` 后，保存 payload 为 `<providerId>/gpt-5.4`。
- 已有旧 provider 在 provider list 中可见。

### Phase 3：auth/runtime 路径收敛

改动：

- provider auth 只对 instance 操作，不隐式创建。
- runtime resolution 先按 model route prefix 找到具体 instance，再通过 instance 的 `providerType` 找到对应 template。
- model picker / model catalog 使用 `providerId` 作为 route prefix，不使用 `providerType` 作为 route prefix。
- 不新增 instance 级 `protocol` 字段；Anthropic Messages / OpenAI-compatible 的选择继续来自 template 的 `apiProtocol`。
- `modelConfig` 合并使用 template + instance override，但 models 不 fallback。

验证：

- 旧 `openai/gpt-5.4` 能路由到 `providers.openai`。
- 新 `openai-work/gpt-5.4` 能路由到 `providers["openai-work"]`，即使 `providerType = "openai"`。
- 同一 `providerType` 下多个 enabled instance 不互相抢路由。
- disabled instance 不被路由。
- 没有 instance 时，template 不参与 runtime routing。
- OAuth 从 template 创建 instance 后再启动。

### Phase 4：可选同步模板能力

后续可以加：

- “Reset models from template”
- “Add new template defaults”
- “Compare with template”

这必须是显式动作，不应自动修改 instance。

## 测试计划

验证目标不是“单元测试通过”，而是证明四条主链路都成立：

- 旧 config 数据能被正确解释。
- provider API resource 能正确创建、更新、删除 instances，并返回 templates。
- kernel 能按 `providerId/model` 精确路由。
- UI 在隔离环境中能真实完成添加、编辑、删除和模型选择。

### Core

- `resolveProviderTypeForInstance`
  - explicit providerType。
  - inferred providerType from `providerId`。
  - custom instance。
  - unknown providerType。
- `parseProviderModelRoute`
  - `openai-work/gpt-5.4` -> providerId `openai-work`。
  - no-slash model -> providerId null。
  - empty prefix/model rejected or normalized by boundary owner。
- `rewriteTemplateModelForProvider`
  - template model `openai/gpt-5.4` + providerId `openai-work` -> `openai-work/gpt-5.4`。
  - template model without slash uses providerId prefix。

### Server

- `/api/provider-templates` 返回 provider templates。
- `/api/provider-templates` 返回 template `apiProtocol` 字段，但 UI 不展示。
- `/api/providers` 返回 provider instances。
- 旧配置 provider 被识别为 built-in type instance。
- 创建 built-in type instance 会复制默认模型。
- 创建同 providerType 第二个 instance 成功，且 models 使用新 `providerId` 前缀。
- 创建重复 providerId 返回 409。
- 更新不存在 instance 返回 404。
- 删除 built-in type instance 成功且 templates 保留。
- auth 对不存在 instance 返回 404。
- 旧 `/api/config/meta.providers` 不再作为 provider template 主入口；应断言旧字段不存在或旧 route 不再注册。
- 旧 `/api/config/providers*` mutation route 不保留转发桥；请求旧 route 应 404，或在 route 表中不存在。

### UI

- Providers 页面隔离环境显示 provider list 空。
- `Add Provider` 选择器显示 templates/custom entry。
- template entry 显示默认模型数量、API base、已有同 providerType instances 数量。
- provider row More 菜单显示 Delete。
- 删除确认弹窗显示 provider displayName / `providerId`。
- 从 template 创建 instance 后跳转到 instance form。
- 从同一 template 创建第二个 instance 时，生成不同 `providerId`，且 model route 前缀不同。
- Instance form 模型编辑显示锁定 `providerId` 前缀，保存时写完整 route。
- 粘贴其他 providerId 前缀的模型时提示不属于当前 provider。
- Instance form 删除全部模型保存后刷新仍为空。
- Chat/model picker 只显示 configured instances，不显示 templates。
- Chat/model picker 使用 `providerId` 前缀显示模型，不使用 `providerType` 前缀。

### Kernel

- 旧 `openai/gpt-5.4` 路由到 `providers.openai`。
- 新 `openai-work/gpt-5.4` 路由到 `providers["openai-work"]`。
- `openai-work` 和 `openai-personal` 同为 `providerType = "openai"` 时，各自模型不会串路由。
- provider disabled 时明确不路由。
- template `apiProtocol = "anthropic-messages"` 时创建 Anthropic Messages client。

### 冒烟

```bash
NEXTCLAW_HOME="$(mktemp -d -t nextclaw-provider-template.XXXXXX)" pnpm -C packages/nextclaw dev serve --ui-port 18994
```

手工/Browser E2E 验收：

1. 打开 `/providers`。
2. provider list 为空。
3. 点击 `Add Provider`，选择器显示内置 templates。
4. 选择 `NextClaw Built-in` template，创建 provider。
5. 创建后进入 instance 表单。
6. 删除所有模型并保存。
7. 刷新后该 instance 模型仍为空。
8. 删除该 instance 后，再次打开 `Add Provider` 仍能看到对应 template。

前端交付验收还需要：

- 用 Browser/Playwright 打开桌面 viewport，截图确认 provider list / add selector / detail 状态都可见且无重叠。
- 用移动 viewport 验证列表 -> 详情 -> 返回流程。
- 在隔离环境创建两个同 providerType instances，确认列表、表单、model picker 都显示不同 `providerId`。
- 用真实点击创建、保存、删除流程验证 query invalidation 后页面刷新正确。

### 端到端验证命令

实现完成后至少跑以下层级：

```bash
pnpm -C packages/nextclaw-core test
pnpm -C packages/nextclaw-server test
pnpm -C packages/nextclaw-kernel test
pnpm -C packages/nextclaw-ui test
pnpm -C packages/nextclaw-ui typecheck
```

如果 package 没有对应脚本，按仓库现有验证入口替换，但不能只跑单测。

还要增加一个隔离环境真实链路 smoke：

1. 用临时 `NEXTCLAW_HOME` 启动 server/UI。
2. 用 HTTP 请求验证 `/api/provider-templates`、`/api/providers`、create/update/delete。
3. 用 Browser/Playwright 点击 UI 完成 Add Provider、编辑模型、删除 provider。
4. 用同一个临时 home 读取最终配置，确认：
   - `config.providers` 里只有真实 instances。
   - 删除后的 provider 不存在。
   - `models: []` 保持为空。
   - 同 type 多 provider 的 models 使用各自 `providerId` 前缀。

负向验证：

- 旧 provider mutation route 不可用。
- template 不出现在 model picker。
- disabled provider 不参与 kernel route。
- `providerType` 不作为 model route prefix。

功能验证报告必须区分：

- 编译/类型验证。
- 单元/集成测试。
- API 冒烟。
- 浏览器 UI 冒烟。
- 剩余未验证项。

## 风险与取舍

### 风险 1：Provider API 从 config route 迁出影响外部客户端

Provider 从 `/api/config*` 迁到 `/api/providers` / `/api/provider-templates` 语义更清晰，但可能影响外部使用者。

本次按内部产品 API 改造处理，直接迁移已知调用方，不保留旧 route 迁移桥。若后续确认存在真实外部公共合同，应单独立项处理，而不是在本次实现里顺手加 alias/forwarding。

### 风险 2：旧配置中 `models: []` 的历史意图不可判断

不做猜测。新规范中它就是空模型列表。

这样可能让某些历史自动生成的空 models provider 继续为空，但这是唯一不会误伤用户显式清空意图的做法。UI 应通过 Add Provider 选择器和显式创建/重置动作给用户清晰恢复路径。

### 风险 3：把 provider type 误当成路由前缀

真正风险不是“同 provider type 多 instance”，而是把 `providerType` 当成 model route prefix。正确合同是：

- `providerType` 只表示模板/展示类型。
- `providerId` 才是具体 provider instance 的身份。
- chat/model picker 的斜杠前缀必须是 `providerId`。

只要路由前缀使用 `providerId`，同 provider type 多 instance 就没有歧义。

### 风险 4：改动面较大

分阶段推进：

- Phase 0 先撤错误 fallback。
- Phase 1/2 建语义和 UI。
- Phase 3 再收 runtime/auth。

每阶段都有可验证验收，不把所有变化塞进一次大爆炸。

## 推荐结论

推荐采用 Provider Template / Provider Instance 双层设计。

最重要的原则：

- `config.providers` 永远是用户 instance。
- `/api/provider-templates` 永远是系统 template view。
- `/api/providers` 永远是用户 provider instance view。
- `models: []` 永远是用户 instance 的空模型列表。
- template default models 只在创建 instance 或显式同步时进入用户配置。
- `providerType` 只负责展示身份、图标查找和初始化来源，不作为运行时协议开关。
- model route prefix 永远来自 `providerId`，不来自 `providerType`。
- 同一 `providerType` 可以有多个 provider instance。
- 旧配置不迁移、不猜测，通过 `providerId` 推断 provider type，让旧配置天然符合新规范。

这不是为了引入新抽象而抽象，而是把当前混在一起的事实 owner 拆开：系统拥有模板，用户拥有实例。
