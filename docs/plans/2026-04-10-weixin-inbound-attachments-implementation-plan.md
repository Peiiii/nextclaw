# Weixin Inbound Attachments Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 NextClaw 的微信插件补齐“用户发送图片/文件给机器人时，消息会以标准附件进入运行时”的能力。

**Architecture:** 保持当前 `WeixinChannel` 作为单一入口，不引入新的宿主层抽象。插件内部补齐微信消息媒体结构建模、下载/解密/落盘，再把结果映射为 `InboundAttachment[]` 注入现有 `BaseChannel.handleMessage()`。文本链路保持兼容，媒体失败时退化为可读占位文本而不是整条消息丢失。

**Tech Stack:** TypeScript, Node.js 22, NextClaw channel plugin runtime, `fetch`, `crypto`, `fs`, `vitest`

---

## 长期目标对齐 / 可维护性推进

- 这次不是给微信单独发明一套附件协议，而是把它接回 NextClaw 已有的标准 `attachments` 链路，增强统一入口的一致体验。
- 优先删除“媒体只剩占位文本”的行为缺口，而不是先扩新的宿主抽象或通用插件协议。
- 若需要新增代码，尽量收敛在微信插件包内部的媒体解析与落盘层，避免把复杂度扩散到 core / compat / agent tool。

## 范围与边界

- 本次必须完成：
  - 微信入站 `image` / `file` 消息识别
  - 媒体下载与本地落盘
  - `InboundAttachment[]` 注入到 `WeixinChannel.handleMessage`
  - “仅附件无文本”消息仍可进入运行时
  - 定向测试与最小充分验证
- 本次不做：
  - 微信出站媒体发送
  - `message` tool 媒体参数扩展
  - 语音/视频增强解析
  - 新的跨插件统一媒体上传抽象

## Task 1: 文档化媒体链路与测试面

**Files:**
- Create: `docs/plans/2026-04-10-weixin-inbound-attachments-implementation-plan.md`
- Reference: `packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-channel.ts`
- Reference: `packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-api.client.ts`

**Step 1: 记录根因与目标**

- 当前微信插件只保留文本和占位文本，未透传媒体实体。
- 目标是让现有 `attachments` 机制直接接住微信图片/文件。

**Step 2: 固定边界**

- 不改宿主 `message` tool。
- 不改 outbound 契约。
- 不新建通用媒体基础设施。

## Task 2: 先写失败测试，覆盖微信媒体入站映射

**Files:**
- Create: `packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-channel.test.ts`
- Test: `packages/extensions/nextclaw-channel-plugin-weixin/src/index.test.ts`

**Step 1: 写“图片消息变成 attachment”失败测试**

- 构造含 `image_item.media.full_url` / `aes_key` 或兼容字段的入站消息。
- 断言最终发布的 `InboundMessage.attachments[0]` 含 `path`、`mimeType`、`status="ready"`。

**Step 2: 写“文件消息保留文件名与 MIME”失败测试**

- 构造含 `file_item.file_name` 与文件媒体字段的消息。
- 断言 attachment 的 `name` 与 MIME 被保留。

**Step 3: 写“仅附件无文本仍进入运行时”失败测试**

- 构造没有文本、只有图片或文件的消息。
- 断言消息没有被过滤掉，并带附件发布。

**Step 4: 运行定向测试确认失败**

Run:

```bash
pnpm -C packages/extensions/nextclaw-channel-plugin-weixin exec vitest run src/weixin-channel.test.ts src/index.test.ts
```

Expected:

- 新增场景失败，现有 hints 测试仍通过。

## Task 3: 最小实现微信媒体建模、下载与附件注入

**Files:**
- Modify: `packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-api.client.ts`
- Modify: `packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-channel.ts`
- Create: `packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-inbound-media.ts`

**Step 1: 扩展微信消息类型建模**

- 在 `weixin-api.client.ts` 补齐图片/文件媒体结构，至少覆盖：
  - `full_url`
  - `encrypt_query_param`
  - `aes_key`
  - `file_name`

**Step 2: 新建微信入站媒体解析模块**

- 提供“从 `WeixinMessageItem` 提取媒体描述”和“下载到本地文件”的最小能力。
- 先支持 `image` / `file`。
- 媒体下载失败时返回带 `errorCode` 的附件或回退为空附件，不抛出整条消息失败。

**Step 3: 在 `WeixinChannel` 中注入附件**

- 将 `handleInboundWeixinMessage()` 改为：
  - 先提取文本
  - 再解析附件
  - 只要“文本或附件”至少存在一个，就发布消息

**Step 4: 保持兼容占位文本**

- 对仅媒体消息，保留简短占位文本作为降级可读性，但不再依赖占位文本承载媒体语义本身。

## Task 4: 验证、守卫与维护性复核

**Files:**
- Modify: `docs/logs/<待定迭代目录>/README.md`

**Step 1: 跑定向测试**

Run:

```bash
pnpm -C packages/extensions/nextclaw-channel-plugin-weixin exec vitest run src/weixin-channel.test.ts src/index.test.ts
pnpm -C packages/extensions/nextclaw-channel-plugin-weixin tsc
```

**Step 2: 跑维护性守卫**

Run:

```bash
pnpm lint:maintainability:guard
```

或最小路径：

```bash
node .codex/skills/post-edit-maintainability-guard/scripts/check-maintainability.mjs --paths packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-api.client.ts packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-channel.ts packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-inbound-media.ts packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-channel.test.ts docs/plans/2026-04-10-weixin-inbound-attachments-implementation-plan.md
```

**Step 3: 做独立维护性复核**

- 判断新增代码是否已经收敛到最佳最小必要。
- 记录总代码与非测试代码增减。

**Step 4: 迭代留痕**

- 代码已触达，收尾时必须判定是否新建 `docs/logs` 迭代目录。
- 若需要新建，README 必须包含验证、验收、发布与可维护性总结。
