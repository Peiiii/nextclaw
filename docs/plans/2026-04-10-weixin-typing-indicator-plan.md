# Weixin Typing Indicator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a real Weixin "AI is typing" indicator during agent processing, using the iLink API with the smallest maintainable design that fits NextClaw's existing channel lifecycle.

**Architecture:** Reuse NextClaw's existing inbound -> agent loop -> outbound/control lifecycle instead of copying CoPaw's full channel-local orchestration. Keep protocol-specific complexity isolated to the Weixin plugin: extend the Weixin API client with `getconfig` / `sendtyping`, add one small plugin-local typing controller for ticket caching and keepalive/cancel, and wire it to existing typing-stop control messages from core.

**Tech Stack:** TypeScript, `@nextclaw/core` bus/control lifecycle, `@nextclaw/channel-plugin-weixin`, fetch-based Weixin iLink HTTP API.

---

## 长期目标对齐 / 可维护性推进

- 这次不追求“功能先上”，而是同时满足两个并行目标：
  - 微信输入中能力真实可用。
  - 代码更少、更清晰、更可维护，而不是多堆一个分支系统。
- 优先顺序：
  - 先复用现有 `typing stop control message` 机制。
  - 再补 Weixin 特有协议能力。
  - 避免为了单一渠道把通用 runtime 再拉出一层新框架。
- 本次默认不做的事：
  - 不把 CoPaw 的整套实现直接照搬进来。
  - 不顺手引入新的全局 channel framework。
  - 不先加 `showTyping` 之类的 UI/配置开关，除非实现后发现这是必要控制面。
- 本次最小维护性推进：
  - 让 Weixin 复用已有 core typing lifecycle，而不是另起一套“回复结束通知”机制。
  - 把 iLink 特有的 `typing_ticket` 和 `sendtyping(status=1/2)` 收口在插件内，不污染 core。

## 方案选择

### 方案 A：直接把 CoPaw 的 typing 逻辑搬进 `weixin-channel.ts`

**优点**
- 最快能跑通。
- 参考实现路径清晰。

**缺点**
- 会把 `weixin-channel.ts` 迅速做大。
- 会把并发、缓存、停止逻辑都塞进 channel 文件。
- 没有利用好我们现有的 core typing stop control。

**结论**
- 不推荐。功能能成，但维护性目标会输。

### 方案 B：在 Weixin 插件内做一个小而专用的 typing controller，并挂到现有 core lifecycle

**优点**
- 代码最少且职责清楚。
- 协议细节留在插件内部。
- 复用已有 `createTypingStopControlMessage`，不重复造轮子。
- 后续如果 Weixin 支持流式或多段发送，也还有自然扩展点。

**缺点**
- 需要新增一个小文件。
- 需要补几条有针对性的测试。

**结论**
- 推荐。这是当前功能目标和维护性目标的最佳平衡点。

### 方案 C：把多渠道 typing 统一抽象升级到 core，再回头改 Weixin/Telegram/Discord/Feishu

**优点**
- 理论上最统一。
- 长期上限最高。

**缺点**
- 范围明显扩大。
- 会把本来单一渠道改动升级成跨包重构。
- 很容易为了“未来可能复用”提前付出过量抽象成本。

**结论**
- 暂缓。除非这轮明确要做跨渠道 typing 统一治理，否则不是当前最优解。

## 推荐设计

### 1. 保持 core 不新增新语义

直接复用现有能力：

- `@nextclaw/core` 已有 typing stop control message。
- agent loop 在“没有最终回复”时已经会发 stop control。
- channel manager 已经支持把 control message 投递给具体 channel。

因此这轮不新增新的 bus event、reply hook 或 channel lifecycle contract。

### 2. Weixin 插件内新增最小必要抽象

新增一个小型插件内控制器，例如：

- `packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-typing-controller.ts`

职责只做三件事：

- 按 `accountId + userId` 缓存 `typing_ticket`。
- 启动/刷新 typing keepalive。
- 停止 typing，并在需要时显式发送 `status=2`。

不做这些事情：

- 不负责消息发送。
- 不负责 session 路由。
- 不负责 inbound polling。
- 不做与 Weixin 无关的通用 channel 抽象。

### 3. API client 只补协议面

在 `weixin-api.client.ts` 中仅补最小协议函数：

- `fetchWeixinConfig(...)` 或 `getWeixinTypingTicket(...)`
- `sendWeixinTyping(...)`
- 统一 iLink 请求头生成（含 `X-WECHAT-UIN`）

这样 `weixin-channel.ts` 只编排“何时 start/stop”，不关心 HTTP body 细节。

### 4. Channel 只负责编排

`weixin-channel.ts` 的职责保持为：

- 入站消息到来时保存 `context_token`
- 启动 typing session
- 把消息送进 bus
- 发送最终回复
- 在 reply 成功、失败、或 control stop 时结束 typing

明确不采用 CoPaw 那种“入站启动一遍，发送前再重启一遍”的路径，除非后面发现 iLink 有真实行为限制。当前先采用“一次 session 覆盖整个 agent processing window”的更简单设计。

## 文件级落点

### 修改

- `packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-api.client.ts`
  - 补 `getconfig` / `sendtyping`
  - 收口 iLink 请求头
- `packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-channel.ts`
  - 在 inbound 时启动 typing
  - 在 outbound `send()` 后停止 typing
  - 实现 `handleControlMessage()` 响应 typing stop
- `packages/extensions/nextclaw-channel-plugin-weixin/src/index.ts`
  - 若需要导出或注册新 helper，则只做最小接线

### 新增

- `packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-typing-controller.ts`
  - ticket cache
  - active session map
  - start/stop/stopAll

### 测试

- `packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-api.client.test.ts`
- `packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-typing-controller.test.ts`
- `packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-channel.test.ts`

## 行为设计

### 入站

1. 收到微信消息。
2. 解析出 `senderId`、`context_token`。
3. 若存在 `context_token`，立即启动 typing。
4. 将 inbound message 投递到 bus。

### 正常回复

1. agent loop 处理完成，生成 outbound reply。
2. `weixin-channel.send()` 调用 `sendmessage` 发送最终文本。
3. `finally` 中停止 typing，并显式发送 `status=2`。

### 无回复

1. agent loop 返回 `null`。
2. core 自动发布 typing stop control message。
3. `weixin-channel.handleControlMessage()` 收到 stop 指令。
4. stop typing，并清理该 `accountId:userId` 的活跃 session。

### 失败

1. 如果 `getconfig` 失败，不阻断主回复链路。
2. 如果 `sendtyping` 失败，只记日志，不影响真正消息发送。
3. 如果 `sendmessage` 失败，也要执行 typing cleanup，避免残留。

## 关键设计判断

### 是否需要新增配置开关？

当前建议：**先不加**。

理由：

- 用户当前明确目标是补齐能力，不是增加配置面。
- 每多一个开关，就多 schema、UI hint、文档、测试和用户理解成本。
- 如果后面出现真实用户需求，再加 `typingIndicator` 开关也不晚。

### 是否需要做全局通用 typing framework？

当前建议：**先不做**。

理由：

- 这会把单渠道需求扩成跨包治理项目。
- 现有 core stop control 已经足够支撑这轮。
- 先把 Weixin 插件做成“局部简单、边界清晰”，比提早全局抽象更符合“代码更少”原则。

### 是否需要完全照搬 CoPaw 的 ticket/session 结构？

当前建议：**不照搬，只借鉴协议要点**。

保留：

- `typing_ticket` 缓存
- 周期性 `status=1`
- 结束时 `status=2`

不保留：

- 与我们当前 runtime 不匹配的 channel 内部编排结构
- 与媒体上传同批引入的大量额外逻辑

## 测试计划

### API client

- `getconfig` 请求体包含 `ilink_user_id`、`context_token`、`base_info`
- `sendtyping` 请求体包含 `status`
- 请求头包含 `AuthorizationType` 与 `X-WECHAT-UIN`

### typing controller

- 首次启动会获取 ticket 并立即发送一次 typing
- 活跃期间按心跳刷新
- stop 会停止定时器并发送 cancel
- 相同 `accountId:userId` 二次启动会替换旧 session
- ticket 过期后会重新获取

### channel

- inbound 消息携带 `context_token` 时启动 typing
- outbound send 成功后停止 typing
- no-reply control message 能停止 typing
- 多账号场景下 session key 不串号

## 验证 / 验收

### 最小代码验证

- 受影响插件测试通过
- `pnpm lint:maintainability:guard`

### 冒烟

- 在隔离 `NEXTCLAW_HOME` 下接入真实或可控 Weixin iLink 环境
- 发送一条消息给机器人
- 观察 AI 开始处理后微信侧出现“正在输入”
- 回复送达后输入态消失
- 构造一个 no-reply 场景，确认输入态也会消失

## 实施顺序

### Task 1: 补 Weixin API typing 协议面

**Files:**
- Modify: `packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-api.client.ts`
- Test: `packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-api.client.test.ts`

### Task 2: 实现插件内 WeixinTypingController

**Files:**
- Create: `packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-typing-controller.ts`
- Test: `packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-typing-controller.test.ts`

### Task 3: 在 WeixinChannel 挂接 typing lifecycle

**Files:**
- Modify: `packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-channel.ts`
- Test: `packages/extensions/nextclaw-channel-plugin-weixin/src/weixin-channel.test.ts`

### Task 4: 运行最小充分验证

**Files:**
- Verify only

### Task 5: 文档与迭代留痕收尾

**Files:**
- Modify: `docs/logs/<pending-iteration>/README.md`（仅在真正代码实现后）
- Optional: `packages/extensions/nextclaw-channel-plugin-weixin/README.md`

