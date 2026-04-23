# Tool Result Content Items Design

## 背景

NCP native runtime 原先把工具结果当作 `unknown -> string` 处理，再塞进 `role: "tool"` message。这个模型对纯文本工具结果足够简单，但对截图、MCP image block、二进制数据和大 JSON 不成立：图片会退化成 base64 文本，既打爆上下文，也让视觉模型无法真正看图。

Codex 的核心做法不是“把图片文本截短”，而是把工具输出拆成内容项：文本按预算截断，图片作为图片项保留；模型不支持图片时才显式 strip。NextClaw 的长期愿景是个人操作层，工具结果可能来自浏览器、桌面、文件系统、云服务和插件生态，所以这里必须升级为通用协议能力，而不是针对某个截图工具写补丁。

## 目标

- 工具输出支持一等 `input_text` / `input_image` content item。
- MCP image block 能进入模型视觉输入，不再只留下摘要。
- UI `result` 保存有界摘要，避免百万字符 payload 作为普通文本污染 session；图片本体先以结构化 `input_image` 保留，后续再做 asset 化/压缩。
- runtime 主循环不包含工具名特判；工具结果治理由单一 owner 承担。
- provider 不支持视觉时有明确文本摘要，而不是静默塞 base64。

## 非目标

- 本次不实现完整图片压缩/转码流水线。Codex 的 2048 最大边、JPEG 85 策略是后续 image processing owner 的目标，本次先建立协议和链路。
- 本次不新增 provider capability registry。现有 user image 已直接进入多模态 message，本次沿用同一 provider 表达方式。
- 本次不重做 UI 工具卡片渲染，只保证事件和持久化里有结构化 content item 可用。

## 协议设计

新增 `NcpToolOutputContentItem`：

```ts
type NcpToolOutputContentItem =
  | { type: "input_text"; text: string }
  | {
      type: "input_image";
      imageUrl: string;
      mimeType?: string;
      detail?: "low" | "high" | "auto" | "original";
      originalDataChars?: number;
      dataOmitted?: boolean;
    };
```

工具调用结果同时保留两个面：

- `result`：UI/历史可展示的有界摘要，绝不包含完整 base64 图片。
- `resultContentItems`：模型可见的结构化内容项，图片以 `input_image` 表达；当前版本可携带 data URL，后续 image processing owner 会把它收敛为压缩后的 asset 引用或受控 data URL。

## Runtime 数据流

1. tool registry 返回 raw result。
2. `ToolResultContentManager` 归一化 raw result：
   - 文本生成 `input_text` 并按预算截断。
   - 委托 `ToolResultImageService` 识别 MCP `{ type: "image", mimeType, data }`、已有 `input_image/image_url` 和 data URL，生成 `input_image`。
   - UI `result` 只保留 `dataOmitted/originalDataChars/mimeType/detail` 摘要。
3. runtime 发 `MessageToolCallResult`，同时携带 `content` 和 `contentItems`。
4. `appendToolRoundToInput` 生成 OpenAI-compatible messages：
   - 标准 `role: "tool"` message 保留文本摘要，满足工具调用协议。
   - 如果存在图片 content item，追加一条 `role: "user"` 的 visual observation message，content 为 text + image_url parts，让 Chat Completions/Responses provider 能真的看到图。
5. 历史 context builder 从 `NcpToolInvocationPart.resultContentItems` 恢复同样的模型输入。

## Provider 映射

当前最小实现复用已有 user image 通道：

- Chat Completions：`role: "user"` + `image_url` content parts。
- Responses bridge：已有 `normalizeResponsesContent` 会把 `image_url/input_image` 转为 `input_image`。
- Text-only provider：会收到明确文本摘要；后续引入 provider capability 后，可在 manager 或 provider bridge 中 strip image 并记录原因。

这种方案不是最终形态里最精细的 Responses function output content items，但它是当前架构下的最小可用路径：不破坏 tool call ordering，又能让视觉模型真实看图。

## 可维护性取舍

- 一个对外 owner：`ToolResultContentManager` 负责工具结果归一化、文本预算和模型消息拼装；图片识别/摘要/`image_url` 映射下沉到 `ToolResultImageService`，纯序列化与截断放在 `tool-result-content.utils.ts`。
- 不新增工具名分支：所有 MCP image block、data URL、base64-like 字符串都按结构识别。
- 不新增异步 asset 依赖：runtime 目前工具执行是同步归一化路径；引入 asset store / image resize 会让主循环变成异步多阶段，先不做。
- 保留显式扩展缝：后续可把图片处理下沉到 `ToolResultImageProcessor`，但只有当需要真正 resize/转码时才拆。

## 验证策略

- 单元测试：大文本截断、MCP image block 生成 `input_image`、模型输入包含 visual observation、历史恢复保留图片。
- 包级验证：runtime test/tsc/build。
- 真实 AI 验证：构造一个带小 PNG data URL 的工具结果，让真实 provider 收到图片并回答图片内容特征，确认不是只读到文本摘要。本次已用 `custom-1/gpt-5.4` 验证：模型请求包含 `image_url` content part，工具文本摘要仅 473 chars，模型回答图片右侧方块颜色为 `green`。
