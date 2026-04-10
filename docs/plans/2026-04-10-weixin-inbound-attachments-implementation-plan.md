# Weixin Inbound Attachments Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 NextClaw 的微信插件补齐“用户发送图片/文件给机器人时，消息会以统一托管资产能力进入运行时，并让原生 agent 也能真正读取非图片附件”的能力。

**Architecture:** 继续保留 `WeixinChannel` 作为单一入站入口，但不再让微信附件止步于 `InboundAttachment.path`。核心层只补三个最小扩展点：入站附件预处理、用户内容构建钩子、附加工具注入；具体的托管资产实现继续放在 `nextclaw` 包里，复用现有 NCP `LocalAssetStore` 与资产语义。这样微信、插件 runtime 直连附件、未来其它渠道都能走同一条“附件 -> assetUri -> asset_export/asset_stat -> 普通文件路径”的通用链路。

**Tech Stack:** TypeScript, Node.js 22, NextClaw core/native agent loop, NCP LocalAssetStore, Weixin channel plugin runtime, `fetch`, `crypto`, `fs`, `vitest`

---

## 长期目标对齐 / 可维护性推进

- 这次不是给微信单独发明“读 markdown”特判，而是补齐原生 agent 对托管资产的通用能力，让微信附件与前端上传附件尽量收敛到同一语义。
- 优先删除“非图片附件进入运行时但模型仍读不到”的结构性缺口，而不是继续在微信插件内堆特殊分支。
- core 只增加必要接缝，不直接依赖 NCP runtime；托管资产的具体实现、工具和格式转换继续收敛在 `nextclaw` 包，避免跨包反向耦合。

## 范围与边界

- 本次必须完成：
  - 微信入站 `image` / `file` 消息识别
  - 媒体下载与本地落盘
  - `InboundAttachment[]` 注入到 `WeixinChannel.handleMessage`
  - 入站附件在原生 agent 进入 prompt 前完成托管资产化
  - 原生 agent 提供 `asset_export` / `asset_stat` 能力
  - 非图片附件在 prompt 中变为统一资产引用块，而不是只剩占位文本
  - “仅附件无文本”消息仍可进入运行时
  - 定向测试与最小充分验证
- 本次不做：
  - 微信出站媒体发送
  - `message` tool 媒体参数扩展
  - 语音/视频增强解析
  - 对宿主消息协议做大规模重构
  - 为 markdown/txt/pdf 分别写特判式读取逻辑

## Task 1: 文档化统一资产方案与边界

**Files:**
- Create: `docs/plans/2026-04-10-weixin-inbound-attachments-implementation-plan.md`
- Reference: `packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-channel.ts`
- Reference: `packages/nextclaw-core/src/agent/context.ts`
- Reference: `packages/nextclaw/src/cli/commands/ncp/nextclaw-ncp-message-bridge.ts`

**Step 1: 固定根因与目标**

- 当前微信插件已经能把文件落成 `InboundAttachment[]`，但原生 agent 只消费图片，多数文件仍读不到内容。
- 目标不是“微信特判读 markdown”，而是让原生 agent 获得与前端上传资产一致的托管资产能力。

**Step 2: 固定边界**

- 不改宿主 `message` tool。
- 不改 outbound 契约。
- 不让 `@nextclaw/core` 直接依赖 `@nextclaw/ncp-agent-runtime`。

## Task 2: 先写失败测试，覆盖“非图片附件可读”

**Files:**
- Modify: `packages/nextclaw-core/src/agent/tests/context.test.ts`
- Create: `packages/nextclaw/src/cli/commands/agent/native-managed-asset-support.test.ts`
- Modify: `packages/extensions/nextclaw-channel-plugin-weixin/src/tests/weixin-channel-attachments.test.ts`

**Step 1: 写“原生上下文支持自定义附件内容构建”失败测试**

- 构造一个含非图片附件的上下文构建场景。
- 断言自定义 builder 能把附件渲染成资产引用文本，而不是被默认忽略。

**Step 2: 写“本地路径附件会被托管资产化”失败测试**

- 给辅助模块一个本地 `.md` 文件路径。
- 断言返回 attachment 带 `assetUri`，且能通过 `asset_export` 导出成普通文件。

**Step 3: 写“微信 markdown 文件最终变成可读资产引用”失败测试**

- 构造微信 `.md` 文件消息。
- 断言最终进入原生 agent 的用户内容里包含 `[Asset: ...]`、`[Asset URI: ...]` 和 `asset_export` 指令，而不是只有 `[收到文件: ...]`。

**Step 4: 运行定向测试确认失败**

Run:

```bash
pnpm -C packages/nextclaw-core exec vitest run src/agent/tests/context.test.ts
pnpm -C packages/nextclaw exec vitest run src/cli/commands/agent/native-managed-asset-support.test.ts
pnpm -C packages/extensions/nextclaw-channel-plugin-weixin exec vitest run src/tests/weixin-channel-attachments.test.ts
```

Expected:

- 新增场景失败，现有图片链路测试仍通过。

## Task 3: 在 core 增加最小扩展接缝

**Files:**
- Modify: `packages/nextclaw-core/src/bus/events.ts`
- Modify: `packages/nextclaw-core/src/agent/context.ts`
- Modify: `packages/nextclaw-core/src/agent/loop.ts`
- Modify: `packages/nextclaw-core/src/engine/types.ts`

**Step 1: 扩展 `InboundAttachment`**

- 为 `InboundAttachment` 增加可选 `assetUri`。
- 保持现有字段兼容，不改变已有调用方。

**Step 2: 让 `ContextBuilder` 支持注入自定义用户内容构建器**

- 默认行为继续兼容现有图片处理。
- 若外部提供 builder，则由外部决定如何把 `attachments` 转成 prompt 内容。

**Step 3: 让 `AgentLoop` 支持入站附件预处理与附加工具**

- 在进入 prompt 前允许外部异步预处理 `attachments`。
- 允许注入额外 tool，但默认行为不变。

## Task 4: 在 `nextclaw` 侧接入托管资产能力

**Files:**
- Create: `packages/nextclaw/src/cli/commands/agent/native-managed-asset-support.ts`
- Modify: `packages/nextclaw/src/cli/commands/agent/agent-runtime-pool.ts`
- Modify: `packages/nextclaw/src/cli/runtime.ts`

**Step 1: 新建 native managed asset support 模块**

- 复用 `LocalAssetStore`。
- 提供：
  - `prepareInboundAttachmentsWithManagedAssets()`
  - `buildManagedAssetUserContent()`
  - 原生 `asset_export` / `asset_stat`（必要时补 `asset_put`）

**Step 2: 把本地附件路径转成 `assetUri`**

- 对入站 `attachment.path` 做最小必要资产化。
- 已有 `assetUri` 的附件不重复处理。
- `remote-only` 附件保留原样，不伪造成功状态。

**Step 3: 复用现有 NCP 文件内容语义**

- 把原生入站附件映射成 NCP `file` parts，再交给 `buildLegacyUserContent()`。
- 这样图片继续走多模态图片逻辑，非图片文件自动变成统一资产引用块。

**Step 4: 把 support 模块接到原生引擎入口**

- `GatewayAgentRuntimePool` 创建原生 engine 时注入：
  - 附件预处理
  - 用户内容构建
  - 原生资产工具
- CLI 直连 `new AgentLoop(...)` 也同步接入，避免服务态与 CLI 行为分叉。

## Task 5: 保持微信插件入口简单

**Files:**
- Modify: `packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-inbound-media.service.ts`
- Modify: `packages/extensions/nextclaw-channel-plugin-weixin/src/tests/weixin-channel-attachments.test.ts`

**Step 1: 补齐文件 MIME 识别**

- 至少支持 `.md`、`.txt`、`.json`、`.csv`、`.yaml`、`.yml` 与常见源码扩展。
- 让 markdown 等文本文件不要无谓退化成 `application/octet-stream`。

**Step 2: 不在微信插件里做文件读取逻辑**

- 插件只负责下载、解密、落盘、组装附件。
- 资产化与 prompt 转换全部留给原生 asset support。

## Task 6: 验证、守卫与维护性复核

**Files:**
- Modify: `docs/logs/v0.15.82-weixin-inbound-attachments/README.md`

**Step 1: 跑定向测试**

Run:

```bash
pnpm -C packages/nextclaw-core exec vitest run src/agent/tests/context.test.ts src/agent/tests/loop.tool-catalog.test.ts
pnpm -C packages/nextclaw exec vitest run src/cli/commands/agent/native-managed-asset-support.test.ts
pnpm -C packages/extensions/nextclaw-channel-plugin-weixin exec vitest run src/tests/weixin-channel-attachments.test.ts src/tests/weixin-channel.test.ts src/tests/index.test.ts src/tests/weixin-api.client.test.ts
pnpm -C packages/nextclaw exec vitest run src/cli/commands/agent/agent-runtime-pool.command.test.ts
pnpm -C packages/nextclaw-core tsc
pnpm -C packages/nextclaw tsc
pnpm -C packages/extensions/nextclaw-channel-plugin-weixin tsc
```

**Step 2: 跑维护性守卫**

Run:

```bash
pnpm lint:maintainability:guard
```

或最小路径：

```bash
node .agents/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/nextclaw-core/src/bus/events.ts packages/nextclaw-core/src/agent/context.ts packages/nextclaw-core/src/agent/loop.ts packages/nextclaw/src/cli/commands/agent/native-managed-asset-support.ts packages/nextclaw/src/cli/commands/agent/agent-runtime-pool.ts packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-inbound-media.service.ts packages/extensions/nextclaw-channel-plugin-weixin/src/tests/weixin-channel-attachments.test.ts docs/plans/2026-04-10-weixin-inbound-attachments-implementation-plan.md
```

**Step 3: 做独立维护性复核**

- 判断新增代码是否已经收敛到最佳最小必要。
- 记录总代码与非测试代码增减。

**Step 4: 迭代留痕**

- 这是同一问题域的续改，默认直接更新 `docs/logs/v0.15.82-weixin-inbound-attachments/README.md`。
