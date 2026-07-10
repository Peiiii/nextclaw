# view_image 工具方案

## 背景

用户上传或生成图片后，模型需要能在后续步骤中主动读取本地图片文件。当前用户附件已经能在消息构建阶段被转换为多模态 `image_url` 输入，但 agent 工具链缺少一个 Codex 风格的 `view_image` 工具来把本地 PNG/JPEG/WebP/GIF 作为视觉观察重新送入模型。

## 现状依据

- `@nextclaw/ncp-agent-runtime` 已有 `ToolResultContentManager`，能从工具结果中抽取 `input_image`，并在下一轮模型输入中追加 user visual observation message。
- `@nextclaw/ncp-agent-runtime-next` 执行工具后也复用同一个 `ToolResultContentManager`，因此只要工具结果被规范化为图片内容项，next runtime 和历史重放都能复用现有链路。
- `nextclaw-kernel` 的 `ToolProviderManager` 是工具注册 owner，`CoreToolProvider` 已根据 `restrictToWorkspace` 为本地文件工具注入 workspace 边界。

## 核心判断

`view_image` 应该是 agent-facing tool，而不是前端附件上传的第二条通道。它的职责是：读取已经存在于本地文件系统的图片文件，把图片 bytes 转成 data URL 内容项，并让现有 tool-result 图片管线负责模型可见传输与历史重放。

## 推荐方案

在 `@nextclaw/core` 的文件工具组新增 `ViewImageTool`：

- 参数：`path` 必填，`detail` 可选，仅支持 `high` 和 `original`。
- 路径：相对路径按当前 workspace 解析；`view_image` 不硬性限制只能读取 workspace。只有当现有 `tools.restrictToWorkspace` 配置开启时，真实文件路径才必须落在 workspace 内，避免绕过 `read_file` 等本地工具的同一安全边界。
- 文件：必须存在且是普通文件。
- 格式：通过文件头嗅探 PNG、JPEG、WebP、GIF；不靠扩展名猜测。
- 大小：默认最大 20 MiB，避免把超大图片直接塞进模型请求。
- 输出：返回结构化摘要和 `type: "image"` 内容块；runtime 负责把它提取成 `input_image`。
- 脱敏：工具结果文本和持久化 `result` 不保留 base64 图片数据，图片数据只进入 `contentItems`。

## Owner 与数据流

- 图片读取与参数合同 owner：`@nextclaw/core` 的 `features/agent/tools/image.tools.ts`，与 `ReadFileTool` / `ListDirTool` 同属 core agent tools。
- 工具注册 owner：`nextclaw-kernel` 的 `CoreToolProvider`。
- 视觉观察传输 owner：既有 `ToolResultContentManager`。

数据流：

1. 模型调用 `view_image({ path, detail })`。
2. `ViewImageTool` 读取文件并返回图片内容块。
3. `ToolResultContentManager` 将 base64 从文本结果中脱敏，同时生成 `contentItems: [{ type: "input_image", imageUrl }]`。
4. runtime 在下一轮模型输入中追加视觉观察 user message。

## 目录组织

- `packages/nextclaw-core/src/features/agent/tools/image.tools.ts`
  这是 agent-facing 本地图片文件工具，放在 core 既有 agent tools owner。
- `packages/ncp-packages/nextclaw-ncp-agent-runtime/src/tool-result/*`
  只负责工具结果的图片脱敏、`contentItems` 抽取与视觉观察消息生成。
- `packages/nextclaw-kernel/src/contributions/tool-provider/providers/core-tool.provider.ts`
  只做工具注册，不承载图片处理逻辑。

## 兼容与迁移

不新增旧字段 alias，不兼容 `file_path`、`image_path`、`low` 等非公开参数。坏参数应在 schema/validation 层显式失败，避免执行层悄悄修正模型输出。

workspace 边界不是 `view_image` 的硬限制，而是复用用户已经选择的工具安全策略：配置关闭时允许读取任意当前进程可访问的本地图片路径；配置开启时与其它本地文件工具一致限制在 workspace 内。

## 验收标准

- 单测覆盖成功读取、结果脱敏、视觉观察生成。
- 单测覆盖 missing file、directory、unsupported format、oversized file、workspace escape、invalid detail。
- kernel 工具提供测试确认 `view_image` 注册并继承 workspace 限制。
- runtime-next 集成测试确认工具结果图片会进入下一轮模型输入。
- 源码变更后运行相关 package 的 `test`、`tsc`、`lint` 和治理检查。

## 非目标

- 图片预算、resize/re-encode 和上下文连续性合同已在后续方案
  `docs/designs/2026-07-11-visual-input-budget.design.md` 中收敛到独立 owner；本文只保留
  `view_image` 工具入口、路径安全和工具结果传输边界。
- 本轮不改变用户上传附件的前端协议；附件上传仍走现有 `NcpMessagePart.file` -> `image_url` 消息构建链路。

## 后续实现顺序

1. 在 core 文件工具 owner 中新增 `ViewImageTool` 与工具导出。
2. 调整 tool-result 脱敏策略，确保图片结果即使未超过文本预算也不把 base64 留在 `result`。
3. 在 kernel `CoreToolProvider` 注册工具。
4. 补充单测和 runtime-next 集成验证。
