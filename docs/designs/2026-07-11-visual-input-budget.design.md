# 视觉输入预算与上下文连续性方案

## 背景

用户反馈 native/NCP 会话在短对话里突然像新会话一样回复“没有上下文”。现场排查确认，这类问题不一定来自上下文压缩；即使没有触发 compaction，只要历史或当前轮输入里重新展开大体积图片 base64，本地预算估算就会和真实模型输入语义严重错位，最终导致正常对话历史被裁剪。

这份方案解决两个相邻问题：

- final 历史消息不能把已经观察过的图片二进制反复重放进后续模型输入。
- 当前轮视觉输入必须按视觉预算估算并在工具侧提前收敛，而不是按 base64 文本长度挤占上下文。

## 现状依据

- `view_image` 的工具结果会被 runtime 抽取为视觉观察消息，进入下一轮模型输入。
- 历史 final 工具结果如果重新展开 `data:image/...;base64`，同一张图片会在每轮后续请求里重复占用输入窗口。
- `InputBudgetPruner` 的职责是本地发送前预算，不是 provider 计费器；它需要估算“这块内容会占多少模型输入预算”，而不是机械统计 JSON/base64 字符数。
- 5MB base64 如果按普通文本估算，按当前 `4 chars/token` 约等于 131 万 tokens；但视觉输入不应作为文本 token 计入本地历史裁剪。

## 核心判断

视觉输入预算要同时处理两个维度：

- 传输体积：请求体不能因为图片原始 bytes 过大而失控。
- 模型输入预算：图片进入模型后按视觉输入处理，应使用有界视觉估算，而不是按 base64 文本估算。

因此修复不应该只在预算器里硬编码一个小数字，也不应该只在 `view_image` 里 resize。正确 owner 拆分是：

- `view_image` / 图片准备 owner 负责把默认高细节图片准备到可发送、可观察、可预算的范围内。
- `InputBudgetPruner` 负责识别视觉内容形态，并按同一套视觉预算函数估算。
- runtime 历史消息转换 owner 负责区分 final 历史摘要和当前轮视觉观察，避免历史二进制重放。

## 推荐方案

### 图片准备合同

默认 `detail: "high"` 使用三重上限：

- 长边最大 2048px。
- base64 payload 最大 5MB。
- 视觉 patch 最大 2500 个，patch 尺寸为 32px。

当原图超过任一上限时，图片准备流程先按尺寸和 patch 上限缩放，再依次尝试 PNG、WebP、JPEG 候选编码，直到找到满足 payload 与视觉预算上限的结果。工具返回 `sourceWidth/sourceHeight`、`width/height`、`patchCount`、`estimatedBudgetTokens`、`processedSizeBytes`、`resized`、`reencoded`，让后续排查能直接看到图片是否被处理过。

显式 `detail: "original"` 保留原始字节语义。它是用户明确要求精确原图时的逃生口，不作为默认路径；预算估算仍会使用更高但有界的 original 上限，避免当前轮预算失控。

### 预算估算合同

`InputBudgetPruner` 识别以下视觉输入形态：

- 裸 `data:image/...;base64,...` 字符串。
- OpenAI chat 风格 `{ type: "image_url", image_url: { url } }`。
- Responses 风格 `{ type: "input_image", image_url }` 或类似 `imageUrl` 字段。
- 工具结果内部 `{ type: "image", mimeType, data }`。

估算规则：

- 有 `width/height` 时，用 `ceil(width / 32) * ceil(height / 32)` 计算 patch 数。
- `high` 默认上限 2500 tokens，缺少尺寸时按该上限估算。
- `original` 上限 10000 tokens，缺少尺寸时按该上限估算。
- 极小图片也至少按 256 tokens 估算，避免把视觉输入估得过低。

这里的 token 是本地输入预算 token，不承诺等于任何 provider 的账单 token。它的目标是让历史裁剪和 compaction 触发判断稳定、保守、可解释。

## Owner 与数据流

数据流如下：

1. 模型调用 `view_image({ path, detail })`。
2. `@nextclaw/core` 的图片准备工具读取文件、嗅探格式、按 detail 准备 payload，并返回可观测元数据。
3. runtime 当前轮把工具结果里的图片提取为视觉观察，送入下一轮模型输入。
4. final 历史重放时只保留工具摘要和结构化元数据，不再重放历史图片二进制。
5. `InputBudgetPruner` 在发送前按视觉预算估算当前模型输入，只有真实超过预算时才裁剪历史。

## 目录组织

- `packages/nextclaw-core/src/features/agent/tools/image.tools.ts`
  负责 tool 参数、路径权限、文件读取、格式嗅探和工具返回合同。
- `packages/nextclaw-core/src/features/agent/utils/image-preparation.utils.ts`
  负责图片 decode、resize/re-encode、patch 计算和视觉预算估算。
- `packages/nextclaw-core/src/features/agent/services/input-budget-pruner.service.ts`
  负责发送前 input budget 估算、历史裁剪、tool protocol 修正。
- `packages/ncp-packages/nextclaw-ncp-agent-runtime*/`
  负责工具结果图片抽取、脱敏、当前轮视觉观察与 final 历史重放边界。

## 兼容与迁移

- 不改变 `view_image` 参数合同；`detail` 仍只接受 `high` / `original`。
- `high` 默认返回的 mime type 可能从 PNG/GIF/WebP 转成 WebP 或 JPEG，这是为了满足模型输入体积和预算上限；返回值会通过 `sourceMimeType` 与 `mimeType` 明确标注。
- `original` 继续保留原始字节，但仍受工具 `maxBytes` 文件读取上限保护。
- 预算估算只影响本地裁剪判断，不改变实际发送给 provider 的多模态内容形态。

## 风险与取舍

- 引入 `sharp` 增加 native 依赖，但它把图片 decode/resize/re-encode 放在成熟库上，比手写图片处理更可靠。
- 视觉 token 估算是本地预算策略，不是 provider 账单精确模型。选择 patch 上限是为了保护上下文连续性，而不是追求计费一致。
- 对缺少尺寸 metadata 的历史视觉输入使用上限估算，会比实际偏保守；这比低估导致历史被异常挤掉更可控。

## 非目标

- 不实现跨 provider 的精确视觉计费器。
- 不把所有历史图片永久保存在模型输入里；历史长期记忆应依赖工具摘要、文件路径和文本结论。
- 不改变用户上传附件的前端协议。

## 验收标准

- 大图片 `view_image` 默认 high 会被限制在 2048px、5MB base64、2500 patches 内，并返回预算元数据。
- 2.5MB 级别 image data URL 不再因为 raw base64 长度导致短会话历史被裁剪。
- 有尺寸 metadata 的视觉输入会按尺寸估算，缺尺寸时走高细节上限估算。
- final 历史视觉 payload 不会在后续请求中重放；当前轮视觉观察仍可进入模型输入。
- 定向测试、包级测试、TypeScript、lint、治理检查通过；无法用纯单测覆盖的真实链路要在迭代记录里保留复现和验证证据。
