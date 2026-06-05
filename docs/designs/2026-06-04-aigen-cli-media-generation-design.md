# aigen 无状态媒体生成 CLI 方案设计

## 背景

NextClaw 需要逐步接入图片、视频、音频等多模态内容生产能力。直接在 NextClaw Kernel 中内置各厂商 provider runtime 可以获得最强控制力，但第一阶段会把 OpenAI、OpenRouter、Google、fal、MiniMax、ComfyUI、Replicate 等不同 SDK、鉴权、错误格式、输出文件处理和模型能力差异全部带进 Kernel，维护压力过早变大。

本设计选择一个更轻的切入点：把多模态生成能力先收敛成一个独立、无状态、可替换的 CLI 工具，暂名 **aigen**。NextClaw 不拥有厂商 provider 逻辑，只负责创建临时目录、调用 CLI、校验结构化输出、把结果文件导入 asset store，再通过 NCP file part 或 chat attachment 交付给用户。

这条路线符合 NextClaw 愿景中的“统一入口”和“能力编排”：NextClaw 不把所有生成能力硬塞进自身，而是成为调用、治理和交付这些能力的统一入口。

## 核心判断

**aigen 语义上是独立项目，不是 NextClaw 私有模块。**

第一阶段可以放在 NextClaw monorepo 中孵化，但必须按独立项目约束实现：

- CLI 名称、命令、JSON 输出不出现 NextClaw / NCP / session / assetUri 等产品内语义。
- CLI 不 import `@nextclaw/*` 包，不读取 NextClaw 配置。
- CLI 只关心 provider 调用、结果落盘、基础 metadata 和错误归一化。
- NextClaw adapter 负责把 CLI 结果转换成 NextClaw asset store / NCP file part。

## 目标

1. 第一版支持通过 CLI 无状态生成图片。
2. 标准字段语义优先对齐 OpenAI Images API；第一条可运行 provider 优先落地 OpenRouter，方便低成本验证。
3. 模型标识沿用 NextClaw 已形成的 `provider/model` 机制，形式为 `<provider-id>/<provider-local-model>`。
4. CLI 输出必须是稳定 JSON，便于 NextClaw、脚本、CI、其它 agent host 复用。
5. 结果必须落成本地文件，由调用方决定是否导入资产系统、上传、转发或删除。
6. CLI 不管理长期状态，不启动常驻服务，不要求 NextClaw 管理 provider runtime 生命周期。

## 非目标

- 第一版不在 NextClaw Kernel 内实现完整 provider registry。
- 第一版不做视频、音频、文档生成。
- 第一版不做图片编辑、mask、参考图、多轮工作流。
- 第一版不做复杂 provider fallback。
- 第一版不维护完整模型 catalog UI。
- 第一版不把 OpenClaw / Hermes / LiteLLM 任意一方协议作为 NextClaw 核心合同。

## 命名

CLI 概念名确定为 `aigen`，含义是 AI generation。它不绑定 NextClaw，也不只绑定 media。

命名分三层：

```text
workspace directory: packages/aigen
npm package name:   @nextclaw/aigen
binary name:        aigen
```

选择理由：

- `packages/aigen` 表达它是独立 CLI 工具，不是 NextClaw 私有 feature。
- `@nextclaw/aigen` 适合第一阶段在 NextClaw monorepo 内孵化，发布归属和供应链边界更清楚。
- `bin.aigen` 保持短命令和独立心智，用户与宿主都调用 `aigen ...`。

`package.json` 形态：

```json
{
  "name": "@nextclaw/aigen",
  "bin": {
    "aigen": "./dist/app/main.js"
  }
}
```

推荐命令形态：

```bash
aigen image \
  --model provider-a/model-id \
  --prompt "一只机械猫在月球工作台上修理咖啡机" \
  --size 1024x1024 \
  --n 1 \
  --quality high \
  --output-format png \
  --output-compression 100 \
  --output-dir "<caller-created-temp-dir>" \
  --output-name "img-20260604-153012-a8f3c9" \
  --json
```

未来扩展时保持同一主语：

```bash
aigen image edit ...
aigen video ...
aigen audio ...
aigen models list --kind image --json
aigen doctor --json
```

## 命令行表面

aigen 是命令行工具，第一设计对象必须是稳定、可记忆、可脚本化的命令表面。内部 protocol adapter、配置合并、响应解析都服务于这组命令。

CLI 出口层使用 `commander` 管理命令树、必填参数、option parser、help/version 和未知参数错误。aigen 不自研通用 CLI parser，也不在 controller 中继续分发 `command/action/flags`；controller 只接收 commander 已解析后的明确 options。

### 命令树

第一版命令表面分成两类：

- 资源命令：`providers`、`models`、`secrets`，按资源形态使用最自然的 CRUD 动词。
- 动作命令：`image`、`doctor`，分别表示执行生成与执行诊断。

```text
aigen
├── image
│   └── aigen image --model <provider/model> --prompt <text> --output-dir <dir> --output-name <name> --json
├── providers
│   ├── list
│   ├── get <provider-id>
│   ├── add <provider-id>
│   ├── update <provider-id>
│   └── remove <provider-id>
├── models
│   ├── list [--provider <provider-id>] [--kind image] [--remote]
│   ├── get <provider-id>/<provider-local-model>
│   ├── add <provider-id>/<provider-local-model>
│   ├── update <provider-id>/<provider-local-model>
│   └── remove <provider-id>/<provider-local-model>
├── secrets
│   ├── list
│   ├── get <provider-id>
│   ├── set <provider-id> [--stdin]
│   └── remove <provider-id>
└── doctor
    └── aigen doctor [--provider <provider-id>] [--model <provider-id>/<provider-local-model>]
```

命名原则：

- 单个资源读取统一叫 `get`，不使用 `show`。
- 记录型资源创建叫 `add`，修改叫 `update`，例如 provider 和 model。
- 单值型资源写入叫 `set`，例如 secret；`set` 同时覆盖新增和更新语义。
- 远程模型列表仍然归入 `models list --remote`，不新增 `discover`。
- `remove` 是标准删除命令。

### 全局参数

所有子命令共享：

```bash
aigen <command> [args] \
  --json \
  --debug
```

语义：

- `--json`：显式声明机器调用。第一版 stdout 始终输出稳定 JSON，因此该参数是被接受的兼容标记，不改变输出格式。
- `--debug`：stderr 输出调试信息；不改变 stdout 的稳定 JSON 合同。

默认原则：

- 第一版优先服务宿主和脚本，所有业务命令默认输出 JSON。
- 机器调用建议加 `--json`，便于未来如果增加人类可读默认输出时仍保持合同稳定。
- 成功结果和可读信息走 stdout。
- 诊断日志、warning、debug 信息走 stderr。
- 命令退出码必须稳定：`0` 表示成功，非 `0` 表示失败。

### 生成命令

第一版只做图片生成：

```bash
aigen image \
  --model provider-a/model-id \
  --prompt "一只机械猫在月球工作台上修理咖啡机" \
  --size 1024x1024 \
  --n 1 \
  --quality high \
  --output-format png \
  --output-compression 100 \
  --output-dir "<caller-created-temp-dir>" \
  --output-name "img-20260604-153012-a8f3c9" \
  --json
```

参数：

- `--model <provider/model>`：必填，完整 provider route。
- `--prompt <text>`：必填，文本提示词。
- `--size <size>`：可选，例如 `1024x1024`。
- `--n <n>`：可选，对齐 OpenAI Images API，第一版默认 `1`，MVP 只保证 `1`。
- `--quality <value>`：可选，对齐 OpenAI Images API；provider 不支持时应报 `UNSUPPORTED_PARAMETER`。
- `--background <value>`：可选，对齐 OpenAI Images API；provider 不支持时应报 `UNSUPPORTED_PARAMETER`。
- `--output-format <value>`：可选，对齐 OpenAI Images API，例如 `png`、`jpeg`、`webp`。
- `--output-compression <0-100>`：可选，对齐 OpenAI Images API；通常只对 `jpeg`、`webp` 这类有损格式有效。
- `--moderation <value>`：可选，对齐 OpenAI Images API；provider 不支持时应报 `UNSUPPORTED_PARAMETER`。
- `--output-dir <path>`：必填，由调用方创建。
- `--output-name <name>`：必填，由调用方生成唯一 basename，不含路径分隔符。
- `--json`：NextClaw 调用时必填。

后续可加：

```bash
aigen image edit ...
aigen video ...
aigen audio ...
```

但第一版不为未来命令提前污染 `aigen image` 的参数。

### 标准请求格式

aigen v1 的图片生成标准请求格式明确对标 **OpenAI Images API 的字段语义**，而不是自造一套全新的图片协议，也不以 OpenRouter Chat/Responses 协议作为内部标准。

这里的“标准请求格式”不是模型 catalog，也不是默认 provider instance。它只定义 `aigen image` 这条命令向内部 provider runtime 传递的图片生成意图。

原因：

- `aigen image` 是无状态直接图片生成命令，语义最接近 OpenAI Images API 的 `/v1/images/generations`。
- OpenAI Images API 的 `model`、`prompt`、`size`、`n`、`quality`、`background`、`output_format`、`output_compression`、`moderation` 都是图片生成领域事实，不是聊天协议细节。
- OpenRouter、Gemini、fal、Replicate、ComfyUI 等并不共享一套图片生成协议，因此 aigen 需要 API format 对应的适配实现。
- 采用 OpenAI Images API 风格可以最大程度减少 aigen 自己发明的概念。

CLI 层标准请求字段：

```ts
type AigenImageStandardRequest = {
  model: string; // provider/model route, not provider-local model
  prompt: string;
  size?: string;
  n?: number;
  quality?: string;
  background?: string;
  output_format?: "png" | "jpeg" | "webp" | string;
  output_compression?: number;
  moderation?: string;
};
```

和 OpenAI Images API 的区别只有两点：

- `model` 使用 aigen 的完整 provider route，例如 `<provider-id>/<provider-local-model>`。
- aigen 额外通过 CLI 参数接收 `output-dir` 和 `output-name`，用于本地文件落盘；这不是 provider 请求字段。

路由层会把 CLI 请求解析成 provider runtime 请求：

```ts
type AigenProviderImageRequest = {
  providerLocalModel: string;
  prompt: string;
  size?: string;
  n: number;
  quality?: string;
  background?: string;
  outputFormat?: "png" | "jpeg" | "webp" | string;
  outputCompression?: number;
  moderation?: string;
};
```

这里 `providerLocalModel` 是上游厂商认识的模型 id。provider class 不负责解析完整 route，也不应该知道调用方传入的 route 前缀。

### provider runtime 合同

配置文件只声明 provider instance；真正执行请求的是由 `apiFormat` 选择出来的 provider runtime。

```ts
type AigenProviderConfig = {
  apiFormat: string;
  displayName?: string;
  apiBase: string;
  apiKeyRef: string;
  headers?: Record<string, string>;
  models: Record<string, AigenModelConfig>;
};

type AigenModelConfig = {
  kind: "image" | "video" | "audio";
  displayName?: string;
  capabilities?: AigenModelCapabilities;
};

type AigenModelCapabilities = {
  generate?: boolean;
  edit?: boolean;
  maxCount?: number;
  sizes?: string[];
  outputFormats?: string[];
  qualities?: string[];
  supportsTransparentBackground?: boolean;
};

type AigenProviderContext = {
  providerId: string;
  apiFormat: string;
  apiBase: string;
  apiKey: string;
  headers?: Record<string, string>;
};

type AigenProviderImageResult = {
  images: Array<{
    bytes: Uint8Array;
    mimeType: string;
    format?: string;
    width?: number;
    height?: number;
    revisedPrompt?: string;
  }>;
  usage?: Record<string, unknown>;
  upstreamRequestId?: string;
  metadata?: Record<string, unknown>;
};

interface AigenImageProvider {
  readonly apiFormat: string;

  generateImage(
    request: AigenProviderImageRequest,
    context: AigenProviderContext,
  ): Promise<AigenProviderImageResult>;
}
```

职责边界：

- route parser：把 `<provider-id>/<provider-local-model>` 拆成 provider id 和 provider-local model。
- config/secrets owner：根据 provider id 读取 `AigenProviderConfig`，再解析 `apiKeyRef` 得到真实 key。
- provider runtime：只负责上游协议适配，返回图片 bytes 和 metadata。
- file writer：统一负责写入 `output-dir`，provider runtime 不直接写文件。

### OpenAI API format 映射

`apiFormat: "openai"` 表示使用 OpenAI Images API 形态。provider runtime 把 `AigenProviderImageRequest` 映射成：

```http
POST {apiBase}/images/generations
Authorization: Bearer <api key>
Content-Type: application/json
```

请求 body：

```ts
type OpenAiImagesGenerationBody = {
  model: string;
  prompt: string;
  size?: string;
  n?: number;
  quality?: string;
  background?: string;
  output_format?: "png" | "jpeg" | "webp" | string;
  output_compression?: number;
  moderation?: string;
};
```

映射规则：

- `model` 取 `providerLocalModel`，不是完整 route。
- `outputFormat` 写成上游字段 `output_format`。
- `outputCompression` 写成上游字段 `output_compression`。
- 未传的可选字段不写入请求 body。
- 第一版不暴露 `response_format`；aigen 统一把上游返回内容落成本地文件。

响应解析规则：

- 优先读取 `data[].b64_json`，base64 decode 后得到图片 bytes。
- 如果上游返回 `data[].url`，可以作为兼容输入下载后落盘，但它不是 GPT Image 主路径，第一版可以标成可选能力。
- 响应中的 `usage`、`created`、`size`、`quality`、`background`、`output_format` 进入 provider result metadata，不直接决定本地文件名。

### OpenRouter API format 映射

`apiFormat: "openrouter"` 不表示 OpenAI Images API。它只是 aigen 内置的另一个 provider runtime。

第一版建议只支持 OpenRouter 直接图片输出模型，不把 Beta server tool 作为主路径。runtime 可映射成：

```http
POST {apiBase}/chat/completions
Authorization: Bearer <api key>
Content-Type: application/json
```

请求 body：

```ts
type OpenRouterImageGenerationBody = {
  model: string;
  messages: Array<{
    role: "user";
    content: string;
  }>;
  modalities: Array<"image" | "text">;
  stream: false;
  image_config?: {
    aspect_ratio?: string;
    image_size?: string;
  };
};
```

映射规则：

- `model` 取 `providerLocalModel`。
- `prompt` 转成单条 user message。
- `modalities` 第一版固定使用 `["image"]`，因为 `aigen image` 是确定性的图片生成命令；需要文本伴随输出时后续再显式扩展。
- OpenAI Images 风格字段中，不能确定能被 OpenRouter 当前模型支持的字段，必须由 runtime 明确映射；不能静默丢弃。无法映射时报 `UNSUPPORTED_PARAMETER`。

响应解析规则：

- 优先读取 `choices[].message.images[].image_url.url`。
- 若 URL 是 `data:image/<format>;base64,...`，解析 data URL 得到 bytes。
- 若 URL 是远程 URL，第一版可以下载后落盘，也可以先标成后续能力；无论哪种都必须在 provider runtime 合同中显式声明。

### provider 命令

provider 是第一层实体。必须先有 provider，才能在 provider 下新增 model。

```bash
aigen providers list --json
aigen providers get openrouter --json
aigen providers add company-openai \
  --api-format openai \
  --display-name "Company OpenAI Gateway" \
  --api-base https://ai.example.com/v1
aigen providers update company-openai \
  --display-name "Company OpenAI Gateway" \
  --api-base https://ai.example.com/v1
aigen providers remove company-openai
```

第一版 provider 支持 `list/get/add/update/remove`。provider 是记录型资源，新增和修改必须分开。

provider 命令只管理 provider instance，不直接管理 model。

`providers add` 在配置文件不存在时负责创建配置文件。这样外部调用者不需要先执行一个泛化的 `config init`。

`providers add` 默认写入 `apiKeyRef: "provider:<providerId>"`。第一版不要求调用方显式传 `--api-key-ref`；只有未来出现共享 secret 或迁移场景时，才考虑增加覆盖参数。

API key 不通过 `providers add/update` 写入。真实 key 由 `secrets set` 负责，避免一条命令同时改 provider 配置和 secret 文件。

### model 命令

model 是 provider 下的子项。命令参数可以使用完整 route，但写入配置时必须拆成 provider id + provider-local model id。

```bash
aigen models list --kind image --json
aigen models list --provider openrouter --kind image --json
aigen models list --provider openrouter --kind image --remote --json
aigen models get openrouter/vendor/model-id --json
aigen models add openrouter/vendor/model-id \
  --kind image \
  --display-name "Model ID" \
  --generate \
  --max-count 1
aigen models update openrouter/vendor/model-id \
  --display-name "Model ID" \
  --max-count 1
aigen models remove openrouter/vendor/model-id
```

第一版 model 支持 `list/get/add/update/remove`。model 是 provider 下的记录型资源，新增和修改必须分开。

硬规则：

- `models add` 必须先解析 provider id。
- provider 不存在时报 `PROVIDER_NOT_FOUND`。
- model 不能脱离 provider 存在。
- `models list` 输出完整 route，便于复制给 `aigen image --model`。
- `models list --remote` 只查询 provider 侧远程模型列表，不写入配置；第一版用于 OpenRouter `output_modalities=image` 发现。远程列表仍然属于 `list` 语义，不新增 `discover` 命令。
- `models add` 在目标配置文件不存在时不能单独创建 provider，只能在已有 provider 下写入 model。
- `models update` 只能修改已存在 model，不存在时报 `MODEL_NOT_FOUND`。
- model capability 中的 `maxCount` 表示该模型允许的最大生成张数；CLI 请求参数仍使用 OpenAI Images API 风格的 `--n`。

### 诊断命令

```bash
aigen doctor --json
aigen doctor --provider openrouter --json
aigen doctor --model openrouter/vendor/model-id --json
```

语义：

- 检查配置文件是否存在且合法。
- 检查 API format 是否可用。
- 检查 provider 需要的 `apiKeyRef` 是否存在。
- 检查 model route 是否能解析到 provider 和 provider-local model。
- 第一版不强制真实请求外部 API；真实连通性检查可后续加 `--probe`。
- `doctor` 承担配置校验职责；第一版不提供泛化的 `aigen config validate`。

### secrets 命令

secrets 命令只管理敏感值，不管理 provider 或 model。

```bash
aigen secrets set openrouter-work
aigen secrets set openrouter-work --stdin
aigen secrets get openrouter-work --json
aigen secrets list --json
aigen secrets remove openrouter-work
```

语义：

- `secrets set <providerId>`：交互式读取 API key，并写入或覆盖 `secrets.json` 中的对应值。
- `secrets set <providerId> --stdin`：从 stdin 读取 API key，适合 AI/脚本调用。
- `secrets get <providerId> --json`：读取单个 provider secret 的元信息，输出 `maskedValue`、`fingerprint` 和更新时间，不输出真实 `value`。
- `secrets list --json`：列出所有 secret 的元信息，包含 `maskedValue`、`fingerprint` 和更新时间，不输出真实 `value`。
- `secrets remove <providerId>`：删除对应 secret。

`secrets get` 输出示例：

```json
{
  "ok": true,
  "ref": "provider:company-openai",
  "exists": true,
  "kind": "apiKey",
  "maskedValue": "sk-...z789",
  "fingerprint": "sha256:8f3c9a12d4e5",
  "updatedAt": "2026-06-05T10:03:00.000Z"
}
```

`secrets list` 输出示例：

```json
{
  "secrets": [
    {
      "ref": "provider:company-openai",
      "kind": "apiKey",
      "exists": true,
      "maskedValue": "sk-...z789",
      "fingerprint": "sha256:8f3c9a12d4e5",
      "updatedAt": "2026-06-05T10:03:00.000Z"
    }
  ]
}
```

脱敏规则：

- 长度小于等于 8 的 secret 统一显示为 `********`。
- 长度大于 8 的 secret 显示为前三位、`...`、后四位，例如 `sk-...z789`。
- `fingerprint` 使用 `sha256:<前 12 位 hex>`，用于验证两次读取是否指向同一把 key。
- `maskedValue` 和 `fingerprint` 都可以进入 `get/list` 输出；真实 `value` 永远不能进入 CLI 输出、日志、debug 或错误信息。

默认 secret ref：

```text
provider:<providerId>
```

例如：

```text
aigen secrets set openrouter-work
  -> writes secret ref provider:openrouter-work
```

## provider/model 标识机制

模型标识采用稳定的 `provider/model` 形式，借鉴 NextClaw 现有模型路由心智。

### 规则

- 标准形式：`<provider>/<model>`。
- `provider` 是能力来源或路由来源，例如 `openai`、`openrouter`、`fal`、`google`。
- `model` 保留上游模型原始标识，可以继续包含 `/`。
- CLI 内部解析时只把第一个 `/` 之前的片段视为 provider，其余全部保留为 model id。

示例：

```text
provider-a/model-id
provider-b/vendor/model-id
provider-c/vendor/family/model-id
```

### provider route 与协议适配的关系

`provider/model` 是唯一对外模型路由标识。调用方不指定 `backend`、`wireApi`、`endpoint` 或其它协议适配细节。

aigen 内部根据 provider route 解析出 provider id，再由 provider 配置中的 API format 决定具体协议适配实现：

```text
provider-a/model-id
  -> provider id: provider-a
  -> API format: openai
  -> protocol adapter: OpenAI Images API
  -> upstream model: model-id

provider-b/vendor/model-id
  -> provider id: provider-b
  -> API format: openrouter
  -> protocol adapter: OpenRouter image generation
  -> upstream model: vendor/model-id
```

这和 NextClaw 当前大语言模型路由机制保持同一个心智：

- 用户选择的是完整模型 route。
- route 斜杠前缀命中 provider id。
- provider id 是用户/宿主可任意命名的实例标识，例如 `provider-a`、`openai-work`、`openrouter-cn`。
- API format 是 aigen 可识别的上游 API 格式，例如 `openai`、`openrouter`、`google`、`fal`。
- API format 决定使用哪个 protocol adapter。
- provider instance 自己知道 apiBase、apiKeyRef、extraHeaders 和上游模型名转换。
- 调用方不需要知道 OpenRouter 图片生成到底走 Chat Completions、Responses 还是 server tool。

因此，OpenRouter 图片生成“不等同于 OpenAI Images API”这个事实仍然存在，但它属于 protocol adapter 内部职责，不应暴露成调用参数。

### provider id、API format 与 protocol adapter

这三个概念必须分开：

```text
provider id
  用户可命名的 provider instance key，用于模型 route 前缀。

API format
  aigen 认识的上游 API 格式，用于选择内置 protocol adapter。

protocol adapter
  把 aigen 的 OpenAI Images-style 标准请求转换成厂商原生请求，并把厂商响应转换成本地文件结果。
```

配置文件中的字段名确定为 `apiFormat`，语义是 API format。它不是 provider id，也不是 model route 的前缀。

第一版 `apiFormat` 的值直接使用厂商或平台名，不提前写成 `openai-images` 这类细分实现名。在 `aigen image` 语境下，`apiFormat: "openai"` 默认表示 OpenAI Images API 形态；如果未来同一厂商确实需要同时支持多套不兼容格式，再引入细分值。

示例：

```json
{
  "providers": {
    "provider-b": {
      "apiFormat": "openrouter",
      "apiKeyRef": "provider:provider-b",
      "models": {
        "vendor/model-id": {
          "kind": "image"
        }
      }
    }
  }
}
```

这里：

```text
provider id: provider-b
API format: openrouter
protocol adapter: built-in openrouter adapter
model route: provider-b/vendor/model-id
provider-local model: vendor/model-id
```

第一阶段 API format 状态：

```text
openrouter  -> MVP 可运行 provider runtime
openai      -> 已定义字段语义与映射合同，runtime 后续实现
```

后续可增加：

```text
google      -> Gemini generateContent adapter
fal         -> fal queue adapter
replicate   -> Replicate predictions adapter
stability   -> Stability REST adapter
comfyui     -> ComfyUI workflow adapter
```

### provider 配置

aigen 应有且只有一个配置文件。生成命令不携带 provider 连接细节，也不直接新增模型；模型必须挂在某个 provider instance 下。

配置文件路径参考 NextClaw 的单配置文件心智：

```text
默认：
  ~/.aigen/config.json
  ~/.aigen/secrets.json

如果设置 AIGEN_HOME：
  $AIGEN_HOME/config.json
  $AIGEN_HOME/secrets.json
```

Windows 下 `~` 指当前用户 home，例如：

```text
%USERPROFILE%\.aigen\config.json
%USERPROFILE%\.aigen\secrets.json
```

规则：

- 不提供项目级 `.aigen/config.*`。
- 不做多层配置合并。
- 不提供 `--config <path>` 常规入口。
- `AIGEN_HOME` 只改变 aigen home 根目录，配置文件名仍固定为 `config.json`。
- provider instance 以 provider id 为 key。
- provider 下的 model 以 provider-local model id 为 key。
- 不存在 provider 时，不能单独 add model。
- 配置文件由 aigen 职责化命令读写；人可以查看，但不鼓励手工编辑。
- `config.json` 不保存真实 API key，只保存 `apiKeyRef`。
- `secrets.json` 保存真实 API key，由 secrets 命令读写。
- macOS/Linux 下 `secrets.json` 创建后设置为 `0600` 权限：只有当前用户可读写。
- Windows 下 `secrets.json` 使用当前用户 ACL：只允许当前用户读写。

内置 provider 可以约定默认配置：

```text
provider id: openai
API format: openai
api key ref: provider:openai
api base: https://api.openai.com/v1

provider id: openrouter
API format: openrouter
api key ref: provider:openrouter
api base: https://openrouter.ai/api/v1
```

未来支持自定义 provider instance 时，route 前缀指向 provider id，而不是 API format：

```text
provider-b/vendor/model-id
  -> provider id: provider-b
  -> API format: openrouter
  -> upstream model: vendor/model-id
```

这与 NextClaw 现有 provider instance 设计一致：用户选择的是 `providerId/providerModel`，运行时再通过 provider id 找到 API format、apiBase、apiKeyRef、协议适配和上游模型名。

### secrets 文件

第一版采用本地 secrets 文件，不接 OS keychain，也不要求用户配置系统环境变量。

文件位置：

```text
${AIGEN_HOME:-~/.aigen}/secrets.json
```

格式：

```json
{
  "version": 1,
  "secrets": {
    "provider:openrouter-work": {
      "kind": "apiKey",
      "value": "sk-..."
    }
  }
}
```

规则：

- `secrets.json` 是敏感文件，不进入普通配置展示。
- `secrets get/list --json` 可以输出 `maskedValue`、`fingerprint` 和更新时间，不能输出真实 `value`。
- `doctor --json` 只能输出 secret 是否存在，不能输出真实 key。
- 错误、debug、日志都不能打印真实 key。
- `apiKeyRef` 必须能解析到 `secrets.json` 中的 secret，否则请求失败并返回 `MISSING_API_KEY`。
- 第一版不支持直接从 `config.json` 读取 `apiKey` 明文字段。

### 配置文件格式

第一版只支持 **JSON**，文件名固定为 `config.json`。

原因：

- aigen 主要面向 AI、宿主程序和脚本调用，不是面向人长期手写配置。
- JSON 没有注释和隐式类型，确定性更强。
- JSON 更适合作为命令读写的镜像文件，避免 YAML 缩进、别名、隐式布尔值等人类友好但机器不够确定的行为。
- 所有 `--json` 输出和配置文件使用同一种数据形态，便于校验、diff、测试和迁移。

写入规则：

- 使用 2 spaces pretty JSON。
- 写入时保持稳定 key 顺序，减少无意义 diff。
- API key 不直接写入 `config.json`，只保存 `apiKeyRef`；真实 key 写入 `secrets.json`。
- 配置结构用 JSON Schema 校验。

### 配置文件 schema

第一版配置结构只需要 `version` 与 `providers`。

配置文件不内置默认 provider instance，也不内置默认模型。内置的是 `apiFormat -> provider runtime` 的实现集合；provider instance 和 model catalog 都由命令或宿主写入配置文件。

```json
{
  "version": 1,
  "providers": {
    "provider-a": {
      "apiFormat": "openai",
      "displayName": "Provider A",
      "apiKeyRef": "provider:provider-a",
      "apiBase": "https://api.openai.com/v1",
      "models": {
        "model-id": {
          "kind": "image",
          "displayName": "Model ID",
          "capabilities": {
            "generate": true,
            "edit": false,
            "maxCount": 1,
            "sizes": ["1024x1024"],
            "outputFormats": ["png", "jpeg", "webp"],
            "qualities": ["low", "medium", "high"]
          }
        }
      }
    },
    "provider-b": {
      "apiFormat": "openrouter",
      "displayName": "Provider B",
      "apiKeyRef": "provider:provider-b",
      "apiBase": "https://openrouter.ai/api/v1",
      "models": {
        "vendor/model-id": {
          "kind": "image",
          "capabilities": {
            "generate": true,
            "edit": false,
            "maxCount": 1
          }
        }
      }
    }
  }
}
```

这里有一个硬规则：

**配置文件里的 `models` 存 provider-local model id，不存完整 route。**

也就是说：

```json
{
  "providers": {
    "provider-b": {
      "models": {
        "vendor/model-id": {
          "kind": "image"
        }
      }
    }
  }
}
```

运行时展开为：

```text
provider-b/vendor/model-id
```

不写成：

```json
{
  "providers": {
    "provider-b": {
      "models": {
        "provider-b/vendor/model-id": {}
      }
    }
  }
}
```

原因是 provider id 已经在外层，重复写完整 route 会让 provider 改名、迁移和合并配置变复杂。

### 新增 provider

新增 provider 是新增 provider instance。它必须指定 `apiFormat`，`apiFormat` 决定使用哪一个 protocol adapter。

配置方式：

```json
{
  "providers": {
    "company-openai": {
      "apiFormat": "openai",
      "displayName": "Company OpenAI Gateway",
      "apiKeyRef": "provider:company-openai",
      "apiBase": "https://ai.example.com/v1",
      "models": {}
    }
  }
}
```

命令方式：

```bash
aigen providers add company-openai \
  --api-format openai \
  --display-name "Company OpenAI Gateway" \
  --api-base https://ai.example.com/v1
```

约束：

- provider id 必须唯一。
- provider id 用于完整模型 route 的第一段。
- provider id 不必等于 API format。
- `apiFormat` 必须命中内置或插件提供的 protocol adapter。
- 第一版 `providers add` 默认写入 `apiKeyRef: "provider:<providerId>"`。
- 第一版不把真实 API key 写入 `config.json`，避免 CLI 配置文件直接保存密钥。

### 新增 model

新增 model 必须发生在某个 provider 下。没有 provider，就不能 add model。

配置方式：

```json
{
  "providers": {
    "company-openai": {
      "models": {
        "model-id": {
          "kind": "image",
          "displayName": "Model ID",
          "capabilities": {
            "generate": true,
            "edit": false,
            "maxCount": 1
          }
        }
      }
    }
  }
}
```

命令方式：

```bash
aigen models add company-openai/model-id \
  --kind image \
  --display-name "Model ID" \
  --generate \
  --max-count 1
```

命令执行时的解析规则：

```text
company-openai/model-id
  -> provider id: company-openai
  -> provider-local model id: model-id
```

然后写入：

```json
{
  "providers": {
    "company-openai": {
      "models": {
        "model-id": {
          "kind": "image"
        }
      }
    }
  }
}
```

OpenRouter 这类上游模型 id 自身带 `/` 的场景也一样：

```bash
aigen models add openrouter/vendor/model-id --kind image
```

解析为：

```text
provider id: openrouter
provider-local model id: vendor/model-id
```

约束：

- `aigen models add <route>` 必须先解析 provider id。
- provider 不存在时报错 `PROVIDER_NOT_FOUND`。
- model 不允许脱离 provider 存在。
- model 的 capabilities 可以缺省，由 protocol adapter 补默认能力；但 `kind` 第一版必须显式或可由命令上下文推导。

### 查询与检查

建议第一版至少支持这些读命令：

```bash
aigen providers list --json
aigen providers get openrouter --json
aigen models list --kind image --json
aigen models list --provider openrouter --kind image --json
aigen models list --provider openrouter --kind image --remote --json
aigen doctor --json
```

`models list` 输出完整 route，便于直接复制到生成命令：

```json
{
  "models": [
    {
      "route": "provider-a/model-id",
      "provider": "provider-a",
      "apiFormat": "openai",
      "providerLocalModel": "model-id",
      "kind": "image"
    },
    {
      "route": "provider-b/vendor/model-id",
      "provider": "provider-b",
      "apiFormat": "openrouter",
      "providerLocalModel": "vendor/model-id",
      "kind": "image"
    }
  ]
}
```

## 包目录结构

第一阶段采用 minimal package 结构，不引入 `features/`。当前 package 只有一个主业务域：无状态生成 CLI。等图片、视频、音频形成多个稳定并列业务域后，再考虑引入 feature 层。

推荐结构：

```text
packages/aigen/
├── package.json
├── tsconfig.json
├── src/
│   ├── app/
│   │   ├── aigen-app.ts
│   │   ├── register-aigen-commands.ts
│   │   └── main.ts
│   ├── controllers/
│   │   ├── image.controller.ts
│   │   ├── providers.controller.ts
│   │   ├── models.controller.ts
│   │   ├── secrets.controller.ts
│   │   └── doctor.controller.ts
│   ├── managers/
│   │   ├── image-generation.manager.ts
│   │   ├── provider-runtime.manager.ts
│   │   └── output-file.manager.ts
│   ├── providers/
│   │   └── openrouter.provider.ts
│   ├── repositories/
│   │   ├── config.repository.ts
│   │   └── secrets.repository.ts
│   ├── types/
│   │   ├── config.types.ts
│   │   ├── image-generation.types.ts
│   │   ├── provider.types.ts
│   │   └── cli-output.types.ts
│   └── utils/
│       ├── route.utils.ts
│       ├── data-url.utils.ts
│       ├── mime.utils.ts
│       └── error.utils.ts
└── tests/
    ├── aigen-app.test.ts
    ├── openrouter.provider.test.ts
    ├── image-generation.manager.test.ts
    └── route.utils.test.ts
```

目录职责：

- `app/main.ts`：唯一 binary 入口，只负责启动 `AigenApp`，不承载业务逻辑。
- `app/aigen-app.ts`：应用装配 owner，负责创建 commander program、捕获输出、转换 commander 错误和装配 repositories/managers/providers/controllers。
- `app/register-aigen-commands.ts`：唯一 commander 命令树注册入口，负责命令、参数、help/version 近端合同，不承载 provider 业务逻辑。
- `controllers/`：CLI 子命令 handler，接收已解析的明确 options，负责命令编排入口，不直接访问外部 provider。
- `managers/`：业务流程 owner，负责生成链路、runtime 选择和输出落盘。
- `providers/`：上游 API format runtime，只做外部协议适配。
- `repositories/`：本地 `config.json` 与 `secrets.json` 的读写 owner。
- `types/`：跨模块共享类型，不包含可执行逻辑。
- `utils/`：纯解析、校验、转换函数，不拥有状态和生命周期。

第一版只实现 `openrouter.provider.ts`。`openai.provider.ts` 先不创建，避免空实现和未验证路径污染主链路。

## 核心抽象与代码组织

### 运行链路

`aigen image` 的主链路：

```text
CLI args
-> commander command tree
-> image.controller
-> image-generation.manager
-> route.utils parses <provider-id>/<provider-local-model>
-> config.repository resolves provider config
-> secrets.repository resolves apiKeyRef
-> provider-runtime.manager resolves apiFormat
-> openrouter.provider.generateImage()
-> output-file.manager writes files
-> stable JSON output
```

核心 owner：

- `ImageGenerationManager`：图片生成主流程 owner。它知道 route、config、secret、provider runtime 和 output writer 如何串联。
- `ProviderRuntimeManager`：`apiFormat -> provider runtime` 的唯一 registry。第一版只注册 `openrouter`。
- `OutputFileManager`：唯一落盘 owner，负责扩展名、防覆盖、path containment 和 metadata。
- `ConfigRepository`：唯一配置文件 owner，负责 `${AIGEN_HOME:-~/.aigen}/config.json`。
- `SecretsRepository`：唯一密钥文件 owner，负责 `${AIGEN_HOME:-~/.aigen}/secrets.json`、mask 和 fingerprint。
- `OpenRouterProvider`：OpenRouter API format runtime，只做 HTTP 请求和响应归一化。

### Controller 分工

```text
image.controller.ts
  image generate 命令入口，调用 ImageGenerationManager。

providers.controller.ts
  providers list/get/add/update/remove 命令入口，只管理 provider instance。

models.controller.ts
  models list/get/add/update/remove 命令入口。list 可加 --remote 查询远程模型，不写配置。

secrets.controller.ts
  secrets list/get/set/remove 命令入口，不输出真实 value。

doctor.controller.ts
  本地配置、secret、route、provider runtime 可用性诊断。
```

Controller 不直接 import `openrouter.provider.ts`。所有 provider 选择都必须经由 `ProviderRuntimeManager`，避免 CLI handler 与具体厂商耦合。

### OpenRouter-first 实现策略

第一版只要求 OpenRouter 跑通：

```bash
aigen providers add openrouter-work \
  --api-format openrouter \
  --display-name "Work OpenRouter" \
  --api-base https://openrouter.ai/api/v1

aigen secrets set openrouter-work --stdin

aigen models list \
  --provider openrouter-work \
  --kind image \
  --remote \
  --json

aigen models add openrouter-work/vendor/model-id \
  --kind image \
  --generate \
  --max-count 1

aigen image \
  --model openrouter-work/vendor/model-id \
  --prompt "A small robot repairing a coffee machine on the moon" \
  --output-dir "<caller-created-temp-dir>" \
  --output-name "img-20260604-153012-a8f3c9" \
  --json
```

`models list --provider <providerId> --kind image --remote --json` 的职责：

- 读取本地 provider config 和 secret。
- 确认 provider 的 `apiFormat` 支持远程模型列表。
- 对 OpenRouter 调用 Models API，并使用 `output_modalities=image` 过滤。
- 输出 provider-local model id、display name、pricing、input/output modalities 和原始 provider metadata。
- 不写入 `config.json`，避免把动态模型列表误当成本地选择。

OpenRouter 免费或低价模型属于动态 provider 数据。aigen 不内置具体免费模型，也不把价格写成稳定判断；调用方通过 `models list --remote` 当场查询。

### OpenRouterProvider 职责

`OpenRouterProvider` 第一版实现两个能力：

```ts
interface AigenRemoteModelListProvider {
  listRemoteModels(
    request: AigenRemoteModelListRequest,
    context: AigenProviderContext,
  ): Promise<AigenRemoteModelListResult>;
}
```

```ts
class OpenRouterProvider implements AigenImageProvider, AigenRemoteModelListProvider {
  readonly apiFormat = "openrouter";

  generateImage = async (
    request: AigenProviderImageRequest,
    context: AigenProviderContext,
  ): Promise<AigenProviderImageResult> => {
    // Maps to OpenRouter Chat Completions image generation.
  };

  listRemoteModels = async (
    request: AigenRemoteModelListRequest,
    context: AigenProviderContext,
  ): Promise<AigenRemoteModelListResult> => {
    // Calls /models?output_modalities=image.
  };
}
```

`generateImage` 的 OpenRouter 映射规则继续沿用前文 “OpenRouter API format 映射”。第一版不走 Beta server tool，不走 Responses，先走 Chat Completions direct image-output path。

### 类型组织

`provider.types.ts` 放 provider runtime 相关合同：

- `AigenProviderContext`
- `AigenImageProvider`
- `AigenRemoteModelListProvider`
- `AigenProviderImageRequest`
- `AigenProviderImageResult`
- `AigenRemoteModelListRequest`
- `AigenRemoteModelListResult`

`image-generation.types.ts` 放 CLI 到 manager 的生成输入输出：

- `AigenImageInput`
- `AigenImageSuccessOutput`
- `AigenImageFailureOutput`
- `AigenImageAsset`

`config.types.ts` 放配置镜像：

- `AigenConfig`
- `AigenProviderConfig`
- `AigenModelConfig`
- `AigenModelCapabilities`

`cli-output.types.ts` 放所有命令共享输出：

- `AigenCommandSuccess`
- `AigenCommandFailure`
- `AigenErrorCode`

原则：外部协议原始 response 类型不要扩散到 manager 或 controller。OpenRouter response shape 只留在 `openrouter.provider.ts` 内部，必要时用私有类型表达。

## CLI 合同

### 输入参数

第一版 `aigen image` 参数：

```ts
type AigenImageInput = {
  model: string;
  prompt: string;
  size?: string;
  n?: number;
  quality?: string;
  background?: string;
  outputFormat?: string;
  outputCompression?: number;
  moderation?: string;
  outputDir: string;
  outputName: string;
  json: true;
};
```

建议默认值：

- `n`: `1`
- provider 连接信息：只由 aigen provider config 解析，不作为生成命令参数。

### 输出文件命名

调用方负责创建本轮专属临时目录，并传入 `output-dir` 与唯一 `output-name`。

CLI 负责：

- 根据实际 mime type 决定扩展名。
- `n=1` 时输出 `<output-name>.<ext>`。
- `n>1` 时输出 `<output-name>-1.<ext>`、`<output-name>-2.<ext>`。
- 不覆盖已有文件。
- 不接受包含路径分隔符的 `output-name`。
- 返回的所有 `path` 必须位于 `output-dir` 内。

NextClaw 侧负责：

- 用跨平台 API 创建临时目录，例如 Node `fs.mkdtemp(path.join(os.tmpdir(), "nextclaw-aigen-"))`。
- 生成唯一 `output-name`，建议包含时间戳和短 request id。
- 校验 CLI 返回 path containment。
- 导入 asset store 后主动清理临时目录。

### JSON 成功输出

```json
{
  "ok": true,
  "kind": "image",
  "provider": "provider-a",
  "apiFormat": "openai",
  "model": "provider-a/model-id",
  "providerLocalModel": "model-id",
  "assets": [
    {
      "path": "/tmp/nextclaw-aigen-abc/img-20260604-153012-a8f3c9.png",
      "filename": "img-20260604-153012-a8f3c9.png",
      "mimeType": "image/png",
      "width": 1024,
      "height": 1024,
      "sizeBytes": 1234567
    }
  ],
  "usage": {
    "latencyMs": 12000,
    "costUsd": null
  },
  "metadata": {
    "revisedPrompt": null
  }
}
```

### JSON 失败输出

```json
{
  "ok": false,
  "kind": "image",
  "provider": "provider-b",
  "apiFormat": "openrouter",
  "model": "provider-b/vendor/model-id",
  "providerLocalModel": "vendor/model-id",
  "error": {
    "code": "PROVIDER_REQUEST_FAILED",
    "message": "OpenRouter image generation request failed.",
    "retryable": true
  }
}
```

错误信息要面向调用方可决策，而不是直接吐完整厂商 response。调试详情可以在 `--debug-json` 或 stderr 中输出，避免稳定合同过早绑定厂商错误结构。

## NextClaw 集成边界

NextClaw 不直接依赖厂商 provider，只依赖 `aigen` CLI 合同。

推荐链路：

```text
Agent Tool / Panel App / Workflow
  -> NextClaw image_generate adapter
  -> create temp dir + output name
  -> spawn aigen image --json
  -> parse JSON + validate files
  -> import files into Asset Store
  -> emit NCP file part / chat attachment
  -> cleanup temp dir
```

Kernel owner 只负责：

- 权限和风险控制。
- 进程调用、超时、取消。
- JSON schema 校验。
- 文件路径 containment 校验。
- 文件大小、mime、扩展名校验。
- asset 入库和交付。

aigen owner 只负责：

- provider API 调用。
- provider/model route 解析。
- 下载或解码图片。
- 写入 output-dir。
- 生成稳定 JSON。

## 候选实现方式

### 方案 A：NextClaw Kernel 内置 provider runtime

优点：

- 能力最可控。
- 可以深度接入权限、配置、UI、fallback。

缺点：

- 第一阶段过重。
- provider SDK 和协议变化会污染 Kernel。
- 与“无状态内容生产执行器”的边界不一致。

结论：长期可演进方向，不作为第一版。

### 方案 B：直接依赖 LiteLLM

优点：

- 成熟、流行，适合统一 AI gateway。
- retry、fallback、cost tracking 等能力强。

缺点：

- 更像 proxy server，不是一次性无状态图片生成 CLI。
- NextClaw 需要处理服务生命周期、端口、健康状态。

结论：可作为 aigen 的后续 protocol adapter，不作为第一版主合同。

### 方案 C：直接依赖 ai-cli / multi-model-image-gen

优点：

- 快速验证。
- 与“一个 CLI 统一多 provider”方向接近。

缺点：

- 直接绑定第三方命令、JSON、错误格式和模型命名。
- 未来替换成本高。

结论：可以参考或作为内部 protocol adapter，但 NextClaw 不直接依赖其协议。

### 方案 D：定义 aigen 合同，底层逐步适配 provider

优点：

- NextClaw 合同稳定。
- CLI 可独立开源或迁移。
- 初期只做 OpenRouter 可运行链路，范围轻、验证快。
- 后续可加 LiteLLM、fal、Google、ComfyUI、Replicate 等 protocol adapter。

缺点：

- 需要维护一个新 CLI 合同。
- 第一版能力不如 OpenClaw 完整。

结论：推荐。

## 第一阶段 MVP

1. 新建独立 CLI 包，binary 名称为 `aigen`。
2. 支持 `aigen image --json`。
3. 支持唯一配置文件 `${AIGEN_HOME:-~/.aigen}/config.json`。
4. 支持唯一密钥文件 `${AIGEN_HOME:-~/.aigen}/secrets.json`。
5. 不提供 `aigen config ...` 泛化命令；配置写入和读取通过职责化命令完成。
6. 支持 `aigen providers list/get/add/update/remove`。
7. 支持 `aigen models list/get/add/update/remove`。
8. 支持 `aigen secrets list/get/set/remove`。
9. 支持 `aigen doctor` 做本地配置、secrets、provider 和 model route 诊断。
10. 支持 provider instance 配置，第一条可运行 provider runtime 只实现 `openrouter` API format。
11. 支持 model 只挂在 provider 下，不能脱离 provider 独立存在。
12. 支持 `provider/model` 模型 route，运行时由 provider id 解析 provider instance，再得到 provider-local model id。
13. 支持 provider route 自动解析到 OpenRouter provider runtime。
14. 支持 OpenRouter `models list --remote`，通过 provider 远程模型列表发现 image output 模型。
15. 支持 `prompt`、`model`、`size`、`n=1`、`quality`、`output-format`、`output-compression`、`output-dir`、`output-name`。
16. 输出本地文件和稳定 JSON。
17. NextClaw 侧实现一个薄 adapter，调用 CLI 后导入 asset store。

## 后续演进

- `aigen models list --remote` 支持更多 provider 的远程模型列表。
- `aigen doctor --probe --json`：发起真实 provider 连通性探测。
- `aigen image edit`：支持参考图、mask、局部编辑。
- `aigen video` / `aigen audio`：扩展到其它媒体类型。
- 新增 `openai` provider runtime：按 OpenAI Images API 实现。
- 新增 `litellm` provider：通过 LiteLLM proxy 调用图片 endpoint。
- 新增 `fal` / `google` / `replicate` / `comfyui` provider。
- provider fallback：只在 CLI 合同稳定后加入。

## 待确认问题

1. OpenRouter 图片生成第一版是否需要同时支持 Responses；当前推荐先走 Chat Completions direct image-output path，不使用 Beta server tool。
2. NextClaw 配置中如何声明 aigen binary path。
3. 是否在 NextClaw UI 中提供一个最小模型输入框，还是先只通过 agent tool 参数指定。
4. 是否允许 provider runtime 通过插件扩展；第一版先只做内置 `openrouter` runtime。
